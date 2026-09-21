"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { ActiveTeacherTool, TeacherTool } from "@/lib/teacherTools/registry";

import { TeacherToolCard } from "./TeacherToolCard";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type TeacherToolsModalProps = {
  description?: string;
  dialogClassName?: string;
  onToolNavigate?: (tool: ActiveTeacherTool) => void;
  title?: string;
  tools: readonly TeacherTool[];
  triggerClassName?: string;
  triggerLabel?: string;
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0,
  );
}

/**
 * A manually opened dialog. It does not inspect storage or open itself, so
 * teachers remain in control of when the tool overview appears.
 */
export function TeacherToolsModal({
  description = "Åbn et værktøj, når det passer til din undervisning.",
  dialogClassName = "",
  onToolNavigate,
  title = "Vælg et værktøj",
  tools,
  triggerClassName = "skolegps-teacher-secondary-action inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500",
  triggerLabel = "Se alle værktøjer",
}: TeacherToolsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    const focusTimer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [close, isOpen]);

  return (
    <>
      <button
        aria-controls={dialogId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={triggerClassName}
        onClick={open}
        ref={triggerRef}
        type="button"
      >
        {triggerLabel}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
          <div
            aria-labelledby={`${dialogId}-title`}
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(7,26,58,0.58)] p-4 sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
            role="dialog"
          >
            <div
              className={`skolegps-teacher-surface relative max-h-[min(52rem,calc(100dvh-2rem))] w-full max-w-6xl overflow-y-auto rounded-3xl p-5 sm:p-7 ${dialogClassName}`}
              id={dialogId}
              ref={dialogRef}
              tabIndex={-1}
            >
              <div className="flex items-start justify-between gap-4 pr-12">
                <div>
                  <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">SkoleGPS-værktøjer</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)]" id={`${dialogId}-title`}>
                    {title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
                </div>
                <button
                  aria-label="Luk værktøjsoversigten"
                  className="skolegps-teacher-secondary-action absolute top-5 right-5 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500 sm:top-7 sm:right-7"
                  onClick={close}
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
                            close();
                          }
                        : undefined
                    }
                    tool={tool}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
