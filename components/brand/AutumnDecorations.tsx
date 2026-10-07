import Mascot from "@/components/brand/Mascot";

type AutumnDecorationsProps = {
  className?: string;
  variant: "dashboard-hero" | "home-hero" | "home-section";
};

type AutumnMascotProps = {
  className?: string;
  size?: "lg" | "md" | "sm";
  variant?: "celebrate" | "guide" | "wave";
};

function Pumpkin({ className = "" }: { className?: string }) {
  return (
    <span className={`skolegps-autumn-pumpkin ${className}`}>
      <span className="skolegps-autumn-pumpkin-stem" />
      <span className="skolegps-autumn-pumpkin-body" />
      <span className="skolegps-autumn-pumpkin-glow" />
    </span>
  );
}

function HarvestStack({ className = "" }: { className?: string }) {
  return (
    <span className={`skolegps-autumn-harvest-stack ${className}`}>
      <span className="skolegps-autumn-hay-bale" />
      <Pumpkin className="skolegps-autumn-harvest-pumpkin skolegps-autumn-harvest-pumpkin-back" />
      <Pumpkin className="skolegps-autumn-harvest-pumpkin skolegps-autumn-harvest-pumpkin-front" />
    </span>
  );
}

export function AutumnMascotHat({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`skolegps-autumn-mascot-hat ${className}`}>
      <span className="skolegps-autumn-mascot-hat-cone" />
      <span className="skolegps-autumn-mascot-hat-band" />
      <span className="skolegps-autumn-mascot-hat-brim" />
    </span>
  );
}

/** Decorative autumn details for the public teacher front page and teacher dashboard only. */
export function AutumnDecorations({ className = "", variant }: AutumnDecorationsProps) {
  const testId = variant === "dashboard-hero" ? "autumn-dashboard-scene" : "autumn-home-scene";

  return (
    <div
      aria-hidden="true"
      className={`skolegps-autumn-decorations skolegps-autumn-decorations-${variant} ${className}`}
      data-testid={testId}
    >
      <span className="skolegps-autumn-ember-glow" />
      <span className="skolegps-autumn-leaf skolegps-autumn-leaf-one" data-autumn-motion="leaf" />
      <span className="skolegps-autumn-leaf skolegps-autumn-leaf-two" data-autumn-motion="leaf" />
      <span className="skolegps-autumn-leaf skolegps-autumn-leaf-three" data-autumn-motion="leaf" />
      <span className="skolegps-autumn-leaf skolegps-autumn-leaf-four" data-autumn-motion="leaf" />
      <span className="skolegps-autumn-leaf skolegps-autumn-leaf-five" data-autumn-motion="leaf" />
      <HarvestStack className="skolegps-autumn-harvest-left" />
      <HarvestStack className="skolegps-autumn-harvest-right" />
    </div>
  );
}

export function AutumnMascot({ className = "", size = "sm", variant = "wave" }: AutumnMascotProps) {
  return (
    <span aria-hidden="true" className={`skolegps-autumn-mascot ${className}`} data-testid="autumn-dashboard-mascot">
      <Mascot decorative size={size} variant={variant} />
      <AutumnMascotHat />
      <span className="skolegps-autumn-mascot-scarf" />
    </span>
  );
}
