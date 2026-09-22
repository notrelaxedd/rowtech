"use client";

import { useRef, useState } from "react";
import { SCREENS, ScreenTourView } from "./screen-tour-view";

export function ScreenTour() {
  const [i, setI] = useState(0);
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
      onSelect={setI}
      onKey={onKey}
      tabRef={(n) => (el) => {
        tabs.current[n] = el;
      }}
    />
  );
}
