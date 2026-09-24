"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  const [picked, setPicked] = useState<string[]>([]);
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
    >
      <h2 className="type-h3 text-lg">Upload a session</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The four files a node writes (<span className="readout">meta.json</span>, <span className="readout">strokes.csv</span>,{" "}
        <span className="readout">curves.bin</span>, <span className="readout">events.csv</span>), or a zip. For several
        seats as one outing, upload one zip with each seat&rsquo;s files in a folder of its own.
      </p>

      {state.status === "error" && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm whitespace-pre-line">
          {state.message}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">Files</span>
          <input
            type="file"
            name="files"
            multiple
            required
            accept=".csv,.json,.bin,.zip"
            onChange={(e) => setPicked([...(e.target.files ?? [])].map((f) => f.name))}
            className={cn(field, "mt-1.5 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-sm file:text-foreground")}
          />
          {picked.length > 0 && (
            <span className="mt-1.5 block text-xs text-muted-foreground">{picked.length} file{picked.length === 1 ? "" : "s"}: {picked.slice(0, 6).join(", ")}{picked.length > 6 ? "…" : ""}</span>
          )}
        </label>
        <label>
          <span className="text-sm font-semibold">When was it rowed?</span>
          <input ref={when} type="datetime-local" name="recorded_local" className={cn(field, "mt-1.5")} />
        </label>
        <label>
          <span className="text-sm font-semibold">
            Boat <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input type="text" name="boat" maxLength={120} placeholder="Club VIII" className={cn(field, "mt-1.5")} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold">
            What was the piece? <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input type="text" name="title" maxLength={120} placeholder="4 x 750m, rate 28" className={cn(field, "mt-1.5")} />
        </label>
      </div>

      <button type="submit" aria-disabled={pending || undefined} className={cn(ctaPrimary, "mt-4 h-11 aria-disabled:cursor-wait aria-disabled:opacity-70")}>
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            Reading the session&hellip;
          </>
        ) : (
          <>
            <Upload aria-hidden className="size-4" />
            Upload
          </>
        )}
      </button>
    </form>
    </>
  );
}
