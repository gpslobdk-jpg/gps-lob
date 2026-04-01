"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AudioContextValue = {
  isPlaying: boolean;
  setIsPlaying: (next: boolean) => void;
  toggleAudio: () => void;
};

const DashboardAudioContext = createContext<AudioContextValue | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleAudio = () => {
    setIsPlaying((current) => !current);
  };

  return (
    <DashboardAudioContext.Provider value={{ isPlaying, setIsPlaying, toggleAudio }}>
      {children}
    </DashboardAudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(DashboardAudioContext);

  if (!context) {
    throw new Error("useAudio skal bruges inde i AudioProvider.");
  }

  return context;
}
