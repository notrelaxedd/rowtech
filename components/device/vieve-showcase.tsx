import { VieveDevice } from "./vieve-device";

/** Vieve, drawn. Its own module so the marketing page can load it as an island. */
export function VieveShowcase() {
  return <VieveDevice idPrefix="vieve-hero" className="block h-auto w-full" />;
}
