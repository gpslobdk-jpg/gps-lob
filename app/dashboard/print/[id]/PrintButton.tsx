"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-violet-500 transition"
    >
      Udskriv / Gem PDF
    </button>
  );
}
