import { POST_ORDER_MODES, type ActivePostOrderMode } from "@/lib/routes/postOrderPolicy";

type PostOrderSummaryProps = {
  mode: ActivePostOrderMode;
  postCount: number;
  participantCount: number;
  startOffsets: number[];
  actual: boolean;
  compact?: boolean;
};

export default function PostOrderSummary({
  mode,
  postCount,
  participantCount,
  startOffsets,
  actual,
  compact = false,
}: PostOrderSummaryProps) {
  const distributed = mode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR;
  const counts = Array.from({ length: Math.max(0, postCount) }, () => 0);
  startOffsets.forEach((offset) => {
    if (Number.isSafeInteger(offset) && offset >= 0 && offset < counts.length) {
      counts[offset] += 1;
    }
  });

  return (
    <section
      className={`rounded-2xl border border-emerald-200/70 bg-emerald-50/90 text-left text-emerald-950 shadow-sm ${
        compact ? "p-3" : "mt-7 p-5"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
        {actual ? "Faktisk startfordeling" : "Forventet startfordeling"}
      </p>
      <p className="mt-1 text-sm font-semibold">
        {distributed
          ? `${participantCount} hold fordeles jævnt mellem ${postCount} poster.`
          : `${participantCount} hold starter ved post 1 i samme rækkefølge.`}
      </p>
      {!actual ? (
        <p className="mt-1 text-xs text-emerald-800">
          Den endelige fordeling fastlåses, når du starter løbet.
        </p>
      ) : null}
      {distributed && counts.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map((count, index) => (
            <span
              key={index}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold"
            >
              Post {index + 1}: {count}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
