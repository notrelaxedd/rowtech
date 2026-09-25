/**
 * The first Tab stop on a page: past the header, straight to its <main id="main">.
 * <main> isn't focusable (a click on its text would otherwise take focus and send
 * the next Tab back to the top); browsers start the next Tab from the #main
 * target instead. Hidden until it has focus. A plain
 * link, so it works without JavaScript. Sits inside a positioned parent (the
 * sticky header) or at the top of the page.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-foreground"
    >
      Skip to content
    </a>
  );
}
