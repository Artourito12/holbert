// Composant créé pour Holbert (n'existe pas dans Heldert) — style Heldert :
// tokens sémantiques, trait fin, typo IBM Plex Sans. Cf. docs/01 §4.2.
interface ScoreGaugeProps {
  /** Score 0 (aucun risque) à 100 (critique). */
  score: number;
  size?: number;
  label?: string;
}

function couleur(score: number) {
  if (score >= 67) return "var(--color-error-500)";
  if (score >= 34) return "var(--color-warning-500)";
  return "var(--color-success-500)";
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = 140, label }) => {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 56;
  const circ = 2 * Math.PI * r;
  // Arc de 270° ouvert en bas
  const arc = circ * 0.75;

  return (
    <div className="inline-flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={`Score ${clamped} sur 100`}>
        <g transform="rotate(135 70 70)">
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke="var(--color-gray-100)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`}
          />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke={couleur(clamped)} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${(arc * clamped) / 100} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </g>
        <text
          x="70" y="66" textAnchor="middle"
          className="fill-gray-900 dark:fill-white"
          style={{ fontSize: 30, fontWeight: 600, fontFamily: "inherit" }}
        >
          {clamped}
        </text>
        <text
          x="70" y="86" textAnchor="middle"
          className="fill-gray-400"
          style={{ fontSize: 12, fontFamily: "inherit" }}
        >
          / 100
        </text>
      </svg>
      {label && (
        <span className="-mt-3 text-xs font-medium uppercase text-gray-400">{label}</span>
      )}
    </div>
  );
};

export default ScoreGauge;
