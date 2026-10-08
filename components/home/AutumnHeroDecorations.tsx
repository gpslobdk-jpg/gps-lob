type AutumnLeafProps = {
  className: string;
  color: string;
  vein: string;
};

function AutumnLeaf({ className, color, vein }: AutumnLeafProps) {
  return (
    <svg
      aria-hidden="true"
      className={`skolegps-autumn-leaf ${className}`}
      data-autumn-motion
      focusable="false"
      viewBox="0 0 64 64"
    >
      <path d="M5 55C7 25 27 6 58 5c-2 29-22 49-53 50Z" fill={color} />
      <path d="M9 51C28 37 41 23 54 10" fill="none" stroke={vein} strokeLinecap="round" strokeWidth="3" />
      <path d="m27 35-3-10m13 1-10-2m9-7-4-7" fill="none" stroke={vein} strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

/** Decorative only: the functional hero content remains server-rendered above this layer. */
export default function AutumnHeroDecorations() {
  return (
    <div
      aria-hidden="true"
      className="skolegps-autumn-home-scene"
      data-testid="autumn-home-scene"
    >
      <span className="skolegps-autumn-haze" data-autumn-motion />
      <span className="skolegps-autumn-sun-wash" data-autumn-motion />
      <AutumnLeaf className="skolegps-autumn-leaf--one" color="#c94824" vein="#7f261a" />
      <AutumnLeaf className="skolegps-autumn-leaf--two" color="#e79b2f" vein="#98551c" />
      <AutumnLeaf className="skolegps-autumn-leaf--three" color="#a92d20" vein="#671d19" />
      <AutumnLeaf className="skolegps-autumn-leaf--four" color="#efb043" vein="#9e5d1c" />
    </div>
  );
}
