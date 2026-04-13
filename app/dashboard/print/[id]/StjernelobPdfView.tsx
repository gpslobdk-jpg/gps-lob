"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
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
  question: string;
  options: [string, string, string, string];
  correct_index: number;
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
Font.register({
  family: "Playfair",
  fonts: [
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQZNLo_U2r.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3ukDQZNLo_U2r.woff2", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKebukDQZNLo_U2r.woff2", fontWeight: 900 },
  ],
});

Font.register({
  family: "Lora",
  fonts: [
    { src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkq0.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787z5vBJBkq0.woff2", fontWeight: 700 },
  ],
});

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
  heroCaption: string;
  footerLabel: string;
  motif: string;
  optionMode: "grid" | "stacked";
  theme: PdfTheme;
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

const DEFAULT_TEMPLATE: PdfTemplate = {
  key: "standard",
  label: "Standard",
  variant: "classic",
  eyebrow: "Læs, gå videre og svar",
  strapline: "En robust standard-skabelon til alle fag, der ikke har deres egen specialudgave endnu.",
  bodyLabel: "Faglig tekst",
  questionLabel: "Spørgsmål",
  heroCaption: "Illustration til posten",
  footerLabel: "Analog post",
  motif: "✦",
  optionMode: "grid",
  theme: STANDARD_THEME,
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
    heroCaption: "Stemningsbillede til teksten",
    footerLabel: "Dansk · analog post",
    motif: "✒",
    optionMode: "stacked",
    theme: DANISH_THEME,
  },
  matematik: {
    key: "matematik-grid",
    label: "Matematik Grid",
    variant: "grid",
    eyebrow: "Se mønsteret og løs opgaven",
    strapline: "Geometrisk og præcis post med stærkt overblik, hurtig scanning og tydelige svarfelter.",
    bodyLabel: "Problemfelt",
    questionLabel: "Løsningsvalg",
    heroCaption: "Visuel nøgle til opgaven",
    footerLabel: "Matematik · analog post",
    motif: "∑",
    optionMode: "grid",
    theme: MATH_THEME,
  },
  engelsk: {
    key: "english-poster",
    label: "English Poster",
    variant: "poster",
    eyebrow: "Read, decide, move on",
    strapline: "Plakatagtig post med klar energi, høj læsbarhed og en stærk mission-følelse.",
    bodyLabel: "Mission briefing",
    questionLabel: "Choose the best answer",
    heroCaption: "Scene setter",
    footerLabel: "English · analog post",
    motif: "★",
    optionMode: "grid",
    theme: ENGLISH_THEME,
  },
};

function resolveTemplate(subject: string): PdfTemplate {
  const key = subject.trim().toLowerCase();
  for (const [mapKey, template] of Object.entries(SUBJECT_TEMPLATES)) {
    if (key === mapKey || key.includes(mapKey) || mapKey.includes(key)) {
      return template;
    }
  }

  return DEFAULT_TEMPLATE;
}

/* ── Image URL helpers ─────────────────────────────────────────────── */
const LETTER_LABELS = ["A", "B", "C", "D"] as const;
const PDF_IMAGE_FETCH_TIMEOUT_MS = 10_000;
const PDF_IMAGE_MAX_RETRY_ATTEMPTS = 2;
const PDF_IMAGE_RETRY_DELAY_MS = 800;
const POLLINATIONS_HOSTNAME = "image.pollinations.ai";

function getPdfImagePrompt(post: Post): string {
  return typeof post.image_prompt === "string" ? post.image_prompt.trim() : "";
}

function getPdfImageRequest(post: Post): { url: string; isPollinations: boolean } {
  const prompt = getPdfImagePrompt(post);
  if (prompt) {
    return {
      url: `/api/pollinations-image?prompt=${encodeURIComponent(prompt)}`,
      isPollinations: true,
    };
  }

  const rawUrl = typeof post.image_url === "string" ? post.image_url.trim() : "";
  return {
    url: rawUrl,
    isPollinations: isPollinationsImageUrl(rawUrl),
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

type PdfSubjectIconVariant = "standard" | "dansk" | "matematik" | "engelsk";

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
      fontFamily: "Lora",
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
      paddingHorizontal: 28,
      paddingTop: 22,
      paddingBottom: 54,
    },
    header: {
      backgroundColor: t.headerBg,
      borderWidth: 2,
      borderColor: t.panelBorder,
      borderRadius: 18,
      paddingHorizontal: isPoster ? 22 : 20,
      paddingTop: isPoster ? 20 : 18,
      paddingBottom: 16,
      marginBottom: 14,
    },
    eyebrowRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    eyebrow: {
      fontFamily: "Playfair",
      fontSize: 6.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 2.5,
      color: t.headerSubtitle,
    },
    motif: {
      fontFamily: "Playfair",
      fontSize: isPoster ? 18 : 14,
      fontWeight: 900,
      color: t.headerAccent,
    },
    runTitle: {
      fontSize: 8.5,
      color: t.headerSubtitle,
      marginBottom: 8,
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
      fontFamily: "Playfair",
      fontSize: isPoster ? 12 : 10,
      fontWeight: 900,
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
      fontFamily: "Playfair",
      fontSize: isPoster ? 23 : isEditorial ? 21 : isGrid ? 20 : 19,
      fontWeight: 900,
      color: t.titleText,
      lineHeight: 1.15,
      marginBottom: 8,
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
      width: "100%",
      height: isPoster ? 190 : isEditorial ? 170 : 150,
      objectFit: "cover",
    },
    heroIcon: {
      width: "100%",
      height: isPoster ? 190 : isEditorial ? 170 : 150,
    },
    heroFallbackTitle: {
      fontFamily: "Playfair",
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
    heroCaptionWrap: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: t.panelMutedBg,
    },
    heroCaption: {
      fontSize: 7.2,
      color: t.bodyMutedText,
      lineHeight: 1.4,
    },
    bodyCard: {
      backgroundColor: t.panelBg,
      borderWidth: 1.5,
      borderColor: t.panelBorder,
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
      fontFamily: "Playfair",
      fontSize: 8,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      color: t.headerAccent,
      marginBottom: 6,
    },
    sectionTitle: {
      fontFamily: "Playfair",
      fontSize: 11,
      fontWeight: 700,
      color: t.questionText,
      marginBottom: 4,
    },
    bodyText: {
      fontSize: 9.4,
      lineHeight: isPoster ? 1.55 : 1.65,
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
      fontFamily: "Playfair",
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
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 12,
    },
    questionText: {
      fontFamily: "Playfair",
      fontSize: isPoster ? 13 : isGrid ? 12.5 : 12,
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
    },
    optionLetter: {
      fontFamily: "Playfair",
      fontSize: 12,
      fontWeight: 900,
      color: t.optionAccentText,
    },
    optionCopy: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 8.5,
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
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    footerText: {
      fontFamily: "Playfair",
      fontSize: 6.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 1.8,
      color: t.footerText,
    },
    classicFlow: {
      flex: 1,
    },
    editorialColumns: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    editorialMain: {
      width: "59%",
    },
    editorialAside: {
      width: "37%",
    },
    gridColumns: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    gridLeft: {
      width: "44%",
    },
    gridRight: {
      width: "52%",
    },
    posterFlow: {
      flex: 1,
    },
    posterIntro: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    posterIntroMain: {
      width: "65%",
    },
    posterIntroAside: {
      width: "31%",
    },
    summaryPageInner: {
      flex: 1,
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
      fontFamily: "Playfair",
      fontSize: 22,
      fontWeight: 900,
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
      fontFamily: "Playfair",
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
      fontFamily: "Playfair",
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
      paddingVertical: 10,
    },
    answerItemNumberLabel: {
      fontSize: 5.5,
      textTransform: "uppercase",
      letterSpacing: 1.8,
      color: t.optionAccentText,
      marginBottom: 1,
    },
    answerItemNumberValue: {
      fontFamily: "Playfair",
      fontSize: 16,
      fontWeight: 900,
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
      fontFamily: "Playfair",
      fontSize: 14,
      fontWeight: 900,
      color: t.optionAccentText,
    },
    answerKeyContent: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    answerKeyTitle: {
      fontFamily: "Playfair",
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
      fontFamily: "Playfair",
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
      fontFamily: "Playfair",
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

function renderPostHeader(
  styles: PdfStyles,
  template: PdfTemplate,
  run: StjernelobData,
  post: Post
) {
  return (
    <View style={styles.header}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{template.eyebrow}</Text>
        <Text style={styles.motif}>{template.motif}</Text>
      </View>
      <Text style={styles.runTitle}>{run.title}</Text>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Post {post.number}</Text>
        </View>
        <Text style={styles.templateLabel}>{template.footerLabel}</Text>
      </View>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.strapline}>{template.strapline}</Text>
      {renderMetaChips(styles, [
        `Fag: ${getDisplaySubject(run.subject)}`,
        `Klassetrin: ${getDisplayGradeLevel(run.grade_level)}`,
        `Layout: ${template.label}`,
      ])}
    </View>
  );
}

function renderHero(
  styles: PdfStyles,
  template: PdfTemplate,
  post: Post,
  imageUrl: string,
  subject: string
) {
  const isHeroImage = post.number === 1;
  const hasImage = Boolean(imageUrl);

  return (
    <View style={styles.heroCard}>
      {isHeroImage && hasImage ? (
        <Image src={imageUrl} style={styles.heroImage} />
      ) : isHeroImage ? (
        <View style={styles.heroVisual}>
          <Text style={styles.heroFallbackTitle}>Illustration mangler</Text>
          <Text style={styles.heroFallbackBody}>
            Hero-billedet kunne ikke hentes. PDF'en vises stadig, og resten af posten er intakt.
          </Text>
        </View>
      ) : (
        <View style={styles.heroVisual}>
          {renderSubjectIconGraphic(styles, subject)}
        </View>
      )}
      <View style={styles.heroCaptionWrap}>
        <Text style={styles.heroCaption}>
          {isHeroImage ? template.heroCaption : `Fagikon til ${getDisplaySubject(subject)}`}: {post.title}
        </Text>
      </View>
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
  const optionsContainerStyle =
    template.optionMode === "stacked" ? styles.optionStack : styles.optionGrid;
  const optionItemStyle =
    template.optionMode === "stacked" ? styles.optionItemStacked : styles.optionItemGrid;

  return (
    <View style={styles.questionCard}>
      <Text style={styles.sectionLabel}>{template.questionLabel}</Text>
      <Text style={styles.questionText}>{post.question}</Text>
      <View style={optionsContainerStyle}>
        {post.options.map((option, index) => (
          <View key={`${post.number}-${index}`} style={optionItemStyle}>
            <View style={styles.optionAccent}>
              <Text style={styles.optionLetter}>{LETTER_LABELS[index]}</Text>
            </View>
            <Text style={styles.optionCopy}>{option}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderPostFooter(styles: PdfStyles, template: PdfTemplate, post: Post, totalPosts: number) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Post {post.number} / {totalPosts}
      </Text>
      <Text style={styles.footerText}>{template.footerLabel}</Text>
      <Text style={styles.footerText}>gpsloeb.dk</Text>
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

function renderAnswerSheetPage(styles: PdfStyles, template: PdfTemplate, run: StjernelobData) {
  return (
    <Page size="A4" style={[styles.page, { backgroundColor: template.theme.answerSheetBg }]}>
      <View style={styles.frame} />
      <View style={styles.summaryPageInner}>
        <View style={styles.summaryHeader}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>Holdets svarark</Text>
            <Text style={styles.motif}>{template.motif}</Text>
          </View>
          <Text style={styles.summaryTitle}>Svarark</Text>
          <Text style={styles.summarySubtitle}>
            {run.title}. Skriv ét bogstav pr. post, når holdet er enige om svaret, og behold arket ved
            samlingspunktet eller hos holdlederen.
          </Text>
          {renderMetaChips(styles, [
            `Fag: ${getDisplaySubject(run.subject)}`,
            `Klassetrin: ${getDisplayGradeLevel(run.grade_level)}`,
            `Layout: ${template.label}`,
          ])}
        </View>

        <View style={styles.teamRow}>
          <Text style={styles.teamLabel}>Holdnavn</Text>
          <View style={styles.teamLine} />
        </View>

        <Text style={styles.answerInstruction}>
          Skriv A, B, C eller D i boksen ud for hver post. Brug kun ét svar pr. post, og ret først,
          når hele holdet er enige.
        </Text>

        <View style={styles.guidanceRow}>
          <View style={styles.guidanceCard}>
            <Text style={styles.guidanceCardTitle}>Sådan bruges arket</Text>
            <Text style={styles.guidanceCardBody}>
              Tag arket med rundt, eller lad én elev stå for noteringen. Ét bogstav pr. boks gør
              hurtig efterretning nemmere bagefter.
            </Text>
          </View>
          <View style={styles.guidanceCard}>
            <Text style={styles.guidanceCardTitle}>Placering</Text>
            <Text style={styles.guidanceCardBody}>
              Hvis holdene afleverer centralt, så print ekstra svarark og læg dem ved startområdet.
            </Text>
          </View>
        </View>

        <View style={styles.answerGrid}>
          {run.posts.map((post) => (
            <View key={`answer-${post.number}`} style={styles.answerItem}>
              <View style={styles.answerItemNumber}>
                <Text style={styles.answerItemNumberLabel}>Post</Text>
                <Text style={styles.answerItemNumberValue}>{post.number}</Text>
              </View>
              <View style={styles.answerBox}>
                <View style={styles.answerBoxInner} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Elevsvarark</Text>
        <Text style={styles.footerText}>{template.footerLabel}</Text>
        <Text style={styles.footerText}>gpsloeb.dk</Text>
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
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>Kun til lærerens brug</Text>
            <Text style={styles.motif}>{template.motif}</Text>
          </View>
          <Text style={styles.summaryTitle}>Facitliste</Text>
          <Text style={styles.summarySubtitle}>
            Brug facitlisten som intern læreroversigt. Den er farvet i samme familie som posterne,
            men skal ikke hænge ude ved posterne.
          </Text>
          {renderMetaChips(styles, [
            `Fag: ${getDisplaySubject(run.subject)}`,
            `Klassetrin: ${getDisplayGradeLevel(run.grade_level)}`,
            `Layout: ${template.label}`,
          ])}
        </View>

        <View style={styles.answerKeyBody}>
          {run.posts.map((post) => {
            const correctAnswer = getCorrectAnswer(post);

            return (
              <View key={`key-${post.number}`} style={styles.answerKeyRow}>
                <View style={styles.answerKeyNumber}>
                  <Text style={styles.answerKeyNumberText}>{post.number}</Text>
                </View>
                <View style={styles.answerKeyContent}>
                  <Text style={styles.answerKeyTitle}>{post.title}</Text>
                  <Text style={styles.answerKeyQuestion}>{post.question}</Text>
                  <Text style={styles.answerKeyAnswer}>
                    <Text style={styles.answerKeyLetter}>{correctAnswer.letter}</Text>
                    {` — ${correctAnswer.option}`}
                  </Text>
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
        <Text style={styles.footerText}>{template.footerLabel}</Text>
        <Text style={styles.footerText}>gpsloeb.dk</Text>
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
      let promise!: Promise<PreparedPdfImages>;
      promise = (async () => {
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
