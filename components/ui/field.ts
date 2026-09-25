import { cn } from "@/lib/utils";

// The site's form controls: a dark well with the trace focus ring. Each form
// adds its own size and spacing.

/** A text field. */
export const field =
  "block w-full rounded-md border border-input bg-[#0b0e11] text-foreground focus:border-trace focus:outline-none focus:ring-3 focus:ring-trace/25";

/** The beta and sign-in forms' larger fields, which turn red on an error. */
export const formField = cn(
  field,
  "px-3.5 text-base transition-[border-color,box-shadow] duration-150 aria-[invalid=true]:border-destructive"
);

/** A compact select in the dashboard. */
export const picker =
  "min-h-9 rounded-md border border-line bg-[#0b0e11] px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace";
