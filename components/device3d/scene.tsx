"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, RoundedBox } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { ForceScreen } from "@/components/device/force-screen";
import { VieveScreen } from "@/components/device/vieve-screen";
import { SCREEN } from "@/components/device/screen-theme";
import type { Note3D, Rig } from "./types";

// The Force node and Vieve as 3D models, built from the concept drawings'
// own geometry (force-device.tsx, vieve-device.tsx) at 1 unit = 10 drawing
// px. The screens are the real screen components, mounted on the face as live
// DOM. The scene reports where each note's anchor lands on screen every
// frame, so the page can draw leader lines to the notes around it.

export type Kind = "force" | "vieve";

const BODY_COLOR = "#262d32";
const KEY_COLOR = "#2c353b";
const BEZEL = "#05080a";
const HIGHLIGHT = "#f76b15";

/**
 * drei's Html never renders the first instance in this scene (its root is
 * created after the first render pass, and nothing re-renders it). An empty
 * one goes first, so every real overlay renders.
 */
function FirstHtml() {
  return (
    <Html zIndexRange={[0, 0]} pointerEvents="none">
      <span />
    </Html>
  );
}

function Force({ active, notes }: { active: string | null; notes: readonly Note3D[] }) {
  const front = 13;
  return (
    <group>
      <FirstHtml />
      <RoundedBox args={[102, 74, 26]} radius={4.6} smoothness={5}>
        <meshStandardMaterial color={BODY_COLOR} roughness={0.55} metalness={0.25} />
      </RoundedBox>
      {/* screen window and the screen in it */}
      <mesh position={[-9.7, 7, front + 0.05]}>
        <boxGeometry args={[72.2, 48.8, 0.4]} />
        <meshStandardMaterial color={BEZEL} roughness={0.3} />
      </mesh>
      <Html transform distanceFactor={58.5} position={[-9.7, 7, front + 0.3]} zIndexRange={[4, 0]} pointerEvents="none">
        <div aria-hidden style={{ width: 480, height: 320 }}>
          <ForceScreen idPrefix="m3d" />
        </div>
      </Html>
      {/* seat badge */}
      <RoundedBox args={[12.4, 15, 2]} radius={0.9} smoothness={3} position={[36.6, 22.3, front + 0.6]}>
        <meshStandardMaterial color={SCREEN.trace} roughness={0.4} />
      </RoundedBox>
      <Html transform distanceFactor={40} position={[36.6, 21.8, front + 1.7]} zIndexRange={[4, 0]} pointerEvents="none">
        <div aria-hidden style={{ font: "800 96px/1 var(--font-archivo), sans-serif", fontStretch: "110%", color: "#03161a" }}>5</div>
      </Html>
      {/* keys */}
      {[2.2, -10.2, -22.6].map((y) => (
        <mesh key={y} position={[36.6, y, front + 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[5.2, 5.2, 2.2, 40]} />
          <meshStandardMaterial color={KEY_COLOR} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
      {/* link LED */}
      <mesh position={[36.6, -30.6, front + 0.3]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color={SCREEN.ok} emissive={SCREEN.ok} emissiveIntensity={1.2} />
      </mesh>
      <Html transform distanceFactor={40} position={[-33, -29.4, front + 0.2]} zIndexRange={[4, 0]} pointerEvents="none">
        <div aria-hidden style={{ font: "30px/1 var(--font-chivo-mono), monospace", letterSpacing: 10, color: SCREEN.label }}>FORCE</div>
      </Html>
      <Outlines active={active} notes={notes} />
    </group>
  );
}

function Vieve({ active, notes }: { active: string | null; notes: readonly Note3D[] }) {
  const front = 11;
  return (
    <group>
      <FirstHtml />
      <RoundedBox args={[128, 70, 22]} radius={5} smoothness={5}>
        <meshStandardMaterial color={BODY_COLOR} roughness={0.55} metalness={0.25} />
      </RoundedBox>
      <mesh position={[-19.8, 1.8, front + 0.05]}>
        <boxGeometry args={[76.4, 46.8, 0.4]} />
        <meshStandardMaterial color={BEZEL} roughness={0.3} />
      </mesh>
      <Html transform distanceFactor={37} position={[-19.8, 1.8, front + 0.3]} zIndexRange={[4, 0]} pointerEvents="none">
        <div aria-hidden style={{ width: 800, height: 480 }}>
          <VieveScreen idPrefix="v3d" />
        </div>
      </Html>
      {/* the big START / SPLIT dial */}
      <mesh position={[36.4, 12, front + 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[12, 12, 1.2, 48]} />
        <meshStandardMaterial color="#11161a" roughness={0.6} />
      </mesh>
      <mesh position={[36.4, 12, front + 2.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[11, 11, 3.2, 48]} />
        <meshStandardMaterial color="#3fd6e0" roughness={0.35} metalness={0.1} />
      </mesh>
      {/* MODE and the volume rocker */}
      <mesh position={[29.2, -14.6, front + 1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[7, 7, 2.4, 40]} />
        <meshStandardMaterial color={KEY_COLOR} roughness={0.5} metalness={0.2} />
      </mesh>
      <RoundedBox args={[10, 19, 3]} radius={4.4} smoothness={4} position={[49, -14.9, front + 1]}>
        <meshStandardMaterial color={KEY_COLOR} roughness={0.5} metalness={0.2} />
      </RoundedBox>
      <mesh position={[-38.6, 28.8, front + 0.3]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color={SCREEN.ok} emissive={SCREEN.ok} emissiveIntensity={1.2} />
      </mesh>
      <Html transform distanceFactor={40} position={[-49.6, 28.4, front + 0.2]} zIndexRange={[4, 0]} pointerEvents="none">
        <div aria-hidden style={{ font: "28px/1 var(--font-chivo-mono), monospace", letterSpacing: 12, color: SCREEN.label }}>VIEVE</div>
      </Html>
      <Outlines active={active} notes={notes} />
    </group>
  );
}

/** The active note's part, outlined in buoy orange. */
function Outlines({ active, notes }: { active: string | null; notes: readonly Note3D[] }) {
  const note = notes.find((n) => n.id === active);
  if (!note) return null;
  return <Line points={note.outline} color={HIGHLIGHT} lineWidth={2.5} />;
}

function Rigged({
  kind,
  rig,
  active,
  notes,
  onFrame,
}: {
  kind: Kind;
  rig: MutableRefObject<Rig>;
  active: string | null;
  notes: readonly Note3D[];
  onFrame: (points: Array<[number, number]>) => void;
}) {
  const group = useRef<Group>(null);
  const { camera, size } = useThree();
  const still = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const v = useMemo(() => new Vector3(), []);
  const out = useMemo<Array<[number, number]>>(() => notes.map(() => [0, 0]), [notes]);
  // Where the model is turned now; it eases toward the rig's target.
  const pose = useRef({ yaw: rig.current.targetYaw, pitch: rig.current.targetPitch });

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const r = rig.current;
    const p = pose.current;
    // Ease toward the target view; with reduced motion, go straight there.
    const k = still ? 1 : 1 - Math.exp(-dt * 7);
    p.yaw += (r.targetYaw - p.yaw) * k;
    p.pitch += (r.targetPitch - p.pitch) * k;
    g.rotation.set(p.pitch, p.yaw, 0);
    g.updateMatrixWorld();
    notes.forEach((n, i) => {
      v.set(n.anchor[0], n.anchor[1], n.anchor[2]).applyMatrix4(g.matrixWorld).project(camera);
      out[i][0] = ((v.x + 1) / 2) * size.width;
      out[i][1] = ((1 - v.y) / 2) * size.height;
    });
    onFrame(out);
  });

  return (
    <group ref={group}>
      {kind === "force" ? <Force active={active} notes={notes} /> : <Vieve active={active} notes={notes} />}
    </group>
  );
}

export default function DeviceScene({
  kind,
  rig,
  active,
  notes,
  onFrame,
  fallback,
}: {
  kind: Kind;
  rig: MutableRefObject<Rig>;
  active: string | null;
  notes: readonly Note3D[];
  onFrame: (points: Array<[number, number]>) => void;
  fallback: React.ReactNode;
}) {
  return (
    <Canvas
      camera={{ fov: 30, position: [0, 0, kind === "force" ? 200 : 250], near: 10, far: 1000 }}
      dpr={[1, 2]}
      fallback={fallback}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[80, 120, 160]} intensity={1.6} />
      <directionalLight position={[-120, -40, 80]} intensity={0.5} color="#9fd8e6" />
      <Rigged kind={kind} rig={rig} active={active} notes={notes} onFrame={onFrame} />
    </Canvas>
  );
}
