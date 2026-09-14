"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused; the link stays visible and selectable.
    }
  };
  return (
    <div className="mt-5 flex max-w-xl items-stretch overflow-hidden rounded-md border border-input">
      <span className="readout min-w-0 flex-1 truncate bg-[#0b0e11] px-3.5 py-3 text-sm text-foreground select-all">{url}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-w-24 items-center justify-center gap-2 border-l border-input px-4 text-sm font-semibold transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-trace"
      >
        {copied ? <Check aria-hidden className="size-4 text-ok" /> : <Copy aria-hidden className="size-4" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
