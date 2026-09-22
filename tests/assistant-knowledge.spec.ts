import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ASSISTANT_KNOWLEDGE_CARDS,
  ASSISTANT_KNOWLEDGE_VERSION,
  ASSISTANT_QUICK_ACTION_KNOWLEDGE_COVERAGE,
  ASSISTANT_SUPPORT_EMAIL,
  buildAssistantKnowledgeContext,
  getAssistantKnowledgeCard,
  getAssistantKnowledgeCards,
} from "../lib/assistant/knowledge";
import {
  createTeacherToolRegistry,
  TEACHER_TOOL_FALLBACK_ORIGINS,
} from "../lib/teacherTools/registry";
import type {
  ActiveTeacherTool,
  TeacherTool,
  TeacherToolId,
} from "../lib/teacherTools/registry";

function card(id: Parameters<typeof getAssistantKnowledgeCard>[0]) {
  const value = getAssistantKnowledgeCard(id);
  expect(value, `Expected assistant knowledge card ${id}`).toBeDefined();
  return value!;
}

function link(cardId: Parameters<typeof getAssistantKnowledgeCard>[0], label: string) {
  const value = card(cardId).links.find((candidate) => candidate.label === label);
  expect(value, `Expected ${label} link on ${cardId}`).toBeDefined();
  return value!;
}

function activeTool(registry: readonly TeacherTool[], id: TeacherToolId): ActiveTeacherTool {
  const value = registry.find((candidate) => candidate.id === id);
  expect(value?.status, `Expected active teacher tool ${id}`).toBe("active");

  if (!value || value.status !== "active") {
    throw new Error(`Expected active teacher tool ${id}`);
  }

  return value;
}

test.describe("assistant knowledge manifest", () => {
  test("is versioned, complete, and made only of uniquely identified factual cards", () => {
    expect(ASSISTANT_KNOWLEDGE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(getAssistantKnowledgeCards()).toBe(ASSISTANT_KNOWLEDGE_CARDS);
    expect(ASSISTANT_KNOWLEDGE_CARDS.map((item) => item.id)).toEqual([
      "gps-loeb",
      "opret-loeb",
      "live-stratego",
      "zone-krigen",
      "vm26",
      "bog-scanneren",
      "podcast-detektiven",
      "generel-quiz",
      "konto-arkiv-og-start",
      "gps-hjaelp",
      "skak",
      "oevekort",
      "kildegps",
      "dagenstavle",
      "printmit-arbejdsark",
      "find-bedrageren",
      "skemapilot",
      "aarsplan-generator",
      "support",
    ]);

    for (const item of ASSISTANT_KNOWLEDGE_CARDS) {
      expect(item.sourcePaths.length, `${item.id} needs a traceable source`).toBeGreaterThan(0);
      expect(item.summary).not.toHaveLength(0);
      expect(item.guidance.length, `${item.id} needs bounded guidance`).toBeGreaterThan(0);
      expect(item.links.length, `${item.id} needs a verified entry`).toBeGreaterThan(0);
    }
  });

  test("keeps the active six-tool registry and its destinations aligned", () => {
    const registry = createTeacherToolRegistry(TEACHER_TOOL_FALLBACK_ORIGINS);
    const gpsLob = activeTool(registry, "gps-lob");
    expect(link("gps-loeb", "Vælg oprettelsesvej").href).toBe(gpsLob.link.href);

    const skak = activeTool(registry, "skak");
    expect(link("skak", "Åbn Skak").href).toBe(skak.link.href);

    const oevekort = activeTool(registry, "oevekort");
    expect(link("oevekort", "Åbn Øvekort").href).toBe(oevekort.link.href);

    const kildeGps = activeTool(registry, "kildegps");
    expect(link("kildegps", "Åbn KildeGPS")).toMatchObject(kildeGps.link);
    expect(kildeGps.link.href).not.toMatch(/[?&](?:token|email|session|sso)=/i);

    const dagensTavle = activeTool(registry, "dagens-tavle");
    expect(link("dagenstavle", `Åbn ${dagensTavle.title}`).href).toBe(dagensTavle.link.href);
    expect(card("dagenstavle").status).toBe("external_handoff");

    const printMit = activeTool(registry, "printmit-arbejdsark");
    expect(link("printmit-arbejdsark", `Åbn ${printMit.title}`).href).toBe(printMit.link.href);
    expect(card("printmit-arbejdsark").status).toBe("external_handoff");
  });

  test("separates verified internal work, external handoffs, and limited routes", () => {
    for (const id of ["gps-loeb", "opret-loeb", "live-stratego", "bog-scanneren", "podcast-detektiven", "generel-quiz", "konto-arkiv-og-start", "gps-hjaelp", "skak", "oevekort", "find-bedrageren", "support"] as const) {
      expect(card(id).status).toBe("available_here");
    }
    for (const id of ["kildegps", "dagenstavle", "printmit-arbejdsark"] as const) {
      expect(card(id).status).toBe("external_handoff");
    }
    for (const id of ["zone-krigen", "vm26", "skemapilot", "aarsplan-generator"] as const) {
      expect(card(id).status).toBe("limited_here");
    }

    expect(card("kildegps").guidance.join(" ")).toMatch(/ikke opfinde|må kun hjælpe/i);
    expect(card("kildegps").summary).toContain("7.–9. klasse");
    expect(card("dagenstavle").guidance.join(" ")).toMatch(/ikke en verificeret delt datavej/i);
    expect(card("printmit-arbejdsark").guidance.join(" ")).toMatch(/ikke love/i);
    expect(card("zone-krigen").guidance.join(" ")).toMatch(/Lov ikke adgang eller prøveløb/i);
    expect(card("vm26").guidance.join(" ")).toMatch(/ikke en verificeret, synlig VM26-startknap/i);
    expect(card("skemapilot").guidance.join(" ")).toMatch(/faste eksempler/i);
    expect(card("aarsplan-generator").guidance.join(" ")).toMatch(/ikke.*live AI/i);
  });

  test("keeps the current creation routes and bounded tool facts explicit", () => {
    expect(card("opret-loeb").guidance.join(" ")).toContain("Lynbygger (/dashboard/opret/lynbygger)");
    expect(card("opret-loeb").guidance.join(" ")).toContain("Lav selv (/dashboard/opret/manuel)");
    expect(card("opret-loeb").guidance.join(" ")).toContain("Fysisk Stjerneløb");
    expect(card("opret-loeb").guidance.join(" ")).toContain("Zone-Krigen");
    expect(card("skak").guidance.join(" ")).toContain("Lær skak, Vis på tavlen og Spil skak");
    expect(card("oevekort").guidance.join(" ")).toContain("ikke elevkonto");
    expect(card("find-bedrageren").guidance.join(" ")).toContain("opsæt ord og roller → eleverne joiner → læreren styrer diskussion og afstemning");
    expect(card("konto-arkiv-og-start").guidance.join(" ")).toContain("ikke den samme handling for alle aktivitetstyper");
    expect(link("konto-arkiv-og-start", "Åbn arkivet").href).toBe("/dashboard/arkiv");
    expect(link("konto-arkiv-og-start", "Deltag i et løb").href).toBe("/join");
    expect(card("gps-hjaelp").guidance.join(" ")).toContain("Hold og fremdrift bliver bevaret");
    expect(card("gps-hjaelp").guidance.join(" ")).toContain("rydde browserdata");
    expect(link("gps-hjaelp", "Åbn GPS-hjælp").href).toBe("/hjaelp");
  });

  test("covers every visible Pilen example prompt with bounded assistant knowledge", () => {
    const source = readFileSync(resolve(process.cwd(), "components", "AIChatButton.tsx"), "utf8");
    const quickActionsBlock = source.match(/const QUICK_ACTIONS:[\s\S]*?] as const;/)?.[0];
    expect(quickActionsBlock, "Could not read AIChatButton QUICK_ACTIONS").toBeDefined();

    if (!quickActionsBlock) {
      throw new Error("Could not read AIChatButton QUICK_ACTIONS");
    }

    const quickActionIds = [...quickActionsBlock.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(quickActionIds).toEqual(Object.keys(ASSISTANT_QUICK_ACTION_KNOWLEDGE_COVERAGE));

    for (const knowledgeId of Object.values(ASSISTANT_QUICK_ACTION_KNOWLEDGE_COVERAGE)) {
      const knowledge = card(knowledgeId);
      expect(knowledge.summary).not.toHaveLength(0);
      expect(knowledge.guidance.length).toBeGreaterThan(0);
      expect(knowledge.links.length).toBeGreaterThan(0);
    }

    expect(link("live-stratego", "Åbn Live Stratego").href).toBe("/dashboard/opret/stratego");
    expect(link("bog-scanneren", "Åbn Bog-Scanneren").href).toBe("/dashboard/opret/scanner");
    expect(link("podcast-detektiven", "Åbn Podcast-Detektiven").href).toBe("/dashboard/opret/podcast");
    expect(link("generel-quiz", "Åbn Generel Quiz").href).toBe("/dashboard/opret/manuel");
  });

  test("builds a stable server-owned context without accepting browser knowledge", () => {
    const context = buildAssistantKnowledgeContext();

    expect(context).toContain(`SKOLEGPS-ASSISTENTVIDEN v${ASSISTANT_KNOWLEDGE_VERSION}`);
    expect(context).toContain("Brug kun denne viden som produktfakta");
    expect(context).toContain("external_handoff");
    expect(context).toContain("KildeGPS");
    expect(context).toContain("Skak");
    expect(context).toContain("Øvekort");
    expect(context).toContain(`mailto:${ASSISTANT_SUPPORT_EMAIL}`);
    expect(context).not.toContain("FondsGPS");
    expect(context).not.toContain("SkoleGPS Music Studio");
  });
});
