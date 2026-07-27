import type { TeacherLiveRouteParticipant } from "@/components/live/types";
import {
  POST_ORDER_MODES,
  type ActivePostOrderMode,
} from "@/lib/routes/postOrderPolicy";

type LiveRouteOverviewProps = {
  participants: TeacherLiveRouteParticipant[];
  mode: ActivePostOrderMode;
  issueCount: number;
};

function formatLatestActivity(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LiveRouteOverview({
  participants,
  mode,
  issueCount,
}: LiveRouteOverviewProps) {
  const distributed = mode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR;

  return (
    <section
      className="mt-5 rounded-3xl border border-cyan-300/20 bg-slate-950/55 p-4"
      data-testid="live-route-overview"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
          Holdenes rute
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {distributed
            ? "Holdene er fordelt på forskellige startposter og følger derefter den samme rute."
            : "Alle hold følger den samme postrækkefølge."}
        </p>
      </div>

      {issueCount > 0 ? (
        <div
          className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-xs font-medium leading-5 text-amber-100"
          role="status"
        >
          Ruten kunne ikke beregnes for {issueCount}{" "}
          {issueCount === 1 ? "deltager" : "deltagere"}. Opdatér siden, eller bed{" "}
          {issueCount === 1 ? "deltageren" : "deltagerne"} om at tilslutte sig igen.
        </div>
      ) : null}

      {participants.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
          Fordelingen vises, når deltagerne er startet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {participants.map(({ participant, overview, lastActivityAt }) => {
            const progressPercent =
              overview.totalPostCount > 0
                ? Math.round(
                    (overview.completedCount / overview.totalPostCount) * 100
                  )
                : 0;
            const latestActivity = formatLatestActivity(lastActivityAt);

            return (
              <article
                key={participant.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-white">
                      {participant.name}
                    </h4>
                    <p className="mt-1 text-xs text-slate-300">
                      {!overview.isConsistent || overview.startPostNumber === null
                        ? "Startpost ikke klar"
                        : `Startede ved post ${overview.startPostNumber}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      overview.isCompleted
                        ? "bg-emerald-300/15 text-emerald-100"
                        : "bg-cyan-300/15 text-cyan-100"
                    }`}
                  >
                    {!overview.isConsistent
                      ? "Rute ikke klar"
                      : overview.isCompleted
                      ? "Færdig"
                      : overview.nextPostNumber === null
                        ? overview.statusLabel
                        : `Næste: Post ${overview.nextPostNumber}`}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span>
                    {overview.completedCount} af {overview.totalPostCount} gennemført
                  </span>
                  {latestActivity ? <span>Senest aktiv {latestActivity}</span> : null}
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700"
                  aria-label={`${overview.completedCount} af ${overview.totalPostCount} poster gennemført`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={overview.totalPostCount}
                  aria-valuenow={overview.completedCount}
                >
                  <div
                    className="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-400"
                    style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
