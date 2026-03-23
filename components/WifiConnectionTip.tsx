type WifiConnectionTipProps = {
  tone?: "dark" | "light";
  className?: string;
};

const WIFI_CONNECTION_TIP_TEXT =
  "💡 Tip: Sluk for Wi-Fi og brug mobildata! Så mister du ikke forbindelsen ude på ruten.";

export default function WifiConnectionTip({
  tone = "dark",
  className = "",
}: WifiConnectionTipProps) {
  const tones =
    tone === "light"
      ? {
          shell:
            "border-amber-300/70 bg-amber-50/90 text-amber-950 shadow-[0_20px_45px_rgba(245,158,11,0.16)]",
          text: "text-amber-950/95",
        }
      : {
          shell:
            "border-amber-300/30 bg-amber-400/12 text-amber-50 shadow-[0_18px_40px_rgba(251,191,36,0.14)]",
          text: "text-amber-50",
        };

  return (
    <aside
      className={`rounded-[1.5rem] border px-5 py-4 text-left backdrop-blur-md ${tones.shell} ${className}`.trim()}
    >
      <p className={`text-sm font-semibold leading-6 sm:text-base ${tones.text}`}>{WIFI_CONNECTION_TIP_TEXT}</p>
    </aside>
  );
}
