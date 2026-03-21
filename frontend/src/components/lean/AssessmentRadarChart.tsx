"use client";

// ─── RadarChart: pure SVG, 12-axis, 5-level scale ───────────────────────────
interface RadarChartProps {
  scores: number[];
  labels: string[];
  autoScores?: number[];
  maxScore?: number;
  size?: number;
  showLegend?: boolean;
}

export default function AssessmentRadarChart({
  scores,
  labels,
  autoScores,
  maxScore = 5,
  size = 320,
  showLegend = true,
}: RadarChartProps) {
  const viewBox = 340;
  const cx = viewBox / 2;
  const cy = viewBox / 2;
  const r = 120;
  const n = scores.length;
  if (n === 0) return null;
  const angleStep = (2 * Math.PI) / n;

  function polarToCart(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    };
  }

  const gridLevels = Array.from({ length: maxScore }, (_, i) => i + 1);

  function makePolygon(values: number[]): string {
    return values
      .map((s, i) => {
        const rad = (s / maxScore) * r;
        const p = polarToCart(i * angleStep, rad);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        className="mx-auto"
        style={{ width: size, maxWidth: "100%" }}
      >
        {/* Grid rings */}
        {gridLevels.map((lvl) => {
          const rad = (lvl / maxScore) * r;
          const pts = Array.from({ length: n }, (_, i) => {
            const p = polarToCart(i * angleStep, rad);
            return `${p.x},${p.y}`;
          }).join(" ");
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              className="stroke-th-border"
              strokeWidth={lvl === maxScore ? 1.5 : 0.5}
              strokeDasharray={lvl < maxScore ? "3,3" : "none"}
            />
          );
        })}

        {/* Axis lines */}
        {Array.from({ length: n }, (_, i) => {
          const p = polarToCart(i * angleStep, r);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              className="stroke-th-border"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={makePolygon(scores)}
          fill="rgba(99,102,241,0.15)"
          stroke="#6366f1"
          strokeWidth={2}
        />
        {scores.map((s, i) => {
          const rad = (s / maxScore) * r;
          const p = polarToCart(i * angleStep, rad);
          return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#6366f1" />;
        })}

        {/* Auto-score polygon (dotted) */}
        {autoScores && autoScores.length === n && (
          <>
            <polygon
              points={makePolygon(autoScores)}
              fill="rgba(245,158,11,0.08)"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            {autoScores.map((s, i) => {
              const rad = (s / maxScore) * r;
              const p = polarToCart(i * angleStep, rad);
              return (
                <circle key={`auto-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#f59e0b" />
              );
            })}
          </>
        )}

        {/* Labels */}
        {labels.map((label, i) => {
          const p = polarToCart(i * angleStep, r + 28);
          const anchor =
            p.x < cx - 10 ? "end" : p.x > cx + 10 ? "start" : "middle";
          // Wrap long labels
          const maxLen = 14;
          const display = label.length > maxLen ? label.slice(0, maxLen - 1) + "\u2026" : label;
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="central"
              className="fill-th-text-2 text-[8px] font-medium"
            >
              {display}
            </text>
          );
        })}

        {/* Level numbers on first axis */}
        {gridLevels.map((lvl) => {
          const p = polarToCart(0, (lvl / maxScore) * r);
          return (
            <text
              key={lvl}
              x={p.x + 6}
              y={p.y - 4}
              className="fill-th-text-3 text-[7px]"
            >
              {lvl}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      {showLegend && autoScores && (
        <div className="flex items-center gap-4 mt-2 text-xs text-th-text-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-indigo-500" />
            <span>Manual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed border-amber-500" />
            <span>Auto</span>
          </div>
        </div>
      )}
    </div>
  );
}
