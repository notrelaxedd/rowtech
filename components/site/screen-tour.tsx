"use client";

import { useRef, useState } from "react";
import { SCREENS, ScreenTourView } from "./screen-tour-view";

export function ScreenTour() {
  const [i, setI] = useState(0);
  const [hot, setHot] = useState<number | null>(null);
  const [pressed, setPressed] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + SCREENS.length) % SCREENS.length;
    setI(n);
    tabs.current[n]?.focus();
  };

  return (
    <ScreenTourView
      i={i}
      hot={hot}
      pressed={pressed}
      onHot={setHot}
      onPress={(n) => {
        setHot(n);
        setPressed((p) => p + 1);
        // The middle button is NEXT on every screen, as on the device.
        if (n === 1) setI((i + 1) % SCREENS.length);
      }}
      onSelect={setI}
      onKey={onKey}
      tabRef={(n) => (el) => {
        tabs.current[n] = el;
      }}
    />
  );
}
