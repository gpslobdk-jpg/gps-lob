"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  School,
  Settings,
  Sparkles,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type AnnualPlanInput = {
  subject: string;
  gradeLevel: string;
  schoolYear: string;
  municipality: string;
  lessonsPerWeek: string;
  courseCount: string;
  specialThemes: string;
  aiNotes: string;
};

type AnnualPlanPeriod = {
  period: string;
  title: string;
  description: string;
  focus: string;
  activities: string;
  product: string;
  imageIdea: string;
};

type AnnualPlan = {
  title: string;
  commonGoalsIntro: string;
  metaLine: string;
  periods: AnnualPlanPeriod[];
  imageIdeas: string[];
};

type CourseSeed = Omit<AnnualPlanPeriod, "period">;

type StepIndex = 0 | 1 | 2 | 3 | 4;

const subjects = [
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

const gradeLevels = [
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

const schoolYears = ["2026/2027", "2027/2028"] as const;

const municipalities = [
  "Faxe Kommune",
  "Vordingborg Kommune",
  "København",
  "Generisk ferieplan",
] as const;

const lessonsPerWeekOptions = ["1", "2", "3", "4", "5"] as const;
const courseCountOptions = ["4", "5", "6", "7", "8"] as const;

const initialInput: AnnualPlanInput = {
  subject: "",
  gradeLevel: "",
  schoolYear: "",
  municipality: "",
  lessonsPerWeek: "2",
  courseCount: "6",
  specialThemes: "",
  aiNotes: "",
};

const wizardSteps = [
  {
    title: "Vælg fag og klassetrin",
    label: "Trin 1",
    icon: BookOpen,
  },
  {
    title: "Vælg skoleår og kommune",
    label: "Trin 2",
    icon: Calendar,
  },
  {
    title: "Vælg rammer og ønsker",
    label: "Trin 3",
    icon: Settings,
  },
  {
    title: "Generér årsplan",
    label: "Trin 4",
    icon: Sparkles,
  },
  {
    title: "Se flot årsplan-preview",
    label: "Trin 5",
    icon: FileText,
  },
] as const;

const commonGoalsCopy: Record<string, string> = {
  Historie:
    "I historie arbejder eleverne med at forstå sammenhænge mellem fortid, nutid og fremtid. Årsplanen lægger op til arbejde med historiske problemstillinger, kilder og elevernes historiske bevidsthed.",
  Samfundsfag:
    "I samfundsfag arbejder eleverne med demokrati, politik, økonomi og sociale forhold. Årsplanen lægger op til, at eleverne undersøger aktuelle problemstillinger og lærer at argumentere fagligt.",
  Engelsk:
    "I engelsk arbejder eleverne med kommunikation, kultur og sprog. Årsplanen lægger op til mundtlighed, læsning, skrivning og møder med engelsksprogede kulturer.",
  Dansk:
    "I dansk arbejder eleverne med læsning, fremstilling, fortolkning og kommunikation. Årsplanen lægger op til tydelige forløb, hvor eleverne undersøger tekster, producerer egne udtryk og taler fagligt om sprog.",
  Matematik:
    "I matematik arbejder eleverne med problemløsning, ræsonnement, modellering og faglige begreber. Årsplanen lægger op til undersøgende aktiviteter, træning af strategier og anvendelse i hverdagsnære situationer.",
};

const genericCommonGoalsCopy =
  "Årsplanen tager udgangspunkt i fagets kompetenceområder og fordeler årets forløb i overskuelige perioder med tydelige mål, aktiviteter og evaluering.";

const historySeeds: CourseSeed[] = [
  {
    title: "Historiske spor i hverdagen",
    description:
      "Eleverne undersøger lokale og nationale spor fra fortiden og kobler dem til deres egen samtid.",
    focus: "Fokus: kildearbejde, kronologi og historiske spørgsmål.",
    activities: "Aktiviteter: billedkilder, tidslinjer, korte undersøgelser og fælles samtaler.",
    product: "Produkt: visuel tidslinje med mundtlig forklaring.",
    imageIdea:
      "AI-billedidé: elever omkring et bord med gamle kort, fotos, tidslinjer og lyse historiske markører.",
  },
  {
    title: "Magt, demokrati og rettigheder",
    description:
      "Eleverne arbejder med demokratiske gennembrud, magtformer og rettigheder i et historisk perspektiv.",
    focus: "Fokus: årsag, virkning, begreber og historiske vendepunkter.",
    activities: "Aktiviteter: kildelæsning, mini-debatter, begrebskort og casearbejde.",
    product: "Produkt: kort gruppefremlæggelse med kilder.",
    imageIdea:
      "AI-billedidé: moderne illustration af elever, stemmesedler, historiske plakater og samfundsikoner.",
  },
  {
    title: "Danmark i verden",
    description:
      "Eleverne undersøger, hvordan handel, krig, migration og kulturmøder har formet Danmark.",
    focus: "Fokus: perspektivskifte, sammenhænge og historisk bevidsthed.",
    activities: "Aktiviteter: kortarbejde, kildepar, fælles analyse og refleksionsskrivning.",
    product: "Produkt: faglig poster med forklaring.",
    imageIdea:
      "AI-billedidé: verdenskort med ruter, arkivfotos, kompas og elever i undersøgende arbejde.",
  },
  {
    title: "Kilder og fortællinger",
    description:
      "Eleverne vurderer kilders afsender, formål og troværdighed og bygger egne historiske fortællinger.",
    focus: "Fokus: kildekritik, fortolkning og faglig argumentation.",
    activities: "Aktiviteter: kildeværksted, makkersamtaler og korte skriveøvelser.",
    product: "Produkt: historisk forklaring med kildehenvisninger.",
    imageIdea:
      "AI-billedidé: dokumenter, lup, notesbog og rolige farveflader i et historieværksted.",
  },
];

const samfundsfagSeeds: CourseSeed[] = [
  {
    title: "Demokrati og magt",
    description:
      "Eleverne arbejder med demokrati, medborgerskab og magtens tredeling i Danmark.",
    focus: "Fokus: begreber, aktuelle eksempler og diskussion.",
    activities: "Aktiviteter: mini-debatter, kildelæsning og casearbejde.",
    product: "Produkt: kort gruppefremlæggelse.",
    imageIdea:
      "AI-billedidé: moderne illustration af elever, stemmesedler og samfundsikoner.",
  },
  {
    title: "Medier og holdninger",
    description:
      "Eleverne undersøger nyheder, vinkling, sociale medier og argumentation i aktuelle debatter.",
    focus: "Fokus: kildekritik, argumenttyper og demokratisk samtale.",
    activities: "Aktiviteter: nyhedsanalyse, debatkort og redaktionelt værksted.",
    product: "Produkt: kort debatindlæg eller nyhedsforklaring.",
    imageIdea:
      "AI-billedidé: klasselokale med nyhedsflader, talebobler, data og elever i debat.",
  },
  {
    title: "Økonomi i hverdagen",
    description:
      "Eleverne arbejder med privatøkonomi, velfærd og økonomiske prioriteringer.",
    focus: "Fokus: budget, skat, forbrug og samfundsøkonomiske valg.",
    activities: "Aktiviteter: budgetcase, begrebstræning og fælles prioriteringsøvelser.",
    product: "Produkt: casebesvarelse med faglige begreber.",
    imageIdea:
      "AI-billedidé: grafiske budgetark, mønter, diagrammer og elever omkring en økonomicase.",
  },
  {
    title: "Unge, fællesskab og rettigheder",
    description:
      "Eleverne undersøger sociale forhold, identitet, pligter og rettigheder for unge.",
    focus: "Fokus: sociologi, normer, fællesskaber og handlemuligheder.",
    activities: "Aktiviteter: interviewspørgsmål, dataøvelser og strukturerede samtaler.",
    product: "Produkt: undersøgelsesnotat med konklusion.",
    imageIdea:
      "AI-billedidé: elever i et lyst fællesskab med grafiske symboler for rettigheder og relationer.",
  },
];

const englishSeeds: CourseSeed[] = [
  {
    title: "Everyday voices",
    description:
      "Eleverne træner mundtlig kommunikation gennem hverdagsemner, små samtaler og korte præsentationer.",
    focus: "Fokus: ordforråd, udtale, samtalestrategier og tryg mundtlighed.",
    activities: "Aktiviteter: pair talks, role cards, listening tasks and mini-presentations.",
    product: "Produkt: kort mundtlig præsentation på engelsk.",
    imageIdea:
      "AI-billedidé: colourful classroom scene with speech cards, students talking and English word fragments.",
  },
  {
    title: "Stories and culture",
    description:
      "Eleverne læser korte tekster og arbejder med kulturmøder i engelsksprogede lande.",
    focus: "Fokus: læsestrategier, tekstforståelse, kultur og personkarakteristik.",
    activities: "Aktiviteter: shared reading, vocabulary maps, discussion circles and writing prompts.",
    product: "Produkt: reading response med teksteksempler.",
    imageIdea:
      "AI-billedidé: open books, cultural landmarks, notes and warm classroom colours.",
  },
  {
    title: "Write to be understood",
    description:
      "Eleverne skriver korte tekster med tydelig struktur, respons og sproglig bearbejdning.",
    focus: "Fokus: writing process, sentence starters, feedback and revision.",
    activities: "Aktiviteter: model texts, peer feedback, writing sprints and editing checklists.",
    product: "Produkt: færdig kort tekst med refleksion.",
    imageIdea:
      "AI-billedidé: writing desk with drafts, feedback notes, pencils and calm green-blue accents.",
  },
  {
    title: "Global themes",
    description:
      "Eleverne undersøger et aktuelt globalt tema og bruger engelsk til at forklare og argumentere.",
    focus: "Fokus: facts, opinions, argumentation and presentation language.",
    activities: "Aktiviteter: short research, vocabulary bank, group talk and presentation practice.",
    product: "Produkt: gruppepræsentation på engelsk.",
    imageIdea:
      "AI-billedidé: world map, presentation boards, student group work and clear visual keywords.",
  },
];

const danishSeeds: CourseSeed[] = [
  {
    title: "Læselyst og læsestrategier",
    description:
      "Eleverne arbejder med læsevaner, teksttyper og strategier til at forstå og tale om tekster.",
    focus: "Fokus: før, under og efter læsning, tekstsamtaler og ordforråd.",
    activities: "Aktiviteter: læselog, makkersamtaler, tekstmarkering og fælles modellering.",
    product: "Produkt: læseprofil med faglig refleksion.",
    imageIdea:
      "AI-billedidé: hyggelig læsezone med bøger, noteskort, tekstmarkeringer og tydelig danskfaglig stemning.",
  },
  {
    title: "Fortællinger med virkning",
    description:
      "Eleverne undersøger fortællende tekster og skriver selv med fokus på komposition og sproglige virkemidler.",
    focus: "Fokus: person, miljø, konflikt, synsvinkel og respons.",
    activities: "Aktiviteter: modeltekst, skriveøvelser, responsrunde og fælles forbedring.",
    product: "Produkt: bearbejdet fortælling.",
    imageIdea:
      "AI-billedidé: skriveværksted med tekstudkast, karakterkort og varme farveflader.",
  },
  {
    title: "Sprog, debat og holdninger",
    description:
      "Eleverne arbejder med argumentation, debatindlæg og sprogets betydning i kommunikation.",
    focus: "Fokus: påstande, belæg, appelformer og modtagerbevidsthed.",
    activities: "Aktiviteter: debatkort, tekstanalyse, mundtlig øvelse og skriveproces.",
    product: "Produkt: debatindlæg eller tale.",
    imageIdea:
      "AI-billedidé: elever ved en debatvæg med talekort, tekstplakater og klare accentfarver.",
  },
  {
    title: "Fortolkning i fællesskab",
    description:
      "Eleverne læser litteratur og arbejder med fortolkning, perspektivering og faglig samtale.",
    focus: "Fokus: tema, symboler, tomme pladser og tekstnære begrundelser.",
    activities: "Aktiviteter: litteratursamtaler, citatjagt, analysemodel og fælles opsamling.",
    product: "Produkt: kort fortolkningsnotat.",
    imageIdea:
      "AI-billedidé: åbne bøger, citatstrimler, analyseikoner og elever i rolig samtale.",
  },
];

const mathSeeds: CourseSeed[] = [
  {
    title: "Tal, strategier og mønstre",
    description:
      "Eleverne arbejder undersøgende med talforståelse, regnestrategier og mønstre.",
    focus: "Fokus: repræsentationer, forklaringer og strategivalg.",
    activities: "Aktiviteter: stationsarbejde, problemløsning, samtalekort og fælles modellering.",
    product: "Produkt: strategiark med eksempler.",
    imageIdea:
      "AI-billedidé: talmønstre, konkrete materialer, tavleskitser og elever i undersøgende matematik.",
  },
  {
    title: "Geometri i praksis",
    description:
      "Eleverne undersøger former, måling og rumlige sammenhænge gennem praktiske aktiviteter.",
    focus: "Fokus: geometriske begreber, tegning, måling og argumentation.",
    activities: "Aktiviteter: opmåling, konstruktion, digitale skitser og makkerforklaringer.",
    product: "Produkt: geometrisk model med forklaring.",
    imageIdea:
      "AI-billedidé: linealer, geometriske figurer, gridpapir og rolige farvefelter.",
  },
  {
    title: "Data og chance",
    description:
      "Eleverne indsamler, viser og tolker data og arbejder med sandsynlighed i enkle situationer.",
    focus: "Fokus: tabeller, diagrammer, gennemsnit, udfald og vurderinger.",
    activities: "Aktiviteter: dataindsamling, diagramværksted, eksperimenter og klassekonklusioner.",
    product: "Produkt: datarapport med diagrammer.",
    imageIdea:
      "AI-billedidé: farvede diagrammer, datakort, terninger og elever omkring en undersøgelse.",
  },
  {
    title: "Problemløsning og modeller",
    description:
      "Eleverne bruger matematik til at undersøge hverdagsnære problemstillinger og forklare løsninger.",
    focus: "Fokus: modellering, ræsonnement, valg af metoder og præcis kommunikation.",
    activities: "Aktiviteter: åbne opgaver, gruppestrategier, feedback og fælles løsninger.",
    product: "Produkt: problemløsningsposter.",
    imageIdea:
      "AI-billedidé: problemløsningsbord med skitser, beregninger, post-its og tydelige matematikikoner.",
  },
];

const genericSeeds: CourseSeed[] = [
  {
    title: "Faglig opstart og fælles sprog",
    description:
      "Eleverne etablerer centrale begreber, arbejdsformer og forventninger til årets faglige arbejde.",
    focus: "Fokus: fagord, nysgerrighed, fælles rutiner og tryg deltagelse.",
    activities: "Aktiviteter: begrebskort, makkerøvelser, korte undersøgelser og fælles opsamling.",
    product: "Produkt: fælles faglig begrebsvæg.",
    imageIdea:
      "AI-billedidé: lyst klasselokale med faglige begrebskort, elever i grupper og rolige farvefelter.",
  },
  {
    title: "Undersøgelse og fordybelse",
    description:
      "Eleverne arbejder med et centralt fagligt tema gennem undersøgende opgaver og guidet fordybelse.",
    focus: "Fokus: metoder, faglige spørgsmål og begrundede svar.",
    activities: "Aktiviteter: stationsarbejde, kildemateriale, samtalekort og fælles refleksion.",
    product: "Produkt: kort fagligt notat eller visuel forklaring.",
    imageIdea:
      "AI-billedidé: elever ved arbejdsstationer med materialer, notesark og tydelige temaikoner.",
  },
  {
    title: "Anvendelse i praksis",
    description:
      "Eleverne bruger fagets begreber og metoder i praktiske, kreative eller virkelighedsnære situationer.",
    focus: "Fokus: anvendelse, samarbejde, problemløsning og faglig præcision.",
    activities: "Aktiviteter: casearbejde, små produktioner, fælles feedback og afprøvning.",
    product: "Produkt: praktisk produkt med kort forklaring.",
    imageIdea:
      "AI-billedidé: produktionsbord med faglige materialer, skitser og elever i koncentreret samarbejde.",
  },
  {
    title: "Perspektiv og evaluering",
    description:
      "Eleverne samler op på årets faglige pointer og viser, hvordan de kan bruge deres viden videre.",
    focus: "Fokus: refleksion, evaluering, perspektivering og faglig samtale.",
    activities: "Aktiviteter: elevsamtaler, portfolio, korte præsentationer og fælles evaluering.",
    product: "Produkt: portfolio-side eller afsluttende præsentation.",
    imageIdea:
      "AI-billedidé: portfolio, præsentationskort, refleksionsspørgsmål og en rolig afsluttende visuel flade.",
  },
];

const courseSeedsBySubject: Record<string, CourseSeed[]> = {
  Dansk: danishSeeds,
  Matematik: mathSeeds,
  Engelsk: englishSeeds,
  Historie: historySeeds,
  Samfundsfag: samfundsfagSeeds,
};

const periodLabelsByCount: Record<number, string[]> = {
  4: ["Uge 33-41", "Uge 43-51", "Uge 2-13", "Uge 15-25"],
  5: ["Uge 33-39", "Uge 40-47", "Uge 48-6", "Uge 7-15", "Uge 16-25"],
  6: ["Uge 33-38", "Uge 39-44", "Uge 45-51", "Uge 2-8", "Uge 9-16", "Uge 17-25"],
  7: [
    "Uge 33-37",
    "Uge 38-42",
    "Uge 43-48",
    "Uge 49-5",
    "Uge 6-11",
    "Uge 12-18",
    "Uge 19-25",
  ],
  8: [
    "Uge 33-36",
    "Uge 37-41",
    "Uge 43-47",
    "Uge 48-51",
    "Uge 2-6",
    "Uge 7-12",
    "Uge 13-18",
    "Uge 19-25",
  ],
};

const periodAccentClasses = [
  {
    visual: "from-emerald-300 via-teal-200 to-sky-200",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    line: "bg-emerald-500",
  },
  {
    visual: "from-amber-300 via-orange-200 to-rose-200",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
    line: "bg-amber-500",
  },
  {
    visual: "from-sky-300 via-cyan-200 to-lime-200",
    badge: "bg-sky-50 text-sky-900 border-sky-200",
    line: "bg-sky-500",
  },
  {
    visual: "from-rose-300 via-pink-200 to-orange-200",
    badge: "bg-rose-50 text-rose-900 border-rose-200",
    line: "bg-rose-500",
  },
  {
    visual: "from-lime-300 via-emerald-200 to-yellow-200",
    badge: "bg-lime-50 text-lime-900 border-lime-200",
    line: "bg-lime-500",
  },
  {
    visual: "from-cyan-300 via-blue-200 to-emerald-200",
    badge: "bg-cyan-50 text-cyan-900 border-cyan-200",
    line: "bg-cyan-500",
  },
  {
    visual: "from-fuchsia-200 via-rose-200 to-amber-200",
    badge: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200",
    line: "bg-fuchsia-500",
  },
  {
    visual: "from-yellow-300 via-lime-200 to-teal-200",
    badge: "bg-yellow-50 text-yellow-900 border-yellow-200",
    line: "bg-yellow-500",
  },
] as const;

const selectClassName =
  "mt-3 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "mt-3 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const buttonBaseClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-45";

function getCourseSeeds(subject: string) {
  return courseSeedsBySubject[subject] ?? genericSeeds;
}

function getCommonGoalsIntro(subject: string) {
  return commonGoalsCopy[subject] ?? genericCommonGoalsCopy;
}

function createDemoAnnualPlan(input: AnnualPlanInput): AnnualPlan {
  const courseCount = Number(input.courseCount);
  const periodLabels = periodLabelsByCount[courseCount] ?? periodLabelsByCount[6];
  const seeds = getCourseSeeds(input.subject);
  const themeNote = input.specialThemes.trim()
    ? ` Lærerens særlige ønske indarbejdes i årsplanen: ${input.specialThemes.trim()}.`
    : "";
  const aiNote = input.aiNotes.trim()
    ? ` Noter til senere AI-version: ${input.aiNotes.trim()}.`
    : "";

  const periods = Array.from({ length: courseCount }, (_, index) => {
    const seed = seeds[index % seeds.length];
    const isFirstPeriod = index === 0;

    return {
      ...seed,
      period: periodLabels[index],
      description: `${seed.description}${isFirstPeriod ? themeNote : ""}`,
      imageIdea: `${seed.imageIdea}${isFirstPeriod ? aiNote : ""}`,
    };
  });

  return {
    title: `Årsplan i ${input.subject} – ${input.gradeLevel} – ${input.schoolYear}`,
    commonGoalsIntro: getCommonGoalsIntro(input.subject),
    metaLine: `${input.lessonsPerWeek} lektioner pr. uge · ${courseCount} større forløb · ${input.municipality}`,
    periods,
    imageIdeas: periods.map((period) => period.imageIdea),
  };
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-950">{label}</span>
      {description ? <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span> : null}
      {children}
    </label>
  );
}

function EmptyValue({ children = "Ikke valgt endnu" }: { children?: ReactNode }) {
  return <span className="text-slate-400">{children}</span>;
}

export default function AarsplanGeneratorPage() {
  const [input, setInput] = useState<AnnualPlanInput>(initialInput);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [generatedPlan, setGeneratedPlan] = useState<AnnualPlan | null>(null);

  useEffect(() => {
    document.title = "Årsplan-generator – GPSLØB";
  }, []);

  const stepValidity = useMemo(
    () =>
      [
        Boolean(input.subject && input.gradeLevel),
        Boolean(input.schoolYear && input.municipality),
        Boolean(input.lessonsPerWeek && input.courseCount),
        Boolean(
          input.subject &&
            input.gradeLevel &&
            input.schoolYear &&
            input.municipality &&
            input.lessonsPerWeek &&
            input.courseCount,
        ),
        Boolean(generatedPlan),
      ] as const,
    [generatedPlan, input],
  );

  const maxAccessibleStep: StepIndex = generatedPlan
    ? 4
    : !stepValidity[0]
      ? 0
      : !stepValidity[1]
        ? 1
        : !stepValidity[2]
          ? 2
          : 3;

  const selectedSubjectIntro = input.subject ? getCommonGoalsIntro(input.subject) : genericCommonGoalsCopy;

  function updateInput<Key extends keyof AnnualPlanInput>(key: Key, value: AnnualPlanInput[Key]) {
    setInput((previousInput) => ({
      ...previousInput,
      [key]: value,
    }));
    setGeneratedPlan(null);
  }

  function goToStep(step: StepIndex) {
    if (step <= maxAccessibleStep) {
      setCurrentStep(step);
    }
  }

  function goBack() {
    setCurrentStep((step) => Math.max(0, step - 1) as StepIndex);
  }

  function goNext() {
    if (currentStep < 3 && stepValidity[currentStep]) {
      setCurrentStep((step) => Math.min(4, step + 1) as StepIndex);
    }
  }

  function generatePlan() {
    if (!stepValidity[3]) {
      return;
    }

    setGeneratedPlan(createDemoAnnualPlan(input));
    setCurrentStep(4);
  }

  return (
    <main
      className={`min-h-screen bg-[linear-gradient(135deg,#edf7f4_0%,#f8fafc_44%,#fff7ed_100%)] text-slate-950 ${poppins.className}`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard/laerervaerktoejer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/70 bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition hover:border-emerald-200 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Lærerværktøjer
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm sm:inline-flex">
            <School className="h-4 w-4" />
            Lokal prototype
          </div>
        </header>

        <section className="pt-10 lg:pt-12">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-lg border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-800 shadow-sm">
                Lærerværktøj
              </p>
              <h1 className={`mt-5 text-4xl font-black tracking-tight text-slate-950 md:text-6xl ${rubik.className}`}>
                Årsplan-generator
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-slate-700 md:text-lg">
                Byg en rolig demo-årsplan ud fra fag, klassetrin, skoleår, ferieplan og lærerens ønsker.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-6 text-amber-950 shadow-sm">
              Ferieplanen er foreløbig en demo i denne prototype.
            </div>
          </div>

          <nav className="mt-8 grid gap-3 lg:grid-cols-5" aria-label="Årsplan-generator trin">
            {wizardSteps.map((step, index) => {
              const Icon = step.icon;
              const stepIndex = index as StepIndex;
              const isCurrent = currentStep === stepIndex;
              const isComplete = stepValidity[stepIndex] && stepIndex < currentStep;
              const isAccessible = stepIndex <= maxAccessibleStep;

              return (
                <button
                  key={step.title}
                  type="button"
                  disabled={!isAccessible}
                  onClick={() => goToStep(stepIndex)}
                  className={`group flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-55 ${
                    isCurrent
                      ? "border-emerald-300 bg-white text-slate-950 shadow-[0_18px_45px_rgba(16,185,129,0.16)]"
                      : "border-white/70 bg-white/70 text-slate-700 hover:border-emerald-200 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                      isCurrent
                        ? "border-emerald-200 bg-emerald-600 text-white"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      {step.label}
                    </span>
                    <span className="mt-1 block text-sm font-black leading-5">{step.title}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        <section className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-white/75 bg-white/80 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur md:p-7">
            {currentStep === 0 ? (
              <section aria-labelledby="step-one-title">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <BookOpen className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Trin 1</p>
                    <h2
                      id="step-one-title"
                      className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}
                    >
                      Vælg fag og klassetrin
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">
                      Start med den undervisning, årsplanen skal passe til. Det styrer både Fælles Mål-teksten og de
                      forløb, demoen foreslår.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Fag" description="Vælg det fag, årsplanen skal bygges til.">
                    <select
                      className={selectClassName}
                      value={input.subject}
                      onChange={(event) => updateInput("subject", event.target.value)}
                    >
                      <option value="">Vælg fag</option>
                      {subjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Klassetrin" description="Vælg klassetrinnet for årsplanen.">
                    <select
                      className={selectClassName}
                      value={input.gradeLevel}
                      onChange={(event) => updateInput("gradeLevel", event.target.value)}
                    >
                      <option value="">Vælg klassetrin</option>
                      {gradeLevels.map((gradeLevel) => (
                        <option key={gradeLevel} value={gradeLevel}>
                          {gradeLevel}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-8 rounded-lg border border-emerald-100 bg-emerald-50/80 p-5">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-emerald-800" />
                    <p className="text-sm font-black text-emerald-950">Fælles Mål-preview</p>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-7 text-emerald-950/80">{selectedSubjectIntro}</p>
                </div>
              </section>
            ) : null}

            {currentStep === 1 ? (
              <section aria-labelledby="step-two-title">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                    <Calendar className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Trin 2</p>
                    <h2
                      id="step-two-title"
                      className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}
                    >
                      Vælg skoleår og kommune
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">
                      Vælg år og ferieplan. I denne version er ferieplanen kun mock-data, så flowet kan prøves lokalt.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Skoleår" description="Første prototype starter med to skoleår.">
                    <select
                      className={selectClassName}
                      value={input.schoolYear}
                      onChange={(event) => updateInput("schoolYear", event.target.value)}
                    >
                      <option value="">Vælg skoleår</option>
                      {schoolYears.map((schoolYear) => (
                        <option key={schoolYear} value={schoolYear}>
                          {schoolYear}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Kommune eller ferieplan" description="Ferieplanen påvirker kun previewet som demo.">
                    <select
                      className={selectClassName}
                      value={input.municipality}
                      onChange={(event) => updateInput("municipality", event.target.value)}
                    >
                      <option value="">Vælg kommune</option>
                      {municipalities.map((municipality) => (
                        <option key={municipality} value={municipality}>
                          {municipality}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-8 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 md:grid-cols-3">
                  {["Efterårsferie", "Vinterferie", "Påskeferie"].map((holiday) => (
                    <div key={holiday} className="rounded-lg border border-amber-200 bg-white/70 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Demo</p>
                      <p className="mt-2 text-sm font-black">{holiday}</p>
                      <p className="mt-1 text-sm font-semibold text-amber-900/75">Foreløbig mock-periode</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {currentStep === 2 ? (
              <section aria-labelledby="step-three-title">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <Settings className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Trin 3</p>
                    <h2
                      id="step-three-title"
                      className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}
                    >
                      Vælg rammer og ønsker
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">
                      Angiv de vigtigste rammer. Tekstfelterne gemmes kun lokalt i denne prototype og bruges i
                      demo-previewet.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Antal lektioner pr. uge" description="Vælg en enkel ramme for årsplanens tempo.">
                    <select
                      className={selectClassName}
                      value={input.lessonsPerWeek}
                      onChange={(event) => updateInput("lessonsPerWeek", event.target.value)}
                    >
                      {lessonsPerWeekOptions.map((lessonCount) => (
                        <option key={lessonCount} value={lessonCount}>
                          {lessonCount}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Antal større forløb" description="Previewet opretter samme antal forløbskort.">
                    <select
                      className={selectClassName}
                      value={input.courseCount}
                      onChange={(event) => updateInput("courseCount", event.target.value)}
                    >
                      {courseCountOptions.map((courseCount) => (
                        <option key={courseCount} value={courseCount}>
                          {courseCount}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <Field label="Særlige ønsker">
                    <textarea
                      className={textareaClassName}
                      value={input.specialThemes}
                      placeholder="Fx mere bevægelse, flere mundtlige aktiviteter, fokus på projektarbejde..."
                      onChange={(event) => updateInput("specialThemes", event.target.value)}
                    />
                  </Field>

                  <Field label="Noter til AI senere">
                    <textarea
                      className={textareaClassName}
                      value={input.aiNotes}
                      placeholder="Fx tone, lokale emner, materialer eller ting en senere AI-version skal huske..."
                      onChange={(event) => updateInput("aiNotes", event.target.value)}
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            {currentStep === 3 ? (
              <section aria-labelledby="step-four-title">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
                    <Sparkles className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Trin 4</p>
                    <h2
                      id="step-four-title"
                      className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}
                    >
                      Generér årsplan
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">
                      Klik for at bygge en lokal mock-årsplan ud fra dine valg. Der kaldes ingen API og ingen rigtig AI.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {[
                    ["Fag", input.subject],
                    ["Klassetrin", input.gradeLevel],
                    ["Skoleår", input.schoolYear],
                    ["Ferieplan", input.municipality],
                    ["Lektioner pr. uge", input.lessonsPerWeek],
                    ["Større forløb", input.courseCount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-2 text-base font-black text-slate-950">{value || <EmptyValue />}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-lg border border-rose-100 bg-rose-50 p-5">
                  <p className="text-sm font-black text-rose-950">Lokalt prototype-output</p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-rose-950/75">
                    Demoen vælger faglige forløb fra lokale arrays, fordeler dem på perioder og lægger billedidéer klar
                    til en senere version.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!stepValidity[3]}
                  onClick={generatePlan}
                  className={`${buttonBaseClassName} mt-8 w-full border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-100 md:w-fit`}
                >
                  <Sparkles className="h-5 w-5" />
                  Generér demo-årsplan
                  <ArrowRight className="h-4 w-4" />
                </button>
              </section>
            ) : null}

            {currentStep === 4 ? (
              <section aria-labelledby="step-five-title">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                      <FileText className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Trin 5</p>
                      <h2
                        id="step-five-title"
                        className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}
                      >
                        Årsplan-preview
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-emerald-200 hover:text-emerald-800 focus-visible:ring-emerald-100`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Tilpas valg
                  </button>
                </div>

                {generatedPlan ? (
                  <AnnualPlanPreview plan={generatedPlan} />
                ) : (
                  <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-950">
                    Generér en demo-årsplan i trin 4 for at se previewet.
                  </div>
                )}
              </section>
            ) : null}

            {currentStep !== 4 ? (
              <div className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={currentStep === 0}
                  onClick={goBack}
                  className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950 focus-visible:ring-slate-100`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Tilbage
                </button>

                {currentStep < 3 ? (
                  <button
                    type="button"
                    disabled={!stepValidity[currentStep]}
                    onClick={goNext}
                    className={`${buttonBaseClassName} border border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-200`}
                  >
                    Næste
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <aside className="h-fit rounded-lg border border-white/75 bg-white/70 p-5 shadow-sm backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dine valg</p>
            <div className="mt-4 grid gap-3">
              <SummaryRow label="Fag" value={input.subject} />
              <SummaryRow label="Klassetrin" value={input.gradeLevel} />
              <SummaryRow label="Skoleår" value={input.schoolYear} />
              <SummaryRow label="Ferieplan" value={input.municipality} />
              <SummaryRow label="Lektioner" value={`${input.lessonsPerWeek} pr. uge`} />
              <SummaryRow label="Forløb" value={`${input.courseCount} større forløb`} />
            </div>
            <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-950">Prototype-status</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950/75">
                Lokal mock uden AI, API, DB, eksport eller billedgenerering.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value || <EmptyValue />}</p>
    </div>
  );
}

function AnnualPlanPreview({ plan }: { plan: AnnualPlan }) {
  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-[#fbfaf6] shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
      <section className="relative border-b border-slate-200 bg-[linear-gradient(135deg,#064e3b_0%,#0f766e_48%,#f59e0b_100%)] p-7 text-white md:p-9">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
            Print preview
          </p>
          <h3 className={`mt-6 text-4xl font-black tracking-tight md:text-5xl ${rubik.className}`}>{plan.title}</h3>
          <p className="mt-4 text-sm font-bold leading-7 text-white/85">{plan.metaLine}</p>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {["Fælles Mål", "Forløb", "Billedidéer"].map((label, index) => (
            <div key={label} className="rounded-lg border border-white/20 bg-white/12 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Del {index + 1}</p>
              <p className="mt-2 text-sm font-black text-white">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="p-7 md:p-9">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-emerald-800" />
              <h4 className="text-base font-black text-slate-950">Kort forklaring af Fælles Mål</h4>
            </div>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">{plan.commonGoalsIntro}</p>
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-amber-800" />
              <h4 className="text-base font-black text-slate-950">Billedidéer til senere</h4>
            </div>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">
              Hvert forløb får en billedprompt, så en senere version kan koble AI-billeder på uden at ændre selve
              årsplanstrukturen.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {plan.periods.map((period, index) => {
            const accent = periodAccentClasses[index % periodAccentClasses.length];

            return (
              <article key={`${period.period}-${period.title}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className={`h-28 bg-gradient-to-br ${accent.visual}`}>
                  <div className="flex h-full items-end justify-between p-4">
                    <span className={`rounded-lg border px-3 py-2 text-xs font-black ${accent.badge}`}>
                      {period.period}
                    </span>
                    <div className="grid h-16 w-24 grid-cols-3 gap-2 opacity-75">
                      <span className="rounded-md bg-white/65" />
                      <span className="rounded-md bg-white/45" />
                      <span className="rounded-md bg-white/65" />
                      <span className="rounded-md bg-white/35" />
                      <span className="rounded-md bg-white/70" />
                      <span className="rounded-md bg-white/45" />
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className={`h-1.5 w-16 rounded-full ${accent.line}`} />
                  <h4 className={`mt-4 text-2xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
                    {period.title}
                  </h4>
                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">{period.description}</p>

                  <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-700">
                    <InfoLine label="Fagligt fokus" value={period.focus} />
                    <InfoLine label="Aktiviteter" value={period.activities} />
                    <InfoLine label="Produkt/evaluering" value={period.product} />
                  </div>

                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-slate-600" />
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Billedprompt til senere
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{period.imageIdea}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
