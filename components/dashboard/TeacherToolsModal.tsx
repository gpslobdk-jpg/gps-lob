"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useId, useRef, useState } from "react";

import { useModalFocusTrap } from "@/components/ui/useModalFocusTrap";
import { TEACHER_TOOL_FACEBOOK_GROUP_LINK } from "@/lib/teacherTools/community";
import type { ActiveTeacherTool, TeacherTool } from "@/lib/teacherTools/registry";

import { TeacherToolCard } from "./TeacherToolCard";

type CommunityInviteProps = {
  autoOpen?: boolean;
  onAlreadyMember?: () => void;
  onSnooze?: () => void;
};

type TeacherToolsModalProps = {
  description?: string;
  dialogClassName?: string;
  onToolNavigate?: (tool: ActiveTeacherTool) => void;
  title?: string;
  tools: readonly TeacherTool[];
  triggerClassName?: string;
  triggerLabel?: string;
  communityInvite?: CommunityInviteProps;
};

/**
 * A manually available dialog that can optionally be opened once by the
 * dashboard after its own quiet-state checks have passed.
 */
export function TeacherToolsModal({
  description = "Åbn et værktøj, når det passer til din undervisning.",
  dialogClassName = "",
  onToolNavigate,
  title = "Vælg et værktøj",
  tools,
  triggerClassName = "skolegps-teacher-secondary-action inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500",
  triggerLabel = "Se alle værktøjer",
  communityInvite,
}: TeacherToolsModalProps) {
  const [isManuallyOpen, setIsManuallyOpen] = useState(false);
  const [hasConsumedAutoOpen, setHasConsumedAutoOpen] = useState(false);
  const dialogId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isAutomaticallyOpen = Boolean(communityInvite?.autoOpen && !hasConsumedAutoOpen);
  const isOpen = isManuallyOpen || isAutomaticallyOpen;

  const close = useCallback((reason: "dismiss" | "member" | "navigate" = "dismiss") => {
    setIsManuallyOpen(false);
    if (communityInvite?.autoOpen) setHasConsumedAutoOpen(true);
    if (reason === "dismiss") communityInvite?.onSnooze?.();
  }, [communityInvite]);

  const open = useCallback(() => {
    setIsManuallyOpen(true);
  }, []);

  const trappedDialogRef = useModalFocusTrap<HTMLDivElement>({
    open: isOpen,
    onClose: () => close("dismiss"),
    initialFocusRef: closeButtonRef,
  });

  return (
    <>
      <button
        aria-controls={dialogId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={triggerClassName}
        onClick={open}
        type="button"
      >
        {triggerLabel}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
          <div
            className="skolegps-teacher-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close("dismiss");
            }}
          >
            <div
              aria-describedby={`${dialogId}-description`}
              aria-labelledby={`${dialogId}-title`}
              aria-modal="true"
              className={`skolegps-teacher-dialog skolegps-teacher-surface relative max-h-[min(52rem,calc(100dvh-2rem))] w-full max-w-6xl overflow-y-auto rounded-3xl p-5 sm:p-7 ${dialogClassName}`}
              id={dialogId}
              ref={trappedDialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="flex items-start justify-between gap-4 pr-12">
                <div>
                  <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">SkoleGPS-værktøjer</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)]" id={`${dialogId}-title`}>
                    {title}
                  </h2>
                  <p id={`${dialogId}-description`} className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
                </div>
                <button
                  aria-label="Luk værktøjsoversigten"
                  className="skolegps-teacher-secondary-action absolute top-5 right-5 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500 sm:top-7 sm:right-7"
                  onClick={() => close("dismiss")}
                  ref={closeButtonRef}
                  type="button"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tools.map((tool) => (
                  <TeacherToolCard
                    key={tool.id}
                    onNavigate={
                      tool.status === "active"
                        ? () => {
                            onToolNavigate?.(tool);
                            close("navigate");
                          }
                        : undefined
                    }
                    tool={tool}
                  />
                ))}
              </div>

              <section className="skolegps-teacher-surface-muted mt-6 rounded-3xl p-5" aria-labelledby={`${dialogId}-community-title`}>
                <p className="text-xs font-black tracking-[0.16em] text-sky-800 uppercase">Fællesskab</p>
                <h3 id={`${dialogId}-community-title`} className="mt-2 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">
                  Er du med i SkoleGPS.dk på Facebook?
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                  Få inspiration, opdag nye værktøjer og del dine idéer med andre undervisere.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    className="skolegps-teacher-primary-action inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-black"
                    href={TEACHER_TOOL_FACEBOOK_GROUP_LINK.href}
                    rel={TEACHER_TOOL_FACEBOOK_GROUP_LINK.rel}
                    target={TEACHER_TOOL_FACEBOOK_GROUP_LINK.target}
                  >
                    {TEACHER_TOOL_FACEBOOK_GROUP_LINK.label}
                  </a>
                  <button
                    className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-bold"
                    onClick={() => {
                      communityInvite?.onAlreadyMember?.();
                      close("member");
                    }}
                    type="button"
                  >
                    Jeg er allerede medlem
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-bold text-sky-800 transition hover:bg-sky-50"
                    onClick={() => close("dismiss")}
                    type="button"
                  >
                    Ikke nu
                  </button>
                </div>
              </section>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
