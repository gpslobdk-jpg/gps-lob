export type AnnualPlanEngineInput = {
  subject: string;
  grade: string;
  schoolYear: string;
  municipality: string;
  lessonsPerWeek: number;
  courseCount: number;
  wishes: string;
  notes?: string;
};

export type HolidayWeek = {
  name: string;
  weeks: number[];
  label: string;
  type: "holiday" | "note";
  note?: string;
};

export type TeachingWeek = {
  week: number;
  label: string;
  order: number;
};

export type SubjectProfile = {
  commonGoalsIntro: string;
  courseIdeas: string[];
  focusAreas: string[];
  activityIdeas: string[];
  productIdeas: string[];
  imagePromptStyle: string;
};

export type AnnualPlanCourse = {
  period: string;
  teachingWeeks: number;
  estimatedLessons: number;
  title: string;
  description: string;
  focus: string;
  activities: string;
  product: string;
  imagePrompt: string;
  pauseNote?: string;
};

export type AnnualPlanDraft = {
  title: string;
  subject: string;
  grade: string;
  schoolYear: string;
  municipality: string;
  teachingWeeks: number;
  holidayWeeks: HolidayWeek[];
  commonGoalsIntro: string;
  courses: AnnualPlanCourse[];
  summary: {
    totalLessons: number;
    courseCount: number;
    weeksUsed: number;
  };
};

export const subjects = [
  "Dansk",
  "Matematik",
  "Engelsk",
  "Tysk",
  "Historie",
  "Samfundsfag",
  "Kristendomskundskab",
  "Geografi",
  "Biologi",
  "Fysik/kemi",
  "Natur/teknologi",
  "Idræt",
  "Musik",
  "Billedkunst",
  "Håndværk og design",
  "Madkundskab",
  "Valgfag",
] as const;

export const gradeLevels = [
  "0. klasse",
  "1. klasse",
  "2. klasse",
  "3. klasse",
  "4. klasse",
  "5. klasse",
  "6. klasse",
  "7. klasse",
  "8. klasse",
  "9. klasse",
] as const;

export const schoolYears = ["2026/2027", "2027/2028"] as const;

export const municipalities = [
  "Faxe Kommune",
  "Vordingborg Kommune",
  "København",
  "Generisk ferieplan",
] as const;

export const lessonsPerWeekOptions = ["1", "2", "3", "4", "5"] as const;
export const courseCountOptions = ["4", "5", "6", "7", "8"] as const;

const genericCommonGoalsIntro =
  "Årsplanen tager udgangspunkt i fagets kompetenceområder og fordeler årets forløb i overskuelige perioder med tydelige mål, aktiviteter og evaluering.";

const subjectProfiles: Record<string, SubjectProfile> = {
  Dansk: {
    commonGoalsIntro:
      "I dansk arbejder eleverne med læsning, fremstilling, fortolkning og kommunikation. Årsplanen lægger op til tydelige forløb, hvor eleverne undersøger tekster, producerer egne udtryk og taler fagligt om sprog.",
    courseIdeas: [
      "Læselyst og læsestrategier",
      "Fortællinger med virkning",
      "Sprog, debat og holdninger",
      "Fortolkning i fællesskab",
      "Fremstilling med modtagerblik",
      "Medier, genrer og multimodale tekster",
      "Mundtlighed og præsentation",
      "Årets danskfaglige portfolio",
    ],
    focusAreas: [
      "læsestrategier, tekstsamtaler og ordforråd",
      "komposition, synsvinkel, miljø og sproglige virkemidler",
      "påstande, belæg, appelformer og modtagerbevidsthed",
      "tema, symboler, citater og tekstnære begrundelser",
      "skriveproces, respons, revision og tydelig struktur",
      "genretræk, billedsprog, lyd, layout og digitale udtryk",
      "stemme, kropssprog, disposition og faglig respons",
      "refleksion, udvælgelse, progression og faglige mål",
    ],
    activityIdeas: [
      "læselog, makkersamtaler, tekstmarkering og fælles modellering",
      "modeltekst, skriveøvelser, responsrunde og fælles forbedring",
      "debatkort, tekstanalyse, mundtlig øvelse og skriveproces",
      "litteratursamtaler, citatjagt, analysemodel og fælles opsamling",
      "skriveværksted, feedbackpar, mini-lektioner og omskrivning",
      "genrejagt, produktion, billedanalyse og kort fremlæggelse",
      "taleøvelser, optagelse, responskort og præsentationstræning",
      "portfolioarbejde, elevsamtaler, refleksionsark og udstilling",
    ],
    productIdeas: [
      "læseprofil med faglig refleksion",
      "bearbejdet fortælling",
      "debatindlæg eller tale",
      "kort fortolkningsnotat",
      "færdig tekst med responslog",
      "multimodal produktion med kort analyse",
      "mundtlig præsentation med peer feedback",
      "portfolio-side med årsrefleksion",
    ],
    imagePromptStyle:
      "Rolig danskfaglig undervisningsillustration med bøger, tekstuddrag, noteskort og varme, professionelle farver",
  },
  Matematik: {
    commonGoalsIntro:
      "I matematik arbejder eleverne med problemløsning, ræsonnement, modellering og faglige begreber. Årsplanen lægger op til undersøgende aktiviteter, træning af strategier og anvendelse i hverdagsnære situationer.",
    courseIdeas: [
      "Tal, strategier og mønstre",
      "Geometri i praksis",
      "Data og chance",
      "Problemløsning og modeller",
      "Brøker, procent og forhold",
      "Måling og enheder",
      "Algebraiske sammenhænge",
      "Matematik i virkelige cases",
    ],
    focusAreas: [
      "repræsentationer, forklaringer og strategivalg",
      "geometriske begreber, tegning, måling og argumentation",
      "tabeller, diagrammer, gennemsnit, udfald og vurderinger",
      "modellering, ræsonnement, valg af metoder og præcis kommunikation",
      "sammenhænge mellem brøker, procent, decimaltal og forhold",
      "målemetoder, overslag, præcision og enhedsskift",
      "mønstre, variable, regneregler og faglige forklaringer",
      "problemløsning, data, antagelser og vurdering af resultater",
    ],
    activityIdeas: [
      "stationsarbejde, problemløsning, samtalekort og fælles modellering",
      "opmåling, konstruktion, digitale skitser og makkerforklaringer",
      "dataindsamling, diagramværksted, eksperimenter og klassekonklusioner",
      "åbne opgaver, gruppestrategier, feedback og fælles løsninger",
      "kortspil, procentcases, visuelle modeller og træningsloops",
      "praktisk måling, overslagsøvelser, værkstedsopgaver og tjekspørgsmål",
      "mønsterjagt, funktionstabeller, parforklaringer og mini-beviser",
      "casearbejde, regneark, modellering og faglig fremlæggelse",
    ],
    productIdeas: [
      "strategiark med eksempler",
      "geometrisk model med forklaring",
      "datarapport med diagrammer",
      "problemløsningsposter",
      "forklaringsark med flere repræsentationer",
      "målerapport med metodevalg",
      "algebraisk mønsterforklaring",
      "casebesvarelse med beregninger og konklusion",
    ],
    imagePromptStyle:
      "Moderne matematikillustration med tavleskitser, konkrete materialer, diagrammer og rolige grønne og blå farver",
  },
  Engelsk: {
    commonGoalsIntro:
      "I engelsk arbejder eleverne med kommunikation, kultur og sprog. Årsplanen lægger op til mundtlighed, læsning, skrivning og møder med engelsksprogede kulturer.",
    courseIdeas: [
      "Everyday communication",
      "Stories and culture",
      "Write to be understood",
      "Global themes",
      "Voices from the English-speaking world",
      "Reading with strategies",
      "Opinion and argument",
      "Presentation project",
    ],
    focusAreas: [
      "ordforråd, udtale, samtalestrategier og tryg mundtlighed",
      "læsestrategier, tekstforståelse, kultur og personkarakteristik",
      "writing process, sentence starters, feedback and revision",
      "facts, opinions, argumentation and presentation language",
      "kulturmøder, perspektiver, lytteforståelse og samtale",
      "skimming, scanning, inference og tekstnære svar",
      "opinion phrases, examples, counterarguments and respectful debate",
      "research, structure, visuals and confident speaking",
    ],
    activityIdeas: [
      "pair talks, role cards, listening tasks and mini-presentations",
      "shared reading, vocabulary maps, discussion circles and writing prompts",
      "model texts, peer feedback, writing sprints and editing checklists",
      "short research, vocabulary bank, group talk and presentation practice",
      "video clips, culture cards, comparison tasks and spoken reflection",
      "reading stations, keyword notes, partner questions and exit tickets",
      "debate lines, argument cards, model phrases and short responses",
      "source work, rehearsal, slide planning and peer coaching",
    ],
    productIdeas: [
      "kort mundtlig præsentation på engelsk",
      "reading response med teksteksempler",
      "færdig kort tekst med refleksion",
      "gruppepræsentation på engelsk",
      "culture comparison poster",
      "reading journal entry",
      "opinion paragraph or mini debate",
      "presentation with visual support",
    ],
    imagePromptStyle:
      "Bright classroom illustration with English word cards, speech bubbles, books and global culture details",
  },
  Tysk: {
    commonGoalsIntro:
      "I tysk arbejder eleverne med enkel kommunikation, kulturforståelse, ordforråd og sproglig nysgerrighed. Årsplanen fordeler mundtlige, skriftlige og kulturelle forløb i overskuelige perioder.",
    courseIdeas: [
      "Hallo und Alltag",
      "Meine Welt",
      "Essen, Freizeit und Gewohnheiten",
      "Tyske byer og kulturmøder",
      "Læsning med støtte",
      "Skriv korte tekster",
      "Mundtlig træning i par",
      "Miniprojekt på tysk",
    ],
    focusAreas: [
      "hilsner, basisordforråd, udtale og tryg deltagelse",
      "familie, interesser, beskrivelser og simple sætningsmønstre",
      "hverdagsemner, verber, chunks og korte dialoger",
      "kultur, geografi, sammenligning og præsentationssprog",
      "læsestrategier, transparente ord og billedstøtte",
      "sætningsstartere, ordstilling, respons og revision",
      "spørgsmål, svar, lytteforståelse og udtale",
      "research, produktvalg, fremlæggelse og sproglig sikkerhed",
    ],
    activityIdeas: [
      "lytteøvelser, samtalekort, gentagelsesrutiner og små rollespil",
      "ordbank, billedkort, makkerinterview og korte beskrivelser",
      "dialogøvelser, madkort, bevægelseslege og mini-skrivning",
      "kortarbejde, videoklip, kulturposter og fælles samtale",
      "tekstbidder, ordjagt, makkerlæsning og forståelsesspørgsmål",
      "modeltekster, skrivepar, responskort og omskrivning",
      "speed-dating, lytteopgaver, udtaletræning og korte optagelser",
      "projektværksted, billedstøtte, øvefremlæggelse og feedback",
    ],
    productIdeas: [
      "kort dialog med makker",
      "personlig præsentation med støtteord",
      "menu, dialog eller hverdagsplakat",
      "kulturposter med tyske nøgleord",
      "læseark med strateginoter",
      "kort tekst med respons",
      "mundtlig optagelse eller samtale",
      "miniprojekt med tysk præsentation",
    ],
    imagePromptStyle:
      "Venlig tyskundervisningsillustration med ordkort, samtalekort, kort over Tyskland og klare undervisningsikoner",
  },
  Historie: {
    commonGoalsIntro:
      "I historie arbejder eleverne med at forstå sammenhænge mellem fortid, nutid og fremtid. Årsplanen lægger op til arbejde med historiske problemstillinger, kilder og elevernes historiske bevidsthed.",
    courseIdeas: [
      "Historiske spor i hverdagen",
      "Magt, demokrati og rettigheder",
      "Danmark i verden",
      "Kilder og fortællinger",
      "Krig, fred og vendepunkter",
      "Levevilkår før og nu",
      "Historiebrug i medier",
      "Årets historiske undersøgelse",
    ],
    focusAreas: [
      "kildearbejde, kronologi og historiske spørgsmål",
      "årsag, virkning, begreber og historiske vendepunkter",
      "perspektivskifte, sammenhænge og historisk bevidsthed",
      "kildekritik, fortolkning og faglig argumentation",
      "brud, kontinuitet, aktører og konsekvenser",
      "levevilkår, sociale forskelle, hverdag og forandring",
      "historiebrug, fremstillinger, afsender og formål",
      "problemstilling, materialevalg, konklusion og formidling",
    ],
    activityIdeas: [
      "billedkilder, tidslinjer, korte undersøgelser og fælles samtaler",
      "kildelæsning, mini-debatter, begrebskort og casearbejde",
      "kortarbejde, kildepar, fælles analyse og refleksionsskrivning",
      "kildeværksted, makkersamtaler og korte skriveøvelser",
      "tidslinjer, aktørkort, årsagskæder og historiske dilemmaer",
      "billedanalyse, sammenligning, elevinterview og klasseopsamling",
      "medieklip, reklamer, monumenter og kritisk samtale",
      "projektværksted, kildesøgning, vejledning og præsentation",
    ],
    productIdeas: [
      "visuel tidslinje med mundtlig forklaring",
      "kort gruppefremlæggelse med kilder",
      "faglig poster med forklaring",
      "historisk forklaring med kildehenvisninger",
      "årsagsforklaring eller historisk essay",
      "sammenlignende hverdagsfortælling",
      "analyse af historiebrug",
      "undersøgelsesprodukt med konklusion",
    ],
    imagePromptStyle:
      "Moderne historiefaglig illustration med kilder, tidslinjer, kort, arkivfotos og elever i undersøgende arbejde",
  },
  Samfundsfag: {
    commonGoalsIntro:
      "I samfundsfag arbejder eleverne med demokrati, politik, økonomi og sociale forhold. Årsplanen lægger op til, at eleverne undersøger aktuelle problemstillinger og lærer at argumentere fagligt.",
    courseIdeas: [
      "Demokrati og magt",
      "Medier og holdninger",
      "Økonomi i hverdagen",
      "Unge, fællesskab og rettigheder",
      "Velfærd og prioriteringer",
      "Kommunalpolitik tæt på",
      "Data, meninger og samfund",
      "Aktuel samfundsfaglig case",
    ],
    focusAreas: [
      "politiske begreber, aktuelle eksempler og argumentation",
      "kildekritik, argumenttyper og demokratisk samtale",
      "budget, skat, forbrug og samfundsøkonomiske valg",
      "sociologi, normer, fællesskaber og handlemuligheder",
      "velfærdsmodeller, rettigheder, pligter og prioritering",
      "kommunale opgaver, demokrati i praksis og lokal beslutningstagning",
      "dataforståelse, grafer, holdningsmålinger og fejlkilder",
      "problemstilling, aktører, interesser og løsningsforslag",
    ],
    activityIdeas: [
      "mini-debatter, kildelæsning og casearbejde",
      "nyhedsanalyse, debatkort og redaktionelt værksted",
      "budgetcase, begrebstræning og fælles prioriteringsøvelser",
      "interviewspørgsmål, dataøvelser og strukturerede samtaler",
      "rollespil, prioriteringskort, velfærdscases og fælles opsamling",
      "lokal case, kommunekort, udvalgsspil og kort argumentation",
      "diagramlæsning, meningsmålinger, klassedata og kritiske spørgsmål",
      "caseanalyse, aktørkort, løsningsforslag og fremlæggelse",
    ],
    productIdeas: [
      "gruppefremlæggelse eller kort skriftlig refleksion",
      "kort debatindlæg eller nyhedsforklaring",
      "casebesvarelse med faglige begreber",
      "undersøgelsesnotat med konklusion",
      "prioriteringsoplæg med begrundelse",
      "lokalpolitisk minioplæg",
      "datafortolkning med kildekritik",
      "samfundsfaglig casepræsentation",
    ],
    imagePromptStyle:
      "Moderne undervisningsillustration med elever, stemmesedler, talebobler, data og samfundsikoner",
  },
};

const fallbackProfile: SubjectProfile = {
  commonGoalsIntro: genericCommonGoalsIntro,
  courseIdeas: [
    "Faglig opstart og fælles sprog",
    "Undersøgelse og fordybelse",
    "Anvendelse i praksis",
    "Perspektiv og evaluering",
    "Faglige metoder i brug",
    "Kreativt eller praktisk produkt",
    "Samarbejde og formidling",
    "Årets afsluttende opsamling",
  ],
  focusAreas: [
    "fagord, nysgerrighed, fælles rutiner og tryg deltagelse",
    "metoder, faglige spørgsmål og begrundede svar",
    "anvendelse, samarbejde, problemløsning og faglig præcision",
    "refleksion, evaluering, perspektivering og faglig samtale",
    "faglige arbejdsmåder, modeller og systematisk undersøgelse",
    "produktudvikling, feedback og tydelig faglig kobling",
    "kommunikation, samarbejdsroller og faglig formidling",
    "portfolio, repetition, valg af eksempler og elevrefleksion",
  ],
  activityIdeas: [
    "begrebskort, makkerøvelser, korte undersøgelser og fælles opsamling",
    "stationsarbejde, kildemateriale, samtalekort og fælles refleksion",
    "casearbejde, små produktioner, fælles feedback og afprøvning",
    "elevsamtaler, portfolio, korte præsentationer og fælles evaluering",
    "værkstedsopgaver, modeller, tjekspørgsmål og makkerforklaringer",
    "skitsefase, prototype, responsrunde og justering",
    "gruppeopgaver, rollefordeling, træning og fremlæggelse",
    "opsamlingsspil, portfolioarbejde, mini-samtaler og evaluering",
  ],
  productIdeas: [
    "fælles faglig begrebsvæg",
    "kort fagligt notat eller visuel forklaring",
    "praktisk produkt med kort forklaring",
    "portfolio-side eller afsluttende præsentation",
    "metodeark med eksempler",
    "produkt med responslog",
    "kort gruppefremlæggelse",
    "årsrefleksion med faglige eksempler",
  ],
  imagePromptStyle:
    "Lys undervisningsillustration med faglige materialer, elever i samarbejde og rolige professionelle farver",
};

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function formatWeekLabel(weeks: number[]) {
  if (weeks.length === 1) {
    return `uge ${weeks[0]}`;
  }

  return `uge ${weeks.slice(0, -1).join(", ")} og ${weeks[weeks.length - 1]}`;
}

function getWinterHolidayWeek(schoolYear: string, municipality: string) {
  const winterWeeks: Record<string, Record<string, number>> = {
    "2026/2027": {
      "Faxe Kommune": 7,
      "Vordingborg Kommune": 8,
      København: 7,
      "Generisk ferieplan": 7,
    },
    "2027/2028": {
      "Faxe Kommune": 8,
      "Vordingborg Kommune": 7,
      København: 7,
      "Generisk ferieplan": 8,
    },
  };

  return winterWeeks[schoolYear]?.[municipality] ?? 7;
}

function getEasterWeeks(schoolYear: string) {
  return schoolYear === "2027/2028" ? [15, 16] : [14, 15];
}

function getSpringBreakNoteWeek(schoolYear: string) {
  return schoolYear === "2027/2028" ? 21 : 20;
}

export function getHolidayWeeks(schoolYear: string, municipality: string): HolidayWeek[] {
  const winterWeek = getWinterHolidayWeek(schoolYear, municipality);
  const easterWeeks = getEasterWeeks(schoolYear);
  const springNoteWeek = getSpringBreakNoteWeek(schoolYear);

  return [
    {
      name: "Efterårsferie",
      weeks: [42],
      label: "uge 42",
      type: "holiday",
    },
    {
      name: "Juleferie",
      weeks: [52, 1],
      label: "uge 52 og 1",
      type: "holiday",
    },
    {
      name: "Vinterferie",
      weeks: [winterWeek],
      label: `uge ${winterWeek}`,
      type: "holiday",
    },
    {
      name: "Påskeferie",
      weeks: easterWeeks,
      label: formatWeekLabel(easterWeeks),
      type: "holiday",
    },
    {
      name: "Kristi himmelfart / korte forårsbrud",
      weeks: [springNoteWeek],
      label: `uge ${springNoteWeek}`,
      type: "note",
      note: "Markeret som prototype-note og ikke behandlet som en hel ferieuge.",
    },
  ];
}

function getSchoolYearWeeks() {
  return [...range(33, 52), ...range(1, 26)].map((week, order) => ({
    week,
    label: `Uge ${week}`,
    order,
  }));
}

export function buildTeachingWeeks(schoolYear: string, municipality: string): TeachingWeek[] {
  const holidayWeeks = getHolidayWeeks(schoolYear, municipality);
  const excludedWeeks = new Set(
    holidayWeeks.flatMap((holiday) => (holiday.type === "holiday" ? holiday.weeks : [])),
  );

  return getSchoolYearWeeks().filter((week) => !excludedWeeks.has(week.week));
}

export function getSubjectProfile(subject: string) {
  return subjectProfiles[subject] ?? fallbackProfile;
}

export function getCommonGoalsIntro(subject: string) {
  return getSubjectProfile(subject).commonGoalsIntro;
}

function splitTeachingWeeks(teachingWeeks: TeachingWeek[], courseCount: number) {
  const count = Math.max(1, Math.min(courseCount, teachingWeeks.length));
  const baseSize = Math.floor(teachingWeeks.length / count);
  const remainder = teachingWeeks.length % count;
  let cursor = 0;

  return Array.from({ length: count }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0);
    const group = teachingWeeks.slice(cursor, cursor + size);
    cursor += size;
    return group;
  });
}

function createPeriodLabel(weeks: TeachingWeek[]) {
  const firstWeek = weeks[0]?.week;
  const lastWeek = weeks[weeks.length - 1]?.week;

  if (!firstWeek || !lastWeek) {
    return "Ingen undervisningsuger";
  }

  if (firstWeek === lastWeek) {
    return `Uge ${firstWeek}`;
  }

  return `Uge ${firstWeek}-${lastWeek}`;
}

function createPauseNote(weeks: TeachingWeek[], holidayWeeks: HolidayWeek[]) {
  const firstOrder = weeks[0]?.order;
  const lastOrder = weeks[weeks.length - 1]?.order;

  if (firstOrder === undefined || lastOrder === undefined) {
    return undefined;
  }

  const schoolWeekOrder = new Map(getSchoolYearWeeks().map((week) => [week.week, week.order]));
  const crossedPauses = holidayWeeks.filter((holiday) =>
    holiday.weeks.some((week) => {
      const order = schoolWeekOrder.get(week);
      return order !== undefined && order > firstOrder && order < lastOrder;
    }),
  );

  if (crossedPauses.length === 0) {
    return undefined;
  }

  return `Forløbet ligger hen over ${crossedPauses
    .map((holiday) => `${holiday.name.toLowerCase()} (${holiday.label})`)
    .join(", ")}.`;
}

function pickProfileValue(values: string[], index: number) {
  return values[index % values.length];
}

function createCourseDescription(input: AnnualPlanEngineInput, title: string, index: number) {
  const base =
    `Eleverne arbejder med ${title.toLowerCase()} i ${input.grade}. ` +
    "Forløbet kobler faglige begreber, varierede aktiviteter og løbende opsamling.";

  if (index !== 0 || !input.wishes.trim()) {
    return base;
  }

  return `${base} Lærerens særlige ønsker indarbejdes: ${input.wishes.trim()}.`;
}

function createImagePrompt(input: AnnualPlanEngineInput, profile: SubjectProfile, title: string, index: number) {
  const notes = input.notes?.trim();
  const base =
    `${profile.imagePromptStyle}. Motiv: ${title.toLowerCase()}, elever i aktivt fagligt arbejde, ` +
    "tydelig periodefornemmelse og plads til titeltekst.";

  if (index !== 0 || !notes) {
    return base;
  }

  return `${base} Noter til senere AI-version: ${notes}.`;
}

export function createAnnualPlanDraft(input: AnnualPlanEngineInput): AnnualPlanDraft {
  const lessonsPerWeek = Math.max(1, input.lessonsPerWeek);
  const courseCount = Math.max(1, input.courseCount);
  const profile = getSubjectProfile(input.subject);
  const holidayWeeks = getHolidayWeeks(input.schoolYear, input.municipality);
  const teachingWeeks = buildTeachingWeeks(input.schoolYear, input.municipality);
  const courseWeekGroups = splitTeachingWeeks(teachingWeeks, courseCount);

  const courses = courseWeekGroups.map((weeks, index) => {
    const title = pickProfileValue(profile.courseIdeas, index);
    const teachingWeekCount = weeks.length;

    return {
      period: createPeriodLabel(weeks),
      teachingWeeks: teachingWeekCount,
      estimatedLessons: teachingWeekCount * lessonsPerWeek,
      title,
      description: createCourseDescription(input, title, index),
      focus: pickProfileValue(profile.focusAreas, index),
      activities: pickProfileValue(profile.activityIdeas, index),
      product: pickProfileValue(profile.productIdeas, index),
      imagePrompt: createImagePrompt(input, profile, title, index),
      pauseNote: createPauseNote(weeks, holidayWeeks),
    };
  });

  const weeksUsed = courses.reduce((total, course) => total + course.teachingWeeks, 0);

  return {
    title: `Årsplan i ${input.subject} – ${input.grade} – ${input.schoolYear}`,
    subject: input.subject,
    grade: input.grade,
    schoolYear: input.schoolYear,
    municipality: input.municipality,
    teachingWeeks: teachingWeeks.length,
    holidayWeeks,
    commonGoalsIntro: profile.commonGoalsIntro,
    courses,
    summary: {
      totalLessons: weeksUsed * lessonsPerWeek,
      courseCount: courses.length,
      weeksUsed,
    },
  };
}
