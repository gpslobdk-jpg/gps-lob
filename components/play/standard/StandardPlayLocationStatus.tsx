"use client";

import { CheckCircle2, LocateFixed, MapPin, RefreshCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import type { StudentLocationState } from "@/lib/location/studentLocationState";

type StandardPlayLocationStatusProps = {
  state: StudentLocationState;
  postNumber: number;
  totalPosts: number;
  distanceMeters: number | null;
  isNearTarget: boolean;
  canOpenCurrentPost: boolean;
  isRetrying: boolean;
  onStart: () => void;
  onRetry: () => void;
  onOpenCurrentPost: () => void;
};

const primaryButtonClassName =
  "inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-base font-black text-slate-950 shadow-[0_14px_34px_rgba(16,185,129,0.28)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

function getDistanceLabel(
  distanceMeters: number | null,
  isNearTarget: boolean,
) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return "Finder din placering…";
  }

  if (isNearTarget) {
    return "Tæt på!";
  }

  if (distanceMeters >= 1_000) {
    return `Gå ${(distanceMeters / 1_000).toFixed(1)} km`;
  }

  return `Gå ${Math.max(1, Math.round(distanceMeters))} meter`;
}

function getStatusCopy(state: StudentLocationState) {
  switch (state.status) {
    case "idle":
      return {
        title: "Find din placering",
        description:
          "Tillad placering, så SkoleGPS kan vise, hvornår du er fremme.",
        action: "Tillad placering",
      };
    case "requesting_permission":
    case "locating":
      return {
        title: "Finder din placering…",
        description: "Gå gerne udenfor, og hold telefonen i ro et øjeblik.",
        action: null,
      };
    case "weak_accuracy":
      return {
        title: "GPS-signalet er lidt usikkert",
        description: "Gå lidt væk fra bygninger, og prøv igen.",
        action: "Prøv igen",
      };
    case "temporarily_unavailable":
      return {
        title: "Vi mistede din placering",
        description: "Vent et øjeblik, eller prøv igen.",
        action: "Find min placering igen",
      };
    case "timed_out":
      return {
        title: "Det tager længere tid end normalt",
        description: "Gå gerne udenfor, og prøv igen.",
        action: "Prøv igen",
      };
    case "permission_denied":
      return {
        title: "Placering er slået fra",
        description:
          "Tillad placering for SkoleGPS i browserens indstillinger, og prøv igen.",
        action: "Prøv igen",
      };
    case "unsupported":
      return {
        title: "Placering virker ikke her",
        description: "Åbn løbet i Safari, Chrome eller en anden almindelig browser.",
        action: null,
      };
    case "offline":
      return {
        title: "Du er offline",
        description: "Bliv på siden. Vi prøver automatisk igen.",
        action: null,
      };
    case "ready":
    default:
      return null;
  }
}

export default function StandardPlayLocationStatus({
  state,
  postNumber,
  totalPosts,
  distanceMeters,
  isNearTarget,
  canOpenCurrentPost,
  isRetrying,
  onStart,
  onRetry,
  onOpenCurrentPost,
}: StandardPlayLocationStatusProps) {
  const openedRef = useRef(false);
  const [hasOpened, setHasOpened] = useState(false);
  const statusCopy = getStatusCopy(state);
  const distanceLabel = useMemo(
    () => getDistanceLabel(distanceMeters, isNearTarget),
    [distanceMeters, isNearTarget],
  );

  const handleOpen = useCallback(() => {
    if (openedRef.current) {
      return;
    }

    openedRef.current = true;
    setHasOpened(true);
    onOpenCurrentPost();
  }, [onOpenCurrentPost]);

  if (canOpenCurrentPost) {
    return (
      <section
        role="status"
        data-testid="standard-play-arrived"
        className="w-full overflow-hidden rounded-[1.75rem] border border-emerald-200/80 bg-emerald-300 p-4 text-slate-950 shadow-[0_22px_60px_rgba(16,185,129,0.34)] sm:p-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Post {postNumber} af {totalPosts}</p>
            <h2 className="text-2xl font-black leading-tight">Du er fremme!</h2>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">Du er fremme ved posten.</p>
        <button
          type="button"
          onClick={handleOpen}
          disabled={hasOpened}
          className="mt-4 inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-lg font-black text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/90 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        >
          <MapPin aria-hidden="true" className="h-5 w-5" />
          {hasOpened ? "Åbner posten…" : "Åbn post"}
        </button>
      </section>
    );
  }

  if (statusCopy) {
    const actionHandler = state.status === "idle" ? onStart : onRetry;

    return (
      <section
        data-testid={`standard-play-location-${state.status}`}
        className="w-full overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950/96 p-4 text-white shadow-[0_22px_60px_rgba(2,6,23,0.48)] backdrop-blur-xl sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
            {isRetrying ? (
              <RefreshCcw aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            ) : (
              <LocateFixed aria-hidden="true" className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/80">
              Post {postNumber} af {totalPosts}
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
              {statusCopy.title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-white/80">
              {statusCopy.description}
            </p>
          </div>
        </div>

        {statusCopy.action ? (
          <button
            type="button"
            onClick={actionHandler}
            disabled={isRetrying}
            aria-busy={isRetrying}
            className={`${primaryButtonClassName} mt-4`}
          >
            {isRetrying ? "Finder placering…" : statusCopy.action}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      data-testid="standard-play-navigation-status"
      aria-label={`Post ${postNumber} af ${totalPosts}. ${distanceLabel}`}
      className="w-full overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950/94 p-4 text-white shadow-[0_22px_60px_rgba(2,6,23,0.46)] backdrop-blur-xl sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/80">
            Post {postNumber} af {totalPosts}
          </p>
          <p
            data-testid="standard-play-distance"
            className="mt-1 text-2xl font-black leading-tight sm:text-3xl"
          >
            {distanceLabel}
          </p>
          <p className="mt-1 text-sm text-white/72">
            {isNearTarget ? "Du er næsten fremme." : "Følg kortet til næste post."}
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg">
          <MapPin aria-hidden="true" className="h-6 w-6" />
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {state.status === "ready" ? "Placeringen er klar." : ""}
      </p>
    </section>
  );
}
