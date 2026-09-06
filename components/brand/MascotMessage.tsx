import Mascot from "@/components/brand/Mascot";

type MascotMessageProps = {
  className?: string;
  message: string;
  title?: string;
  variant?: "default" | "wave" | "point" | "thinking" | "celebrate" | "guide";
};

export default function MascotMessage({
  className = "",
  message,
  title,
  variant = "guide",
}: MascotMessageProps) {
  return (
    <aside
      className={`flex items-center gap-3 rounded-2xl border border-sky-100 bg-white/88 p-3 text-left text-slate-900 shadow-[0_18px_42px_rgba(7,26,58,0.12)] backdrop-blur ${className}`}
    >
      <Mascot variant={variant} size="sm" />
      <div className="min-w-0">
        {title ? (
          <p className="text-[11px] font-bold uppercase text-sky-700">{title}</p>
        ) : null}
        <p className="text-sm font-semibold leading-6 text-slate-700">{message}</p>
      </div>
    </aside>
  );
}
