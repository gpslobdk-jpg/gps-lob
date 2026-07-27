"use client";

import {
  POST_ORDER_MODES,
  type ActivePostOrderMode,
} from "@/lib/routes/postOrderPolicy";

type PostOrderModeFieldProps = {
  value: ActivePostOrderMode;
  onChange: (value: ActivePostOrderMode) => void;
  disabled?: boolean;
};

const OPTIONS = [
  {
    value: POST_ORDER_MODES.DISTRIBUTED_CIRCULAR,
    title: "Fordel holdene på forskellige startposter",
    description:
      "Holdene starter forskellige steder og følger derefter den samme rute.",
    badge: "Anbefalet",
  },
  {
    value: POST_ORDER_MODES.FIXED,
    title: "Samme rækkefølge for alle",
    description: "Alle starter ved den samme post og følger samme rækkefølge.",
  },
] as const;

export default function PostOrderModeField({
  value,
  onChange,
  disabled = false,
}: PostOrderModeFieldProps) {
  return (
    <fieldset
      className="space-y-3 rounded-2xl border border-gray-200 bg-white/95 p-4"
      disabled={disabled}
    >
      <legend className="text-sm font-semibold text-gray-900">Postrækkefølge</legend>
      <p className="text-sm text-gray-600">
        Vælg hvordan holdene fordeles, når løbet startes.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                selected
                  ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                  : "border-gray-200 bg-white hover:border-gray-300"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="post-order-mode"
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="mt-1 h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span>
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                    {option.title}
                    {"badge" in option ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        {option.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm text-gray-600">{option.description}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
