"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useAudio } from "@/contexts/AudioContext";

function getAudioSource(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/dashboard/opret") {
    return "/forest.mp3";
  }

  return "/zen-focus.mp3";
}

export default function DashboardAudioPlayer() {
  const pathname = usePathname();
  const { isPlaying, setIsPlaying } = useAudio();
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeSourceRef = useRef<string | null>(null);
  const audioSrc = getAudioSource(pathname);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const sourceChanged = activeSourceRef.current !== audioSrc;

    if (sourceChanged) {
      if (!audio.paused) {
        audio.pause();
      }

      activeSourceRef.current = audioSrc;
      audio.src = audioSrc;
      audio.load();
    }

    if (!isPlaying) {
      if (!audio.paused) {
        audio.pause();
      }

      return;
    }

    if (!sourceChanged && !audio.paused) {
      return;
    }

    let ignoreResult = false;

    const startPlayback = async () => {
      try {
        await audio.play();
      } catch (error) {
        if (ignoreResult) {
          return;
        }

        console.error("Kunne ikke starte dashboard-lyd:", error);
        setIsPlaying(false);
      }
    };

    void startPlayback();

    return () => {
      ignoreResult = true;
    };
  }, [audioSrc, isPlaying, setIsPlaying]);

  return <audio ref={audioRef} loop preload="none" className="hidden" aria-hidden="true" playsInline />;
}
