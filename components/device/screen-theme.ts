// The device screens, in the site's colours.
//
// The mockup (Vieve V1 + Force, concept A) uses orange for live values and
// teal for link status. Translated into this site's palette the roles stay
// the same and the colours become the ones used everywhere else:
//
//   trace cyan   the live value: peak, curves, split, the race line
//   ok green     linked and healthy: Vieve link, GPS lock, mic live
//   warn amber   off the average, or off the line
//
// Screens are drawn as SVG at the panel's own pixel size, so a screen is
// crisp at any size on the page and the same component can animate.
export const SCREEN = {
  bg: "#05080a",
  panel: "#0a0e11",
  raised: "#12171b",
  line: "rgb(255 255 255 / 0.09)",
  grid: "rgb(255 255 255 / 0.06)",
  label: "#8d9aa6",
  value: "#e8edf1",
  trace: "#22e3ef",
  ok: "#3ddc6e",
  warn: "#ffa630",
  /** Fill under a force curve. */
  traceFill: "rgb(34 227 239 / 0.14)",
  warnFill: "rgb(255 166 48 / 0.16)",
} as const;

/** The node's own panel, in device pixels (3.5" ILI9488). */
export const FORCE_PANEL = { w: 480, h: 320 } as const;
/** Vieve's panel (4.3" IPS). */
export const VIEVE_PANEL = { w: 800, h: 480 } as const;

export const mono = "var(--font-geist-mono), ui-monospace, monospace";
export const sans = "var(--font-archivo), ui-sans-serif, system-ui, sans-serif";
