"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The RowTech node in 3D: the enclosure CAD (public/product/rowtech-node.glb)
// with a live screen (lib/live-screen.ts) as its display. `progress` (0..1) is
// written by the parent on scroll and read every frame, so scrolling never
// re-renders React. Until the model is ready -- or with reduced motion, or no
// WebGL -- the still render stands in.

type Pose = { rx: number; ry: number; dist: number; ty: number };
// 0: three-quarter from the button side. 1: from below, the cable port.
// 2: square on, pushed in until the screen fills the stage.
const POSES: Pose[] = [
  { rx: 0.1, ry: -0.5, dist: 1.0, ty: 0 },
  { rx: -0.75, ry: 0.55, dist: 1.05, ty: 4 },
  { rx: 0, ry: 0, dist: 0.64, ty: 0 },
];
const ease = (x: number) => x * x * (3 - 2 * x);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

function poseAt(p: number): Pose {
  // 0 -> 1 over the first 45%, hold, 1 -> 2 over the last 45%.
  const [a, b, k] =
    p < 0.45 ? [POSES[0], POSES[1], ease(p / 0.45)] : p < 0.55 ? [POSES[1], POSES[1], 0] : [POSES[1], POSES[2], ease((p - 0.55) / 0.45)];
  return { rx: mix(a.rx, b.rx, k), ry: mix(a.ry, b.ry, k), dist: mix(a.dist, b.dist, k), ty: mix(a.ty, b.ty, k) };
}

export function DeviceStage({
  progress,
  className,
}: {
  progress: React.RefObject<number>;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

    let disposed = false;
    let raf = 0;
    let visible = true;
    const cleanups: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { LiveScreen } = await import("@/lib/live-screen");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.domElement.className = "absolute inset-0 h-full w-full";
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);
      cleanups.push(() => {
        renderer.dispose();
        renderer.domElement.remove();
      });

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
      scene.environmentIntensity = 0.9;
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(80, 160, 180);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x7feff6, 1.4);
      rim.position.set(-180, -40, -80);
      scene.add(rim);

      const [gltf, screen] = await Promise.all([
        new GLTFLoader().loadAsync("/product/rowtech-node.glb"),
        LiveScreen.create(),
      ]);
      if (disposed) return;

      const shell = new THREE.MeshPhysicalMaterial({ color: 0x17191c, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.55 });
      const bezel = new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, roughness: 0.8 });
      const icons: Record<string, number> = { icon_up: 0xf0a21c, icon_down: 0xf2c81f, icon_mid: 0xa9b1b8 };
      const device = new THREE.Group();
      // The exporter nests everything under one group; transforms are baked,
      // so meshes can be lifted out as-is.
      gltf.scene.updateMatrixWorld(true);
      let anchor = new THREE.Vector3();
      const meshes: InstanceType<typeof THREE.Mesh>[] = [];
      gltf.scene.traverse((o) => {
        if (o.name === "screen") o.getWorldPosition(anchor);
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      for (const o of meshes) {
        o.material = o.name in icons ? new THREE.MeshStandardMaterial({ color: icons[o.name], roughness: 0.5 }) : o.name === "bezel" ? bezel : shell;
        o.applyMatrix4(o.parent ? o.parent.matrixWorld : new THREE.Matrix4());
        device.add(o);
      }
      anchor = anchor.clone();

      const tex = new THREE.CanvasTexture(screen.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.magFilter = THREE.NearestFilter;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(76, 50.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      glass.position.copy(anchor);
      device.add(glass);
      const cover = new THREE.Mesh(
        new THREE.PlaneGeometry(76, 50.8),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.04 })
      );
      cover.position.copy(anchor).add(new THREE.Vector3(0, 0, 0.6));
      device.add(cover);
      scene.add(device);

      const camera = new THREE.PerspectiveCamera(24, 1, 1, 4000);
      const fit = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      cleanups.push(() => ro.disconnect());

      // Cursor tilt, eased.
      const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.16;
        tilt.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.1;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));

      // Distance that fits the whole node (radius ~70 mm) in the vertical fov.
      const baseDist = 70 / Math.sin(THREE.MathUtils.degToRad(12));
      let prev = performance.now();
      const loop = (now: number) => {
        raf = 0;
        if (disposed || !visible || document.hidden) return;
        const dt = (now - prev) / 1000;
        prev = now;
        screen.step(dt);
        tex.needsUpdate = true;

        const p = Math.min(1, Math.max(0, progress.current ?? 0));
        const pose = poseAt(p);
        tilt.x += (tilt.tx - tilt.x) * 0.06;
        tilt.y += (tilt.ty - tilt.y) * 0.06;
        const idle = Math.sin(now / 1600) * 0.035 * (1 - p);
        device.rotation.set(pose.rx + tilt.y, pose.ry + tilt.x + idle, 0);
        const narrow = camera.aspect < 1 ? 1 / camera.aspect : 1;
        // Aim drifts from the node's centre to the screen's as the camera pushes in.
        const k = ease(Math.max(0, (p - 0.55) / 0.45));
        const aim = new THREE.Vector3(anchor.x * k, anchor.y * k, 0);
        camera.position.set(aim.x, aim.y + pose.ty, baseDist * pose.dist * Math.min(narrow, 1.9));
        camera.lookAt(aim);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      const onVis = () => {
        if (!document.hidden && visible && !raf) {
          prev = performance.now();
          raf = requestAnimationFrame(loop);
        }
      };
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

      // Only render while the stage is on screen.
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) {
          prev = performance.now();
          raf = requestAnimationFrame(loop);
        }
      });
      io.observe(el);
      cleanups.push(() => io.disconnect());

      raf = requestAnimationFrame(loop);
      setReady(true);
      cleanups.push(() => {
        tex.dispose();
        pmrem.dispose();
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
      });
    })().catch(() => {
      // Model or WebGL failed: the still render stays up.
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
    };
  }, [progress]);

  return (
    <div ref={host} className={cn("relative", className)}>
      <Image
        src="/product/device-hero.webp"
        alt="The RowTech node: a matte black enclosure with a 3.5-inch screen showing a live force reading over the graph of the stroke in progress, and three buttons down its right edge."
        width={1496}
        height={1030}
        priority
        sizes="(min-width: 1024px) 56vw, 100vw"
        className={cn(
          "absolute inset-0 m-auto h-auto max-h-full w-full object-contain drop-shadow-[0_40px_60px_rgb(0_0_0/0.6)] transition-opacity duration-700 ease-out",
          ready && "opacity-0"
        )}
      />
    </div>
  );
}
