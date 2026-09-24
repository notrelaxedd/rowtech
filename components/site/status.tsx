/** Where something stands, in words: built, or still being built. */
export function Status({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      <span aria-hidden className="size-2 rounded-[2px] border border-current" />
      {children}
    </p>
  );
}
