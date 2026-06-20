"use client";

function renderPostPage(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post,
  totalPosts: number,
  imageUrl: string
) {
  switch (template.variant) {
    case "editorial":
      return renderEditorialPostPage(styles, template, run, post, totalPosts, imageUrl);
    case "grid":
      return renderGridPostPage(styles, template, run, post, totalPosts, imageUrl);
    case "poster":
      return renderPosterPostPage(styles, template, run, post, totalPosts, imageUrl);
    default:
      return renderClassicPostPage(styles, template, run, post, totalPosts, imageUrl);
  }
}

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
  Rect,
  Circle,
  Line,
  pdf,
} from "@react-pdf/renderer";

/* ── Types ─────────────────────────────────────────────────────────── */
type Post = {
  number: number;
  title: string;
  body_text: string;
  image_url: string;
  image_prompt: string;
  question?: string;
  options?: [string, string, string, string];
  correct_index?: number;
  hint?: string;
  answer_word?: string;
};

type StjernelobData = {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  posts: Post[];
};

type StjernelobPdfViewProps = {
  run: StjernelobData;
};

/* ── Fonts ─────────────────────────────────────────────────────────── */

/* ── Theme ─────────────────────────────────────────────────────────── */
type PdfTheme = {
  pageBg: string;
  panelBg: string;
  panelBorder: string;
  panelMutedBg: string;
  headerBg: string;
  headerAccent: string;
  headerSubtitle: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  titleText: string;
  bodyText: string;
  bodyMutedText: string;
  questionText: string;
  optionBorder: string;
  optionBg: string;
  optionAccentBg: string;
  optionAccentText: string;
  optionText: string;
  footerBg: string;
  footerBorder: string;
  footerText: string;
  outerBorder: string;
  answerSheetBg: string;
  answerKeyBg: string;
  guideLine: string;
  noteBg: string;
  noteBorder: string;
  noteText: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  imageFrameBg: string;
  imageFrameBorder: string;
};

type PdfTemplateVariant = "classic" | "editorial" | "grid" | "poster";

type PdfTemplate = {
  key: string;
  label: string;
  variant: PdfTemplateVariant;
  eyebrow: string;
  strapline: string;
  bodyLabel: string;
  questionLabel: string;
  footerLabel: string;
  motif: string;
  optionMode: "grid" | "stacked";
  theme: PdfTheme;
  watermarkGlyphs: string[];
  subjectBadge: string;
  cornerMark: string;
  footerIcon: string;
  bodyLineHeight?: number;
};

const STANDARD_THEME: PdfTheme = {
  pageBg: "#f8fafc",
  panelBg: "#ffffff",
  panelBorder: "#cbd5e1",
  panelMutedBg: "#f1f5f9",
  headerBg: "#1e293b",
  headerAccent: "#38bdf8",
  headerSubtitle: "#94a3b8",
  badgeBg: "#334155",
  badgeText: "#ffffff",
  badgeBorder: "#475569",
  titleText: "#f8fafc",
  bodyText: "#334155",
  bodyMutedText: "#64748b",
  questionText: "#0f172a",
  optionBorder: "#475569",
  optionBg: "#f1f5f9",
  optionAccentBg: "#334155",
  optionAccentText: "#e2e8f0",
  optionText: "#1e293b",
  footerBg: "#1e293b",
  footerBorder: "#334155",
  footerText: "#94a3b8",
  outerBorder: "#334155",
  answerSheetBg: "#f8fafc",
  answerKeyBg: "#f1f5f9",
  guideLine: "#94a3b8",
  noteBg: "#e0f2fe",
  noteBorder: "#7dd3fc",
  noteText: "#0f172a",
  chipBg: "#0f172a",
  chipBorder: "#475569",
  chipText: "#e2e8f0",
  imageFrameBg: "#ffffff",
  imageFrameBorder: "#94a3b8",
};

const DANISH_THEME: PdfTheme = {
  pageBg: "#fff8f2",
  panelBg: "#fffdf9",
  panelBorder: "#d8b4bf",
  panelMutedBg: "#fef2f2",
  headerBg: "#4a1d2f",
  headerAccent: "#f59eae",
  headerSubtitle: "#fbcfe8",
  badgeBg: "#7a284c",
  badgeText: "#fff7ed",
  badgeBorder: "#f9a8d4",
  titleText: "#fff7ed",
  bodyText: "#4a1d2f",
  bodyMutedText: "#7a284c",
  questionText: "#3b1024",
  optionBorder: "#9d174d",
  optionBg: "#fff7f7",
  optionAccentBg: "#7a284c",
  optionAccentText: "#ffe4e6",
  optionText: "#4a1d2f",
  footerBg: "#4a1d2f",
  footerBorder: "#7a284c",
  footerText: "#fbcfe8",
  outerBorder: "#7a284c",
  answerSheetBg: "#fff8f2",
  answerKeyBg: "#fdf2f8",
  guideLine: "#d8b4bf",
  noteBg: "#fff1f2",
  noteBorder: "#f9a8d4",
  noteText: "#4a1d2f",
  chipBg: "#fff7ed",
  chipBorder: "#f9a8d4",
  chipText: "#7a284c",
  imageFrameBg: "#fff7ed",
  imageFrameBorder: "#f9a8d4",
};

const MATH_THEME: PdfTheme = {
  pageBg: "#eef4ff",
  panelBg: "#ffffff",
  panelBorder: "#a5b4fc",
  panelMutedBg: "#eef2ff",
  headerBg: "#162456",
  headerAccent: "#60a5fa",
  headerSubtitle: "#c7d2fe",
  badgeBg: "#2563eb",
  badgeText: "#eff6ff",
  badgeBorder: "#93c5fd",
  titleText: "#eff6ff",
  bodyText: "#1e3a8a",
  bodyMutedText: "#475569",
  questionText: "#0f172a",
  optionBorder: "#2563eb",
  optionBg: "#f8fbff",
  optionAccentBg: "#1d4ed8",
  optionAccentText: "#dbeafe",
  optionText: "#1e293b",
  footerBg: "#162456",
  footerBorder: "#2563eb",
  footerText: "#bfdbfe",
  outerBorder: "#1d4ed8",
  answerSheetBg: "#eef4ff",
  answerKeyBg: "#eff6ff",
  guideLine: "#93c5fd",
  noteBg: "#dbeafe",
  noteBorder: "#60a5fa",
  noteText: "#162456",
  chipBg: "#eff6ff",
  chipBorder: "#93c5fd",
  chipText: "#1e3a8a",
  imageFrameBg: "#ffffff",
  imageFrameBorder: "#60a5fa",
};

const ENGLISH_THEME: PdfTheme = {
  pageBg: "#fff8ef",
  panelBg: "#fffdf7",
  panelBorder: "#fdba74",
  panelMutedBg: "#fff1f2",
  headerBg: "#102347",
  headerAccent: "#f97316",
  headerSubtitle: "#dbeafe",
  badgeBg: "#ef4444",
  badgeText: "#fff7ed",
  badgeBorder: "#fdba74",
  titleText: "#fff7ed",
  bodyText: "#1f2937",
  bodyMutedText: "#475569",
  questionText: "#111827",
  optionBorder: "#ef4444",
  optionBg: "#fff7ed",
  optionAccentBg: "#102347",
  optionAccentText: "#dbeafe",
  optionText: "#1f2937",
  footerBg: "#102347",
  footerBorder: "#ef4444",
  footerText: "#e0e7ff",
  outerBorder: "#102347",
  answerSheetBg: "#fff8ef",
  answerKeyBg: "#fff7ed",
  guideLine: "#fdba74",
  noteBg: "#ffedd5",
  noteBorder: "#fb923c",
  noteText: "#7c2d12",
  chipBg: "#fff7ed",
  chipBorder: "#fdba74",
  chipText: "#9a3412",
  imageFrameBg: "#fff7ed",
  imageFrameBorder: "#fdba74",
};

const GERMAN_THEME: PdfTheme = {
  pageBg: "#fffbeb",
  panelBg: "#fffdf7",
  panelBorder: "#fbbf24",
  panelMutedBg: "#fef9c3",
  headerBg: "#422006",
  headerAccent: "#facc15",
  headerSubtitle: "#fde68a",
  badgeBg: "#78350f",
  badgeText: "#fefce8",
  badgeBorder: "#fbbf24",
  titleText: "#fefce8",
  bodyText: "#422006",
  bodyMutedText: "#78350f",
  questionText: "#1c1917",
  optionBorder: "#b45309",
  optionBg: "#fffbeb",
  optionAccentBg: "#78350f",
  optionAccentText: "#fef3c7",
  optionText: "#422006",
  footerBg: "#422006",
  footerBorder: "#78350f",
  footerText: "#fde68a",
  outerBorder: "#78350f",
  answerSheetBg: "#fffbeb",
  answerKeyBg: "#fef9c3",
  guideLine: "#fbbf24",
  noteBg: "#fef3c7",
  noteBorder: "#fbbf24",
  noteText: "#422006",
  chipBg: "#fefce8",
  chipBorder: "#fbbf24",
  chipText: "#78350f",
  imageFrameBg: "#fffdf7",
  imageFrameBorder: "#fbbf24",
};

const PHYSICS_THEME: PdfTheme = {
  pageBg: "#f5f3ff",
  panelBg: "#ffffff",
  panelBorder: "#c4b5fd",
  panelMutedBg: "#ede9fe",
  headerBg: "#1e1b4b",
  headerAccent: "#a78bfa",
  headerSubtitle: "#c4b5fd",
  badgeBg: "#5b21b6",
  badgeText: "#f5f3ff",
  badgeBorder: "#a78bfa",
  titleText: "#f5f3ff",
  bodyText: "#3730a3",
  bodyMutedText: "#6366f1",
  questionText: "#0f172a",
  optionBorder: "#7c3aed",
  optionBg: "#f5f3ff",
  optionAccentBg: "#5b21b6",
  optionAccentText: "#ede9fe",
  optionText: "#1e1b4b",
  footerBg: "#1e1b4b",
  footerBorder: "#5b21b6",
  footerText: "#c4b5fd",
  outerBorder: "#5b21b6",
  answerSheetBg: "#f5f3ff",
  answerKeyBg: "#ede9fe",
  guideLine: "#a78bfa",
  noteBg: "#ede9fe",
  noteBorder: "#a78bfa",
  noteText: "#1e1b4b",
  chipBg: "#f5f3ff",
  chipBorder: "#a78bfa",
  chipText: "#5b21b6",
  imageFrameBg: "#ffffff",
  imageFrameBorder: "#a78bfa",
};

const GEOGRAPHY_THEME: PdfTheme = {
  pageBg: "#ecfdf5",
  panelBg: "#ffffff",
  panelBorder: "#6ee7b7",
  panelMutedBg: "#d1fae5",
  headerBg: "#064e3b",
  headerAccent: "#34d399",
  headerSubtitle: "#a7f3d0",
  badgeBg: "#047857",
  badgeText: "#ecfdf5",
  badgeBorder: "#34d399",
  titleText: "#ecfdf5",
  bodyText: "#064e3b",
  bodyMutedText: "#047857",
  questionText: "#0f172a",
  optionBorder: "#059669",
  optionBg: "#ecfdf5",
  optionAccentBg: "#047857",
  optionAccentText: "#d1fae5",
  optionText: "#064e3b",
  footerBg: "#064e3b",
  footerBorder: "#047857",
  footerText: "#a7f3d0",
  outerBorder: "#047857",
  answerSheetBg: "#ecfdf5",
  answerKeyBg: "#d1fae5",
  guideLine: "#6ee7b7",
  noteBg: "#d1fae5",
  noteBorder: "#34d399",
  noteText: "#064e3b",
  chipBg: "#ecfdf5",
  chipBorder: "#34d399",
  chipText: "#047857",
  imageFrameBg: "#ffffff",
  imageFrameBorder: "#34d399",
};

const BIOLOGY_THEME: PdfTheme = {
  pageBg: "#f0fdf4",
  panelBg: "#ffffff",
  panelBorder: "#86efac",
  panelMutedBg: "#dcfce7",
  headerBg: "#14532d",
  headerAccent: "#4ade80",
  headerSubtitle: "#bbf7d0",
  badgeBg: "#166534",
  badgeText: "#f0fdf4",
  badgeBorder: "#4ade80",
  titleText: "#f0fdf4",
  bodyText: "#14532d",
  bodyMutedText: "#166534",
  questionText: "#0f172a",
  optionBorder: "#16a34a",
  optionBg: "#f0fdf4",
  optionAccentBg: "#166534",
  optionAccentText: "#dcfce7",
  optionText: "#14532d",
  footerBg: "#14532d",
  footerBorder: "#166534",
  footerText: "#bbf7d0",
  outerBorder: "#166534",
  answerSheetBg: "#f0fdf4",
  answerKeyBg: "#dcfce7",
  guideLine: "#86efac",
  noteBg: "#dcfce7",
  noteBorder: "#4ade80",
  noteText: "#14532d",
  chipBg: "#f0fdf4",
  chipBorder: "#4ade80",
  chipText: "#166534",
  imageFrameBg: "#ffffff",
  imageFrameBorder: "#4ade80",
};

const DEFAULT_TEMPLATE: PdfTemplate = {
  key: "standard",
  label: "Standard",
  variant: "classic",
  eyebrow: "Læs, gå videre og svar",
  strapline: "En robust standard-skabelon til alle fag, der ikke har deres egen specialudgave endnu.",
  bodyLabel: "Faglig tekst",
  questionLabel: "Spørgsmål",
  footerLabel: "Analog post",
  motif: "✦",
  optionMode: "grid",
  theme: STANDARD_THEME,
  watermarkGlyphs: ["✦"],
  subjectBadge: "",
  cornerMark: "✦",
  footerIcon: "✦",
};

const SUBJECT_TEMPLATES: Record<string, PdfTemplate> = {
  dansk: {
    key: "dansk-editorial",
    label: "Dansk Editorial",
    variant: "editorial",
    eyebrow: "Læs, fortolk og svar",
    strapline: "Boglig og redaktionel post med tydelig læserytme, varm typografi og plads til fordybelse.",
    bodyLabel: "Tekstuddrag",
    questionLabel: "Læseopgave",
    footerLabel: "Dansk · analog post",
    motif: "✒",
    optionMode: "stacked",
    theme: DANISH_THEME,
    watermarkGlyphs: ["✒", "§"],
    subjectBadge: "DANSK",
    cornerMark: "✒",
    footerIcon: "✒",
    bodyLineHeight: 1.75,
  },
  matematik: {
    key: "matematik-grid",
    label: "Matematik Grid",
    variant: "grid",
    eyebrow: "Se mønsteret og løs opgaven",
    strapline: "Geometrisk og præcis post med stærkt overblik, hurtig scanning og tydelige svarfelter.",
    bodyLabel: "Problemfelt",
    questionLabel: "Løsningsvalg",
    footerLabel: "Matematik · analog post",
    motif: "∑",
    optionMode: "grid",
    theme: MATH_THEME,
    watermarkGlyphs: ["∑", "π", "∞"],
    subjectBadge: "MATEMATIK",
    cornerMark: "∑",
    footerIcon: "∑",
  },
  engelsk: {
    key: "english-poster",
    label: "English Poster",
    variant: "poster",
    eyebrow: "Read, decide, move on",
    strapline: "Plakatagtig post med klar energi, høj læsbarhed og en stærk mission-følelse.",
    bodyLabel: "Mission briefing",
    questionLabel: "Choose the best answer",
    footerLabel: "English · analog post",
    motif: "★",
    optionMode: "grid",
    theme: ENGLISH_THEME,
    watermarkGlyphs: ["★", "A"],
    subjectBadge: "ENGLISH",
    cornerMark: "★",
    footerIcon: "★",
  },
  tysk: {
    key: "tysk-classic",
    label: "Deutsch Klassisch",
    variant: "classic",
    eyebrow: "Lies, verstehe und antworte",
    strapline: "Klar og struktureret post med tydelig formidling og præcis sproglig tone.",
    bodyLabel: "Tekst og opgave",
    questionLabel: "Aufgabe",
    footerLabel: "Tysk · analog post",
    motif: "✦",
    optionMode: "grid",
    theme: GERMAN_THEME,
    watermarkGlyphs: ["Ä", "ß"],
    subjectBadge: "DEUTSCH",
    cornerMark: "✦",
    footerIcon: "✦",
  },
  "fysik/kemi": {
    key: "fysik-kemi-grid",
    label: "Fysik/Kemi Grid",
    variant: "grid",
    eyebrow: "Observer, analyser og svar",
    strapline: "Datadrevet og eksperimentel post med laboratorietone og tydelig vidensoverblik.",
    bodyLabel: "Fagligt felt",
    questionLabel: "Analyseopgave",
    footerLabel: "Fysik/Kemi · analog post",
    motif: "⚛",
    optionMode: "grid",
    theme: PHYSICS_THEME,
    watermarkGlyphs: ["⚛", "⚡"],
    subjectBadge: "FYSIK/KEMI",
    cornerMark: "⚛",
    footerIcon: "⚛",
  },
  geografi: {
    key: "geografi-classic",
    label: "Geografi Klassisk",
    variant: "classic",
    eyebrow: "Udforsk, kortlæg og svar",
    strapline: "Åben og kortvenlig post med plads til rumlig tænkning og geografisk nysgerrighed.",
    bodyLabel: "Faglig tekst",
    questionLabel: "Spørgsmål",
    footerLabel: "Geografi · analog post",
    motif: "◎",
    optionMode: "grid",
    theme: GEOGRAPHY_THEME,
    watermarkGlyphs: ["◎", "◉"],
    subjectBadge: "GEOGRAFI",
    cornerMark: "◎",
    footerIcon: "◎",
  },
  biologi: {
    key: "biologi-editorial",
    label: "Biologi Editorial",
    variant: "editorial",
    eyebrow: "Observer, beskriv og svar",
    strapline: "Naturvidenskabelig post med plads til observation, terminologi og faglig fordybelse.",
    bodyLabel: "Fagligt felt",
    questionLabel: "Biologiopgave",
    footerLabel: "Biologi · analog post",
    motif: "❋",
    optionMode: "stacked",
    theme: BIOLOGY_THEME,
    watermarkGlyphs: ["❋", "❊"],
    subjectBadge: "BIOLOGI",
    cornerMark: "❋",
    footerIcon: "❋",
    bodyLineHeight: 1.70,
  },
};

function resolveTemplate(subject: string): PdfTemplate {
  const key = subject.trim().toLowerCase();
  for (const [mapKey, template] of Object.entries(SUBJECT_TEMPLATES)) {
    if (key === mapKey || key.includes(mapKey) || mapKey.includes(key)) {
      return template;
    }
  }

  // Handle partial matches for compound subjects like "fysik" or "kemi"
  if (key.includes("fysik") || key.includes("kemi")) {
    return SUBJECT_TEMPLATES["fysik/kemi"]!;
  }

  return DEFAULT_TEMPLATE;
}

/* ── Image URL helpers ─────────────────────────────────────────────── */
const LETTER_LABELS = ["A", "B", "C", "D"] as const;
const PDF_IMAGE_FETCH_TIMEOUT_MS = 10_000;
const PDF_IMAGE_MAX_RETRY_ATTEMPTS = 2;
const PDF_IMAGE_RETRY_DELAY_MS = 800;
const POLLINATIONS_HOSTNAME = "image.pollinations.ai";
const DALLE_CDN_HOSTNAME = "oaidalleapiprodscus.blob.core.windows.net";

function getPdfImagePrompt(post: Post): string {
  return typeof post.image_prompt === "string" ? post.image_prompt.trim() : "";
}

function isDalleImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === DALLE_CDN_HOSTNAME;
  } catch {
    return false;
  }
}

function getPdfImageRequest(post: Post): { url: string; isPollinations: boolean } {
  const rawUrl = typeof post.image_url === "string" ? post.image_url.trim() : "";

  // Route DALL-E CDN URLs through our server-side proxy to bypass CORS
  if (rawUrl && isDalleImageUrl(rawUrl)) {
    return {
      url: `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`,
      isPollinations: false,
    };
  }

  // Prefer stored images from OpenAI data URLs or persisted public URLs.
  if (rawUrl) {
    return {
      url: rawUrl,
      isPollinations: isPollinationsImageUrl(rawUrl),
    };
  }

  // Fall back to Pollinations proxy only when no stored image exists.
  const prompt = getPdfImagePrompt(post);
  if (prompt) {
    return {
      url: `/api/pollinations-image?prompt=${encodeURIComponent(prompt)}`,
      isPollinations: true,
    };
  }

  return {
    url: "",
    isPollinations: false,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isPollinationsImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === POLLINATIONS_HOSTNAME;
  } catch {
    return false;
  }
}

function waitForPdfImageDelay(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

type PdfSubjectIconVariant = "standard" | "dansk" | "matematik" | "engelsk" | "tysk" | "fysik-kemi" | "geografi" | "biologi";

function resolveSubjectIconVariant(subject: string): PdfSubjectIconVariant {
  const normalizedSubject = subject.trim().toLowerCase();

  if (normalizedSubject.includes("dansk")) {
    return "dansk";
  }

  if (normalizedSubject.includes("matematik")) {
    return "matematik";
  }

  if (normalizedSubject.includes("engelsk")) {
    return "engelsk";
  }

  if (normalizedSubject.includes("tysk")) {
    return "tysk";
  }

  if (normalizedSubject.includes("fysik") || normalizedSubject.includes("kemi")) {
    return "fysik-kemi";
  }

  if (normalizedSubject.includes("geografi")) {
    return "geografi";
  }

  if (normalizedSubject.includes("biologi")) {
    return "biologi";
  }

  return "standard";
}

function buildInitialPdfImageSources(posts: Post[], subject: string) {
  void subject;

  return Object.fromEntries(
    posts.map((post) => [
      post.number,
      "",
    ])
  ) as Record<number, string>;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Kunne ikke laese billeddata til PDF."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Kunne ikke laese billeddata til PDF."));
    };

    reader.readAsDataURL(blob);
  });
}

async function fetchPdfImageResponseWithTimeout(url: string, signal?: AbortSignal) {
  const timeoutController = new AbortController();

  const handleParentAbort = () => {
    timeoutController.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      timeoutController.abort(signal.reason);
    } else {
      signal.addEventListener("abort", handleParentAbort, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => {
    timeoutController.abort(new DOMException("Timed out", "AbortError"));
  }, PDF_IMAGE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      cache: "force-cache",
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    if (timeoutController.signal.aborted) {
      throw new Error(`Billedhentning timed out efter ${PDF_IMAGE_FETCH_TIMEOUT_MS} ms.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener("abort", handleParentAbort);
    }
  }
}

type PreparedPdfImageResult = {
  number: number;
  source: string;
  usedFallback: boolean;
};

type PreparedPdfImages = {
  sources: Record<number, string>;
  totalCount: number;
  loadedCount: number;
  fallbackCount: number;
};

async function fetchPdfImageSourceWithRetry(
  post: Post,
  url: string,
  signal?: AbortSignal
): Promise<PreparedPdfImageResult> {
  for (let attempt = 1; attempt <= PDF_IMAGE_MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchPdfImageResponseWithTimeout(url, signal);
      const contentType = response.headers.get("content-type") ?? "";
      const canUseImageBody = contentType.startsWith("image/");

      if (!response.ok && !canUseImageBody) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Billedblob var tom.");
      }

      return {
        number: post.number,
        source: await blobToDataUrl(blob),
        usedFallback: !response.ok,
      };
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error;
      }

      const isLastAttempt = attempt === PDF_IMAGE_MAX_RETRY_ATTEMPTS;
      console.error(
        `Kunne ikke hente PDF-billede (forsøg ${attempt}/${PDF_IMAGE_MAX_RETRY_ATTEMPTS}):`,
        url,
        error
      );

      if (isLastAttempt) {
        return {
          number: post.number,
          source: "",
          usedFallback: true,
        };
      }

      await waitForPdfImageDelay(PDF_IMAGE_RETRY_DELAY_MS * attempt);
    }
  }

  return {
    number: post.number,
    source: "",
    usedFallback: true,
  };
}

async function preparePdfImages(
  posts: Post[],
  subject: string,
  signal?: AbortSignal
): Promise<PreparedPdfImages> {
  void subject;

  const tasks = posts.map(async (post) => {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const { url } = getPdfImageRequest(post);

    if (!url) {
      return {
        number: post.number,
        source: "",
        usedFallback: true,
      } satisfies PreparedPdfImageResult;
    }

    return fetchPdfImageSourceWithRetry(post, url, signal);
  });

  const preparedResults = await Promise.all(tasks);
  const sources: Record<number, string> = {};
  let fallbackCount = 0;

  for (const result of preparedResults) {
    sources[result.number] = result.source;
    if (result.usedFallback) {
      fallbackCount += 1;
    }
  }

  return {
    sources,
    totalCount: preparedResults.length,
    loadedCount: preparedResults.length - fallbackCount,
    fallbackCount,
  };
}

/* ── PDF Styles ────────────────────────────────────────────────────── */
function createStyles(template: PdfTemplate) {
  const t = template.theme;
  const isEditorial = template.variant === "editorial";
  const isGrid = template.variant === "grid";
  const isPoster = template.variant === "poster";

  return StyleSheet.create({
    page: {
      width: "210mm",
      height: "297mm",
      backgroundColor: t.pageBg,
      position: "relative",
    },
    frame: {
      position: "absolute",
      top: 8,
      left: 8,
      right: 8,
      bottom: 8,
      borderWidth: 4,
      borderColor: t.outerBorder,
      borderStyle: "solid",
    },
    pageInner: {
      flex: 1,
      flexDirection: "column",
      paddingHorizontal: 28,
      paddingTop: 22,
      paddingBottom: 54,
    },
    header: {
      backgroundColor: t.headerBg,
      borderWidth: 0,
      borderRadius: 0,
      marginHorizontal: -28,
      paddingHorizontal: 28,
      paddingTop: 24,
      paddingBottom: 20,
      marginBottom: 14,
      borderBottomWidth: 4,
      borderBottomColor: t.headerAccent,
    },
    eyebrowRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    eyebrow: {
      fontSize: 6.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 2.5,
      color: t.headerSubtitle,
    },
    motif: {
      fontSize: isPoster ? 18 : 14,
      fontWeight: 700,
      color: t.headerAccent,
    },
    runTitle: {
      fontSize: 10,
      color: t.headerSubtitle,
      textAlign: "center",
      marginBottom: 4,
    },
    badgeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    badge: {
      backgroundColor: t.badgeBg,
      borderWidth: 2,
      borderColor: t.badgeBorder,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: isPoster ? 12 : 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1.8,
      color: t.badgeText,
    },
    templateLabel: {
      fontSize: 7,
      color: t.headerSubtitle,
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    title: {
      fontSize: isPoster ? 56 : isEditorial ? 52 : isGrid ? 50 : 48,
      fontWeight: 700,
      color: t.titleText,
      textAlign: "center",
      letterSpacing: 6,
      lineHeight: 1.1,
      marginBottom: 6,
    },
    strapline: {
      fontSize: isPoster ? 8.8 : 7.8,
      color: t.headerSubtitle,
      lineHeight: 1.45,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 10,
    },
    chip: {
      backgroundColor: t.chipBg,
      borderWidth: 1,
      borderColor: t.chipBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginRight: 6,
      marginBottom: 6,
    },
    chipText: {
      fontSize: 6.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: t.chipText,
    },
    content: {
      flex: 1,
    },
    heroCard: {
      flexDirection: "column",
      backgroundColor: t.imageFrameBg,
      borderWidth: 2,
      borderColor: t.imageFrameBorder,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
    },
    heroVisual: {
      backgroundColor: t.panelMutedBg,
      paddingHorizontal: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    heroImage: {
      flexShrink: 0,
      width: "100%",
      height: isPoster ? 190 : isEditorial ? 170 : 150,
      objectFit: "cover",
    },
    heroIcon: {
      width: "100%",
      height: isPoster ? 190 : isEditorial ? 170 : 150,
    },
    heroFallbackTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: t.questionText,
      marginBottom: 8,
    },
    heroFallbackBody: {
      fontSize: 9,
      lineHeight: 1.45,
      color: t.bodyMutedText,
      textAlign: "center",
      maxWidth: 280,
    },
    bodyCard: {
      backgroundColor: t.panelBg,
      borderWidth: 1.5,
      borderColor: t.panelBorder,
      borderLeftWidth: 4,
      borderLeftColor: t.headerAccent,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
      marginBottom: 12,
    },
    bodyCardMuted: {
      backgroundColor: t.panelMutedBg,
      borderColor: t.guideLine,
    },
    sectionLabel: {
      fontSize: 8,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      color: t.headerAccent,
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: t.questionText,
      marginBottom: 4,
    },
    bodyText: {
      fontSize: 11.5,
      lineHeight: template.bodyLineHeight ?? (isPoster ? 1.55 : 1.65),
      color: t.bodyText,
    },
    mutedText: {
      fontSize: 8,
      lineHeight: 1.45,
      color: t.bodyMutedText,
    },
    noteCard: {
      backgroundColor: t.noteBg,
      borderWidth: 1.5,
      borderColor: t.noteBorder,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      marginBottom: 12,
    },
    noteTitle: {
      fontSize: 8,
      fontWeight: 700,
      color: t.noteText,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 1.3,
    },
    noteBody: {
      fontSize: 8.2,
      lineHeight: 1.45,
      color: t.noteText,
    },
    questionCard: {
      backgroundColor: t.panelBg,
      borderWidth: 1.5,
      borderColor: t.optionBorder,
      borderLeftWidth: 4,
      borderLeftColor: t.headerAccent,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
    },
    questionText: {
      fontSize: isPoster ? 15.5 : isGrid ? 15 : 14.5,
      fontWeight: 700,
      color: t.questionText,
      lineHeight: 1.3,
      marginBottom: 10,
    },
    optionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    optionStack: {
      flexDirection: "column",
    },
    optionItemGrid: {
      width: "48%",
      minHeight: 46,
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: t.optionBorder,
      backgroundColor: t.optionBg,
      borderRadius: 12,
      marginBottom: 8,
      overflow: "hidden",
    },
    optionItemStacked: {
      width: "100%",
      minHeight: 44,
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: t.optionBorder,
      backgroundColor: t.optionBg,
      borderRadius: 12,
      marginBottom: 8,
      overflow: "hidden",
    },
    optionAccent: {
      width: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.optionAccentBg,
      paddingVertical: 8,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
    },
    optionLetter: {
      fontSize: 14,
      fontWeight: 700,
      color: t.optionAccentText,
    },
    optionCopy: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 10.5,
      lineHeight: 1.4,
      color: t.optionText,
    },
    footer: {
      position: "absolute",
      bottom: 14,
      left: 28,
      right: 28,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: t.footerBg,
      borderWidth: 1.5,
      borderColor: t.footerBorder,
      borderTopWidth: 2.5,
      borderTopColor: t.headerAccent,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    footerText: {
      fontSize: 6.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1.8,
      color: t.footerText,
    },
    classicFlow: {
      flex: 1,
      flexDirection: "column",
    },
    editorialColumns: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    editorialMain: {
      flexDirection: "column",
      width: "59%",
    },
    editorialAside: {
      flexDirection: "column",
      width: "37%",
    },
    gridColumns: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    gridLeft: {
      flexDirection: "column",
      width: "44%",
    },
    gridRight: {
      flexDirection: "column",
      width: "52%",
    },
    posterFlow: {
      flex: 1,
      flexDirection: "column",
    },
    posterIntro: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    posterIntroMain: {
      flexDirection: "column",
      width: "65%",
    },
    posterIntroAside: {
      flexDirection: "column",
      width: "31%",
    },
    summaryPageInner: {
      flex: 1,
      flexDirection: "column",
      paddingHorizontal: 28,
      paddingTop: 22,
      paddingBottom: 54,
    },
    summaryHeader: {
      backgroundColor: t.headerBg,
      borderWidth: 2,
      borderColor: t.panelBorder,
      borderRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 16,
      marginBottom: 14,
    },
    summaryTitle: {
      fontSize: 22,
      fontWeight: 700,
      color: t.titleText,
      marginBottom: 4,
    },
    summarySubtitle: {
      fontSize: 8.3,
      lineHeight: 1.45,
      color: t.headerSubtitle,
    },
    teamRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 16,
    },
    teamLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: t.questionText,
      marginRight: 10,
    },
    teamLine: {
      flex: 1,
      height: 18,
      borderBottomWidth: 1.5,
      borderBottomColor: t.guideLine,
    },
    answerInstruction: {
      fontSize: 8.8,
      lineHeight: 1.45,
      color: t.bodyMutedText,
      marginBottom: 12,
    },
    guidanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
      marginBottom: 14,
    },
    guidanceCard: {
      width: "48%",
      backgroundColor: t.noteBg,
      borderWidth: 1.5,
      borderColor: t.noteBorder,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
    },
    guidanceCardTitle: {
      fontSize: 8,
      fontWeight: 700,
      color: t.noteText,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 1.3,
    },
    guidanceCardBody: {
      fontSize: 8.2,
      lineHeight: 1.4,
      color: t.noteText,
    },
    answerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    answerItem: {
      width: "48%",
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: t.optionBorder,
      borderRadius: 14,
      backgroundColor: t.panelBg,
      overflow: "hidden",
      marginBottom: 10,
    },
    answerItemNumber: {
      width: 42,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.optionAccentBg,
      paddingVertical: 4,
    },
    answerItemNumberLabel: {
      fontSize: 9,
      textTransform: "uppercase",
      letterSpacing: 1.8,
      color: t.optionAccentText,
      marginBottom: 0,
    },
    answerItemNumberValue: {
      fontSize: 52,
      fontWeight: 700,
      color: t.optionAccentText,
    },
    answerBox: {
      flex: 1,
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    answerBoxInner: {
      height: 34,
      borderWidth: 1.5,
      borderColor: t.guideLine,
      borderRadius: 8,
      backgroundColor: "#ffffff",
    },
    answerKeyBody: {
      flex: 1,
      paddingTop: 4,
    },
    answerKeyRow: {
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: t.optionBorder,
      borderRadius: 14,
      backgroundColor: t.panelBg,
      overflow: "hidden",
      marginBottom: 8,
    },
    answerKeyNumber: {
      width: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.optionAccentBg,
    },
    answerKeyNumberText: {
      fontSize: 14,
      fontWeight: 700,
      color: t.optionAccentText,
    },
    answerKeyContent: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    answerKeyTitle: {
      fontSize: 10,
      fontWeight: 700,
      color: t.questionText,
      marginBottom: 2,
    },
    answerKeyQuestion: {
      fontSize: 7.8,
      lineHeight: 1.4,
      color: t.bodyMutedText,
      marginBottom: 3,
    },
    answerKeyAnswer: {
      fontSize: 8.6,
      fontWeight: 700,
      color: t.questionText,
    },
    answerKeyLetter: {
      color: t.headerAccent,
    },
    answerKeyFooterNote: {
      backgroundColor: t.noteBg,
      borderWidth: 1.5,
      borderColor: t.noteBorder,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      marginTop: 6,
    },
    answerKeyFooterTitle: {
      fontSize: 8,
      fontWeight: 700,
      color: t.noteText,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 1.3,
    },
    answerKeyFooterBody: {
      fontSize: 8.1,
      lineHeight: 1.45,
      color: t.noteText,
    },
  });
}

type PdfStyles = ReturnType<typeof createStyles>;

function getDisplaySubject(subject: string) {
  return subject.trim() || "Ikke angivet";
}

function getDisplayGradeLevel(gradeLevel: string) {
  return gradeLevel.trim() || "Ikke angivet";
}

function getCorrectAnswer(post: Post) {
  if (post.correct_index === undefined || !post.options) {
    return { letter: "?", option: "Intet svar" };
  }
  const letter = LETTER_LABELS[post.correct_index] ?? "?";
  const option = post.options[post.correct_index] ?? "Ukendt svar";
  return { letter, option };
}

function renderMetaChips(styles: PdfStyles, values: string[]) {
  return (
    <View style={styles.chipRow}>
      {values.map((value) => (
        <View key={value} style={styles.chip}>
          <Text style={styles.chipText}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Watermark Layer ───────────────────────────────────────────────── */
function renderWatermarkLayer(template: PdfTemplate) {
  const glyphs = template.watermarkGlyphs;
  if (!glyphs.length) return null;

  const positions: { top: number; left: number; fontSize: number; rotate: string; glyph: string }[] = [
    { top: 180, left: 20, fontSize: 180, rotate: "-22deg", glyph: glyphs[0]! },
    { top: 500, left: 280, fontSize: 120, rotate: "15deg", glyph: glyphs[glyphs.length > 1 ? 1 : 0]! },
    { top: 350, left: 60, fontSize: 90, rotate: "-35deg", glyph: glyphs[glyphs.length > 2 ? 2 : 0]! },
  ];

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {positions.map((p, i) => (
        <Text
          key={`wm-${i}`}
          style={{
            position: "absolute",
            top: p.top,
            left: p.left,
            fontSize: p.fontSize,
            fontWeight: 700,
            color: template.theme.headerAccent,
            opacity: 0.045,
            transform: `rotate(${p.rotate})`,
          }}
        >
          {p.glyph}
        </Text>
      ))}
    </View>
  );
}

/* ── Corner Marks ──────────────────────────────────────────────────── */
function renderCornerMarks(template: PdfTemplate) {
  const mark = template.cornerMark;
  if (!mark) return null;

  return (
    <>
      <Text
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          fontSize: 9,
          fontWeight: 700,
          color: template.theme.headerAccent,
          opacity: 0.15,
        }}
      >
        {mark}
      </Text>
      <Text
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          fontSize: 9,
          fontWeight: 700,
          color: template.theme.headerAccent,
          opacity: 0.15,
        }}
      >
        {mark}
      </Text>
    </>
  );
}

/* ── Watermark SVG Fallbacks ───────────────────────────────────────── */
function renderWatermarkSvgLayer(template: PdfTemplate) {
  const variant = template.key;

  if (variant === "fysik-kemi-grid") {
    return (
      <View style={{ position: "absolute", top: 160, left: 30, width: 200, height: 200 }}>
        <Svg viewBox="0 0 200 200" style={{ width: 200, height: 200 }}>
          {/* Atom ring */}
          <Circle cx={100} cy={100} r={50} fill="none" stroke={template.theme.headerAccent} strokeWidth={2} opacity={0.05} />
          <Circle cx={100} cy={100} r={4} fill={template.theme.headerAccent} opacity={0.05} />
          <Path d="M100 50 Q140 75 100 100 Q60 125 100 150" fill="none" stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
          <Path d="M50 100 Q75 60 100 100 Q125 140 150 100" fill="none" stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
        </Svg>
      </View>
    );
  }

  if (variant === "geografi-classic") {
    return (
      <View style={{ position: "absolute", top: 280, left: 200, width: 160, height: 160 }}>
        <Svg viewBox="0 0 160 160" style={{ width: 160, height: 160 }}>
          {/* Compass rose */}
          <Circle cx={80} cy={80} r={60} fill="none" stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.05} />
          <Circle cx={80} cy={80} r={40} fill="none" stroke={template.theme.headerAccent} strokeWidth={1} opacity={0.04} />
          <Line x1={80} y1={15} x2={80} y2={145} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.05} />
          <Line x1={15} y1={80} x2={145} y2={80} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.05} />
          <Path d="M80 20L86 70H94L80 80L66 70H74Z" fill={template.theme.headerAccent} opacity={0.04} />
        </Svg>
      </View>
    );
  }

  if (variant === "biologi-editorial") {
    return (
      <View style={{ position: "absolute", top: 200, left: 50, width: 140, height: 280 }}>
        <Svg viewBox="0 0 140 280" style={{ width: 140, height: 280 }}>
          {/* DNA helix */}
          <Path d="M40 20 Q100 60 40 100 Q-20 140 40 180 Q100 220 40 260" fill="none" stroke={template.theme.headerAccent} strokeWidth={2} opacity={0.04} />
          <Path d="M100 20 Q40 60 100 100 Q160 140 100 180 Q40 220 100 260" fill="none" stroke={template.theme.headerAccent} strokeWidth={2} opacity={0.04} />
          {/* Rungs */}
          <Line x1={50} y1={40} x2={90} y2={40} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
          <Line x1={35} y1={80} x2={105} y2={80} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
          <Line x1={50} y1={120} x2={90} y2={120} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
          <Line x1={35} y1={160} x2={105} y2={160} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
          <Line x1={50} y1={200} x2={90} y2={200} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
          <Line x1={35} y1={240} x2={105} y2={240} stroke={template.theme.headerAccent} strokeWidth={1.5} opacity={0.04} />
        </Svg>
      </View>
    );
  }

  return null;
}


function renderHero(
  styles: PdfStyles,
  template: PdfTemplate,
  post: Post,
  imageUrl: string,
  subject: string
) {
  const isHeroImage = true;
  const hasImage = Boolean(imageUrl);

  return (
    <View style={styles.heroCard}>
      {isHeroImage && hasImage ? (
        // react-pdf's Image is not a DOM img; jsx-a11y still treats it as one.
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={imageUrl} style={styles.heroImage} />
      ) : isHeroImage ? (
        <View style={styles.heroVisual}>
          <Text style={styles.heroFallbackTitle}>Illustration mangler</Text>
          <Text style={styles.heroFallbackBody}>
            {"Hero-billedet kunne ikke hentes. PDF'en vises stadig, og resten af posten er intakt."}
          </Text>
        </View>
      ) : (
        <View style={styles.heroVisual}>
          {renderSubjectIconGraphic(styles, subject)}
        </View>
      )}
    </View>
  );
}

function renderSubjectIconGraphic(styles: PdfStyles, subject: string) {
  switch (resolveSubjectIconVariant(subject)) {
    case "dansk":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#fff7ed" stroke="#7a284c" strokeWidth={2.4} />
          <Path d="M24 58V24c12-5 24-5 36 0v34c-12-5-24-5-36 0Z" fill="#fffdf9" stroke="#9d174d" strokeWidth={2.4} />
          <Path d="M96 58V24c-12-5-24-5-36 0v34c12-5 24-5 36 0Z" fill="#fffdf9" stroke="#9d174d" strokeWidth={2.4} />
          <Line x1={60} y1={24} x2={60} y2={58} stroke="#f59eae" strokeWidth={2.2} />
          <Line x1={30} y1={31} x2={50} y2={31} stroke="#f59eae" strokeWidth={2.6} />
          <Line x1={30} y1={39} x2={50} y2={39} stroke="#f59eae" strokeWidth={2.6} />
          <Line x1={70} y1={31} x2={90} y2={31} stroke="#f59eae" strokeWidth={2.6} />
          <Line x1={70} y1={39} x2={90} y2={39} stroke="#f59eae" strokeWidth={2.6} />
        </Svg>
      );
    case "matematik":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#f8fbff" stroke="#60a5fa" strokeWidth={2.4} />
          <Path d="M28 57L48 24l20 33Z" fill="#dbeafe" stroke="#1d4ed8" strokeWidth={2.4} />
          <Rect x={58} y={24} width={18} height={18} rx={2.5} fill="#eff6ff" stroke="#2563eb" strokeWidth={2.4} />
          <Circle cx={88} cy={50} r={10} fill="#eff6ff" stroke="#1d4ed8" strokeWidth={2.4} />
          <Line x1={22} y1={18} x2={98} y2={18} stroke="#bfdbfe" strokeWidth={1.8} />
          <Line x1={22} y1={62} x2={98} y2={62} stroke="#bfdbfe" strokeWidth={1.8} />
        </Svg>
      );
    case "engelsk":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#fffdf7" stroke="#fdba74" strokeWidth={2.4} />
          <Rect x={24} y={20} width={38} height={24} rx={3} fill="#102347" />
          <Line x1={24} y1={20} x2={62} y2={44} stroke="#ffffff" strokeWidth={5.5} />
          <Line x1={62} y1={20} x2={24} y2={44} stroke="#ffffff" strokeWidth={5.5} />
          <Line x1={24} y1={20} x2={62} y2={44} stroke="#ef4444" strokeWidth={2.6} />
          <Line x1={62} y1={20} x2={24} y2={44} stroke="#ef4444" strokeWidth={2.6} />
          <Line x1={43} y1={20} x2={43} y2={44} stroke="#ffffff" strokeWidth={8} />
          <Line x1={24} y1={32} x2={62} y2={32} stroke="#ffffff" strokeWidth={8} />
          <Line x1={43} y1={20} x2={43} y2={44} stroke="#ef4444" strokeWidth={3.8} />
          <Line x1={24} y1={32} x2={62} y2={32} stroke="#ef4444" strokeWidth={3.8} />
          <Rect x={78} y={18} width={10} height={42} rx={2} fill="#102347" />
          <Line x1={72} y1={28} x2={94} y2={28} stroke="#102347" strokeWidth={3.6} />
          <Line x1={70} y1={38} x2={96} y2={38} stroke="#102347" strokeWidth={3.6} />
          <Line x1={72} y1={48} x2={94} y2={48} stroke="#102347" strokeWidth={3.6} />
        </Svg>
      );
    case "tysk":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#fffdf7" stroke="#fbbf24" strokeWidth={2.4} />
          {/* German flag stripes */}
          <Rect x={24} y={20} width={72} height={10} rx={2} fill="#1c1917" />
          <Rect x={24} y={32} width={72} height={10} rx={2} fill="#dc2626" />
          <Rect x={24} y={44} width={72} height={10} rx={2} fill="#facc15" />
          {/* Gothic letter */}
          <Rect x={50} y={58} width={20} height={8} rx={2} fill="#422006" opacity={0.4} />
        </Svg>
      );
    case "fysik-kemi":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#f5f3ff" stroke="#a78bfa" strokeWidth={2.4} />
          {/* Atom */}
          <Circle cx={60} cy={40} r={5} fill="#5b21b6" />
          <Circle cx={60} cy={40} r={20} fill="none" stroke="#a78bfa" strokeWidth={2} />
          <Path d="M40 40 Q50 20 60 40 Q70 60 80 40" fill="none" stroke="#7c3aed" strokeWidth={2} />
          <Path d="M60 20 Q80 30 60 40 Q40 50 60 60" fill="none" stroke="#7c3aed" strokeWidth={2} />
          {/* Flask */}
          <Path d="M88 24V36L98 56H78L88 36Z" fill="#ede9fe" stroke="#5b21b6" strokeWidth={2} />
          <Rect x={84} y={20} width={8} height={6} rx={1} fill="#5b21b6" />
        </Svg>
      );
    case "geografi":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#ecfdf5" stroke="#34d399" strokeWidth={2.4} />
          {/* Globe */}
          <Circle cx={60} cy={40} r={22} fill="#d1fae5" stroke="#047857" strokeWidth={2.2} />
          <Path d="M60 18C52 24 48 32 48 40C48 48 52 56 60 62" fill="none" stroke="#047857" strokeWidth={1.6} />
          <Path d="M60 18C68 24 72 32 72 40C72 48 68 56 60 62" fill="none" stroke="#047857" strokeWidth={1.6} />
          <Line x1={38} y1={32} x2={82} y2={32} stroke="#047857" strokeWidth={1.4} />
          <Line x1={38} y1={48} x2={82} y2={48} stroke="#047857" strokeWidth={1.4} />
          <Line x1={60} y1={18} x2={60} y2={62} stroke="#047857" strokeWidth={1.4} />
          {/* Compass needle */}
          <Path d="M92 20L96 28L88 28Z" fill="#059669" />
          <Path d="M92 36L96 28L88 28Z" fill="#d1fae5" stroke="#059669" strokeWidth={1} />
        </Svg>
      );
    case "biologi":
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#f0fdf4" stroke="#4ade80" strokeWidth={2.4} />
          {/* DNA helix */}
          <Path d="M36 20 Q56 30 36 40 Q16 50 36 60" fill="none" stroke="#16a34a" strokeWidth={2.2} />
          <Path d="M56 20 Q36 30 56 40 Q76 50 56 60" fill="none" stroke="#16a34a" strokeWidth={2.2} />
          <Line x1={38} y1={25} x2={54} y2={25} stroke="#4ade80" strokeWidth={1.6} />
          <Line x1={32} y1={35} x2={60} y2={35} stroke="#4ade80" strokeWidth={1.6} />
          <Line x1={38} y1={45} x2={54} y2={45} stroke="#4ade80" strokeWidth={1.6} />
          <Line x1={32} y1={55} x2={60} y2={55} stroke="#4ade80" strokeWidth={1.6} />
          {/* Leaf */}
          <Path d="M82 56C72 46 72 30 82 20C92 30 92 46 82 56Z" fill="#dcfce7" stroke="#166534" strokeWidth={2} />
          <Line x1={82} y1={22} x2={82} y2={54} stroke="#166534" strokeWidth={1.4} />
          <Line x1={76} y1={32} x2={82} y2={28} stroke="#166534" strokeWidth={1} />
          <Line x1={88} y1={38} x2={82} y2={34} stroke="#166534" strokeWidth={1} />
          <Line x1={76} y1={44} x2={82} y2={40} stroke="#166534" strokeWidth={1} />
        </Svg>
      );
    default:
      return (
        <Svg viewBox="0 0 120 80" style={styles.heroIcon}>
          <Rect x={14} y={12} width={92} height={56} rx={10} fill="#ffffff" stroke="#94a3b8" strokeWidth={2.4} />
          <Circle cx={60} cy={40} r={18} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={2.4} />
          <Path d="M60 22l5.5 12.5L79 36l-10 8.5L72 58l-12-7-12 7 3-13.5L41 36l13.5-1.5Z" fill="#0f172a" />
          <Line x1={60} y1={14} x2={60} y2={22} stroke="#0f172a" strokeWidth={2.6} />
          <Line x1={60} y1={58} x2={60} y2={66} stroke="#0f172a" strokeWidth={2.6} />
          <Line x1={34} y1={40} x2={42} y2={40} stroke="#0f172a" strokeWidth={2.6} />
          <Line x1={78} y1={40} x2={86} y2={40} stroke="#0f172a" strokeWidth={2.6} />
        </Svg>
      );
  }
}

function renderBodySection(styles: PdfStyles, template: PdfTemplate, post: Post, title?: string) {
  return (
    <View style={styles.bodyCard}>
      <Text style={styles.sectionLabel}>{template.bodyLabel}</Text>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <Text style={styles.bodyText}>{post.body_text}</Text>
    </View>
  );
}

function renderEditorialAside(styles: PdfStyles, template: PdfTemplate, run: StjernelobData) {
  return (
    <>
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Læseramme</Text>
        <Text style={styles.noteBody}>
          Læs teksten roligt, se efter tydelige spor i formuleringerne, og vælg derefter det svar,
          der passer bedst til indholdet.
        </Text>
      </View>
      <View style={[styles.bodyCard, styles.bodyCardMuted]}>
        <Text style={styles.sectionLabel}>Redaktionel tone</Text>
        <Text style={styles.sectionTitle}>{run.title}</Text>
        <Text style={styles.mutedText}>
          Denne udgave er bygget som en mere boglig post med længere læserytme og tydelig
          tekststruktur.
        </Text>
      </View>
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Til læreren</Text>
        <Text style={styles.noteBody}>
          Hæng posten i øjenhøjde og giv holdene ro til at læse færdigt, før de svarer.
        </Text>
      </View>
    </>
  );
}

function renderGridAside(styles: PdfStyles) {
  return (
    <View style={[styles.bodyCard, styles.bodyCardMuted]}>
      <Text style={styles.sectionLabel}>Scan hurtigt</Text>
      <Text style={styles.sectionTitle}>Mønstre først</Text>
      <Text style={styles.mutedText}>
        Kig efter størrelser, relationer, rækkefølger eller geometriske hint i både billedet og
        teksten, før I vælger svar.
      </Text>
    </View>
  );
}

function renderPosterAside(styles: PdfStyles) {
  return (
    <>
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Mission cue</Text>
        <Text style={styles.noteBody}>
          Read fast, agree on one answer, and move to the next station with momentum.
        </Text>
      </View>
      <View style={[styles.bodyCard, styles.bodyCardMuted]}>
        <Text style={styles.sectionLabel}>Tempo</Text>
        <Text style={styles.sectionTitle}>Keep it moving</Text>
        <Text style={styles.mutedText}>
          Poster-layouten er lavet til hurtig scanning, tydelig briefing og stærk mission-følelse.
        </Text>
      </View>
    </>
  );
}

function renderQuestionSection(styles: PdfStyles, template: PdfTemplate, post: Post) {
  // Crossword: vis hint og antal bogstaver, skjul options
  if (post.answer_word) {
    return (
      <View style={styles.questionCard}>
        <Text style={styles.sectionLabel}>Ledetråd</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={styles.questionText}>{post.hint}</Text>
          <Text style={{ fontSize: 10, color: "#64748b", marginLeft: 10 }}>
            ({post.answer_word.length} bogstaver)
          </Text>
        </View>
      </View>
    );
  }
  // Classic: som før
  const optionsContainerStyle =
    template.optionMode === "stacked" ? styles.optionStack : styles.optionGrid;
  const optionItemStyle =
    template.optionMode === "stacked" ? styles.optionItemStacked : styles.optionItemGrid;

  return (
    <View style={styles.questionCard}>
      <Text style={styles.sectionLabel}>{template.questionLabel}</Text>
      <Text style={styles.questionText}>{post.question}</Text>
      {post.options && (
        <View style={optionsContainerStyle}>
          {post.options.map && post.options.map((option, index) => (
            <View key={`${post.number}-${index}`} style={optionItemStyle}>
              <View style={styles.optionAccent}>
                <Text style={styles.optionLetter}>{LETTER_LABELS[index]}</Text>
              </View>
              <Text style={styles.optionCopy}>{option}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function renderPostFooter(styles: PdfStyles, template: PdfTemplate, post: Post, totalPosts: number) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        {template.footerIcon} Post {post.number} / {totalPosts}
      </Text>
      <Text style={styles.footerText}>{template.footerLabel}</Text>
      <Text style={styles.footerText}>SkoleGPS.dk</Text>
    </View>
  );
}

function renderClassicPostPage(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post,
  totalPosts: number,
  imageUrl: string
) {
  return (
    <Page key={`post-${post.number}`} size="A4" style={styles.page}>
      {renderWatermarkLayer(template)}
      {renderWatermarkSvgLayer(template)}
      {renderCornerMarks(template)}
      <View style={styles.frame} />
      <View style={styles.pageInner}>
        {renderPostHeader(styles, template, run, post)}
        <View style={styles.classicFlow}>
          {renderHero(styles, template, post, imageUrl, run.subject)}
          {renderBodySection(styles, template, post)}
          {renderQuestionSection(styles, template, post)}
        </View>
      </View>
      {renderPostFooter(styles, template, post, totalPosts)}
    </Page>
  );
}

function renderEditorialPostPage(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post,
  totalPosts: number,
  imageUrl: string
) {
  return (
    <Page key={`post-${post.number}`} size="A4" style={styles.page}>
      {renderWatermarkLayer(template)}
      {renderWatermarkSvgLayer(template)}
      {renderCornerMarks(template)}
      <View style={styles.frame} />
      <View style={styles.pageInner}>
        {renderPostHeader(styles, template, run, post)}
        <View style={styles.editorialColumns}>
          <View style={styles.editorialMain}>
            {renderHero(styles, template, post, imageUrl, run.subject)}
            {renderBodySection(styles, template, post, "Læs og fortolk")}
            {renderQuestionSection(styles, template, post)}
          </View>
          <View style={styles.editorialAside}>{renderEditorialAside(styles, template, run)}</View>
        </View>
      </View>
      {renderPostFooter(styles, template, post, totalPosts)}
    </Page>
  );
}

function renderGridPostPage(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post,
  totalPosts: number,
  imageUrl: string
) {
  return (
    <Page key={`post-${post.number}`} size="A4" style={styles.page}>
      {renderWatermarkLayer(template)}
      {renderWatermarkSvgLayer(template)}
      {renderCornerMarks(template)}
      <View style={styles.frame} />
      <View style={styles.pageInner}>
        {renderPostHeader(styles, template, run, post)}
        <View style={styles.gridColumns}>
          <View style={styles.gridLeft}>
            {renderHero(styles, template, post, imageUrl, run.subject)}
            {renderGridAside(styles)}
          </View>
          <View style={styles.gridRight}>
            {renderBodySection(styles, template, post, "Problemfelt")}
            {renderQuestionSection(styles, template, post)}
          </View>
        </View>
      </View>
      {renderPostFooter(styles, template, post, totalPosts)}
    </Page>
  );
}

function renderPosterPostPage(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post,
  totalPosts: number,
  imageUrl: string
) {
  return (
    <Page key={`post-${post.number}`} size="A4" style={styles.page}>
      {renderWatermarkLayer(template)}
      {renderWatermarkSvgLayer(template)}
      {renderCornerMarks(template)}
      <View style={styles.frame} />
      <View style={styles.pageInner}>
        {renderPostHeader(styles, template, run, post)}
        <View style={styles.posterFlow}>
          {renderHero(styles, template, post, imageUrl, run.subject)}
          <View style={styles.posterIntro}>
            <View style={styles.posterIntroMain}>
              {renderBodySection(styles, template, post, "Mission briefing")}
              {renderQuestionSection(styles, template, post)}
            </View>
            <View style={styles.posterIntroAside}>{renderPosterAside(styles)}</View>
          </View>
        </View>
      </View>
      {renderPostFooter(styles, template, post, totalPosts)}
    </Page>
  );
}

function renderPostHeader(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post
) {
  return (
    <View style={styles.header}>
      <Text style={{ fontSize: 72, fontWeight: 700, color: template.theme.headerAccent, opacity: 0.12, position: "absolute", right: 28, top: 8 }}>
        {template.motif}
      </Text>
      {template.subjectBadge ? (
        <View
          style={{
            position: "absolute",
            right: 16,
            bottom: 10,
            backgroundColor: template.theme.badgeBg,
            borderWidth: 1.5,
            borderColor: template.theme.badgeBorder,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 3,
          }}
        >
          <Text
            style={{
              fontSize: 6,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: template.theme.badgeText,
            }}
          >
            {template.subjectBadge}
          </Text>
        </View>
      ) : null}
      <Text style={styles.title}>POST {post.number}</Text>
      <Text style={styles.runTitle}>{post.title}</Text>
    </View>
  );
}

function renderAnswerSheetPage(styles: PdfStyles, template: PdfTemplate, run: StjernelobData) {
  return (
    <Page size="A4" style={[styles.page, { backgroundColor: template.theme.answerSheetBg }]}>
      <View style={styles.frame} />
      <View style={styles.summaryPageInner}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Svarark</Text>
        </View>

        <View style={styles.teamRow}>
          <Text style={styles.teamLabel}>Holdnavn</Text>
          <View style={styles.teamLine} />
        </View>

        <Text style={styles.answerInstruction}>
          Skriv A, B, C eller D i boksen ud for hver post. Brug kun ét svar pr. post, og ret først,
          når hele holdet er enige.
        </Text>



        <View style={styles.answerGrid}>
          {run.posts.map((post) => (
            <View key={`answer-${post.number}`} style={styles.answerItem}>
              <View style={styles.answerItemNumber}>
                <Text style={styles.answerItemNumberLabel}>Post</Text>
                <Text style={styles.answerItemNumberValue}>{post.number}</Text>
              </View>
              <View style={styles.answerBox}>
                {post.answer_word ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {Array.from({ length: post.answer_word.length }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.answerBoxInner,
                          { width: 30, marginRight: 6 },
                        ]}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.answerBoxInner} />
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Elevsvarark</Text>
        <Text style={styles.footerText}>SkoleGPS.dk</Text>
      </View>
    </Page>
  );
}

function renderAnswerKeyPage(styles: PdfStyles, template: PdfTemplate, run: StjernelobData) {
  return (
    <Page size="A4" style={[styles.page, { backgroundColor: template.theme.answerKeyBg }]}>
      <View style={styles.frame} />
      <View style={styles.summaryPageInner}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Facitliste</Text>
        </View>

        <View style={styles.answerKeyBody}>
          {run.posts.map((post) => {
            if (post.answer_word) {
              return (
                <View key={`key-${post.number}`} style={styles.answerKeyRow}>
                  <View style={styles.answerKeyNumber}>
                    <Text style={styles.answerKeyNumberText}>{post.number}</Text>
                  </View>
                  <View style={styles.answerKeyContent}>
                    <Text style={styles.answerKeyTitle}>{post.title}</Text>
                    <Text style={styles.answerKeyQuestion}>{post.hint}</Text>
                    <Text style={styles.answerKeyAnswer}>{post.answer_word.toUpperCase()}</Text>
                  </View>
                </View>
              );
            }
            const correctAnswer = getCorrectAnswer(post);
            return (
              <View key={`key-${post.number}`} style={styles.answerKeyRow}>
                <View style={styles.answerKeyNumber}>
                  <Text style={styles.answerKeyNumberText}>{post.number}</Text>
                </View>
                <View style={styles.answerKeyContent}>
                  <Text style={styles.answerKeyTitle}>{post.title}</Text>
                  <Text style={styles.answerKeyQuestion}>{post.question}</Text>
                  {post.options && (
                    <Text style={styles.answerKeyAnswer}>
                      <Text style={styles.answerKeyLetter}>{correctAnswer.letter}</Text>
                      {` — ${correctAnswer.option}`}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.answerKeyFooterNote}>
          <Text style={styles.answerKeyFooterTitle}>Lærerplacering</Text>
          <Text style={styles.answerKeyFooterBody}>
            Læg facitlisten ved lærermappen, på clipboard eller i startområdet bagved bordet. Del
            den først, når holdene er færdige, eller brug den kun til hurtig kontrol undervejs.
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Facitliste</Text>
        <Text style={styles.footerText}>SkoleGPS.dk</Text>
      </View>
    </Page>
  );
}

/* ── PDF Document ──────────────────────────────────────────────────── */
function StjernelobDocument({
  run,
  imageSources,
}: {
  run: StjernelobData;
  imageSources: Record<number, string>;
}) {
  const template = resolveTemplate(run.subject);
  const styles = createStyles(template);
  const totalPosts = run.posts.length;

  return (
    <Document title={run.title} author="gpsloeb.dk">
      {run.posts.map((post) => {
        const imageUrl = imageSources[post.number] ?? "";
        return renderPostPage(styles, template, run, post, totalPosts, imageUrl);
      })}
      {renderAnswerSheetPage(styles, template, run)}
      {renderAnswerKeyPage(styles, template, run)}
    </Document>
  );
}

/* ── Client Wrapper ────────────────────────────────────────────────── */
// PDFViewer must only render on the client (uses iframe + blob)
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false }
);

export default function StjernelobPdfView({ run }: StjernelobPdfViewProps) {
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [imageFallbackCount, setImageFallbackCount] = useState(0);
  const [preparedImageSources, setPreparedImageSources] = useState<Record<number, string>>(() =>
    buildInitialPdfImageSources(run.posts, run.subject)
  );
  const prepareImagesPromiseRef = useRef<Promise<PreparedPdfImages> | null>(null);
  const imagePreparationGenerationRef = useRef(0);

  const ensurePreparedImageSources = useCallback(
    async (signal?: AbortSignal) => {
      if (prepareImagesPromiseRef.current) {
        return prepareImagesPromiseRef.current;
      }

      const generation = imagePreparationGenerationRef.current;
      // The promise compares against itself in finally to avoid clearing a newer preparation.
      /* eslint-disable prefer-const */
      let promise!: Promise<PreparedPdfImages>;
      promise = (async () => {
        /* eslint-enable prefer-const */
        if (generation === imagePreparationGenerationRef.current) {
          setIsPreparingImages(true);
        }

        try {
          const prepared = await preparePdfImages(run.posts, run.subject, signal);

          if (generation !== imagePreparationGenerationRef.current) {
            return {
              sources: {},
              totalCount: 0,
              loadedCount: 0,
              fallbackCount: 0,
            };
          }

          setPreparedImageSources(prepared.sources);
          setImageFallbackCount(prepared.fallbackCount);
          return prepared;
        } catch (error) {
          if (isAbortError(error)) {
            return {
              sources: {},
              totalCount: 0,
              loadedCount: 0,
              fallbackCount: 0,
            };
          }

          console.error("Kunne ikke klargoere PDF-billeder:", error);
          const fallbackSources = buildInitialPdfImageSources(run.posts, run.subject);

          setPreparedImageSources(fallbackSources);
          setImageFallbackCount(run.posts.some((post) => post.number === 1) ? 1 : 0);

          return {
            sources: fallbackSources,
            totalCount: run.posts.length,
            loadedCount: Math.max(run.posts.length - 1, 0),
            fallbackCount: run.posts.some((post) => post.number === 1) ? 1 : 0,
          };
        } finally {
          if (prepareImagesPromiseRef.current === promise) {
            prepareImagesPromiseRef.current = null;
          }

          if (generation === imagePreparationGenerationRef.current) {
            setIsPreparingImages(false);
          }
        }
      })();

      prepareImagesPromiseRef.current = promise;
      return promise;
    },
    [run.posts, run.subject]
  );

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    imagePreparationGenerationRef.current += 1;
    prepareImagesPromiseRef.current = null;
    setPreparedImageSources(buildInitialPdfImageSources(run.posts, run.subject));
    setImageFallbackCount(0);

    void ensurePreparedImageSources(abortController.signal);

    return () => {
      abortController.abort();
      prepareImagesPromiseRef.current = null;
    };
  }, [ensurePreparedImageSources, run.id, run.posts, run.subject]);

  const buildPdfBlob = useCallback(async () => {
    const prepared = await ensurePreparedImageSources();
    return pdf(<StjernelobDocument run={run} imageSources={prepared.sources} />).toBlob();
  }, [ensurePreparedImageSources, run]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${run.title || "stjerneloeb"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";

      const cleanup = () => {
        iframe.remove();
        URL.revokeObjectURL(url);
      };

      iframe.onload = () => {
        const targetWindow = iframe.contentWindow;
        if (!targetWindow) {
          cleanup();
          return;
        }

        targetWindow.focus();

        const afterPrintCleanup = () => {
          targetWindow.removeEventListener("afterprint", afterPrintCleanup);
          window.setTimeout(cleanup, 250);
        };

        targetWindow.addEventListener("afterprint", afterPrintCleanup, { once: true });
        window.setTimeout(cleanup, 60_000);
        targetWindow.print();
      };

      iframe.src = url;
      document.body.appendChild(iframe);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1e293b" }}>
      <style>{`@keyframes pdfHeroSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "#f5f5f4",
          borderBottom: "1px solid #d6d3d1",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#78716c",
              margin: 0,
            }}
          >
            {run.subject} · {run.grade_level}
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1c1917", margin: "4px 0 0" }}>
            {run.title}
          </h1>
          {isPreparingImages ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  border: "2px solid #cbd5e1",
                  borderTopColor: "#475569",
                  animation: "pdfHeroSpin 0.9s linear infinite",
                }}
              />
              <p style={{ fontSize: 12, color: "#78716c", margin: 0 }}>
                Opdaterer hero-billede i baggrunden...
              </p>
            </div>
          ) : null}
          {!isPreparingImages && imageFallbackCount > 0 ? (
            <p style={{ fontSize: 12, color: "#92400e", margin: "6px 0 0" }}>
              {imageFallbackCount} billede{imageFallbackCount === 1 ? "" : "r"} blev erstattet med en sikker placeholder.
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a
            href="/dashboard/opret/stjerneloeb"
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: "#57534e",
              background: "#ffffff",
              border: "1px solid #d6d3d1",
              borderRadius: 6,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            ← Ny version
          </a>
          <button
            onClick={handlePrint}
            disabled={isPrinting || isDownloading}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              color: "#312e81",
              background: isPrinting || isDownloading ? "#e2e8f0" : "#eef2ff",
              border: "1px solid #c7d2fe",
              borderRadius: 8,
              cursor: isPrinting || isDownloading ? "wait" : "pointer",
              opacity: isPrinting || isDownloading ? 0.7 : 1,
            }}
          >
            {isPrinting ? "Forbereder print..." : "Print PDF"}
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading || isPrinting}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              background: isDownloading || isPrinting ? "#8b5cf6aa" : "#7c3aed",
              border: "none",
              borderRadius: 8,
              cursor: isDownloading || isPrinting ? "wait" : "pointer",
              opacity: isDownloading || isPrinting ? 0.7 : 1,
            }}
          >
            {isDownloading ? "Genererer..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {isClientMounted ? (
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            <StjernelobDocument run={run} imageSources={preparedImageSources} />
          </PDFViewer>
        ) : (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#cbd5e1" }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  border: "2px solid rgba(226,232,240,0.35)",
                  borderTopColor: "#e2e8f0",
                  animation: "pdfHeroSpin 0.9s linear infinite",
                }}
              />
              <span style={{ fontSize: 14 }}>Klargør PDF-preview...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
