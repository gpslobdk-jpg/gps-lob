import Image from "next/image";

type MascotVariant =
  | "default"
  | "wave"
  | "point"
  | "thinking"
  | "celebrate"
  | "guide"
  | "head-only";

type MascotSize = "xs" | "sm" | "md" | "lg" | "hero";

type MascotProps = {
  alt?: string;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  size?: MascotSize;
  variant?: MascotVariant;
};

const sizeClasses: Record<MascotSize, string> = {
  xs: "h-12 w-12",
  sm: "h-20 w-20",
  md: "h-32 w-24 sm:h-40 sm:w-30",
  lg: "h-44 w-34 sm:h-56 sm:w-44",
  hero: "h-58 w-44 sm:h-72 sm:w-56 lg:h-82 lg:w-64",
};

const variantClasses: Record<MascotVariant, string> = {
  default: "",
  wave: "[--skolegps-mascot-rotate:-2deg]",
  point: "[--skolegps-mascot-rotate:3deg]",
  thinking: "saturate-[0.94] [--skolegps-mascot-rotate:-3deg]",
  celebrate: "drop-shadow-[0_22px_38px_rgba(14,165,233,0.3)] [--skolegps-mascot-rotate:2deg]",
  guide: "drop-shadow-[0_18px_34px_rgba(34,164,71,0.2)] [--skolegps-mascot-rotate:-1deg]",
  "head-only": "",
};

const imageSizes: Record<MascotSize, string> = {
  xs: "48px",
  sm: "80px",
  md: "(max-width: 640px) 96px, 120px",
  lg: "(max-width: 640px) 136px, 176px",
  hero: "(max-width: 640px) 176px, (max-width: 1024px) 224px, 256px",
};

export default function Mascot({
  alt = "SkoleGPS-maskotten",
  className = "",
  decorative = true,
  priority = false,
  size = "md",
  variant = "default",
}: MascotProps) {
  const isHeadOnly = variant === "head-only" || size === "xs";

  return (
    <div
      className={[
        "relative shrink-0 select-none",
        sizeClasses[size],
        isHeadOnly
          ? "overflow-hidden rounded-full border border-sky-100 bg-white shadow-[0_14px_28px_rgba(3,119,216,0.18)]"
          : "skolegps-mascot-float",
        variantClasses[variant],
        className,
      ].join(" ")}
    >
      <Image
        src="/brand/mascot/skolegps-pin.webp"
        alt={decorative ? "" : alt}
        aria-hidden={decorative ? "true" : undefined}
        fill
        priority={priority}
        sizes={imageSizes[size]}
        className={
          isHeadOnly
            ? "scale-[1.9] object-cover object-[50%_10%]"
            : "object-contain drop-shadow-[0_22px_42px_rgba(7,26,58,0.24)]"
        }
      />
    </div>
  );
}
