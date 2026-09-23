import { cn } from "@/lib/utils";
import { ForceDevice, FORCE_KEYS, type ForceKeyId } from "@/components/device/force-device";
import { DevicePlaceholder } from "@/components/device/device-placeholder";

// The node's three keys, against the screen they drive. Pointing at a key
// lights it on the device; there is nothing else to learn.
export const KEY_COPY: Record<ForceKeyId, { label: string; body: string }> = {
  view: {
    label: "VIEW",
    body: "Cycles what the screen shows: this stroke, the piece so far, the session. Nothing to set up afloat.",
  },
  tare: {
    label: "TARE",
    body: "Zeroes the cell before you push off. Hold it to reset the peaks and start the numbers again.",
  },
  power: {
    label: "POWER",
    body: "Hold to switch the node on or off. Sessions are saved as they're recorded, so the dock switch-off costs you nothing.",
  },
};

export function ScreenTourView({
  hot = null,
  onHot,
  idPrefix = "tour",
  placeholder = false,
}: {
  hot?: ForceKeyId | null;
  onHot?: (id: ForceKeyId | null) => void;
  idPrefix?: string;
  /** The server renders the box; the drawing arrives with the island. */
  placeholder?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14">
      <div className="rounded-xl bg-[#0b0d10] p-3 ring-1 ring-white/10 sm:p-5">
        {placeholder ? <DevicePlaceholder ratio={1180 / 800} name="FORCE" /> : <ForceDevice idPrefix={idPrefix} hot={hot} className="block h-auto w-full" />}
      </div>

      <div>
        <ul aria-label="The node's keys" className="divide-y divide-line border-y border-line">
          {FORCE_KEYS.map((k) => {
            const copy = KEY_COPY[k.id];
            const on = hot === k.id;
            return (
              <li key={k.id}>
                <button
                  type="button"
                  onPointerEnter={onHot && (() => onHot(k.id))}
                  onPointerLeave={onHot && (() => onHot(null))}
                  onFocus={onHot && (() => onHot(k.id))}
                  onBlur={onHot && (() => onHot(null))}
                  onClick={onHot && (() => onHot(on ? null : k.id))}
                  className={cn(
                    "w-full py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
                    on && "bg-white/[0.03]"
                  )}
                >
                  <span className={cn("readout flex items-center gap-2.5 text-sm transition-colors", on ? "text-trace" : "text-foreground")}>
                    <span
                      aria-hidden
                      className={cn(
                        "inline-block size-2.5 rounded-full transition-colors",
                        on ? "bg-trace shadow-[0_0_10px_rgb(34_227_239/0.8)]" : "bg-white/25"
                      )}
                    />
                    {copy.label}
                  </span>
                  <span className="mt-1.5 block text-[0.9375rem] leading-relaxed text-muted-foreground">{copy.body}</span>
                </button>
              </li>
            );
          })}
          <li className="py-4">
            <span className="readout flex items-center gap-2.5 text-sm text-ok">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]" />
              LINK LED
            </span>
            <span className="mt-1.5 block text-[0.9375rem] leading-relaxed text-muted-foreground">
              Green when the seat is linked to Vieve. The screen says the same thing, in words, along its top edge.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          The badge is a snap-in tab, 1 to 8: it sets which seat the node is, so nodes move between seats and boats with
          nothing to configure.
        </p>
      </div>
    </div>
  );
}
