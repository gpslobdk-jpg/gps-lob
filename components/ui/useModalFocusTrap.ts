"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type UseModalFocusTrapOptions = {
  open: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  lockBodyScroll?: boolean;
};

function isVisible(element: HTMLElement) {
  if (!element.isConnected) return false;
  const style = window.getComputedStyle(element);
  return element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/**
 * Keeps an existing dialog's data/actions untouched while giving it the same
 * keyboard, focus-return and scroll-lock behaviour as the teacher tool dialog.
 */
export function useModalFocusTrap<T extends HTMLElement>({
  open,
  onClose,
  initialFocusRef,
  lockBodyScroll = true,
}: UseModalFocusTrapOptions) {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const returnFocusTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    let focusFrame: number | null = null;

    if (lockBodyScroll) document.body.style.overflow = "hidden";

    focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const preferredTarget = initialFocusRef?.current;
      const fallbackTarget = getFocusableElements(dialog)[0] ?? dialog;
      const focusTarget = preferredTarget && isVisible(preferredTarget)
        ? preferredTarget
        : fallbackTarget;

      focusTarget.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;

      if (returnFocusTarget?.isConnected && isVisible(returnFocusTarget)) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef, lockBodyScroll, open]);

  return dialogRef;
}
