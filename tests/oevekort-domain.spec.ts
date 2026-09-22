import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  advanceOevekortFlashQueue,
  buildOevekortShareLink,
  compareOevekortAnswer,
  moveOevekortItem,
  normalizeOevekortAnswerForComparison,
  OEVEKORT_MAX_CARDS_PER_SET,
  OEVEKORT_PUBLIC_SHARE_PATH,
  parseOevekortImport,
  parseOevekortSetInput,
  parseOevekortShareExpiry,
} from "../lib/oevekort";
import {
  generateOevekortShareToken,
  hashOevekortShareToken,
} from "../lib/oevekortServer";
import { filterPrivacySafeAnalyticsEvent } from "../components/PrivacySafeAnalytics";
import {
  isOevekortPublicSet,
  isOevekortSet,
  isOevekortSetSummary,
  isOevekortShareStatus,
} from "../components/oevekort/types";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test.describe("Øvekort domain and share security", () => {
  test("normalizes a valid teacher-owned set without treating card text as HTML", () => {
    const result = parseOevekortSetInput({
      title: "  Tyske gloser  ",
      cards: [
        {
          front: "<b>Hund</b>",
          back: "  der Hund ",
          acceptedAnswers: ["DER HUND", " der Hund "],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual({
      title: "Tyske gloser",
      cards: [
        {
          front: "<b>Hund</b>",
          back: "der Hund",
          acceptedAnswers: [],
        },
      ],
    });
  });

  test("rejects empty, oversized, and malformed cards before they reach a route", () => {
    const noCards = parseOevekortSetInput({ title: "Tomt", cards: [] });
    expect(noCards.ok).toBe(false);

    const malformed = parseOevekortSetInput({
      title: "Begreber",
      cards: [{ front: "Nøgleord", back: "", acceptedAnswers: ["ok"] }],
    });
    expect(malformed.ok).toBe(false);

    const tooMany = parseOevekortSetInput({
      title: "For mange",
      cards: Array.from({ length: OEVEKORT_MAX_CARDS_PER_SET + 1 }, () => ({
        front: "Forside",
        back: "Bagside",
      })),
    });
    expect(tooMany.ok).toBe(false);
  });

  test("rejects empty or partial API sets before an owner or learner view can dereference them", () => {
    const validCard = {
      id: "kort-1",
      front: "Hund",
      back: "der Hund",
      acceptedAnswers: [],
    };
    const validSet = {
      id: "set-1",
      title: "Tyske gloser",
      createdAt: "2026-09-22T10:00:00.000Z",
      updatedAt: "2026-09-22T10:00:00.000Z",
      cards: [validCard],
    };

    expect(isOevekortPublicSet({ title: "Tyske gloser", cards: [validCard] })).toBe(true);
    expect(isOevekortSet(validSet)).toBe(true);
    expect(isOevekortSet({ ...validSet, cards: [] })).toBe(false);
    expect(isOevekortSet({ ...validSet, cards: [{ id: "kort-1" }] })).toBe(false);
    expect(isOevekortPublicSet({ title: "", cards: [validCard] })).toBe(false);
    expect(isOevekortShareStatus({ id: "share-1", createdAt: "now", expiresAt: null, active: true })).toBe(true);
    expect(isOevekortShareStatus({ id: "share-1", active: true })).toBe(false);
    expect(isOevekortSetSummary({
      id: "set-1",
      title: "Tyske gloser",
      cardCount: 1,
      createdAt: "now",
      updatedAt: "now",
      share: { active: false, createdAt: null, expiresAt: null },
    })).toBe(true);
    expect(isOevekortSetSummary({ id: "set-1", title: "Tyske gloser" })).toBe(false);
  });

  test("imports exactly two columns and reports incorrectly separated rows", () => {
    const tabs = parseOevekortImport("kat\tcat\nhund\tdog");
    expect(tabs).toMatchObject({
      ok: true,
      delimiter: "tab",
      cards: [
        { front: "kat", back: "cat" },
        { front: "hund", back: "dog" },
      ],
    });

    const semicolons = parseOevekortImport("ven;friend\nhej;hello");
    expect(semicolons).toMatchObject({ ok: true, delimiter: "semicolon" });

    const malformed = parseOevekortImport("kat\tcat\textra");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.errors[0]?.message).toContain("præcis to kolonner");
    }
  });

  test("compares answers by case and whitespace only, preserving Danish and accent distinctions", () => {
    const card = {
      back: "Café Ønske",
      acceptedAnswers: ["Kaffested"],
    };

    expect(normalizeOevekortAnswerForComparison("  CAFÉ   ØNSKE ")).toBe(
      "café ønske"
    );
    expect(compareOevekortAnswer(" café  ønske ", card).correct).toBe(true);
    expect(compareOevekortAnswer("KAFFESTED", card).correct).toBe(true);
    expect(compareOevekortAnswer("cafe ønske", card).correct).toBe(false);
    expect(compareOevekortAnswer("cafe\u0301 ønske", card).correct).toBe(false);
    expect(compareOevekortAnswer("café onske", card).correct).toBe(false);
  });

  test("keeps card reordering local and preserves every card exactly once", () => {
    const cards = ["første", "anden", "tredje"];

    expect(moveOevekortItem(cards, 2, 0)).toEqual([
      "tredje",
      "første",
      "anden",
    ]);
    expect(moveOevekortItem(cards, -1, 1)).toEqual(cards);
    expect(cards).toEqual(["første", "anden", "tredje"]);
  });

  test("repeats only the flashcards a learner chooses to practise again", () => {
    const queue = ["kort-1", "kort-2", "kort-3"];

    expect(advanceOevekortFlashQueue(queue, "again")).toEqual([
      "kort-2",
      "kort-3",
      "kort-1",
    ]);
    expect(advanceOevekortFlashQueue(queue, "known")).toEqual([
      "kort-2",
      "kort-3",
    ]);
    expect(advanceOevekortFlashQueue(["kort-1"], "again")).toEqual([
      "kort-1",
    ]);
  });

  test("keeps the agreed editor, practice, board, and print capabilities in their guarded surfaces", () => {
    const teacherEditor = source("components/oevekort/OevekortTeacherClient.tsx");
    const publicShare = source("components/oevekort/OevekortPublicShareClient.tsx");
    const presentation = source("components/oevekort/OevekortSetPresentation.tsx");

    expect(teacherEditor).toContain("Flyt kort");
    expect(teacherEditor).toContain("beforeunload");
    expect(teacherEditor).toContain("Ikke gemt endnu");
    expect(teacherEditor).toContain("skolegps:before-dashboard-leave");
    expect(teacherEditor).toContain('closest<HTMLAnchorElement>("a[href]")');
    expect(teacherEditor).toContain("Gem sættet først");
    expect(teacherEditor).toContain("Gem udløbstidspunktet først");
    expect(publicShare).toContain('rateFlashCard("again")');
    expect(publicShare).toContain('rateFlashCard("known")');
    expect(publicShare).toContain("Dine valg bliver kun brugt i denne browser");
    expect(publicShare).toContain("Start øvelsen");
    expect(publicShare).toContain("hasStarted");
    expect(presentation).toContain("requestFullscreen");
    expect(presentation).toContain("Fuld skærm");
    expect(presentation).toContain('id: "cards"');
    expect(presentation).toContain('id: "list"');
    expect(presentation).toContain('id: "pupil"');
    expect(presentation).toContain('id: "answers"');
    expect(presentation).toContain("[overflow-wrap:anywhere]");
    expect(publicShare).toContain("[overflow-wrap:anywhere]");
  });

  test("uses a high-entropy fragment bearer link and stores only its hash", () => {
    const token = generateOevekortShareToken();
    const hash = hashOevekortShareToken(token);
    const link = buildOevekortShareLink("https://www.skolegps.dk/dashboard", token);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(link).toBe(`https://www.skolegps.dk${OEVEKORT_PUBLIC_SHARE_PATH}#${token}`);
    expect(new URL(link!).search).toBe("");
  });

  test("accepts only a future ISO share expiry", () => {
    const now = new Date("2026-09-22T10:00:00.000Z");
    expect(parseOevekortShareExpiry(null, now)).toEqual({ ok: true, value: null });
    expect(parseOevekortShareExpiry("2026-09-22T11:00:00Z", now)).toEqual({
      ok: true,
      value: "2026-09-22T11:00:00.000Z",
    });
    expect(parseOevekortShareExpiry("2026-09-22T09:59:59Z", now).ok).toBe(false);
    expect(parseOevekortShareExpiry("22-09-2026", now).ok).toBe(false);
  });

  test("keeps tables and RPCs service-role-only and avoids raw-token route logs", () => {
    const migration = source("supabase/migrations/20260921220800_oevekort.sql");
    const domain = source("lib/oevekort.ts");
    const shareRoute = source("app/api/oevekort/sets/[setId]/share/route.ts");
    const publicRoute = source("app/api/oevekort/public/route.ts");

    expect(migration).toContain("create table public.oevekort_sets");
    expect(migration).toContain("create table public.oevekort_cards");
    expect(migration).toContain("create table public.oevekort_shares");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("grant execute on function public.read_oevekort_public_share(text) to service_role");
    expect(migration).not.toContain("grant select on table public.oevekort_sets to anon");
    expect(migration).not.toContain("grant select on table public.oevekort_cards to authenticated");
    expect(migration).not.toContain("grant select on table public.oevekort_shares to anon");
    expect(domain).not.toContain(".normalize(");

    expect(shareRoute).toContain("shareUrl");
    expect(shareRoute).toContain("only endpoint response that contains the bearer link");
    expect(shareRoute).not.toMatch(/console\.(log|info|warn|error)/);
    expect(publicRoute).toContain("p_token_hash: tokenHash");
    expect(publicRoute).not.toContain("shareUrl");
    expect(publicRoute).not.toMatch(/console\.(log|info|warn|error)/);
  });

  test("drops analytics for the public fragment route", () => {
    const event = {
      type: "pageview",
      url: `https://www.skolegps.dk${OEVEKORT_PUBLIC_SHARE_PATH}#unsafe-token`,
    } as Parameters<typeof filterPrivacySafeAnalyticsEvent>[0];

    expect(filterPrivacySafeAnalyticsEvent(event)).toBeNull();
  });

  test("keeps Øvekort free from AI overlays and limits the portal shell to compatible routes", () => {
    const aiChatButton = source("components/AIChatButton.tsx");
    const dashboardHeader = source("components/dashboard/DashboardHeader.tsx");

    expect(aiChatButton).toContain('pathname === "/oevekort/del"');
    expect(aiChatButton).toContain('pathname.startsWith("/dashboard/laerervaerktoejer/oevekort")');
    expect(dashboardHeader).toContain('pathname === "/dashboard/laerervaerktoejer"');
    expect(dashboardHeader).toContain('pathname.startsWith("/dashboard/laerervaerktoejer/oevekort")');
    expect(dashboardHeader).not.toContain('pathname.startsWith("/dashboard/laerervaerktoejer");');
  });
});
