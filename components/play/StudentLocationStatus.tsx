"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import type { StudentLocationState as StudentLocationStateResult } from "@/lib/location/studentLocationState";

type StudentLocationStatusProps = {
  state: StudentLocationStateResult;
  onStart: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  isStandardFlow: boolean;
  currentPostLabel?: string | null;
  canOpenCurrentPost: boolean;
  onOpenCurrentPost: () => void;
};

type StatusCardProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isRetrying?: boolean;
  children?: ReactNode;
};

const actionButtonClassName =
  "inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl border border-emerald-300/40 bg-emerald-500 px-5 py-3 text-base font-black text-slate-950 shadow-lg transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

function StatusCard({
  title,
  description,
  actionLabel,
  onAction,
  isRetrying = false,
  children,
}: StatusCardProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="w-full rounded-3xl border border-white/15 bg-slate-950/95 p-4 text-white shadow-xl sm:p-5"
    >
      <h2 className="text-lg font-black sm:text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/85 sm:text-base">{description}</p>

      {children}

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={isRetrying}
          aria-busy={isRetrying}
          className={`${actionButtonClassName} mt-4`}
        >
          {isRetrying ? "Finder placering…" : actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function ArrivedCard({
  currentPostLabel,
  onOpenCurrentPost,
}: Pick<StudentLocationStatusProps, "currentPostLabel" | "onOpenCurrentPost">) {
  const openedRef = useRef(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = useCallback(() => {
    if (openedRef.current) {
      return;
    }

    openedRef.current = true;
    setHasOpened(true);
    onOpenCurrentPost();
  }, [onOpenCurrentPost]);

  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="w-full rounded-3xl border border-emerald-300/45 bg-emerald-500 p-5 text-center text-slate-950 shadow-xl sm:p-6"
    >
      <h2 className="text-2xl font-black sm:text-3xl">Du er fremme!</h2>
      {currentPostLabel ? (
        <p className="mt-2 text-sm font-bold sm:text-base">{currentPostLabel}</p>
      ) : null}
      <button
        type="button"
        onClick={handleOpen}
        disabled={hasOpened}
        className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-lg font-black text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      >
        Åbn post
      </button>
    </section>
  );
}

export default function StudentLocationStatus({
  state,
  onStart,
  onRetry,
  isRetrying,
  isStandardFlow,
  currentPostLabel,
  canOpenCurrentPost,
  onOpenCurrentPost,
}: StudentLocationStatusProps) {
  if (!isStandardFlow) {
    return null;
  }

  if (canOpenCurrentPost) {
    return (
      <ArrivedCard
        currentPostLabel={currentPostLabel}
        onOpenCurrentPost={onOpenCurrentPost}
      />
    );
  }

  switch (state.status) {
    case "idle":
      return (
        <StatusCard
          title="Find din placering"
          description="SkoleGPS bruger din placering til at vise, hvornår du er fremme ved posten."
          actionLabel="Tillad placering"
          onAction={onStart}
          isRetrying={isRetrying}
        >
          <p className="mt-3 text-xs leading-5 text-white/60 sm:text-sm">
            Din placering bruges kun, mens du deltager i løbet.
          </p>
        </StatusCard>
      );

    case "requesting_permission":
    case "locating":
      return (
        <StatusCard
          title="Finder din placering…"
          description="Det kan tage et øjeblik. Gå gerne udenfor og hold telefonen i ro."
        />
      );

    case "weak_accuracy":
      return (
        <StatusCard
          title="GPS-signalet er lidt usikkert"
          description="Gå lidt væk fra bygninger, og vent et øjeblik."
          actionLabel="Prøv igen"
          onAction={onRetry}
          isRetrying={isRetrying}
        />
      );

    case "temporarily_unavailable":
      return (
        <StatusCard
          title="Vi mistede din placering"
          description="Vent et øjeblik, eller prøv igen."
          actionLabel="Find min placering igen"
          onAction={onRetry}
          isRetrying={isRetrying}
        />
      );

    case "timed_out":
      return (
        <StatusCard
          title="Det tager længere tid end normalt"
          description="Gå gerne udenfor, og prøv igen."
          actionLabel="Prøv igen"
          onAction={onRetry}
          isRetrying={isRetrying}
        />
      );

    case "permission_denied":
      return (
        <StatusCard
          title="Placering er slået fra"
          description="Tillad placering for SkoleGPS i browserens indstillinger, og prøv igen."
          actionLabel="Prøv igen"
          onAction={onRetry}
          isRetrying={isRetrying}
        >
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-black text-white">Sådan gør du</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-white/80">
              <li>Åbn browserens indstillinger for siden.</li>
              <li>Tillad placering.</li>
              <li>Gå tilbage og tryk “Prøv igen”.</li>
            </ol>
          </div>
        </StatusCard>
      );

    case "unsupported":
      return (
        <StatusCard
          title="Placering virker ikke i denne browser"
          description="Åbn linket i Safari, Chrome eller en anden almindelig browser."
        />
      );

    case "ready":
    case "offline":
    default:
      return null;
  }
}
