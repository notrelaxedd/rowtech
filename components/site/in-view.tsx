/**
 * Marks a block for a scroll reveal. No client code of its own: the page's
 * single observer (reveals.tsx) arms it if it is below the fold and plays it
 * when it scrolls in. Rendered fully drawn until then, so nothing is ever
 * hidden without JS.
 */
export function InView({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-reveal="" className={className}>
      {children}
    </div>
  );
}
