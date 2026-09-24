"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { ctaPrimary, ctaSecondary } from "@/components/site/cta";
import { cn } from "@/lib/utils";
import { formField } from "@/components/ui/field";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

const EMPTY: LoginState = { status: "idle", message: "", email: "" };

export function LoginForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, EMPTY);

  if (state.status === "sent") {
    return (
      <div className="rounded-lg border border-line bg-panel p-6">
        <p className="readout inline-flex items-center gap-2.5 text-sm">
          <span aria-hidden className="size-2 rounded-full bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]" />
          <span className="text-ok">SENT</span>
        </p>
        <h2 className="type-h3 mt-4">Check your email.</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
          If <span className="text-foreground">{state.email}</span> has a dashboard account, a sign-in link is on its way.
          It works once, and only for a short while.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || state.message) && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[0.9375rem]">
          {state.message || error}
        </p>
      )}

      <form action={signInWithGoogle}>
        <button type="submit" className={cn(ctaSecondary, "w-full")}>
          <GoogleMark />
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
              Sending&hellip;
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

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-4">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.3-.2-1.9H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5Z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3Z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6Z" />
    </svg>
  );
}
