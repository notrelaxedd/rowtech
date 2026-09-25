"use client";

import { useActionState, useEffect, useRef } from "react";
import { Google_Sans } from "next/font/google";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { ctaPrimary } from "@/components/site/cta";
import { cn } from "@/lib/utils";
import { formField } from "@/components/ui/field";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

// The type Google's sign-in button is set in, for that button alone. Next has
// no size-matched fallback for it; the button's height is fixed either way.
const googleSans = Google_Sans({ weight: "500", subsets: ["latin"], adjustFontFallback: false, fallback: ["Arial", "sans-serif"] });

const EMPTY: LoginState = { status: "idle", message: "", email: "" };

export function LoginForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, EMPTY);

  if (state.status === "sent") return <Sent email={state.email} />;

  return (
    <div className="space-y-5">
      {(error || state.message) && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[0.9375rem]">
          {state.message || error}
        </p>
      )}

      <form action={signInWithGoogle}>
        {/* Google's "Sign in with Google" button, dark theme, built to its
            branding guidelines: 40px high, 12px in from each end, the
            standard "G" (public/google-g.svg, cut from Google's own button
            asset) 10px from the text, #131314 with a #8E918F edge, #E3E3E3
            type in Google Sans Medium 14/20. It takes taps over 44px high on
            a phone all the same (hit-area, A11Y-005). */}
        <button
          type="submit"
          className={cn(
            googleSans.className,
            "hit-area relative flex h-10 w-full items-center justify-center gap-2.5 rounded-[4px] border border-[#8E918F] bg-[#131314] px-3 text-sm leading-5 font-medium text-[#E3E3E3] transition-colors hover:bg-[#242425] active:bg-[#2c2c2d]"
          )}
        >
          <span aria-hidden className="size-5 shrink-0 bg-[url(/google-g.svg)] bg-contain bg-no-repeat" />
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="readout text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Outside the form: a busy region's announcements can wait until it isn't. */}
      <p aria-live="polite" className="sr-only">
        {pending ? "Sending your sign-in link…" : ""}
      </p>
      <form
        action={action}
        noValidate
        aria-busy={pending}
        className="space-y-3"
        // The button stays focusable while sending (aria-disabled), so this
        // is what stops a second send.
        onSubmit={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <label htmlFor="email" className="block text-[0.9375rem] font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={state.status === "error" || undefined}
          className={cn(formField, "h-12")}
        />
        <button type="submit" aria-disabled={pending || undefined} className={cn(ctaPrimary, "w-full aria-disabled:cursor-wait aria-disabled:opacity-70")}>
          {pending ? (
            <>
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              Sending…
            </>
          ) : (
            <>
              <Mail aria-hidden className="size-4" />
              Email me a link
              <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// Replaces the form, and the button that had focus, so focus moves to its
// heading: a screen reader reads the result, and Tab goes on from here.
function Sent({ email }: { email: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="readout inline-flex items-center gap-2.5 text-sm">
        <span aria-hidden className="size-2 rounded-full bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]" />
        <span className="text-ok">SENT</span>
      </p>
      <h2 ref={heading} tabIndex={-1} className="type-h3 mt-4 outline-none">
        Check your email.
      </h2>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
        If <span className="text-foreground">{email}</span> has a dashboard account, a sign-in link is on its way.
        It works once, and only for a short while.
      </p>
    </div>
  );
}
