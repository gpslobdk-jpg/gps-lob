import type { SubjectAssignmentMap } from "./SkemaPilotSubjectAssignment";
import type { ManualChange } from "./skemaPilotPreviewData";

export const DRAFT_STORAGE_KEY = "skemapilot.localDraft.v1";
const DRAFT_VERSION = 1 as const;

type PriorityLevel = "Lav" | "Middel" | "Høj";

export type DraftSchoolSettings = {
  schoolName: string;
  schoolYear: string;
  schoolType: string;
  schoolStructure: string;
  gradeFrom: string;
  gradeTo: string;
  lessonsPerDay: string;
  lessonMinutes: string;
  startTime: string;
  endTime: string;
};

export type DraftTeacher = {
  id: string;
  name: string;
  subjects: string;
  wishes: string;
};

export type SkemaPilotDraftData = {
  currentStep: number;
  settings: DraftSchoolSettings;
  classSelection: Record<string, boolean>;
  lessonMatrix: Record<string, Record<string, string>>;
  teachers: DraftTeacher[];
  subjectAssignments: SubjectAssignmentMap;
  roomSelection: Record<string, boolean>;
  blockSelection: Record<string, boolean>;
  extraBlocks: string[];
  priorities: Record<string, PriorityLevel>;
  manualChanges: ManualChange[];
};

export type SkemaPilotDraft = SkemaPilotDraftData & {
  version: 1;
  savedAt: string;
};

export type SaveDraftResult = { ok: true; savedAt: string } | { ok: false; error: string };

export type LoadDraftResult =
  | { status: "empty" }
  | { status: "ok"; draft: SkemaPilotDraft }
  | { status: "error"; message: string };

export function saveDraft(data: SkemaPilotDraftData): SaveDraftResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "Kladde kan ikke gemmes på serveren." };
  }

  try {
    const savedAt = new Date().toISOString();
    const full: SkemaPilotDraft = { version: DRAFT_VERSION, savedAt, ...data };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(full));
    return { ok: true, savedAt };
  } catch {
    return { ok: false, error: "Kladde kunne ikke gemmes i browseren." };
  }
}

export function loadDraft(): LoadDraftResult {
  if (typeof window === "undefined") {
    return { status: "empty" };
  }

  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!raw) {
      return { status: "empty" };
    }

    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Record<string, unknown>).version !== DRAFT_VERSION
    ) {
      return {
        status: "error",
        message: "Den lokale kladde kunne ikke læses. Du kan starte forfra.",
      };
    }

    return { status: "ok", draft: parsed as SkemaPilotDraft };
  } catch {
    return {
      status: "error",
      message: "Den lokale kladde kunne ikke læses. Du kan starte forfra.",
    };
  }
}

export function deleteDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // localStorage might be unavailable — silently ignore
  }
}

export function formatDraftSavedAt(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
