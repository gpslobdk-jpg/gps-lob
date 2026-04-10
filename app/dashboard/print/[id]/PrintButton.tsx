"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Waits until every <img data-print-image> on the page has fully loaded
 * (or errored out), then enables the print button.  This prevents the
 * browser from opening the print dialog before below-the-fold images
 * have been fetched — which is the root cause of blank images in PDF.
 */
function useImagesReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>("img[data-print-image]")
      );

      if (images.length === 0) {
        // No images on the page — nothing to wait for
        setReady(true);
        return;
      }

      const allDone = images.every((img) => img.complete && img.naturalWidth > 0);
      if (allDone) {
        if (!cancelled) setReady(true);
        return;
      }

      // Not all done yet — attach listeners to the remaining ones
      let remaining = 0;
      const onSettled = () => {
        remaining--;
        if (remaining <= 0 && !cancelled) {
          setReady(true);
        }
      };

      for (const img of images) {
        if (img.complete) continue;
        remaining++;
        img.addEventListener("load", onSettled, { once: true });
        img.addEventListener("error", onSettled, { once: true });
      }

      if (remaining === 0 && !cancelled) {
        setReady(true);
      }
    };

    // Run after a microtask so all server-rendered <img> tags are in the DOM
    requestAnimationFrame(check);

    // Safety timeout: if images haven't loaded after 15 s, unlock anyway
    const timeout = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 15_000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return ready;
}

export function PrintButton() {
  const imagesReady = useImagesReady();

  const handlePrint = useCallback(() => {
    // Give the browser one extra frame to composite after images settled
    requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  return (
    <button
      onClick={handlePrint}
      disabled={!imagesReady}
      className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-violet-500 transition disabled:opacity-50 disabled:cursor-wait"
    >
      {imagesReady ? "Udskriv / Gem PDF" : "Indlæser billeder..."}
    </button>
  );
}
