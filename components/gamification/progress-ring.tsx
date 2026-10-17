'use client';

export function ProgressRing({
  value,
  label,
  sub,
  size = 112,
}: {
  value: number;
  label: string;
  sub?: string;
  size?: number;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (circumference * clamped) / 100;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}, ${clamped}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1A3C34" strokeOpacity="0.15" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#C8922A"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#1A3C34" fontSize="18" fontWeight="700">
          {clamped}%
        </text>
      </svg>
      <div>
        <p className="font-heading text-xl text-foreground">{label}</p>
        {sub ? <p className="text-sm text-muted-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}
