import { useEffect, useRef, type RefObject } from "react";

export function useBuilderSaveGuidance(
  isReady: boolean,
  saveRef: RefObject<HTMLElement | null>
) {
  const wasReadyRef = useRef(isReady);

  useEffect(() => {
    if (isReady && !wasReadyRef.current) {
      saveRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    wasReadyRef.current = isReady;
  }, [isReady, saveRef]);

  return { shouldHighlight: isReady };
}
