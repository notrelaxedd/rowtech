import { cn } from "@/lib/utils";
import { ForceDevice, FORCE_KEYS, type ForceKeyId } from "@/components/device/force-device";
import { DevicePlaceholder } from "@/components/device/device-placeholder";

// The node's keys, against the screen they drive. Pointing at a key lights it
// on the device. Only what the firmware does is described; a key without a
// confirmed description is left off the list.
export const KEY_COPY: Partial<Record<ForceKeyId, { label: string; body: string }>> = {
  view: {
    label: "VIEW",
    body: "Steps through the rower's screens: live, this stroke, and the session so far.",
  },
  tare: {
    label: "TARE",
    body: "Hold it to zero the load cell before you push off.",
  },
};

export function ScreenTourView({
  hot = null,
  onHot,
  idPrefix = "tour",
  placeholder = false,
  photo,
}: {
  hot?: ForceKeyId | null;
  onHot?: (id: ForceKeyId | null) => void;
  idPrefix?: string;
  /** The server renders the box; the drawing arrives with the island. */
  placeholder?: boolean;
  /** A photo slot shown under the keys. */
  photo?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14">
      <figure className="m-0">
        <div className="instrument rounded-lg p-3 sm:p-5">
          {placeholder ? <DevicePlaceholder ratio={1180 / 800} name="FORCE" /> : <ForceDevice idPrefix={idPrefix} hot={hot} className="block h-auto w-full" />}
        </div>
        <figcaption className="mt-3 text-sm text-muted-foreground">Force node, concept design.</figcaption>
      </figure>

      <div>
        <ul aria-label="The node's keys" className="divide-y divide-line border-y border-line">
          {FORCE_KEYS.map((k) => {
            const copy = KEY_COPY[k.id];
            if (!copy) return null;
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
                  className={cn("w-full py-4 text-left transition-colors", on && "bg-foreground/[0.04]")}
                >
                  <span className={cn("flex items-center gap-2.5 text-sm font-bold tracking-[0.04em] transition-colors", on ? "text-trace" : "text-foreground")}>
                    <span
                      aria-hidden
                      className={cn("inline-block size-2.5 rounded-full border-2 transition-colors", on ? "border-trace bg-trace" : "border-foreground/40")}
                    />
                    {copy.label}
                  </span>
                  <span className="mt-1.5 block text-[0.9375rem] leading-relaxed text-muted-foreground">{copy.body}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Each node&rsquo;s seat number is set on its own web page, counting bow as 1.
        </p>
        {photo}
      </div>
    </div>
  );
}
