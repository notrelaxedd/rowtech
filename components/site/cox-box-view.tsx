// Top-down eight: a node on every rigger, each reporting to Vieve at the
// stern. A diagram of the system in development, not a drawing of hardware,
// and still: the page keeps its one moment of motion for the hero.
const HULL = "M28 150 C 220 118, 760 116, 972 150 C 760 184, 220 182, 28 150 Z";
const SEAT_X = [236, 318, 400, 482, 564, 646, 728, 810]; // bow (1) to stroke (8)
const BOX = { x: 872, y: 150 };

export function CoxBoxView({ lit = 8 }: { /** Seats drawn on the clock, bow first. */ lit?: number }) {
  return (
    <figure className="m-0">
      <div className="instrument rounded-lg px-3 py-6 sm:px-6 sm:py-8">
        <svg
          viewBox="0 44 1000 212"
          role="img"
          aria-label="Diagram: an eight seen from above, with a RowTech node on each of the eight riggers, each reporting to Vieve, the cox box at the stern. The target is every seat on one clock, within 5 milliseconds."
          className="block h-auto w-full"
        >
          <path d={HULL} fill="#12333e" stroke="rgb(230 235 237 / 0.2)" strokeWidth={1.5} />
          <line x1={60} x2={950} y1={150} y2={150} stroke="rgb(230 235 237 / 0.07)" />

          {SEAT_X.map((x, i) => {
            const side = i % 2 === 0 ? -1 : 1; // riggers alternate sides
            const tipY = 150 + side * 96;
            const nodeY = 150 + side * 52;
            const on = i < lit;
            return (
              <g key={x}>
                <rect x={x - 13} y={142} width={26} height={16} rx={3} fill="rgb(230 235 237 / 0.08)" />
                <line x1={x - 18} x2={x} y1={150 + side * 24} y2={tipY} stroke="rgb(230 235 237 / 0.3)" strokeWidth={2} />
                <line x1={x + 18} x2={x} y1={150 + side * 24} y2={tipY} stroke="rgb(230 235 237 / 0.3)" strokeWidth={2} />
                <path
                  d={`M${x} ${nodeY} Q ${(x + BOX.x) / 2} ${nodeY + side * 34} ${BOX.x} ${BOX.y}`}
                  fill="none"
                  stroke="var(--trace)"
                  strokeWidth={1.5}
                  strokeDasharray="4 10"
                  strokeOpacity={on ? 0.6 : 0}
                />
                <rect
                  x={x - 7}
                  y={nodeY - 7}
                  width={14}
                  height={14}
                  rx={3}
                  fill={on ? "rgb(34 227 239 / 0.25)" : "#0a2029"}
                  stroke={on ? "var(--trace)" : "rgb(230 235 237 / 0.3)"}
                  strokeWidth={2}
                />
              </g>
            );
          })}

          <rect x={BOX.x - 16} y={BOX.y - 11} width={32} height={22} rx={4} fill="var(--trace)" />
        </svg>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <p className="text-sm text-muted-foreground">
            Bow to stern: <span className="font-semibold text-foreground">{lit} of 8</span>{" "}seats on Vieve&rsquo;s clock
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Target: every seat within</span>
            <span className="text-3xl font-bold tabular-nums text-trace [font-stretch:75%] sm:text-4xl">5 ms</span>
          </p>
        </div>
      </div>
    </figure>
  );
}
