"use client";

import { useState } from "react";
import type { ForceKeyId } from "@/components/device/force-device";
import { ScreenTourView } from "./screen-tour-view";

export function ScreenTour() {
  const [hot, setHot] = useState<ForceKeyId | null>(null);
  return <ScreenTourView hot={hot} onHot={setHot} idPrefix="tour" />;
}
