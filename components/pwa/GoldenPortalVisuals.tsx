import Image from "next/image";
import { useId } from "react";

import Mascot from "@/components/brand/Mascot";

type AutumnPortalMascotSize = "md" | "lg" | "hero";

export function GoldenPortalBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-testid="golden-portal-backdrop"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#030b23]"
    >
      <Image
        src="/brand/golden-portal/forest-night.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,9,33,0.18)_0%,rgba(2,8,27,0.2)_38%,rgba(2,7,22,0.62)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(255,191,72,0.12),transparent_27%),radial-gradient(circle_at_50%_20%,rgba(7,35,86,0.16),transparent_46%)]" />

      <svg className="absolute inset-0 h-full w-full opacity-75" viewBox="0 0 360 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="golden-portal-trail" x1="0" y1="1" x2="0.8" y2="0">
            <stop offset="0" stopColor="#f9c35d" stopOpacity="0.12" />
            <stop offset="0.42" stopColor="#ffe6a6" stopOpacity="0.92" />
            <stop offset="1" stopColor="#f5b448" stopOpacity="0.36" />
          </linearGradient>
        </defs>
        <path
          d="M182 790 C190 715 142 678 182 614 C224 546 160 506 198 428 C238 346 245 267 208 206"
          fill="none"
          stroke="url(#golden-portal-trail)"
          strokeLinecap="round"
          strokeWidth="2.4"
          strokeDasharray="1 13"
        />
        {[{ x: 181, y: 620 }, { x: 197, y: 426 }, { x: 215, y: 294 }].map(({ x, y }) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="7" fill="#f9c35d" fillOpacity="0.1" />
            <circle cx={x} cy={y} r="2.2" fill="#fff2ca" />
          </g>
        ))}
      </svg>

      <Image
        src="/brand/golden-portal/foreground-leaves.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-90"
      />
    </div>
  );
}

export function AutumnPortalMascot({
  size = "md",
  priority = false,
  className = "",
}: {
  size?: AutumnPortalMascotSize;
  priority?: boolean;
  className?: string;
}) {
  const scarfGradientId = useId().replace(/:/g, "");

  return (
    <div
      aria-hidden="true"
      className={`relative isolate inline-block ${className}`}
      data-testid="golden-portal-mascot"
    >
      <div className="pointer-events-none absolute inset-x-[16%] bottom-[1%] h-[12%] rounded-[50%] bg-[#010615]/55 blur-[7px]" />
      <Mascot
        size={size}
        variant="wave"
        priority={priority}
        className="relative z-10 mx-auto drop-shadow-[0_0_18px_rgba(255,204,112,0.36)]"
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
        viewBox="0 0 256 320"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={scarfGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd56a" />
            <stop offset="0.54" stopColor="#e8862f" />
            <stop offset="1" stopColor="#a9431f" />
          </linearGradient>
        </defs>
        <path
          d="M51 134c18 13 45 19 77 19 29 0 57-6 77-19l-5 24c-19 12-45 18-72 18-29 0-55-6-73-18l-4-24Z"
          fill={`url(#${scarfGradientId})`}
          stroke="#ffe7a3"
          strokeOpacity="0.68"
          strokeWidth="2"
        />
        <path
          d="M183 156c16 20 18 43 9 62-7-8-15-12-25-13 9-14 10-30 3-47l13-2Z"
          fill="#d66b28"
          stroke="#ffe08a"
          strokeOpacity="0.52"
          strokeWidth="2"
        />
        <path
          d="M107 43c7-13 17-18 26-16-4 6-3 11 2 16 6 4 12 5 18 2-2 10-10 16-21 17-8 1-16-3-25-11Z"
          fill="#d58a26"
          stroke="#ffe1a0"
          strokeOpacity="0.72"
          strokeWidth="2"
        />
        <path d="M128 31v23M116 38l20 12M139 38l-20 12" stroke="#9d4e1f" strokeOpacity="0.78" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
