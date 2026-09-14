"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { readAttribution } from "@/components/site/attribution";
import { ctaPrimary } from "@/components/site/cta";
import { cn } from "@/lib/utils";
import { submitSignup } from "./actions";
import { EMPTY_STATE, LIMITS, ROLES, SEATS, type Field, type SignupState } from "./fields";

const input =
  "block w-full rounded-md border border-input bg-[#0b0e11] px-3.5 text-base text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus:border-trace focus:outline-none focus:ring-3 focus:ring-trace/25 aria-[invalid=true]:border-destructive";
const chip =
  "relative flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-input px-4 text-[0.9375rem] text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground has-[:checked]:border-trace has-[:checked]:bg-trace/10 has-[:checked]:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-trace";

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-2 text-sm text-destructive">
      {msg}
    </p>
  );
}

export function SignupForm({ from }: { from: string }) {
  // The hidden field carries which CTA sent them; first-touch UTM/referrer is
  // added at submit time. Without JS the form still posts, minus the UTM part.
  const [state, action, pending] = useActionState(
    (prev: SignupState, fd: FormData) => {
      const first = readAttribution();
      if (first) fd.set("source", `${fd.get("source") ?? ""}&${first}`);
      return submitSignup(prev, fd);
    },
    EMPTY_STATE
  );
  const source = `from=${from}`;

  const e = state.errors;
  const v = state.values;
  const invalid = (f: Field) => (e[f] ? true : undefined);
  const describe = (f: Field) => (e[f] ? `${f}-error` : undefined);

  return (
    <form
      key={state === EMPTY_STATE ? "init" : JSON.stringify(v) + state.message}
      action={action}
      noValidate
      className="space-y-7"
    >
      {state.message && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[0.9375rem] text-foreground">
          {state.message}
        </p>
      )}

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-5">
        <div>
          <label htmlFor="name" className="text-[0.9375rem] font-semibold">
            Name
          </label>
          <input id="name" name="name" autoComplete="name" required maxLength={LIMITS.name} defaultValue={v.name} aria-invalid={invalid("name")} aria-describedby={describe("name")} className={cn(input, "mt-2 h-12")} />
          <Err id="name-error" msg={e.name} />
        </div>
        <div>
          <label htmlFor="email" className="text-[0.9375rem] font-semibold">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={LIMITS.email} defaultValue={v.email} aria-invalid={invalid("email")} aria-describedby={describe("email")} className={cn(input, "mt-2 h-12")} />
          <Err id="email-error" msg={e.email} />
        </div>
      </div>

      <fieldset aria-describedby={describe("role")}>
        <legend className="text-[0.9375rem] font-semibold">I&rsquo;m a&hellip;</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <label key={r.value} className={chip}>
              <input type="radio" name="role" value={r.value} defaultChecked={v.role === r.value} required className="sr-only" />
              {r.label}
            </label>
          ))}
        </div>
        <Err id="role-error" msg={e.role} />
      </fieldset>

      <div>
        <label htmlFor="organization" className="text-[0.9375rem] font-semibold">
          Club, school or team <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input id="organization" name="organization" autoComplete="organization" maxLength={LIMITS.organization} defaultValue={v.organization} aria-invalid={invalid("organization")} aria-describedby={describe("organization")} className={cn(input, "mt-2 h-12")} />
        <Err id="organization-error" msg={e.organization} />
      </div>

      <fieldset aria-describedby={describe("seats")}>
        <legend className="text-[0.9375rem] font-semibold">
          How many seats would you want to measure? <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEATS.map((s) => (
            <label key={s} className={cn(chip, "readout min-w-14")}>
              <input type="radio" name="seats" value={s} defaultChecked={v.seats === s} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
        <Err id="seats-error" msg={e.seats} />
      </fieldset>

      <div>
        <label htmlFor="location" className="text-[0.9375rem] font-semibold">
          Where do you row? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input id="location" name="location" placeholder="City, country" maxLength={LIMITS.location} defaultValue={v.location} aria-invalid={invalid("location")} aria-describedby={describe("location")} className={cn(input, "mt-2 h-12")} />
        <Err id="location-error" msg={e.location} />
      </div>

      <div>
        <label htmlFor="message" className="text-[0.9375rem] font-semibold">
          What would you want to learn from force data? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea id="message" name="message" rows={4} maxLength={LIMITS.message} defaultValue={v.message} aria-invalid={invalid("message")} aria-describedby={describe("message")} className={cn(input, "mt-2 resize-y py-3 leading-relaxed")} />
        <Err id="message-error" msg={e.message} />
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="source" value={source} />

      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:gap-6">
        <button type="submit" disabled={pending} className={cn(ctaPrimary, "h-13 px-7 text-base disabled:cursor-wait disabled:opacity-70")}>
          {pending ? (
            <>
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              Sending&hellip;
            </>
          ) : (
            <>
              Apply for the beta
              <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>
        <p className="text-sm text-muted-foreground">We&rsquo;ll only use this to contact you about the RowTech beta.</p>
      </div>
    </form>
  );
}
