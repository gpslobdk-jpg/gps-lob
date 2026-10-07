"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  dispatchSavedMaterials,
  readSavedMaterialIds,
  writeSavedMaterialIds,
} from "@/lib/printpakker/savedMaterials";

import styles from "./PrintpakkerCatalog.module.css";

type SavedMaterialButtonProps = {
  materialId: string;
};

export function SavedMaterialButton({ materialId }: SavedMaterialButtonProps) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setSaved(readSavedMaterialIds(window.localStorage).includes(materialId));
      } catch {
        setMessage("Denne browser kan ikke gemme materialer lige nu.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [materialId]);

  function toggleSavedMaterial() {
    try {
      const ids = readSavedMaterialIds(window.localStorage);
      const nextIds = ids.includes(materialId)
        ? ids.filter((id) => id !== materialId)
        : [...ids, materialId];
      const storedIds = writeSavedMaterialIds(window.localStorage, nextIds);
      const isSaved = storedIds.includes(materialId);
      setSaved(isSaved);
      setMessage(isSaved ? "Gemt i denne browser." : "Fjernet fra Mine gemte.");
      dispatchSavedMaterials(storedIds);
    } catch {
      setMessage("Kunne ikke gemme i denne browser.");
    }
  }

  const Icon = saved ? BookmarkCheck : Bookmark;

  return (
    <div className={styles.saveControl}>
      <button
        aria-pressed={saved}
        className={styles.saveButton}
        onClick={toggleSavedMaterial}
        type="button"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        {saved ? "Gemt" : "Gem"}
      </button>
      <span aria-live="polite" className={styles.saveStatus}>{message}</span>
    </div>
  );
}
