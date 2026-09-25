"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Note3D, Rig } from "@/components/device3d/types";
import type { Kind } from "@/components/device3d/scene";

// three.js and the models are their own chunk, about 250 kB gzipped, so it is
// fetched only when someone reaches for the model: points at it or its notes,
// tabs to a note, taps it, or presses "Show the 3D model". Until the model has
// drawn its first frame (and for good without JavaScript or WebGL) the
// drawing of the device stands in, and the notes are readable on their own.
const DeviceScene = dynamic(() => import("@/components/device3d/scene"), { ssr: false });

const noSubscribe = () => () => {};

/** If the scene can't start (no WebGL, or its chunk didn't load), the drawing stays. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * A 3D model with its notes around it: notes on both sides on wide screens,
 * leader lines from each note to the part it describes, numbered markers on
 * the model. Pointing at, focusing or tapping a note outlines the part and
 * turns the model to show it. Drag the model, or use the arrow keys, to turn
 * it yourself. `poster` is the drawing shown until the model is there.
 */
export function DeviceDiagram3D({
  kind,
  notes,
  defaultView,
  label,
  caption,
  poster,
}: {
  kind: Kind;
  notes: readonly Note3D[];
  defaultView: [number, number];
  label: string;
  caption: string;
  poster: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  // live: the scene has been asked for. shown: it has drawn a frame.
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const js = useSyncExternalStore(noSubscribe, () => true, () => false);
  const on = active ?? pinned;
  const hintId = useId();

  const rig = useRef<Rig>({ targetYaw: defaultView[0], targetPitch: defaultView[1] });
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const noteEls = useRef<Array<HTMLButtonElement | null>>([]);
  const lines = useRef<Array<SVGLineElement | null>>([]);
  const dots = useRef<Array<HTMLButtonElement | null>>([]);
  const firstFrame = useRef(false);
  // "Show the 3D model": whether it was pressed, and whether it still had
  // focus when it went, so that focus can be handed on.
  const btn = useRef<HTMLButtonElement>(null);
  const pressed = useRef(false);
  const focusModel = useRef(false);
  const hadFocus = () => pressed.current && document.activeElement === btn.current;
  const load = () => setLive(true);

  // The button goes once the model is there, or once it can't be. If it was
  // pressed and focus went with it, focus moves on to the model, or failing
  // that to the first note, rather than back to the top of the page.
  useEffect(() => {
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!focusModel.current || !lost) return;
    focusModel.current = false;
    if (shown) stage.current?.focus();
    else if (failed) {
      const notesShown = wrap.current?.querySelectorAll<HTMLElement>("ol button") ?? [];
      Array.from(notesShown).find((b) => b.getClientRects().length > 0)?.focus();
    }
  }, [shown, failed]);

  // The note being looked at decides the view; with none, the model rests.
  useEffect(() => {
    const note = notes.find((n) => n.id === on);
    const [yaw, pitch] = note ? note.view : defaultView;
    rig.current.targetYaw = yaw;
    rig.current.targetPitch = pitch;
  }, [on, notes, defaultView]);

  // Every frame, the scene says where each anchor is on the stage: move the
  // markers there, and run each leader line from its note to its marker.
  const onFrame = useCallback((pts: Array<[number, number]>) => {
    if (!firstFrame.current) {
      firstFrame.current = true;
      focusModel.current = pressed.current && document.activeElement === btn.current;
      setShown(true);
    }
    const w = wrap.current, s = stage.current;
    if (!w || !s) return;
    const wr = w.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    const ox = sr.left - wr.left, oy = sr.top - wr.top;
    notes.forEach((n, i) => {
      const [px, py] = pts[i];
      const dot = dots.current[i];
      if (dot) dot.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
      const line = lines.current[i];
      const note = noteEls.current[i];
      if (!line || !note) return;
      const nr = note.getBoundingClientRect();
      const x1 = n.side === "left" ? nr.right - wr.left + 8 : nr.left - wr.left - 8;
      const y1 = nr.top - wr.top + 22;
      line.setAttribute("x1", x1.toFixed(1));
      line.setAttribute("y1", y1.toFixed(1));
      line.setAttribute("x2", (ox + px).toFixed(1));
      line.setAttribute("y2", (oy + py).toFixed(1));
    });
  }, [notes]);

  // Turning it by hand.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const turn = (dYaw: number, dPitch: number) => {
    const r = rig.current;
    r.targetYaw = Math.max(-0.85, Math.min(0.85, r.targetYaw + dYaw));
    r.targetPitch = Math.max(-0.2, Math.min(0.6, r.targetPitch + dPitch));
  };

  const hover = (id: string | null) => () => setActive(id);
  const toggle = (id: string) => setPinned((p) => (p === id ? null : id));
  const noteProps = (n: Note3D) => ({
    "aria-pressed": pinned === n.id,
    onPointerEnter: hover(n.id),
    onPointerLeave: hover(null),
    onFocus: hover(n.id),
    onBlur: hover(null),
    onClick: () => toggle(n.id),
  });

  const renderNote = (n: Note3D, i: number) => (
    <li key={n.id}>
      <button
        type="button"
        ref={(el) => {
          noteEls.current[i] = el;
        }}
        {...noteProps(n)}
        className={cn(
          "grid w-full grid-cols-[2rem_1fr] gap-3 rounded-md p-3 text-left transition-colors duration-200",
          on === n.id ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors duration-200",
            on === n.id ? "bg-buoy text-buoy-ink" : "bg-foreground/10 text-foreground"
          )}
        >
          {i + 1}
        </span>
        <span>
          <span className="block font-semibold">{n.label}</span>
          <span className="mt-1 block text-[0.9375rem] leading-relaxed text-muted-foreground">{n.body}</span>
        </span>
      </button>
    </li>
  );

  const indexed = notes.map((n, i) => ({ n, i }));
  const left = indexed.filter(({ n }) => n.side === "left");
  const right = indexed.filter(({ n }) => n.side === "right");

  return (
    <figure className="m-0">
      <div
        ref={wrap}
        onPointerEnter={(e) => e.pointerType !== "touch" && load()}
        // Focus on a note is intent enough; focus on the button isn't, until it's pressed.
        onFocusCapture={(e) => (e.target as Element) !== btn.current && load()}
        onClick={load}
        className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)_minmax(0,1fr)] lg:gap-6">
        {/* leader lines, wide screens only */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible lg:block">
          {notes.map((n, i) => (
            <line
              key={n.id}
              ref={(el) => {
                lines.current[i] = el;
              }}
              stroke={on === n.id ? "var(--buoy)" : "var(--foreground)"}
              strokeOpacity={on === n.id ? 1 : 0.35}
              strokeWidth={on === n.id ? 1.75 : 1}
            />
          ))}
        </svg>

        <ol aria-label={`${label}, left`} className="order-2 hidden space-y-2 lg:order-1 lg:block">
          {left.map(({ n, i }) => renderNote(n, i))}
        </ol>

        <div className="order-1 lg:order-2">
          <div
            ref={stage}
            // Until the model is there, the stage is just the drawing in it.
            {...(shown && {
              role: "application",
              tabIndex: 0,
              "aria-label": `3D model: ${label}`,
              "aria-describedby": hintId,
            })}
            onPointerDown={(e) => {
              if (!shown) return;
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              turn((e.clientX - drag.current.x) * 0.008, (e.clientY - drag.current.y) * 0.006);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={(e) => {
              if (!shown) return;
              const step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
              if (!step) return;
              e.preventDefault();
              turn(step[0], step[1]);
            }}
            className={cn(
              "relative aspect-[4/3] w-full touch-pan-y select-none rounded-lg",
              shown && "cursor-grab active:cursor-grabbing"
            )}
          >
            {live && !failed && (
              <SceneBoundary
                onError={() => {
                  focusModel.current = hadFocus();
                  setFailed(true);
                }}
              >
                <DeviceScene kind={kind} rig={rig} active={on} notes={notes} onFrame={onFrame} />
              </SceneBoundary>
            )}
            {!shown && <div className="absolute inset-0">{poster}</div>}
            {/* numbered markers on the model */}
            {shown &&
              notes.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  ref={(el) => {
                    dots.current[i] = el;
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerEnter={hover(n.id)}
                  onPointerLeave={hover(null)}
                  onClick={() => toggle(n.id)}
                  className={cn(
                    "absolute top-0 left-0 z-10 flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums shadow-[0_0_0_3px_rgb(10_28_35/0.6)] transition-colors duration-200",
                    on === n.id ? "bg-buoy text-buoy-ink" : "bg-foreground text-background"
                  )}
                >
                  {i + 1}
                </button>
              ))}
          </div>
          <p id={hintId} className="mt-2 min-h-4 text-center text-xs text-muted-foreground">
            {shown
              ? "Drag the model, or use the arrow keys, to turn it."
              : js &&
                !failed && (
                  <button
                    type="button"
                    ref={btn}
                    onClick={() => {
                      pressed.current = true;
                      load();
                    }}
                    className="hit-area relative underline underline-offset-4 hover:text-foreground"
                  >
                    {live ? "Loading the 3D model…" : "Show the 3D model"}
                  </button>
                )}
          </p>
        </div>

        <ol aria-label={`${label}, right`} className="order-3 hidden space-y-2 lg:block">
          {right.map(({ n, i }) => renderNote(n, i))}
        </ol>

        {/* narrow screens: every note, in order, under the model */}
        <ol aria-label={label} className="order-4 space-y-1 lg:hidden">
          {indexed.map(({ n, i }) => (
            <MobileNote key={n.id} n={n} i={i} lit={on === n.id} props={noteProps(n)} />
          ))}
        </ol>
      </div>
      <figcaption className="mt-4 text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

function MobileNote({
  n,
  i,
  lit,
  props,
}: {
  n: Note3D;
  i: number;
  lit: boolean;
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { "aria-pressed": boolean };
}) {
  return (
    <li>
      <button
        type="button"
        {...props}
        className={cn("grid w-full grid-cols-[2rem_1fr] gap-3 rounded-md p-3 text-left", lit && "bg-foreground/[0.06]")}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums",
            lit ? "bg-buoy text-buoy-ink" : "bg-foreground/10 text-foreground"
          )}
        >
          {i + 1}
        </span>
        <span>
          <span className="block font-semibold">{n.label}</span>
          <span className="mt-1 block text-[0.9375rem] leading-relaxed text-muted-foreground">{n.body}</span>
        </span>
      </button>
    </li>
  );
}
