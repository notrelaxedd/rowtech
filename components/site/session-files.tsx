// Step 3 of "how it works", for people who don't think in files: the node in
// the middle, and what comes off it over its WiFi around it. Each file is one
// of the node's real session files (LoadCellNode storage.cpp): strokes.csv,
// curves.bin and events.csv, named for what's in them.
const W = 400;
const H = 280;
const NODE = { x: 140, y: 96, w: 120, h: 88 };

const FILES = [
  { label: "Strokes", x: 34, y: 20, icon: "rows" },
  { label: "Curves", x: 302, y: 20, icon: "curve" },
  { label: "Timing", x: 168, y: 196, icon: "clock" },
] as const;
const FW = 64;
const FH = 58;

function Icon({ kind, x, y }: { kind: (typeof FILES)[number]["icon"]; x: number; y: number }) {
  const cx = x + FW / 2;
  const cy = y + FH / 2 + 2;
  if (kind === "rows")
    return (
      <g stroke="var(--foreground)" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round">
        {[0, 1, 2].map((i) => (
          <line key={i} x1={cx - 16} x2={cx + (i === 1 ? 8 : 16)} y1={cy - 9 + i * 9} y2={cy - 9 + i * 9} />
        ))}
      </g>
    );
  if (kind === "curve")
    return (
      <path
        d={`M${cx - 18} ${cy + 10} C ${cx - 10} ${cy + 10}, ${cx - 8} ${cy - 14}, ${cx} ${cy - 14} S ${cx + 10} ${cy + 10}, ${cx + 18} ${cy + 10}`}
        fill="none"
        stroke="var(--trace)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  return (
    <g fill="none" stroke="var(--foreground)" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round">
      <circle cx={cx} cy={cy} r={12} />
      <path d={`M${cx} ${cy - 7} V${cy} L${cx + 6} ${cy + 4}`} />
    </g>
  );
}

export function SessionFiles() {
  const nodeCx = NODE.x + NODE.w / 2;
  const nodeCy = NODE.y + NODE.h / 2;
  return (
    <div className="instrument w-full rounded-md p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="The Force node in the middle, with three things you download from it: strokes, the numbers for every stroke; curves, the force curve of every stroke; and timing, when everything happened."
        className="block h-auto w-full"
      >
        {/* what comes off the node, over its WiFi */}
        {FILES.map((f) => (
          <line
            key={f.label}
            x1={nodeCx}
            y1={nodeCy}
            x2={f.x + FW / 2}
            y2={f.y + FH / 2}
            stroke="var(--trace)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeDasharray="4 5"
          />
        ))}

        {/* the node */}
        <rect x={NODE.x} y={NODE.y} width={NODE.w} height={NODE.h} rx={12} fill="#1d2226" stroke="rgb(255 255 255 / 0.18)" strokeWidth={1.5} />
        <rect x={NODE.x + 9} y={NODE.y + 10} width={74} height={50} rx={4} fill="#05080a" />
        <path
          d={`M${NODE.x + 14} ${NODE.y + 50} C ${NODE.x + 26} ${NODE.y + 50}, ${NODE.x + 32} ${NODE.y + 20}, ${NODE.x + 44} ${NODE.y + 20} S ${NODE.x + 64} ${NODE.y + 50}, ${NODE.x + 78} ${NODE.y + 50}`}
          fill="none"
          stroke="var(--trace)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <rect x={NODE.x + 92} y={NODE.y + 10} width={18} height={22} rx={4} fill="var(--trace)" />
        {[42, 58, 74].map((dy) => (
          <circle key={dy} cx={NODE.x + 101} cy={NODE.y + dy} r={5} fill="#2a3237" stroke="rgb(255 255 255 / 0.2)" />
        ))}
        <text x={nodeCx - 9} y={NODE.y + 78} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} letterSpacing={3}>
          FORCE
        </text>

        {/* the three files */}
        {FILES.map((f) => (
          <g key={f.label}>
            <path
              d={`M${f.x} ${f.y + 4} a4 4 0 0 1 4 -4 H${f.x + FW - 14} L${f.x + FW} ${f.y + 14} V${f.y + FH - 4} a4 4 0 0 1 -4 4 H${f.x + 4} a4 4 0 0 1 -4 -4 Z`}
              fill="#16343f"
              stroke="rgb(230 235 237 / 0.35)"
              strokeWidth={1.5}
            />
            <path d={`M${f.x + FW - 14} ${f.y} V${f.y + 14} H${f.x + FW}`} fill="none" stroke="rgb(230 235 237 / 0.35)" strokeWidth={1.5} />
            <Icon kind={f.icon} x={f.x} y={f.y} />
            <text x={f.x + FW / 2} y={f.y + FH + 20} textAnchor="middle" fill="var(--foreground)" fontSize={15} fontWeight={600}>
              {f.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
