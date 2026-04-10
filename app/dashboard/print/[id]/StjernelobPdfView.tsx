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
  headerBg: string;
  headerLine: string;
  headerSubtitle: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  titleText: string;
  bodyText: string;
  dividerColor: string;
  questionText: string;
  optionBorder: string;
  optionBg: string;
  optionLetterBg: string;
  optionLetterText: string;
  optionText: string;
  footerBg: string;
  footerBorder: string;
  footerText: string;
  outerBorder: string;
};

const THEMES: Record<string, PdfTheme> = {
  historie: {
    pageBg: "#fffbeb",
    headerBg: "#1c1917",
    headerLine: "#78716c",
    headerSubtitle: "#a8a29e",
    badgeBg: "#d97706",
    badgeText: "#ffffff",
    badgeBorder: "#92400e",
    titleText: "#fefce8",
    bodyText: "#44403c",
    dividerColor: "#a8a29e",
    questionText: "#1c1917",
    optionBorder: "#44403c",
    optionBg: "#f5f5f4",
    optionLetterBg: "#292524",
    optionLetterText: "#fcd34d",
    optionText: "#292524",
    footerBg: "#1c1917",
    footerBorder: "#292524",
    footerText: "#a8a29e",
    outerBorder: "#292524",
  },
  matematik: {
    pageBg: "#eff6ff",
    headerBg: "#312e81",
    headerLine: "#818cf8",
    headerSubtitle: "#a5b4fc",
    badgeBg: "#2563eb",
    badgeText: "#ffffff",
    badgeBorder: "#1e40af",
    titleText: "#eff6ff",
    bodyText: "#334155",
    dividerColor: "#a5b4fc",
    questionText: "#0f172a",
    optionBorder: "#4f46e5",
    optionBg: "#eff6ff",
    optionLetterBg: "#3730a3",
    optionLetterText: "#bfdbfe",
    optionText: "#1e293b",
    footerBg: "#312e81",
    footerBorder: "#3730a3",
    footerText: "#a5b4fc",
    outerBorder: "#3730a3",
  },
  "natur/teknik": {
    pageBg: "#ecfdf5",
    headerBg: "#064e3b",
    headerLine: "#10b981",
    headerSubtitle: "#6ee7b7",
    badgeBg: "#059669",
    badgeText: "#ffffff",
    badgeBorder: "#065f46",
    titleText: "#ecfdf5",
    bodyText: "#44403c",
    dividerColor: "#6ee7b7",
    questionText: "#1c1917",
    optionBorder: "#059669",
    optionBg: "#ecfdf5",
    optionLetterBg: "#065f46",
    optionLetterText: "#a7f3d0",
    optionText: "#292524",
    footerBg: "#064e3b",
    footerBorder: "#065f46",
    footerText: "#6ee7b7",
    outerBorder: "#065f46",
  },
};

const DEFAULT_THEME: PdfTheme = {
  pageBg: "#f8fafc",
  headerBg: "#1e293b",
  headerLine: "#64748b",
  headerSubtitle: "#94a3b8",
  badgeBg: "#334155",
  badgeText: "#ffffff",
  badgeBorder: "#475569",
  titleText: "#f8fafc",
  bodyText: "#334155",
  dividerColor: "#94a3b8",
  questionText: "#0f172a",
  optionBorder: "#475569",
  optionBg: "#f1f5f9",
  optionLetterBg: "#334155",
  optionLetterText: "#e2e8f0",
  optionText: "#1e293b",
  footerBg: "#1e293b",
  footerBorder: "#334155",
  footerText: "#94a3b8",
  outerBorder: "#334155",
};

function resolveTheme(subject: string): PdfTheme {
  const key = subject.trim().toLowerCase();
  if (THEMES[key]) return THEMES[key];
  for (const [mapKey, theme] of Object.entries(THEMES)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return theme;
  }
  return DEFAULT_THEME;
}

/* ── Image URL helpers ─────────────────────────────────────────────── */
const LETTER_LABELS = ["A", "B", "C", "D"] as const;
const PDF_IMAGE_REQUEST_DELAY_MS = 300;
const POLLINATIONS_HOSTNAME = "image.pollinations.ai";

function getAbsoluteImageUrl(post: Post): string {
  const prompt = typeof post.image_prompt === "string" ? post.image_prompt.trim() : "";
  if (prompt) {
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`;
  }
  const rawUrl = typeof post.image_url === "string" ? post.image_url.trim() : "";
  return rawUrl || "";
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

type PreparedPdfImages = {
  sources: Record<number, string>;
  objectUrls: string[];
};

async function preparePdfImages(posts: Post[], signal?: AbortSignal): Promise<PreparedPdfImages> {
  const sources: Record<number, string> = {};
  const objectUrls: string[] = [];
  let hasRequestedPollinationsImage = false;

  for (const post of posts) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const imageUrl = getAbsoluteImageUrl(post);
    if (!imageUrl) {
      continue;
    }

    if (isPollinationsImageUrl(imageUrl)) {
      if (hasRequestedPollinationsImage) {
        await waitForPdfImageDelay(PDF_IMAGE_REQUEST_DELAY_MS);
      }
      hasRequestedPollinationsImage = true;
    }

    try {
      const response = await fetch(imageUrl, {
        cache: "force-cache",
        signal,
      });

      if (!response.ok) {
        console.error("Kunne ikke hente PDF-billede:", response.status, response.statusText, imageUrl);
        continue;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      sources[post.number] = objectUrl;
      objectUrls.push(objectUrl);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      console.error("Kunne ikke forberede PDF-billede:", error);
    }
  }

  return { sources, objectUrls };
}

/* ── PDF Styles ────────────────────────────────────────────────────── */
function createStyles(t: PdfTheme) {
  return StyleSheet.create({
    page: {
      width: "210mm",
      height: "297mm",
      backgroundColor: t.pageBg,
      fontFamily: "Lora",
      position: "relative",
    },
    border: {
      position: "absolute",
      top: 8,
      left: 8,
      right: 8,
      bottom: 8,
      borderWidth: 4,
      borderColor: t.outerBorder,
      borderStyle: "solid",
    },
    header: {
      backgroundColor: t.headerBg,
      paddingHorizontal: 40,
      paddingTop: 28,
      paddingBottom: 24,
      alignItems: "center",
    },
    headerLine: {
      width: "100%",
      height: 1,
      backgroundColor: t.headerLine,
      marginBottom: 10,
    },
    headerSubtitle: {
      fontFamily: "Playfair",
      fontSize: 6,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 3,
      color: t.headerSubtitle,
      marginBottom: 12,
    },
    badgeContainer: {
      marginBottom: 12,
      alignItems: "center",
    },
    badge: {
      fontFamily: "Playfair",
      fontSize: 28,
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: 4,
      color: t.badgeText,
      backgroundColor: t.badgeBg,
      borderWidth: 3,
      borderColor: t.badgeBorder,
      paddingHorizontal: 28,
      paddingVertical: 6,
    },
    title: {
      fontFamily: "Playfair",
      fontSize: 22,
      fontWeight: 900,
      fontStyle: "italic",
      color: t.titleText,
      textAlign: "center",
      letterSpacing: 1,
      marginBottom: 8,
    },
    headerLineBottom: {
      width: "100%",
      height: 1,
      backgroundColor: t.headerLine,
      marginTop: 6,
    },
    imageContainer: {
      paddingHorizontal: 40,
      paddingTop: 22,
      alignItems: "center",
    },
    image: {
      width: "100%",
      maxHeight: 150,
      objectFit: "cover",
      borderWidth: 3,
      borderColor: t.outerBorder,
    },
    bodyContainer: {
      paddingHorizontal: 40,
      paddingTop: 16,
    },
    bodyText: {
      fontSize: 10,
      lineHeight: 1.75,
      color: t.bodyText,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 40,
      marginVertical: 14,
    },
    dividerLine: {
      flex: 1,
      height: 1.5,
      backgroundColor: t.dividerColor,
    },
    dividerGlyph: {
      fontSize: 14,
      color: t.dividerColor,
      marginHorizontal: 10,
    },
    questionContainer: {
      paddingHorizontal: 40,
    },
    questionText: {
      fontFamily: "Playfair",
      fontSize: 14,
      fontWeight: 700,
      color: t.questionText,
      marginBottom: 14,
      lineHeight: 1.4,
    },
    optionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    optionItem: {
      width: "48%",
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: t.optionBorder,
      backgroundColor: t.optionBg,
    },
    optionLetter: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.optionLetterBg,
      fontFamily: "Playfair",
      fontSize: 13,
      fontWeight: 900,
      color: t.optionLetterText,
    },
    optionText: {
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 8,
      fontSize: 9,
      fontWeight: 500,
      color: t.optionText,
      lineHeight: 1.4,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: t.footerBg,
      borderTopWidth: 2,
      borderTopColor: t.footerBorder,
      paddingHorizontal: 40,
      paddingVertical: 8,
    },
    footerText: {
      fontFamily: "Playfair",
      fontSize: 5.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 2.5,
      color: t.footerText,
    },
    // Answer sheet styles
    answerSheetBody: {
      paddingHorizontal: 40,
      paddingTop: 30,
    },
    holdnavnRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 24,
      gap: 10,
    },
    holdnavnLabel: {
      fontFamily: "Playfair",
      fontSize: 12,
      fontWeight: 700,
      color: "#1c1917",
    },
    holdnavnLine: {
      flex: 1,
      borderBottomWidth: 2,
      borderBottomColor: "#44403c",
      height: 20,
    },
    answerInstruction: {
      fontSize: 9,
      fontStyle: "italic",
      color: "#57534e",
      marginBottom: 18,
    },
    answerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    answerItem: {
      width: "47%",
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: "#44403c",
    },
    answerItemNumber: {
      width: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#292524",
      paddingVertical: 10,
    },
    answerItemNumberLabel: {
      fontFamily: "Playfair",
      fontSize: 5,
      textTransform: "uppercase",
      letterSpacing: 2,
      color: "#a8a29e",
    },
    answerItemNumberValue: {
      fontFamily: "Playfair",
      fontSize: 16,
      fontWeight: 900,
      color: "#fcd34d",
    },
    answerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    answerBoxInner: {
      width: 36,
      height: 36,
      borderWidth: 1.5,
      borderColor: "#78716c",
      backgroundColor: "#ffffff",
    },
    // Teacher answer key styles
    answerKeyBody: {
      paddingHorizontal: 40,
      paddingTop: 24,
      paddingBottom: 60,
      gap: 8,
    },
    answerKeyRow: {
      flexDirection: "row",
      borderWidth: 1.5,
      borderColor: "#44403c",
      backgroundColor: "#ffffff",
    },
    answerKeyNumber: {
      width: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#292524",
      fontFamily: "Playfair",
      fontSize: 11,
      fontWeight: 900,
      color: "#fcd34d",
    },
    answerKeyContent: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    answerKeyTitle: {
      fontFamily: "Playfair",
      fontSize: 10,
      fontWeight: 700,
      color: "#1c1917",
    },
    answerKeyQuestion: {
      fontSize: 8,
      color: "#57534e",
      marginTop: 2,
    },
    answerKeyAnswer: {
      fontFamily: "Playfair",
      fontSize: 8.5,
      fontWeight: 700,
      color: "#b45309",
      marginTop: 4,
    },
  });
}

/* ── PDF Document ──────────────────────────────────────────────────── */
function StjernelobDocument({
  run,
  imageSources,
}: {
  run: StjernelobData;
  imageSources: Record<number, string>;
}) {
  const t = resolveTheme(run.subject);
  const s = createStyles(t);
  const posts = run.posts;

  return (
    <Document title={run.title} author="gpsloeb.dk">
      {/* Post cards */}
      {posts.map((post) => {
        const imageUrl = imageSources[post.number] ?? "";
        return (
          <Page key={`post-${post.number}`} size="A4" style={s.page}>
            <View style={s.border} />
            {/* Header */}
            <View style={s.header}>
              <View style={s.headerLine} />
              <Text style={s.headerSubtitle}>{run.title}</Text>
              <View style={s.badgeContainer}>
                <Text style={s.badge}>Post {post.number}</Text>
              </View>
              <Text style={s.title}>{post.title}</Text>
              <View style={s.headerLineBottom} />
            </View>

            {/* Image */}
            {imageUrl ? (
              <View style={s.imageContainer}>
                <Image src={imageUrl} style={s.image} />
              </View>
            ) : null}

            {/* Body text */}
            <View style={s.bodyContainer}>
              <Text style={s.bodyText}>{post.body_text}</Text>
            </View>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerGlyph}>✦</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Question + Options */}
            <View style={s.questionContainer}>
              <Text style={s.questionText}>{post.question}</Text>
              <View style={s.optionsGrid}>
                {post.options.map((option, i) => (
                  <View key={i} style={s.optionItem}>
                    <View style={s.optionLetter}>
                      <Text>{LETTER_LABELS[i]}</Text>
                    </View>
                    <Text style={s.optionText}>{option}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Footer */}
            <View style={s.footer}>
              <Text style={s.footerText}>
                Post {post.number} / {posts.length}
              </Text>
              <Text style={s.footerText}>gpsloeb.dk</Text>
            </View>
          </Page>
        );
      })}

      {/* Student Answer Sheet */}
      <Page size="A4" style={[s.page, { backgroundColor: "#fffbeb" }]}>
        <View style={s.border} />
        <View style={s.header}>
          <View style={s.headerLine} />
          <Text style={s.headerSubtitle}>{run.title}</Text>
          <Text style={s.title}>Svarark</Text>
          <View style={s.headerLineBottom} />
        </View>
        <View style={s.answerSheetBody}>
          <View style={s.holdnavnRow}>
            <Text style={s.holdnavnLabel}>Holdnavn:</Text>
            <View style={s.holdnavnLine} />
          </View>
          <Text style={s.answerInstruction}>
            Skriv A, B, C eller D i boksen ud for hver post, når I har besøgt den.
          </Text>
          <View style={s.answerGrid}>
            {posts.map((post) => (
              <View key={`answer-${post.number}`} style={s.answerItem}>
                <View style={s.answerItemNumber}>
                  <Text style={s.answerItemNumberLabel}>Post</Text>
                  <Text style={s.answerItemNumberValue}>{post.number}</Text>
                </View>
                <View style={s.answerBox}>
                  <View style={s.answerBoxInner} />
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={s.footer}>
          <Text style={s.footerText}>Elev-svarark</Text>
          <Text style={s.footerText}>gpsloeb.dk</Text>
        </View>
      </Page>

      {/* Teacher Answer Key */}
      <Page size="A4" style={[s.page, { backgroundColor: "#f5f5f4" }]}>
        <View style={s.border} />
        <View style={s.header}>
          <View style={s.headerLine} />
          <Text style={s.headerSubtitle}>{run.title}</Text>
          <Text style={s.title}>Facitliste</Text>
          <Text
            style={{
              fontFamily: "Playfair",
              fontSize: 7,
              color: "#78716c",
              marginTop: 2,
            }}
          >
            Kun til lærerens brug — hæng ikke op
          </Text>
          <View style={s.headerLineBottom} />
        </View>
        <View style={s.answerKeyBody}>
          {posts.map((post) => (
            <View key={`key-${post.number}`} style={s.answerKeyRow}>
              <View style={s.answerKeyNumber}>
                <Text>{post.number}</Text>
              </View>
              <View style={s.answerKeyContent}>
                <Text style={s.answerKeyTitle}>{post.title}</Text>
                <Text style={s.answerKeyQuestion}>{post.question}</Text>
                <Text style={s.answerKeyAnswer}>
                  {LETTER_LABELS[post.correct_index]} — {post.options[post.correct_index]}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={s.footer}>
          <Text style={s.footerText}>Facitliste</Text>
          <Text style={s.footerText}>gpsloeb.dk</Text>
        </View>
      </Page>
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [preparedImageSources, setPreparedImageSources] = useState<Record<number, string>>({});
  const preparedImageUrlsRef = useRef<string[]>([]);
  const prepareImagesPromiseRef = useRef<Promise<Record<number, string>> | null>(null);
  const imagePreparationGenerationRef = useRef(0);

  const revokePreparedImageUrls = useCallback(() => {
    for (const objectUrl of preparedImageUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }
    preparedImageUrlsRef.current = [];
  }, []);

  const ensurePreparedImageSources = useCallback(
    async (signal?: AbortSignal) => {
      if (prepareImagesPromiseRef.current) {
        return prepareImagesPromiseRef.current;
      }

      const generation = imagePreparationGenerationRef.current;
      let promise!: Promise<Record<number, string>>;
      promise = (async () => {
        if (generation === imagePreparationGenerationRef.current) {
          setIsPreparingImages(true);
        }

        try {
          const prepared = await preparePdfImages(run.posts, signal);

          if (generation !== imagePreparationGenerationRef.current) {
            for (const objectUrl of prepared.objectUrls) {
              URL.revokeObjectURL(objectUrl);
            }
            return {};
          }

          revokePreparedImageUrls();
          preparedImageUrlsRef.current = prepared.objectUrls;
          setPreparedImageSources(prepared.sources);
          return prepared.sources;
        } catch (error) {
          if (isAbortError(error)) {
            return {};
          }

          console.error("Kunne ikke klargoere PDF-billeder:", error);
          return {};
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
    [revokePreparedImageUrls, run.posts]
  );

  useEffect(() => {
    const abortController = new AbortController();

    imagePreparationGenerationRef.current += 1;
    prepareImagesPromiseRef.current = null;
    setPreparedImageSources({});
    revokePreparedImageUrls();

    void ensurePreparedImageSources(abortController.signal);

    return () => {
      abortController.abort();
      prepareImagesPromiseRef.current = null;
      revokePreparedImageUrls();
    };
  }, [ensurePreparedImageSources, revokePreparedImageUrls, run.id]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const imageSources = await ensurePreparedImageSources();
      const blob = await pdf(<StjernelobDocument run={run} imageSources={imageSources} />).toBlob();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1e293b" }}>
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
            <p style={{ fontSize: 12, color: "#78716c", margin: "6px 0 0" }}>
              Klargoer billeder til PDF en...
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
            onClick={handleDownload}
            disabled={isDownloading}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              background: isDownloading ? "#8b5cf6aa" : "#7c3aed",
              border: "none",
              borderRadius: 8,
              cursor: isDownloading ? "wait" : "pointer",
              opacity: isDownloading ? 0.7 : 1,
            }}
          >
            {isDownloading ? "Genererer..." : isPreparingImages ? "Klargoer billeder..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PDFViewer width="100%" height="100%" showToolbar={false}>
          <StjernelobDocument run={run} imageSources={preparedImageSources} />
        </PDFViewer>
      </div>
    </div>
  );
}
