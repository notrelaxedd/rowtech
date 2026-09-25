"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Upload } from "lucide-react";
import { ctaPrimary } from "@/components/site/cta";
import { field as textField } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { uploadSession, type UploadState } from "./actions";

const EMPTY: UploadState = { status: "idle", message: "" };
const field = cn(textField, "px-3 py-2 text-sm");

/** Local time, formatted for datetime-local. */
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** A file's size, as a file manager shows it. */
function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Files listed by name under the picker; the rest are counted. */
const LISTED = 6;

/**
 * datetime-local gives a wall-clock time with no zone, and the server can't
 * know the browser's, so the time is turned into an instant here, in the zone
 * it was typed in, and sent as recorded_at when the form is submitted. Without
 * JavaScript only the typed time (recorded_local) is sent: blank, the server
 * takes it as now; typed, it's refused rather than read in the wrong zone.
 */
function toInstant(v: string) {
  // A date and time with no offset is read in the browser's zone.
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
}

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadSession, EMPTY);
  const [picked, setPicked] = useState<Array<{ name: string; size: number }>>([]);
  const pickedId = useId();
  const whenHint = useId();
  const when = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  // The node has no clock, so the session's date comes from here. Written to
  // the DOM rather than through state: the server can't know the local time,
  // and a default from the server would differ from the browser's.
  useEffect(() => {
    const el = when.current;
    if (el && !el.value) el.value = nowLocal();
  }, []);

  // The instant is worked out from what the field shows as the form is sent,
  // so it can't go stale: React resets the form after every submit, which
  // blanks the field (and blank means now).
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    const send = (e: FormDataEvent) => e.formData.set("recorded_at", toInstant(when.current?.value ?? ""));
    el.addEventListener("formdata", send);
    return () => el.removeEventListener("formdata", send);
  }, []);

  useEffect(() => {
    if (state.status === "ok" && state.sessionId) router.push(`/app/force/${state.sessionId}`);
  }, [state, router]);

  return (
    <>
    {/* Outside the form: a busy region's announcements can wait until it isn't. */}
    <p aria-live="polite" className="sr-only">
      {pending ? "Reading the session…" : ""}
    </p>
    <form
      ref={form}
      action={action}
      aria-busy={pending}
      className="rounded-lg border border-line bg-panel p-4 sm:p-5"
      // The button stays focusable while sending (aria-disabled), so this is
      // what stops a second upload.
      onSubmit={(e) => {
        if (pending) e.preventDefault();
      }}
      // React empties the form after every upload, the file picker included.
      onReset={() => setPicked([])}
    >
      <h2 className="type-h3 text-lg">Upload a session</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The four files a node writes (<span className="readout">meta.json</span>, <span className="readout">strokes.csv</span>,{" "}
        <span className="readout">curves.bin</span>, <span className="readout">events.csv</span>), or a zip. For several
        seats as one outing, upload one zip with each seat’s files in a folder of its own.
      </p>

      {state.status === "error" && (
        // Line breaks kept: a file's wrong header is shown under its message,
        // and broken where it must be, as it has no spaces.
        <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm whitespace-pre-line wrap-anywhere">
          <p>{state.message}</p>
          {state.errors && (
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label>
            <span className="text-sm font-semibold">Files</span>
            <input
              type="file"
              name="files"
              multiple
              required
              accept=".csv,.json,.bin,.zip"
              aria-describedby={picked.length ? pickedId : undefined}
              onChange={(e) => setPicked([...(e.target.files ?? [])].map((f) => ({ name: f.name, size: f.size })))}
              className={cn(field, "mt-1.5 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-foreground")}
            />
          </label>
          {picked.length > 0 && (
            <div id={pickedId} className="mt-1.5 text-xs text-muted-foreground wrap-anywhere">
              <p>
                {picked.length} file{picked.length === 1 ? "" : "s"}, {fileSize(picked.reduce((sum, f) => sum + f.size, 0))}
              </p>
              <ul className="mt-1 space-y-0.5">
                {picked.slice(0, LISTED).map((f, i) => (
                  <li key={i}>
                    <span className="readout">{f.name}</span>, {fileSize(f.size)}
                  </li>
                ))}
                {picked.length > LISTED && <li>and {picked.length - LISTED} more</li>}
              </ul>
            </div>
          )}
        </div>
        <div>
          <label>
            <span className="text-sm font-semibold">When was it rowed?</span>
            <input ref={when} type="datetime-local" name="recorded_local" aria-describedby={whenHint} className={cn(field, "mt-1.5")} />
          </label>
          <p id={whenHint} className="mt-1.5 text-xs text-muted-foreground">
            Defaults to now; change it if the outing was earlier.
          </p>
        </div>
        <label>
          <span className="text-sm font-semibold">
            Boat <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input type="text" name="boat" maxLength={120} placeholder="Club 8+" className={cn(field, "mt-1.5")} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">
            Session name <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input type="text" name="title" maxLength={120} placeholder="4 × 750 m, rate 28" className={cn(field, "mt-1.5")} />
        </label>
      </div>

      <button type="submit" aria-disabled={pending || undefined} className={cn(ctaPrimary, "mt-4 h-11 aria-disabled:cursor-wait aria-disabled:opacity-70")}>
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            Reading the session…
          </>
        ) : (
          <>
            <Upload aria-hidden className="size-4" />
            Upload
          </>
        )}
      </button>
      {pending && (
        // The files go up in one request, so there's no count of bytes to show.
        <div className="mt-3">
          <div role="progressbar" aria-label="Upload" className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="rt-indeterminate h-full w-1/3 rounded-full bg-trace" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">This can take a minute for large sessions.</p>
        </div>
      )}
    </form>
    </>
  );
}
