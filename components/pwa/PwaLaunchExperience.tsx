"use client";

import { useEffect, useState } from "react";

const LAUNCH_SESSION_KEY = "skolegps.pwa.launch-shown.v1";
const LAUNCH_DURATION_MS = 1_280;
const REDUCED_LAUNCH_DURATION_MS = 360;

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

let launchShownInDocument = false;

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

export default function PwaLaunchExperience({ brandName }: { brandName: string }) {
  const [launchState, setLaunchState] = useState<"hidden" | "full" | "reduced">("hidden");

  useEffect(() => {
    if (!isStandaloneApp() || launchShownInDocument) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(LAUNCH_SESSION_KEY)) {
        launchShownInDocument = true;
        return;
      }
    } catch {
      // sessionStorage can be unavailable in restricted browser modes. The
      // document-level guard still prevents repeats during client navigation.
    }

    launchShownInDocument = true;
    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      window.sessionStorage.setItem(LAUNCH_SESSION_KEY, shouldReduceMotion ? "reduced" : "full");
    } catch {
      // See the restricted-mode fallback above.
    }
    let hideTimer: number | null = null;
    const showFrame = window.requestAnimationFrame(() => {
      setLaunchState(shouldReduceMotion ? "reduced" : "full");
      hideTimer = window.setTimeout(
        () => setLaunchState("hidden"),
        shouldReduceMotion ? REDUCED_LAUNCH_DURATION_MS : LAUNCH_DURATION_MS,
      );
    });

    return () => {
      window.cancelAnimationFrame(showFrame);
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  if (launchState === "hidden") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-motion={launchState}
      data-testid="pwa-launch-experience"
      className={`pwa-launch-layer pwa-launch-${launchState}`}
    >
      <div className="pwa-launch-glow" />
      <div className="pwa-launch-mark">
        <svg viewBox="0 0 240 210" role="presentation" focusable="false">
          <defs>
            <linearGradient id="pwa-route-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#34d399" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
            <filter id="pwa-pin-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            className="pwa-launch-route"
            d="M24 178 C58 152 78 168 105 137 C132 107 145 125 175 91 C191 73 206 69 220 62"
            fill="none"
            stroke="url(#pwa-route-gradient)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <circle className="pwa-launch-destination-halo" cx="220" cy="62" r="15" fill="none" stroke="#67e8f9" strokeWidth="2" />
          <circle className="pwa-launch-destination" cx="220" cy="62" r="6" fill="#67e8f9" />

          <g className="pwa-launch-pin" filter="url(#pwa-pin-glow)">
            <circle className="pwa-launch-ripple pwa-launch-ripple-one" cx="77" cy="73" r="32" fill="none" stroke="#34d399" strokeWidth="2" />
            <circle className="pwa-launch-ripple pwa-launch-ripple-two" cx="77" cy="73" r="32" fill="none" stroke="#22d3ee" strokeWidth="2" />
            <path
              d="M77 25c-24 0-43 18-43 42 0 34 43 76 43 76s43-42 43-76c0-24-19-42-43-42Z"
              fill="#0f172a"
              stroke="url(#pwa-route-gradient)"
              strokeWidth="6"
            />
            <circle cx="77" cy="67" r="15" fill="#67e8f9" />
            <circle cx="77" cy="67" r="7" fill="#020617" />
          </g>
        </svg>
      </div>

      <div className="pwa-launch-copy">
        <p className="pwa-launch-brand">{brandName}</p>
        <p className="pwa-launch-tagline">FIND <span>•</span> LØS <span>•</span> VIDERE</p>
      </div>

      <style jsx>{`
        .pwa-launch-layer {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: grid;
          place-content: center;
          overflow: hidden;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 38%, rgba(16, 185, 129, 0.15), transparent 30%),
            linear-gradient(145deg, #020617 0%, #07152c 55%, #032f2b 140%);
          color: white;
          animation: pwa-launch-layer-exit 1.28s ease-out both;
        }

        .pwa-launch-glow {
          position: absolute;
          left: 50%;
          top: 44%;
          width: 18rem;
          height: 18rem;
          border-radius: 9999px;
          background: rgba(45, 212, 191, 0.12);
          filter: blur(70px);
          transform: translate(-50%, -50%);
        }

        .pwa-launch-mark {
          position: relative;
          width: min(68vw, 16rem);
          margin-inline: auto;
        }

        .pwa-launch-pin {
          transform-box: fill-box;
          transform-origin: center;
          animation: pwa-launch-pin-enter 0.48s cubic-bezier(0.2, 0.9, 0.2, 1.18) 0.1s both;
        }

        .pwa-launch-route {
          stroke-dasharray: 270;
          stroke-dashoffset: 270;
          animation: pwa-launch-route-draw 0.35s ease-out 0.42s forwards;
        }

        .pwa-launch-ripple {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: pwa-launch-ripple 0.42s ease-out 0.32s forwards;
        }

        .pwa-launch-ripple-two {
          animation-delay: 0.42s;
        }

        .pwa-launch-destination,
        .pwa-launch-destination-halo {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: pwa-launch-destination 0.26s ease-out 0.68s forwards;
        }

        .pwa-launch-copy {
          position: relative;
          margin-top: -0.6rem;
          text-align: center;
          opacity: 0;
          transform: translateY(8px);
          animation: pwa-launch-copy-enter 0.3s ease-out 0.78s forwards;
        }

        .pwa-launch-brand {
          font-family: var(--font-rubik), Arial, sans-serif;
          font-size: clamp(1.55rem, 7vw, 2.3rem);
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .pwa-launch-tagline {
          margin-top: 0.5rem;
          color: rgba(167, 243, 208, 0.78);
          font-size: clamp(0.64rem, 2.7vw, 0.78rem);
          font-weight: 700;
          letter-spacing: 0.28em;
        }

        .pwa-launch-tagline span {
          color: #22d3ee;
        }

        @keyframes pwa-launch-layer-exit {
          0%, 84% { opacity: 1; visibility: visible; }
          100% { opacity: 0; visibility: hidden; }
        }

        @keyframes pwa-launch-pin-enter {
          from { opacity: 0; transform: translateY(-30px) scale(0.84); }
          72% { opacity: 1; transform: translateY(3px) scale(1.03); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pwa-launch-route-draw {
          to { stroke-dashoffset: 0; }
        }

        @keyframes pwa-launch-ripple {
          from { opacity: 0.55; transform: scale(0.62); }
          to { opacity: 0; transform: scale(1.4); }
        }

        @keyframes pwa-launch-destination {
          from { opacity: 0; transform: scale(0.25); }
          70% { opacity: 1; transform: scale(1.25); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes pwa-launch-copy-enter {
          to { opacity: 1; transform: translateY(0); }
        }

        .pwa-launch-reduced {
          animation-duration: 0.36s;
        }

        .pwa-launch-reduced .pwa-launch-mark {
          display: none;
        }

        .pwa-launch-reduced .pwa-launch-copy {
          margin-top: 0;
          opacity: 1;
          transform: none;
          animation: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .pwa-launch-layer,
          .pwa-launch-pin,
          .pwa-launch-route,
          .pwa-launch-ripple,
          .pwa-launch-destination,
          .pwa-launch-destination-halo,
          .pwa-launch-copy {
            animation: none;
          }

          .pwa-launch-layer {
            opacity: 0.98;
            transition: opacity 0.12s linear;
          }
        }
      `}</style>
    </div>
  );
}
