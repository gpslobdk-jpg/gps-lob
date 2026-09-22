"use client";

import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  ExternalLink,
  FileUp,
  Link as LinkIcon,
  Loader2,
  Plus,
  Presentation,
  Printer,
  Save,
  Share2,
  ShieldCheck,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  OEVEKORT_MAX_CARDS_PER_SET,
  OEVEKORT_OWNER_PATH,
  moveOevekortItem,
  parseOevekortImport,
  type OevekortCardInput,
  type OevekortImportDelimiter,
} from "@/lib/oevekort";

import {
  formatOevekortDate,
  getOevekortError,
  isOevekortSet,
  isOevekortSetSummary,
  isOevekortShareStatus,
  readOevekortResponse,
  type OevekortSet,
  type OevekortSetSummary,
  type OevekortShareStatus,
} from "./types";

type DraftSet = {
  cards: OevekortCardInput[];
  title: string;
};

type ListResponse = { sets: OevekortSetSummary[] };
type SetResponse = { set: OevekortSet };
type CreateSetResponse = { set: { id: string } };
type ShareStatusResponse = { share: OevekortShareStatus | null };
type ShareCreateResponse = {
  share: OevekortShareStatus;
  shareUrl: string;
};

const inputClassName =
  "mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60";
const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(3,119,216,0.24)] transition hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60";

function createEmptyDraft(): DraftSet {
  return {
    title: "",
    cards: [{ front: "", back: "", acceptedAnswers: [] }],
  };
}

function draftFromSet(set: OevekortSet): DraftSet {
  return {
    title: set.title,
    cards: set.cards.map(({ acceptedAnswers, back, front }) => ({
      front,
      back,
      acceptedAnswers,
    })),
  };
}

function serializeDraft(draft: DraftSet) {
  return JSON.stringify(draft);
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toExpiryIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isSetResponse(value: unknown): value is SetResponse {
  if (!value || typeof value !== "object") return false;
  const set = (value as { set?: unknown }).set;
  return isOevekortSet(set);
}

function malformedSetMessage(value: unknown) {
  if (!value || typeof value !== "object") {
    return "Sættet kunne ikke læses sikkert. Prøv at åbne det igen.";
  }

  const set = (value as { set?: unknown }).set;
  if (
    set &&
    typeof set === "object" &&
    Array.isArray((set as { cards?: unknown }).cards) &&
    (set as { cards: unknown[] }).cards.length === 0
  ) {
    return "Sættet har ingen kort endnu. Vælg et andet sæt, eller prøv igen senere.";
  }

  return "Sættet kunne ikke læses sikkert. Prøv at åbne det igen.";
}

function isListResponse(value: unknown): value is ListResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { sets?: unknown }).sets) &&
      (value as { sets: unknown[] }).sets.every(isOevekortSetSummary),
  );
}

function isShareStatusResponse(value: unknown): value is ShareStatusResponse {
  if (!value || typeof value !== "object" || !("share" in value)) return false;
  const share = (value as { share?: unknown }).share;
  return share === null || isOevekortShareStatus(share);
}

function isShareCreateResponse(value: unknown): value is ShareCreateResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ShareCreateResponse>;
  return (
    isOevekortShareStatus(candidate.share) &&
    typeof candidate.shareUrl === "string" &&
    candidate.shareUrl.startsWith("http")
  );
}

function LoadingIndicator({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-slate-600" role="status">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      {label}
    </p>
  );
}

export default function OevekortTeacherClient() {
  const [sets, setSets] = useState<OevekortSetSummary[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isLoadingSet, setIsLoadingSet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagingShare, setIsManagingShare] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSet>(createEmptyDraft);
  const [savedDraftSignature, setSavedDraftSignature] = useState(() =>
    serializeDraft(createEmptyDraft()),
  );
  const [share, setShare] = useState<OevekortShareStatus | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiryValue, setExpiryValue] = useState("");
  const [savedExpiryValue, setSavedExpiryValue] = useState("");
  const [importText, setImportText] = useState("");
  const [importDelimiter, setImportDelimiter] =
    useState<OevekortImportDelimiter>("semicolon");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSummary = useMemo(
    () => sets.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets],
  );
  const hasUnsavedChanges =
    isEditorOpen && serializeDraft(draft) !== savedDraftSignature;
  const hasPendingShareExpiryInput =
    isEditorOpen &&
    Boolean(selectedSetId) &&
    expiryValue !== savedExpiryValue;
  const hasUnsavedEditorState =
    hasUnsavedChanges || hasPendingShareExpiryInput;
  const hasPendingExistingShareExpiry = Boolean(share) && hasPendingShareExpiryInput;

  const loadSets = useCallback(async () => {
    setIsLoadingSets(true);
    try {
      const { body, response } = await readOevekortResponse<ListResponse>(
        "/api/oevekort/sets",
      );
      if (!response.ok || !isListResponse(body)) {
        setError(getOevekortError(body, "Dine sæt kunne ikke hentes."));
        return;
      }
      setSets(body.sets);
    } catch {
      setError("Dine sæt kunne ikke hentes. Prøv igen.");
    } finally {
      setIsLoadingSets(false);
    }
  }, []);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  useEffect(() => {
    if (!hasUnsavedEditorState) return;

    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnAboutUnsavedChanges);
    return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
  }, [hasUnsavedEditorState]);

  useEffect(() => {
    if (!hasUnsavedEditorState) return;

    const confirmDiscard = () =>
      window.confirm(
        "Du har ændringer, der ikke er gemt. Vil du forkaste dem og fortsætte?",
      );

    const confirmPlainAnchorNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target ||
        anchor.hasAttribute("download") ||
        anchor.dataset.unsavedNavigation === "ignore"
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      if (
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }

      if (!confirmDiscard()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const confirmDashboardLeave = (event: Event) => {
      if (!confirmDiscard()) event.preventDefault();
    };

    // This capture listener also sees the dashboard shell's sidebar links. It
    // deliberately ignores new-tab/download/external actions, which cannot
    // discard the in-page draft.
    document.addEventListener("click", confirmPlainAnchorNavigation, true);
    window.addEventListener(
      "skolegps:before-dashboard-leave",
      confirmDashboardLeave,
    );

    return () => {
      document.removeEventListener("click", confirmPlainAnchorNavigation, true);
      window.removeEventListener(
        "skolegps:before-dashboard-leave",
        confirmDashboardLeave,
      );
    };
  }, [hasUnsavedEditorState]);

  const resetEditor = () => {
    const emptyDraft = createEmptyDraft();
    setSelectedSetId(null);
    setDraft(emptyDraft);
    setSavedDraftSignature(serializeDraft(emptyDraft));
    setShare(null);
    setShareUrl(null);
    setExpiryValue("");
    setSavedExpiryValue("");
    setImportText("");
    setError("");
  };

  const beginNewSet = () => {
    if (
      hasUnsavedEditorState &&
      !window.confirm("Du har ændringer, der ikke er gemt. Vil du forkaste dem og lave et nyt sæt?")
    ) {
      return;
    }
    resetEditor();
    setMessage("");
    setIsEditorOpen(true);
  };

  const openSet = async (setId: string, discardUnsavedChanges = false) => {
    if (
      !discardUnsavedChanges &&
      hasUnsavedEditorState &&
      !window.confirm("Du har ændringer, der ikke er gemt. Vil du forkaste dem og åbne sættet?")
    ) {
      return;
    }

    setIsLoadingSet(true);
    setError("");
    setMessage("");
    setShareUrl(null);

    try {
      const [setResult, shareResult] = await Promise.all([
        readOevekortResponse<SetResponse>(`/api/oevekort/sets/${setId}`),
        readOevekortResponse<ShareStatusResponse>(
          `/api/oevekort/sets/${setId}/share`,
        ),
      ]);

      if (!setResult.response.ok || !isSetResponse(setResult.body)) {
        setError(
          setResult.response.ok
            ? malformedSetMessage(setResult.body)
            : getOevekortError(setResult.body, "Sættet kunne ikke åbnes."),
        );
        return;
      }

      const nextDraft = draftFromSet(setResult.body.set);
      setSelectedSetId(setResult.body.set.id);
      setDraft(nextDraft);
      setSavedDraftSignature(serializeDraft(nextDraft));
      setIsEditorOpen(true);

      if (shareResult.response.ok && isShareStatusResponse(shareResult.body)) {
        const nextShare = shareResult.body.share;
        const nextExpiryValue = toDateTimeLocal(nextShare?.expiresAt ?? null);
        setShare(nextShare);
        setExpiryValue(nextExpiryValue);
        setSavedExpiryValue(nextExpiryValue);
      } else {
        setShare(null);
        setExpiryValue("");
        setSavedExpiryValue("");
      }
    } catch {
      setError("Sættet kunne ikke åbnes. Prøv igen.");
    } finally {
      setIsLoadingSet(false);
    }
  };

  const updateTitle = (title: string) => {
    setDraft((current) => ({ ...current, title }));
  };

  const updateCard = (
    cardIndex: number,
    field: "front" | "back",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      cards: current.cards.map((card, index) =>
        index === cardIndex ? { ...card, [field]: value } : card,
      ),
    }));
  };

  const updateAcceptedAnswers = (cardIndex: number, value: string) => {
    const acceptedAnswers = value
      .split("\n")
      .map((answer) => answer.trim())
      .filter(Boolean);

    setDraft((current) => ({
      ...current,
      cards: current.cards.map((card, index) =>
        index === cardIndex ? { ...card, acceptedAnswers } : card,
      ),
    }));
  };

  const addCard = () => {
    if (draft.cards.length >= OEVEKORT_MAX_CARDS_PER_SET) {
      setError(`Et sæt kan højst have ${OEVEKORT_MAX_CARDS_PER_SET} kort.`);
      return;
    }

    setDraft((current) => ({
      ...current,
      cards: [...current.cards, { front: "", back: "", acceptedAnswers: [] }],
    }));
  };

  const removeCard = (cardIndex: number) => {
    if (draft.cards.length <= 1) {
      setError("Et sæt skal have mindst ét kort.");
      return;
    }
    setDraft((current) => ({
      ...current,
      cards: current.cards.filter((_, index) => index !== cardIndex),
    }));
  };

  const moveCard = (cardIndex: number, direction: -1 | 1) => {
    const nextIndex = cardIndex + direction;
    if (nextIndex < 0 || nextIndex >= draft.cards.length) return;

    setDraft((current) => ({
      ...current,
      cards: moveOevekortItem(current.cards, cardIndex, nextIndex),
    }));
  };

  const importCards = () => {
    setError("");
    const parsed = parseOevekortImport(importText, importDelimiter);
    if (!parsed.ok) {
      setError(parsed.errors.slice(0, 3).map((item) => item.message).join(" "));
      return;
    }

    if (draft.cards.length + parsed.cards.length > OEVEKORT_MAX_CARDS_PER_SET) {
      setError(`Importen vil give mere end ${OEVEKORT_MAX_CARDS_PER_SET} kort i sættet.`);
      return;
    }

    setDraft((current) => ({
      ...current,
      cards: [...current.cards, ...parsed.cards],
    }));
    setImportText("");
    setMessage(`${parsed.cards.length} kort er lagt til sættet.`);
  };

  const saveSet = async () => {
    const wasEditing = Boolean(selectedSetId);
    const pendingExpiryValue = expiryValue;
    const shouldRestorePendingExpiry = hasPendingShareExpiryInput;
    setIsSaving(true);
    setError("");
    setMessage("");

    const payload = JSON.stringify({ title: draft.title, cards: draft.cards });
    const endpoint = selectedSetId
      ? `/api/oevekort/sets/${selectedSetId}`
      : "/api/oevekort/sets";
    const method = selectedSetId ? "PUT" : "POST";

    try {
      const { body, response } = await readOevekortResponse<
        SetResponse | CreateSetResponse
      >(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      const nextSet = (body as { set?: { id?: unknown } }).set;
      if (!response.ok || !nextSet || typeof nextSet.id !== "string") {
        setError(getOevekortError(body, "Sættet kunne ikke gemmes. Prøv igen."));
        return;
      }

      await loadSets();
      await openSet(nextSet.id, true);
      if (shouldRestorePendingExpiry) setExpiryValue(pendingExpiryValue);
      setMessage(wasEditing ? "Dine ændringer er gemt." : "Dit nye sæt er gemt.");
    } catch {
      setError("Sættet kunne ikke gemmes. Prøv igen.");
    } finally {
      setIsSaving(false);
    }
  };

  const copySet = async () => {
    if (!selectedSetId) return;
    if (
      hasUnsavedEditorState &&
      !window.confirm("Du har ændringer, der ikke er gemt. Vil du forkaste dem og lave en kopi af den gemte version?")
    ) {
      return;
    }
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const { body, response } = await readOevekortResponse<CreateSetResponse>(
        `/api/oevekort/sets/${selectedSetId}/copy`,
        { method: "POST" },
      );
      const copiedId = (body as { set?: { id?: unknown } }).set?.id;
      if (!response.ok || typeof copiedId !== "string") {
        setError(getOevekortError(body, "Sættet kunne ikke kopieres. Prøv igen."));
        return;
      }
      await loadSets();
      await openSet(copiedId, true);
      setMessage("Kopien er klar til at blive tilpasset.");
    } catch {
      setError("Sættet kunne ikke kopieres. Prøv igen.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSet = async () => {
    if (!selectedSetId) return;
    if (
      hasUnsavedEditorState &&
      !window.confirm("Du har ændringer, der ikke er gemt. Vil du forkaste dem og slette den gemte version?")
    ) {
      return;
    }
    if (!window.confirm("Vil du slette dette sæt og dets eventuelle delingslink?")) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const { body, response } = await readOevekortResponse(
        `/api/oevekort/sets/${selectedSetId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(getOevekortError(body, "Sættet kunne ikke slettes. Prøv igen."));
        return;
      }
      resetEditor();
      setIsEditorOpen(false);
      await loadSets();
      setMessage("Sættet er slettet.");
    } catch {
      setError("Sættet kunne ikke slettes. Prøv igen.");
    } finally {
      setIsSaving(false);
    }
  };

  const createShare = async () => {
    if (!selectedSetId) return;
    if (hasUnsavedChanges) {
      setError(
        "Gem sættet først. Delingslinket må kun pege på den gemte version af dine kort.",
      );
      return;
    }
    if (hasPendingExistingShareExpiry) {
      setError(
        "Gem udløbstidspunktet først, før du opretter et nyt delingslink.",
      );
      return;
    }
    const expiresAt = toExpiryIso(expiryValue);
    if (expiresAt === undefined) {
      setError("Vælg et gyldigt tidspunkt for udløb, eller lad feltet stå tomt.");
      return;
    }

    setIsManagingShare(true);
    setError("");
    setMessage("");
    try {
      const { body, response } = await readOevekortResponse<ShareCreateResponse>(
        `/api/oevekort/sets/${selectedSetId}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresAt }),
        },
      );
      if (!response.ok || !isShareCreateResponse(body)) {
        setError(getOevekortError(body, "Delingslinket kunne ikke oprettes."));
        return;
      }
      setShare(body.share);
      setShareUrl(body.shareUrl);
      const nextExpiryValue = toDateTimeLocal(body.share.expiresAt);
      setExpiryValue(nextExpiryValue);
      setSavedExpiryValue(nextExpiryValue);
      await loadSets();
      setMessage("Et nyt delingslink er klar. Det vises kun denne gang.");
    } catch {
      setError("Delingslinket kunne ikke oprettes. Prøv igen.");
    } finally {
      setIsManagingShare(false);
    }
  };

  const updateShareExpiry = async () => {
    if (!selectedSetId || !share) return;
    if (hasUnsavedChanges) {
      setError(
        "Gem sættet først, før du ændrer delingen. Delingslinket må kun pege på den gemte version af dine kort.",
      );
      return;
    }
    const expiresAt = toExpiryIso(expiryValue);
    if (expiresAt === undefined) {
      setError("Vælg et gyldigt tidspunkt for udløb, eller lad feltet stå tomt.");
      return;
    }

    setIsManagingShare(true);
    setError("");
    try {
      const { body, response } = await readOevekortResponse<ShareStatusResponse>(
        `/api/oevekort/sets/${selectedSetId}/share`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresAt }),
        },
      );
      if (!response.ok || !isShareStatusResponse(body) || !body.share) {
        setError(getOevekortError(body, "Delingen kunne ikke opdateres."));
        return;
      }
      setShare(body.share);
      const nextExpiryValue = toDateTimeLocal(body.share.expiresAt);
      setExpiryValue(nextExpiryValue);
      setSavedExpiryValue(nextExpiryValue);
      await loadSets();
      setMessage("Delingens udløbstidspunkt er opdateret.");
    } catch {
      setError("Delingen kunne ikke opdateres. Prøv igen.");
    } finally {
      setIsManagingShare(false);
    }
  };

  const revokeShare = async () => {
    if (!selectedSetId || !share) return;
    if (!window.confirm("Vil du lukke dette delingslink? Elever med linket mister adgangen.")) {
      return;
    }

    setIsManagingShare(true);
    setError("");
    try {
      const { body, response } = await readOevekortResponse(
        `/api/oevekort/sets/${selectedSetId}/share`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(getOevekortError(body, "Delingslinket kunne ikke lukkes."));
        return;
      }
      setShare(null);
      setShareUrl(null);
      setExpiryValue("");
      setSavedExpiryValue("");
      await loadSets();
      setMessage("Delingslinket er lukket.");
    } catch {
      setError("Delingslinket kunne ikke lukkes. Prøv igen.");
    } finally {
      setIsManagingShare(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Delingslinket er kopieret.");
    } catch {
      setMessage("Markér og kopiér linket fra feltet.");
    }
  };

  const closeEditor = () => {
    if (
      hasUnsavedEditorState &&
      !window.confirm("Du har ændringer, der ikke er gemt. Vil du forkaste dem og gå tilbage til dine sæt?")
    ) {
      return;
    }

    resetEditor();
    setIsEditorOpen(false);
  };

  const editorTitle = selectedSetId ? "Redigér dit sæt" : "Lav et nyt sæt";
  const busy = isSaving || isManagingShare;
  const shareCreationBlocked = hasUnsavedChanges || hasPendingExistingShareExpiry;
  const setBoardHref = selectedSetId
    ? `${OEVEKORT_OWNER_PATH}/tavle?set=${encodeURIComponent(selectedSetId)}`
    : null;
  const setPrintHref = selectedSetId
    ? `${OEVEKORT_OWNER_PATH}/print?set=${encodeURIComponent(selectedSetId)}`
    : null;

  return (
    <main className="skolegps-teacher-portal min-h-screen px-4 py-5 text-slate-950 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="skolegps-teacher-portal-hero overflow-hidden rounded-3xl border border-white/80 px-5 py-7 shadow-[0_18px_42px_rgba(25,83,129,0.09)] sm:px-8 sm:py-9">
          <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">Lærerværktøj</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-4xl">
            Øvekort
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            Lav kort til ord, begreber og spørgsmål. Del et sæt, eller vis det direkte på tavlen.
          </p>
        </header>

        <div aria-live="polite" className="mt-4">
          {message ? (
            <p className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-950">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <aside className="skolegps-teacher-surface h-fit rounded-3xl p-4 sm:p-5" aria-labelledby="oevekort-sets-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Dine sæt</p>
                <h2 id="oevekort-sets-heading" className="mt-1 text-2xl font-black text-[var(--skolegps-deep-navy)]">
                  Kort, du kan bruge igen
                </h2>
              </div>
              <button className={primaryButtonClassName} onClick={beginNewSet} type="button">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nyt sæt
              </button>
            </div>

            {isLoadingSets ? (
              <div className="mt-6"><LoadingIndicator label="Henter dine sæt..." /></div>
            ) : sets.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-5">
                <BookOpen aria-hidden="true" className="h-6 w-6 text-sky-700" />
                <p className="mt-3 font-black text-[var(--skolegps-deep-navy)]">Dit første sæt starter her</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Skriv ét kort ad gangen, eller indsæt en liste fra dit forberedelsesark.</p>
              </div>
            ) : (
              <ul className="mt-5 grid gap-2" aria-label="Gemte Øvekort-sæt">
                {sets.map((set) => (
                  <li key={set.id}>
                    <button
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50 ${selectedSetId === set.id ? "border-sky-400 bg-sky-50" : "border-slate-100 bg-white"}`}
                      onClick={() => void openSet(set.id)}
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-black text-[var(--skolegps-deep-navy)]">{set.title}</span>
                          <span className="mt-1 block text-xs font-medium text-slate-500">{set.cardCount} {set.cardCount === 1 ? "kort" : "kort"} · ændret {formatOevekortDate(set.updatedAt)}</span>
                        </span>
                        {set.share.active ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[0.68rem] font-black text-emerald-800">
                            <Share2 aria-hidden="true" className="h-3 w-3" /> Delt
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="skolegps-teacher-surface min-h-[32rem] rounded-3xl p-4 sm:p-6" aria-labelledby="oevekort-editor-heading">
            {isLoadingSet ? (
              <div className="flex min-h-80 items-center justify-center"><LoadingIndicator label="Åbner sættet..." /></div>
            ) : !isEditorOpen ? (
              <div className="flex min-h-80 flex-col items-start justify-center rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-6 sm:p-9">
                <SquarePen aria-hidden="true" className="h-9 w-9 text-sky-700" />
                <h2 id="oevekort-editor-heading" className="mt-4 text-2xl font-black text-[var(--skolegps-deep-navy)]">Vælg et sæt, eller lav et nyt</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">Hvert kort har en forside, en bagside og valgfri alternative svar til skriveøvelsen.</p>
                <button className={`${primaryButtonClassName} mt-5`} onClick={beginNewSet} type="button">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Lav mit første sæt
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">{selectedSetId ? "Gemte kort" : "Nyt sæt"}</p>
                    <h2 id="oevekort-editor-heading" className="mt-1 text-2xl font-black text-[var(--skolegps-deep-navy)]">{editorTitle}</h2>
                    {hasUnsavedChanges ? <p className="mt-2 text-sm font-bold text-amber-800" role="status">Ikke gemt endnu</p> : null}
                  </div>
                  <button
                    className={secondaryButtonClassName}
                    onClick={closeEditor}
                    type="button"
                  >
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    Tilbage til sæt
                  </button>
                </div>

                <label className="mt-6 block text-sm font-black text-slate-800" htmlFor="oevekort-title">
                  Titel på sættet
                  <input
                    className={inputClassName}
                    id="oevekort-title"
                    maxLength={120}
                    onChange={(event) => updateTitle(event.target.value)}
                    placeholder="Fx Franske gloser uge 12"
                    value={draft.title}
                  />
                </label>

                <section className="mt-6" aria-labelledby="oevekort-cards-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 id="oevekort-cards-heading" className="text-lg font-black text-[var(--skolegps-deep-navy)]">Kortene</h3>
                      <p className="mt-1 text-sm text-slate-600">{draft.cards.length} af højst {OEVEKORT_MAX_CARDS_PER_SET} kort</p>
                    </div>
                    <button className={secondaryButtonClassName} onClick={addCard} type="button">
                      <Plus aria-hidden="true" className="h-4 w-4" /> Tilføj kort
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    {draft.cards.map((card, cardIndex) => (
                      <article key={`${selectedSetId ?? "new"}-${cardIndex}`} className="rounded-2xl border border-sky-100 bg-sky-50/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-[var(--skolegps-deep-navy)]">Kort {cardIndex + 1}</p>
                          <div className="flex items-center gap-1">
                            <button
                              aria-label={`Flyt kort ${cardIndex + 1} op`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sky-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                              disabled={cardIndex === 0}
                              onClick={() => moveCard(cardIndex, -1)}
                              type="button"
                            >
                              <ChevronUp aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Flyt kort ${cardIndex + 1} ned`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sky-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                              disabled={cardIndex === draft.cards.length - 1}
                              onClick={() => moveCard(cardIndex, 1)}
                              type="button"
                            >
                              <ChevronDown aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`Fjern kort ${cardIndex + 1}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => removeCard(cardIndex)}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-bold text-slate-700">
                            Forside
                            <textarea
                              className={`${inputClassName} min-h-24 resize-y`}
                              maxLength={1000}
                              onChange={(event) => updateCard(cardIndex, "front", event.target.value)}
                              placeholder="Ordet eller spørgsmålet"
                              value={card.front}
                            />
                          </label>
                          <label className="block text-sm font-bold text-slate-700">
                            Bagside
                            <textarea
                              className={`${inputClassName} min-h-24 resize-y`}
                              maxLength={1000}
                              onChange={(event) => updateCard(cardIndex, "back", event.target.value)}
                              placeholder="Forklaringen eller svaret"
                              value={card.back}
                            />
                          </label>
                        </div>
                        <label className="mt-3 block text-sm font-bold text-slate-700">
                          Alternative svar <span className="font-medium text-slate-500">(ét pr. linje, valgfrit)</span>
                          <textarea
                            className={`${inputClassName} min-h-18 resize-y`}
                            maxLength={3000}
                            onChange={(event) => updateAcceptedAnswers(cardIndex, event.target.value)}
                            placeholder="Et alternativt, korrekt svar"
                            value={card.acceptedAnswers.join("\n")}
                          />
                        </label>
                      </article>
                    ))}
                  </div>
                </section>

                <details className="mt-6 rounded-2xl border border-sky-100 bg-white p-4">
                  <summary className="cursor-pointer list-none font-black text-[var(--skolegps-deep-navy)]">
                    <span className="inline-flex items-center gap-2"><FileUp aria-hidden="true" className="h-4 w-4 text-sky-700" /> Indsæt mange kort på én gang</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Indsæt én linje pr. kort med forside og bagside adskilt af semikolon eller tabulator. Bogstaver som æ, ø, å og accenter bevares præcist.</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-slate-700">
                    <label className="inline-flex items-center gap-2"><input checked={importDelimiter === "semicolon"} name="oevekort-delimiter" onChange={() => setImportDelimiter("semicolon")} type="radio" /> Semikolon</label>
                    <label className="inline-flex items-center gap-2"><input checked={importDelimiter === "tab"} name="oevekort-delimiter" onChange={() => setImportDelimiter("tab")} type="radio" /> Tabulator</label>
                  </div>
                  <textarea className={`${inputClassName} min-h-32 resize-y font-mono text-xs`} onChange={(event) => setImportText(event.target.value)} placeholder={importDelimiter === "tab" ? "bonjour\thej" : "bonjour;hej"} value={importText} />
                  <button className={`${secondaryButtonClassName} mt-3`} onClick={importCards} type="button"><FileUp aria-hidden="true" className="h-4 w-4" /> Læg kort til sættet</button>
                </details>

                <div className="mt-6 flex flex-wrap gap-3 border-t border-sky-100 pt-5">
                  <button className={primaryButtonClassName} disabled={isSaving} onClick={() => void saveSet()} type="button">
                    {isSaving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                    Gem sæt
                  </button>
                  {selectedSetId ? (
                    <>
                      <button className={secondaryButtonClassName} disabled={isSaving} onClick={() => void copySet()} type="button"><Copy aria-hidden="true" className="h-4 w-4" /> Lav kopi</button>
                      <button className={`${secondaryButtonClassName} border-rose-200 text-rose-800 hover:border-rose-300 hover:bg-rose-50`} disabled={isSaving} onClick={() => void deleteSet()} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" /> Slet</button>
                    </>
                  ) : null}
                </div>

                {selectedSetId ? (
                  <section className="mt-8 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f4fbff,#f7fcf8)] p-4 sm:p-5" aria-labelledby="oevekort-use-heading">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Brug sættet</p>
                        <h3 id="oevekort-use-heading" className="mt-1 text-xl font-black text-[var(--skolegps-deep-navy)]">Vælg den måde, der passer til timen</h3>
                      </div>
                      {selectedSummary ? <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm">{selectedSummary.cardCount} kort</span> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {setBoardHref ? <Link className={secondaryButtonClassName} href={setBoardHref}><Presentation aria-hidden="true" className="h-4 w-4" /> Vis på tavle</Link> : null}
                      {setPrintHref ? <Link className={secondaryButtonClassName} href={setPrintHref}><Printer aria-hidden="true" className="h-4 w-4" /> Print</Link> : null}
                    </div>

                    <div className="mt-6 border-t border-sky-100 pt-5">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm"><Share2 aria-hidden="true" className="h-5 w-5" /></span>
                        <div>
                          <h4 className="font-black text-[var(--skolegps-deep-navy)]">Del med eleverne</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Delingslinket giver adgang til dette sæt. Det vises kun, når du opretter et nyt link.</p>
                        </div>
                      </div>
                      <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="oevekort-expiry">
                        Udløber <span className="font-medium text-slate-500">(valgfrit)</span>
                        <input className={inputClassName} id="oevekort-expiry" onChange={(event) => setExpiryValue(event.target.value)} type="datetime-local" value={expiryValue} />
                      </label>
                      {hasPendingShareExpiryInput ? (
                        <p className="mt-2 text-sm font-semibold text-amber-800" role="status">
                          {share
                            ? "Udløbstidspunktet er ikke gemt endnu. Gem det, før du opretter et nyt link."
                            : "Udløbstidspunktet gemmes sammen med det nye delingslink."}
                        </p>
                      ) : null}
                      {share ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800"><ShieldCheck aria-hidden="true" className="h-4 w-4" /> Aktiv deling {share.expiresAt ? `indtil ${formatOevekortDate(share.expiresAt)}` : "uden udløb"}.</p> : <p className="mt-3 text-sm text-slate-600">Der er ikke et aktivt delingslink endnu.</p>}
                      {shareCreationBlocked ? (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-950" id="oevekort-share-save-first" role="status">
                          {hasUnsavedChanges
                            ? "Gem sættet først. Et delingslink viser kun den gemte version af dine kort."
                            : "Gem udløbstidspunktet først, før du opretter et nyt delingslink."}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button aria-describedby={shareCreationBlocked ? "oevekort-share-save-first" : undefined} className={primaryButtonClassName} disabled={busy || shareCreationBlocked} onClick={() => void createShare()} type="button">
                          {isManagingShare ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <LinkIcon aria-hidden="true" className="h-4 w-4" />}
                          {share ? "Opret nyt link" : "Opret delingslink"}
                        </button>
                        {share ? <button className={secondaryButtonClassName} disabled={busy || hasUnsavedChanges || !hasPendingShareExpiryInput} onClick={() => void updateShareExpiry()} type="button">Gem udløb</button> : null}
                        {share ? <button className={`${secondaryButtonClassName} border-rose-200 text-rose-800 hover:border-rose-300 hover:bg-rose-50`} disabled={busy} onClick={() => void revokeShare()} type="button"><X aria-hidden="true" className="h-4 w-4" /> Luk deling</button> : null}
                      </div>
                      {shareUrl ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-3">
                          <label className="block text-xs font-black tracking-[0.12em] text-emerald-800 uppercase" htmlFor="oevekort-share-url">Nyt delingslink</label>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input className="min-h-11 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-slate-800" id="oevekort-share-url" readOnly value={shareUrl} />
                            <button className={secondaryButtonClassName} onClick={() => void copyShareUrl()} type="button"><Copy aria-hidden="true" className="h-4 w-4" /> Kopiér</button>
                            <a className={secondaryButtonClassName} href={shareUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" className="h-4 w-4" /> Åbn</a>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
