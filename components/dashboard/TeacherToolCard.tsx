"use client";

import {
  ArrowRight,
  ChessKnight,
  Clock3,
  Compass,
  FileText,
  MapPin,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId } from "react";

import type { TeacherTool, TeacherToolIcon } from "@/lib/teacherTools/registry";

const icons: Record<TeacherToolIcon, LucideIcon> = {
  "chess-knight": ChessKnight,
  clock: Clock3,
  compass: Compass,
  "file-text": FileText,
  "map-pin": MapPin,
  presentation: Presentation,
};

type TeacherToolCardProps = {
  className?: string;
  onNavigate?: () => void;
  priority?: boolean;
  tool: TeacherTool;
};

function TeacherToolCardContent({
  headingId,
  priority,
  tool,
}: Pick<TeacherToolCardProps, "priority" | "tool"> & { headingId: string }) {
  const Icon = icons[tool.icon];

  return (
    <>
      {tool.imageSrc ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/80 bg-sky-50">
          <Image
            alt=""
            className="object-cover"
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22rem, (min-width: 640px) 42vw, 100vw"
            src={tool.imageSrc}
          />
        </div>
      ) : (
        <span className="skolegps-adventure-card-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
          <Icon aria-hidden="true" className="h-7 w-7" />
        </span>
      )}
      <h3 className="mt-4 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]" id={headingId}>
        {tool.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{tool.description}</p>
      {tool.status === "active" ? (
        <span className="skolegps-teacher-primary-action mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black">
          {tool.cta}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </span>
      ) : (
        <span className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
          <Clock3 aria-hidden="true" className="h-4 w-4" />
          {tool.cta}
        </span>
      )}
    </>
  );
}

/** A visual card that is only navigable for a verified active teacher tool. */
export function TeacherToolCard({ className = "", onNavigate, priority = false, tool }: TeacherToolCardProps) {
  const cardClassName = `skolegps-adventure-card flex min-h-80 flex-col rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(7,26,58,0.11)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500 ${className}`;
  const headingId = useId();

  if (tool.status === "coming_soon") {
    return (
      <article aria-labelledby={headingId} className={cardClassName} data-adventure-tone={tool.tone}>
        <TeacherToolCardContent headingId={headingId} priority={priority} tool={tool} />
      </article>
    );
  }

  if (tool.link.kind === "internal") {
    return (
      <Link
        aria-labelledby={headingId}
        className={cardClassName}
        data-adventure-tone={tool.tone}
        href={tool.link.href}
        onClick={onNavigate}
      >
        <TeacherToolCardContent headingId={headingId} priority={priority} tool={tool} />
      </Link>
    );
  }

  return (
    <a
      aria-labelledby={headingId}
      className={cardClassName}
      data-adventure-tone={tool.tone}
      href={tool.link.href}
      onClick={onNavigate}
      rel={tool.link.target === "_blank" ? "noopener noreferrer" : undefined}
      target={tool.link.target}
    >
      <TeacherToolCardContent headingId={headingId} priority={priority} tool={tool} />
    </a>
  );
}
