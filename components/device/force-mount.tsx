import { SCREEN, sans } from "./screen-theme";

// Where the node goes, after the mounting sheet in "Vieve V1 + Force": the
// load cell sits in the backstay, the node clamps to the stay in front of the
// rower, and the oar handle sweeps over it. Schematic, not to scale -- and it
// says so, because the fit depends on the rigger.
const W = 560;
const H = 360;

export function ForceMount({ className }: { className?: string }) {
  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Schematic, concept design: the load cell sits in the rigger's backstay and the Force node clamps to the stay in front of the rower, where the oar handle sweeps over it."
        className="block h-full w-full"
      >
        {/* hull edge */}
        <rect x={2} y={70} width={18} height={266} rx={4} fill="rgb(255 255 255 / 0.05)" />
        <path d="M20 70 L20 336" stroke="rgb(255 255 255 / 0.22)" strokeWidth={3} strokeLinecap="round" />
        <text x={26} y={352} fill={SCREEN.label} fontFamily={sans} fontSize={13} letterSpacing={0}>
          Hull
        </text>

        {/* rigger: main arm and backstay, meeting at the pin */}
        <line x1={22} y1={112} x2={438} y2={188} stroke="rgb(255 255 255 / 0.34)" strokeWidth={5} strokeLinecap="round" />
        <text x={126} y={132} fill={SCREEN.label} fontFamily={sans} fontSize={13} letterSpacing={0}>
          Main arm
        </text>
        <line x1={22} y1={310} x2={438} y2={206} stroke="rgb(255 255 255 / 0.34)" strokeWidth={5} strokeLinecap="round" />
        <text x={126} y={324} fill={SCREEN.label} fontFamily={sans} fontSize={13} letterSpacing={0}>
          Backstay
        </text>

        {/* pin and oarlock */}
        <line x1={438} y1={104} x2={438} y2={286} stroke="rgb(255 255 255 / 0.5)" strokeWidth={4} strokeLinecap="round" />
        <rect x={422} y={180} width={32} height={32} rx={5} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth={3} />
        <text x={468} y={204} fill={SCREEN.label} fontFamily={sans} fontSize={13} letterSpacing={0}>
          Pin
        </text>

        {/* the load cell, in series on the stay */}
        <g transform="translate(250 264) rotate(-14)">
          <rect x={-36} y={-16} width={72} height={32} rx={9} fill={SCREEN.trace} fillOpacity={0.18} stroke={SCREEN.trace} strokeWidth={2.5} />
          <circle cx={0} cy={0} r={7.5} fill="none" stroke={SCREEN.trace} strokeWidth={2.5} />
        </g>
        <text x={214} y={300} fill={SCREEN.trace} fontFamily={sans} fontSize={13} letterSpacing={0}>
          Load cell
        </text>

        {/* the node, clamped to the stay in front of the rower */}
        <g transform="translate(268 152) rotate(-8)">
          <rect x={-62} y={-42} width={124} height={84} rx={14} fill="#1d2226" stroke="rgb(255 255 255 / 0.18)" strokeWidth={2} />
          <rect x={-52} y={-31} width={86} height={62} rx={6} fill="#05080a" />
          <path d="M-47 20 C -31 20, -24 -20, -9 -20 C 6 -20, 13 20, 30 20" fill="none" stroke={SCREEN.trace} strokeWidth={2.5} strokeLinecap="round" />
          <rect x={40} y={-29} width={17} height={22} rx={5} fill={SCREEN.trace} />
        </g>
        <line x1={262} y1={196} x2={250} y2={246} stroke="rgb(255 255 255 / 0.3)" strokeWidth={2} strokeDasharray="4 4" />
        <text x={344} y={96} fill={SCREEN.value} fontFamily={sans} fontSize={14} letterSpacing={0}>
          Force node
        </text>
        <line x1={340} y1={92} x2={306} y2={124} stroke="rgb(255 255 255 / 0.3)" strokeWidth={1.5} />

        {/* the handle's path, which the node stays clear of */}
        <path d="M104 78 C 236 58, 360 66, 452 112" fill="none" stroke={SCREEN.ok} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="8 7" />
        <text x={104} y={44} fill={SCREEN.ok} fontFamily={sans} fontSize={13} letterSpacing={0}>
          Handle sweeps over
        </text>
      </svg>
    </figure>
  );
}
