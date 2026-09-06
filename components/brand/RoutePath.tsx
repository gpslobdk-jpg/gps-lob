type RoutePathProps = {
  className?: string;
  tone?: "blue" | "white";
};

export default function RoutePath({ className = "", tone = "blue" }: RoutePathProps) {
  const stroke = tone === "white" ? "rgba(255,255,255,0.78)" : "rgba(3,119,216,0.72)";
  const pinFill = tone === "white" ? "#ffffff" : "var(--skolegps-blue)";

  return (
    <svg
      viewBox="0 0 720 220"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
      preserveAspectRatio="none"
    >
      <path
        d="M24 168C104 78 178 75 248 128C321 183 383 174 448 105C512 37 609 42 696 92"
        fill="none"
        stroke={stroke}
        strokeWidth="7"
        strokeDasharray="12 18"
        strokeLinecap="round"
        className="skolegps-route-dash"
      />
      {[24, 248, 448, 696].map((cx, index) => (
        <g key={cx} transform={`translate(${cx} ${index === 0 ? 168 : index === 1 ? 128 : index === 2 ? 105 : 92})`}>
          <circle r="15" fill={pinFill} opacity={index === 1 ? 0.82 : 1} />
          <circle r="5" fill={tone === "white" ? "var(--skolegps-blue)" : "#ffffff"} />
        </g>
      ))}
    </svg>
  );
}
