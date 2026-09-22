/**
 * Verified, versioned product knowledge for the SkoleGPS assistant.
 *
 * Keep this manifest deliberately narrow: every card must be traceable to a
 * current primary source. Facts about an external product must be traceable to
 * that product's own current primary source and remain separate from the
 * SkoleGPS handoff.
 */

export const ASSISTANT_KNOWLEDGE_VERSION = "2026-09-22.3";

export const ASSISTANT_SUPPORT_EMAIL = "skolegpsdk@gmail.com";

export type AssistantKnowledgeStatus =
  | "available_here"
  | "external_handoff"
  | "limited_here";

export type AssistantKnowledgeLink = {
  href: string;
  kind: "internal" | "external" | "email";
  label: string;
  target: "_self" | "_blank";
};

export type AssistantKnowledgeCard = {
  guidance: readonly string[];
  id: string;
  links: readonly AssistantKnowledgeLink[];
  sourcePaths: readonly string[];
  status: AssistantKnowledgeStatus;
  summary: string;
  title: string;
};

export type AssistantKnowledgeId =
  | "gps-loeb"
  | "opret-loeb"
  | "live-stratego"
  | "zone-krigen"
  | "vm26"
  | "bog-scanneren"
  | "podcast-detektiven"
  | "generel-quiz"
  | "konto-arkiv-og-start"
  | "gps-hjaelp"
  | "skak"
  | "oevekort"
  | "kildegps"
  | "dagenstavle"
  | "printmit-arbejdsark"
  | "find-bedrageren"
  | "skemapilot"
  | "aarsplan-generator"
  | "support";

const STATUS_CONTEXT: Record<AssistantKnowledgeStatus, string> = {
  available_here:
    "Verificeret i den aktuelle SkoleGPS-kodebase. Du må guide til de viste trin, men må ikke love adgang, data eller resultat for en bestemt konto.",
  external_handoff:
    "Skeln den verificerede overgang fra eventuelle kildeverificerede fakta om det eksterne produkt. Lov ikke data, priser, adgang eller tilgængelighed for en bestemt konto.",
  limited_here:
    "Ruten findes i den aktuelle kodebase, men dens afgrænsning er vigtig. Beskriv begrænsningen tydeligt og lov ikke live-AI, officielle data eller automatiske resultater.",
};

export const ASSISTANT_KNOWLEDGE_CARDS = [
  {
    id: "gps-loeb",
    title: "GPS-løb",
    status: "available_here",
    summary:
      "Læreren starter fra dashboardet og bygger et GPS-løb med rute, poster og spørgsmål.",
    guidance: [
      "Start læreren ved Dashboard → Lav nyt GPS-løb → Vælg, hvordan du vil starte.",
      "Hold vejledningen lærerrettet; elevflow, liveafvikling og login ændres ikke af denne hjælper.",
    ],
    links: [
      {
        label: "Vælg oprettelsesvej",
        href: "/dashboard/opret/valg",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/DashboardHomeClient.tsx",
      "app/dashboard/opret/page.tsx",
      "app/dashboard/opret/valg/page.tsx",
    ],
  },
  {
    id: "opret-loeb",
    title: "Aktuelle oprettelsesveje",
    status: "available_here",
    summary:
      "Den aktuelle vælger har to hovedveje: Lynbygger til et udkast og Lav selv til egne spørgsmål. Flere formater ligger under samme vælger.",
    guidance: [
      "Hovedveje: Lynbygger (/dashboard/opret/lynbygger) og Lav selv (/dashboard/opret/manuel).",
      "Flere formater: Engelsk, Matematik, Dansk, Musikquiz, Foto mission, Fra tekst eller bog, Podcast-Detektiven, Fysisk Stjerneløb og Zone-Krigen.",
      "Zone-Krigen kan vise en adgangstilstand. Lov ikke adgang eller prøveløb, før brugerens aktuelle skærm viser det.",
      "Oprettelse og redigering er markeret som bedst på computer, fordi kort og spørgsmål kræver plads.",
    ],
    links: [
      {
        label: "Lynbygger",
        href: "/dashboard/opret/lynbygger",
        kind: "internal",
        target: "_self",
      },
      {
        label: "Lav selv",
        href: "/dashboard/opret/manuel",
        kind: "internal",
        target: "_self",
      },
      {
        label: "Flere formater",
        href: "/dashboard/opret/valg",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: ["app/dashboard/opret/valg/page.tsx"],
  },
  {
    id: "live-stratego",
    title: "Live Stratego",
    status: "available_here",
    summary:
      "Live Stratego er et live-format for to hold: læreren giver spillet en titel og intro, placerer en rød og en blå base og åbner derefter en live-session.",
    guidance: [
      "Åbn Live Stratego fra den beskyttede lærerroute. Læreren skal være logget ind for at oprette eller redigere et Stratego-løb.",
      "Opsætningen har to trin: titel/kort intro og derefter placering af begge baser på kortet. Når begge baser er sat, gemmes løbet og åbner den relevante live-session.",
      "I spillet vinder et hold ved at fange modstanderens fane. Radaren viser afstand som zoner, ikke præcise spillerprikker, og baserne er fredszoner.",
      "Bed aldrig brugeren dele en join-PIN, et lærerlogin eller præcise elevplaceringer i chatten.",
    ],
    links: [
      {
        label: "Åbn Live Stratego",
        href: "/dashboard/opret/stratego",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/opret/stratego/page.tsx",
      "components/live/LiveRulesSheet.tsx",
      "components/play/StudentRulesSheet.tsx",
    ],
  },
  {
    id: "zone-krigen",
    title: "Zone-Krigen",
    status: "limited_here",
    summary:
      "Zone-Krigen er et holdspil med zoner og spørgsmål: Holdet med flest erobrede zoner ved slutfløjtet vinder.",
    guidance: [
      "Læreren finder Zone-Krigen under Flere formater i løbsvælgeren og opsætter titel, spørgsmål og zoner på kortet, før løbet gemmes i arkivet.",
      "En zone overtages ved et korrekt svar. En overtaget zone får et skjold i 3 minutter, og et korrekt svar på egen zone kan forny skjoldet.",
      "Når betalingsvæggen er slået til, kan løbsvælgeren vise kræver adgang, prøveløb eller tjekker adgang. Lov ikke adgang eller prøveløb, før brugerens aktuelle skærm viser det.",
      "Du må gerne forklare reglerne, men ikke love et bestemt taktisk resultat eller en bestemt kontoadgang.",
    ],
    links: [
      {
        label: "Se Zone-Krigen i løbsvælgeren",
        href: "/dashboard/opret/valg",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/opret/valg/page.tsx",
      "app/dashboard/opret/zone-krig/page.tsx",
      "components/live/LiveRulesSheet.tsx",
      "utils/accessControl.ts",
    ],
  },
  {
    id: "vm26",
    title: "VM26 – Jagten på pokalen",
    status: "limited_here",
    summary:
      "VM26 er et fodboldtema oven på et almindeligt GPS-løb; et VM26-konfigureret løb redigeres som et standardløb i den manuelle builder.",
    guidance: [
      "Et eksisterende VM26-løb viser temaet Jagten på pokalen og poster som Kickoff, Gruppespil og Straffespark i den manuelle builder.",
      "Den aktuelle løbsvælger har ikke en verificeret, synlig VM26-startknap. Lov derfor ikke, at brugeren kan starte et nyt VM26-løb direkte fra Pilen eller en hurtiggenvej.",
      "Hjælp med det almindelige GPS-løb i den manuelle builder, eller henvis til support, hvis læreren mangler adgang til en VM26-skabelon.",
    ],
    links: [
      {
        label: "Åbn den manuelle builder",
        href: "/dashboard/opret/manuel",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/opret/valg/page.tsx",
      "app/dashboard/opret/manuel/page.tsx",
      "utils/vm26Template.ts",
    ],
  },
  {
    id: "bog-scanneren",
    title: "Bog-Scanneren",
    status: "available_here",
    summary:
      "Bog-Scanneren klargør et GPS-løbsudkast i den manuelle builder ud fra indsat tekst eller bogsider fra kamera eller upload.",
    guidance: [
      "Vælg tekst eller billeder, fag, klassetrin og antal poster. Der kan højst bruges fem billeder af bogsider ad gangen.",
      "Når læreren vælger Generér løb, åbnes et udkast i den manuelle builder. Læreren skal gennemgå og redigere titel, poster og placeringer før gemning.",
      "Før generering bekræfter læreren, at materialet må bearbejdes. Pilen må ikke vurdere ophavsret eller fortælle, at en skoles aftale dækker et konkret materiale.",
      "Lov ikke perfekt tekstgenkendelse eller et bestemt resultat fra billeder og tekst.",
    ],
    links: [
      {
        label: "Åbn Bog-Scanneren",
        href: "/dashboard/opret/scanner",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/opret/scanner/page.tsx",
      "app/ophavsret/page.tsx",
    ],
  },
  {
    id: "podcast-detektiven",
    title: "Podcast-Detektiven",
    status: "available_here",
    summary:
      "Podcast-Detektiven tager imod et podcastlink og klargør et udkast med spørgsmål, som læreren kan tilpasse i den manuelle builder.",
    guidance: [
      "Indsæt et podcastlink og vælg Lav et udkast. Hvis oplysningerne kan hentes, åbnes den manuelle builder med spørgsmålene som et udkast.",
      "Det aktuelle flow bruger linket til at læse offentlige resuméer; lyd afspilles via originalkilden. Lov ikke, at et bestemt link har et transcript eller kan blive behandlet.",
      "Læreren bekræfter rettigheder eller dækning fra skolens aftale før brug. Pilen må ikke vurdere ophavsret for det konkrete podcastmateriale.",
      "Læreren skal gennemgå og redigere spørgsmålene før gemning.",
    ],
    links: [
      {
        label: "Åbn Podcast-Detektiven",
        href: "/dashboard/opret/podcast",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/opret/podcast/page.tsx",
      "app/ophavsret-podcast/page.tsx",
    ],
  },
  {
    id: "generel-quiz",
    title: "Generel Quiz",
    status: "available_here",
    summary:
      "Generel Quiz er den manuelle GPS-løbsbygger, hvor læreren selv skriver og placerer quizposter.",
    guidance: [
      "Start i den manuelle builder og tilføj titel, fag og klassetrin. En quizpost har spørgsmål, fire svarmuligheder, et rigtigt svar, point og en placering på kortet.",
      "Et løb skal have en titel og mindst ét færdigt spørgsmål, før det kan gemmes i arkivet.",
      "Pilen kan hjælpe med ideer og formuleringer, men læreren skal gennemgå indholdet, korrekte svar og kortplaceringer før gemning.",
    ],
    links: [
      {
        label: "Åbn Generel Quiz",
        href: "/dashboard/opret/manuel",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: ["app/dashboard/opret/manuel/page.tsx"],
  },
  {
    id: "konto-arkiv-og-start",
    title: "Konto, arkiv og start af løb",
    status: "available_here",
    summary:
      "Læreren finder gemte løb i arkivet og kan åbne en lobby eller planlægge et løb, når den konkrete aktivitet understøtter det.",
    guidance: [
      "Åbn Mine løb/arkivet fra dashboardet for at se gemte løb.",
      "I arkivet kan nogle aktiviteter startes, åbne en lobby eller planlægges. Lov ikke den samme handling for alle aktivitetstyper; skærmen viser, hvad der er muligt for det valgte løb.",
      "Når en lobby har en PIN-kode eller et link, bruger deltagerne join-siden eller det delte link. Del aldrig en lærerlogin i chatten.",
    ],
    links: [
      {
        label: "Åbn arkivet",
        href: "/dashboard/arkiv",
        kind: "internal",
        target: "_self",
      },
      {
        label: "Deltag i et løb",
        href: "/join",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/arkiv/page.tsx",
      "app/dashboard/DashboardHomeClient.tsx",
      "app/join/page.tsx",
    ],
  },
  {
    id: "gps-hjaelp",
    title: "GPS-hjælp",
    status: "available_here",
    summary:
      "En kort lærer-guide, når en elevs placering ikke kan findes i et SkoleGPS-løb.",
    guidance: [
      "1. Åbn løbet i telefonens almindelige Safari eller Chrome, hvis det blev åbnet fra en anden app.",
      "2. Tjek, at telefonen, browseren og SkoleGPS må bruge placering, og slå præcis placering til, når enheden understøtter det.",
      "3. Gå udenfor og lad løbet stå åbent et øjeblik, mens telefonen finder en position.",
      "4. Bed eleven vælge “Prøv igen”. Hold og fremdrift bliver bevaret.",
      "Bed ikke eleven rydde browserdata eller tilmelde holdet igen. Hvis skolens enhed blokerer placering, skal skolens indstillinger afklares først.",
    ],
    links: [
      {
        label: "Åbn GPS-hjælp",
        href: "/hjaelp",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: ["app/hjaelp/page.tsx"],
  },
  {
    id: "skak",
    title: "Skak",
    status: "available_here",
    summary:
      "Skak er et lærer-værktøj med læring, tavlevisning og klasseaktiviteter.",
    guidance: [
      "Åbn Skak fra Lærerværktøjer. Den korte offentlige rute viderestiller til den beskyttede lærerroute.",
      "Læreren kan bruge Lær skak, Vis på tavlen og Spil skak, inklusive brætvisning, makkere, timer, en enkel turnering og stilling.",
      "Bræt- og turneringsarbejde er session-lokalt. Lov ikke fælles konto- eller elevhistorik.",
    ],
    links: [
      {
        label: "Åbn Skak",
        href: "/dashboard/laerervaerktoejer/skak",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/laerervaerktoejer/skak/page.tsx",
      "app/vaerktojer/skak/page.tsx",
      "components/chess/ChessHub.tsx",
      "lib/chess.ts",
    ],
  },
  {
    id: "oevekort",
    title: "Øvekort",
    status: "available_here",
    summary:
      "Læreren kan lave faglige kort, dele dem, vise dem på tavlen og gøre dem klar til print.",
    guidance: [
      "Lærerens arbejdsflade ligger under Lærerværktøjer → Øvekort.",
      "Et delt elevlink er læseadgang til et kortsæt. Deling kan have udløb og kan tilbagekaldes.",
      "Bed aldrig en elev eller lærer om at indsætte et delingstoken i chatten. Et delt kortsæt åbnes fra dets eget link.",
      "Den offentlige delingsrute kræver ikke elevkonto; elevens øvevalg er lokale for browseren.",
    ],
    links: [
      {
        label: "Åbn Øvekort",
        href: "/dashboard/laerervaerktoejer/oevekort",
        kind: "internal",
        target: "_self",
      },
      {
        label: "Åbn delt Øvekort",
        href: "/oevekort/del",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/laerervaerktoejer/oevekort/page.tsx",
      "app/oevekort/del/page.tsx",
      "components/oevekort/OevekortTeacherClient.tsx",
      "components/oevekort/OevekortPublicShareClient.tsx",
      "docs/skolegps-dashboard-oevekort-plan.md",
    ],
  },
  {
    id: "kildegps",
    title: "KildeGPS",
    status: "external_handoff",
    summary:
      "KildeGPS er et selvstændigt søgeunivers for elever i 7.–9. klasse med redaktionelt kuraterede, troværdige kilder – ikke hele nettet. Det åbnes direkte fra SkoleGPS.",
    guidance: [
      "Den verificerede overgang går direkte til KildeGPS i en ny fane uden SSO-, token- eller elevoplysninger i linket.",
      "KildeGPS' offentlige søgning læser kun godkendte og publicerede kilder. Fortæl ikke, at en bestemt søgning vil have et bestemt resultat eller at en kilde er egnet uden lærerens eget gennemsyn.",
      "For lærere er de verificerede arbejdsgange: start Fokus, lav eller genbrug et kildesæt, og foreslå et link til redaktionel vurdering. Et forslag bliver ikke automatisk udgivet.",
      "Du må ikke opfinde flere KildeGPS-funktioner, data, priser eller adgangsforhold end disse kildeverificerede fakta.",
    ],
    links: [
      {
        label: "Åbn KildeGPS",
        href: "https://www.kildegps.dk",
        kind: "external",
        target: "_blank",
      },
    ],
    sourcePaths: [
      "lib/teacherTools/registry.ts",
      "tests/family-sso.spec.ts",
      "KILDEGPS separate repository: README.md",
      "KILDEGPS separate repository: app/laerer/page.tsx",
    ],
  },
  {
    id: "dagenstavle",
    title: "DagensTavle",
    status: "external_handoff",
    summary:
      "DagensTavle åbnes fra SkoleGPS via en afgrænset Family SSO-overgang til tavlevisningen.",
    guidance: [
      "Åbn værktøjet fra Lærerværktøjer eller dashboardets genvej. Overgangen peger mod /tavle.",
      "Denne kodebase har ikke en verificeret delt datavej til DagensTavle. Lov derfor ikke, at dashboardet kan læse, redigere eller synkronisere en dagsplan.",
      "Beskriv ikke DagensTavles interne funktioner som SkoleGPS-fakta.",
    ],
    links: [
      {
        label: "Åbn DagensTavle",
        href: "https://dagenstavle.dk/auth/family-sso/start?next=%2Ftavle&source=skolegps",
        kind: "external",
        target: "_self",
      },
    ],
    sourcePaths: [
      "lib/teacherTools/registry.ts",
      "lib/familySso/config.ts",
      "app/dashboard/DashboardHomeClient.tsx",
    ],
  },
  {
    id: "printmit-arbejdsark",
    title: "PrintMitArbejdsark",
    status: "external_handoff",
    summary:
      "PrintMitArbejdsark åbnes fra SkoleGPS via en afgrænset Family SSO-overgang til /lav.",
    guidance: [
      "Åbn værktøjet fra Lærerværktøjer eller dashboardets genvej.",
      "Beskriv kun overgangen herfra. Du må ikke love, hvilke arbejdsark, data, priser eller funktioner det eksterne produkt har.",
      "Handoffens faktiske tilgængelighed afhænger af den konfigurerede Family SSO-opsætning.",
    ],
    links: [
      {
        label: "Åbn PrintMitArbejdsark",
        href: "https://printmitarbejdsark.dk/auth/family-sso/start?next=%2Flav&source=skolegps",
        kind: "external",
        target: "_self",
      },
    ],
    sourcePaths: ["lib/teacherTools/registry.ts", "lib/familySso/config.ts"],
  },
  {
    id: "find-bedrageren",
    title: "Find Bedrageren",
    status: "available_here",
    summary:
      "Et mobilspil, hvor elever får roller og et hemmeligt ord, og klassen taler sammen og stemmer om, hvem der bluffer.",
    guidance: [
      "Læreren går til Dashboard → Mobilspil → Find Bedrageren.",
      "Det aktuelle flow er: opsæt ord og roller → eleverne joiner → læreren styrer diskussion og afstemning.",
    ],
    links: [
      {
        label: "Opsæt Find Bedrageren",
        href: "/dashboard/mobilspil/find-bedrageren",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: ["app/dashboard/mobilspil/page.tsx"],
  },
  {
    id: "skemapilot",
    title: "SkemaPilot",
    status: "limited_here",
    summary:
      "En lærerroute med lokal skemakladde, visuel oversigt og lokale tjek.",
    guidance: [
      "SkemaPilot ligger under Lærerværktøjer, men er ikke et af de seks verificerede kort i den aktuelle lærerhub.",
      "Kladder gemmes lokalt i browseren. Beskriv derfor ikke løsningen som fælles eller centralt synkroniseret.",
      "AI-panelet indeholder faste eksempler. Kald det ikke live AI, officiel skemavalidering eller automatisk optimering.",
    ],
    links: [
      {
        label: "Åbn SkemaPilot",
        href: "/dashboard/laerervaerktoejer/skemapilot",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/laerervaerktoejer/skemapilot/page.tsx",
      "app/dashboard/laerervaerktoejer/skemapilot/SkemaPilotWizard.tsx",
      "app/dashboard/laerervaerktoejer/skemapilot/SkemaPilotAiMockPanel.tsx",
      "app/dashboard/laerervaerktoejer/skemapilot/skemaPilotLocalDraft.ts",
    ],
  },
  {
    id: "aarsplan-generator",
    title: "Årsplan-generator",
    status: "limited_here",
    summary:
      "En lærerroute til at bygge, redigere og printe en årsplan som et udkast.",
    guidance: [
      "Vejled til ruten under Lærerværktøjer, når læreren vil arbejde med en årsplanskladde.",
      "Læreren skal altid gennemgå mål, aktiviteter, ferieuger og evaluering før deling eller brug.",
      "Kald ikke den nuværende lokale/mock-baserede forbedring for live AI, officiel læreplansfortolkning eller juridisk rådgivning.",
    ],
    links: [
      {
        label: "Åbn Årsplan-generator",
        href: "/dashboard/laerervaerktoejer/aarsplan-generator",
        kind: "internal",
        target: "_self",
      },
    ],
    sourcePaths: [
      "app/dashboard/laerervaerktoejer/aarsplan-generator/page.tsx",
      "app/dashboard/laerervaerktoejer/aarsplan-generator/annualPlanAiMock.ts",
    ],
  },
  {
    id: "support",
    title: "Support",
    status: "available_here",
    summary:
      "Ved personlig eller uløselig hjælp henviser SkoleGPS til den verificerede supportadresse.",
    guidance: [
      "Brug support ved køb, større licenser, betaling, RLS-fejl, loginproblemer eller når brugeren har brug for menneskelig hjælp.",
      "Angiv kun den verificerede adresse nedenfor. Opfind ikke alternative kontaktveje.",
    ],
    links: [
      {
        label: "Skriv til SkoleGPS-support",
        href: `mailto:${ASSISTANT_SUPPORT_EMAIL}`,
        kind: "email",
        target: "_self",
      },
    ],
    sourcePaths: [
      "components/AIChatButton.tsx",
      "components/HomePageClient.tsx",
      "lib/legalCopy.ts",
    ],
  },
] as const satisfies readonly AssistantKnowledgeCard[];

const CARDS_BY_ID = new Map(
  ASSISTANT_KNOWLEDGE_CARDS.map((card) => [card.id, card]),
);

/**
 * Every example prompt exposed in AIChatButton must point to a bounded card.
 * Keep the client prompt ids here as a server-readable audit map, not as
 * browser-supplied knowledge.
 */
export const ASSISTANT_QUICK_ACTION_KNOWLEDGE_COVERAGE = {
  gps: "gps-loeb",
  skak: "skak",
  kildegps: "kildegps",
  oevekort: "oevekort",
  stratego: "live-stratego",
  "zone-krig": "zone-krigen",
  vm26: "vm26",
  scanner: "bog-scanneren",
  podcast: "podcast-detektiven",
  manual: "generel-quiz",
  start: "opret-loeb",
} as const satisfies Readonly<Record<string, AssistantKnowledgeId>>;

export function getAssistantKnowledgeCards(): readonly AssistantKnowledgeCard[] {
  return ASSISTANT_KNOWLEDGE_CARDS;
}

export function getAssistantKnowledgeCard(
  id: AssistantKnowledgeId,
): AssistantKnowledgeCard | undefined {
  return CARDS_BY_ID.get(id);
}

/**
 * A stable, server-owned prompt section. Call this from a route handler; do
 * not accept an equivalent knowledge block from a browser request.
 */
export function buildAssistantKnowledgeContext(): string {
  const cards = ASSISTANT_KNOWLEDGE_CARDS.map((card) => {
    const guidance = card.guidance.map((item) => `- ${item}`).join("\n");
    const links = card.links
      .map((link) => `- ${link.label}: ${link.href}`)
      .join("\n");

    return [
      `## ${card.title}`,
      `Status: ${card.status}`,
      `Statusregel: ${STATUS_CONTEXT[card.status]}`,
      `Fakta: ${card.summary}`,
      "Vejledning:",
      guidance,
      "Verificerede indgange:",
      links,
    ].join("\n");
  }).join("\n\n");

  return [
    `SKOLEGPS-ASSISTENTVIDEN v${ASSISTANT_KNOWLEDGE_VERSION}`,
    "Brug kun denne viden som produktfakta. Hvis spørgsmålet ligger uden for den, så sig tydeligt, at du ikke kan bekræfte det, og henvis kun til en verificeret indgang eller support, når det passer.",
    "Et kort med status external_handoff giver kun lov til at forklare overgangen og de konkrete, kildeverificerede fakta på kortet; opfind eller udvid aldrig det eksterne værktøjs indhold eller funktioner.",
    "Et kort med status limited_here skal beskrives med dets forbehold. Lov aldrig live AI, officielle data eller automatisk synkronisering, hvis kortet ikke siger det.",
    cards,
  ].join("\n\n");
}
