"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { chip } from "@/components/dash/chip";
import { cn } from "@/lib/utils";
import { deleteSession } from "../actions";

/** Deletes the session after the coach confirms, then goes back to the list. */
export function DeleteSession({ id, seats }: { id: string; seats: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startDeleting] = useTransition();
  const router = useRouter();

  const remove = () => {
    const what = seats ? `this outing and its ${seats} seat${seats === 1 ? "" : "s"}` : "this session";
    if (!confirm(`Delete ${what}, with every stroke and file? This can’t be undone.`)) return;
    setMessage(null);
    startDeleting(async () => {
      const result = await deleteSession(id);
      if (result.ok) router.push("/app/force");
      else setMessage(result.message);
    });
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className={cn(chip, "inline-flex items-center gap-2 text-muted-foreground hover:text-foreground disabled:cursor-wait disabled:opacity-70")}
      >
        {pending ? (
          <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        ) : (
          <Trash2 aria-hidden className="size-3.5" />
        )}
        {pending ? "Deleting…" : "Delete session"}
      </button>
      {message && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
