import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

const h = React.createElement;
const workspace = process.cwd();
const outputDirectory = join(workspace, "output", "pdf");
const protectedAssetDirectory = join(workspace, "assets", "printpakker", "efteraarsmysteriet");
const publicPreviewDirectory = join(workspace, "public", "printpakker");
const stationArtworkDirectory = join(publicPreviewDirectory, "stations");
// Passing an in-memory buffer keeps the renderer independent of Windows path
// parsing and embeds the original illustration in the prebuilt PDF.
const coverImage = await readFile(join(publicPreviewDirectory, "afteraarsmysteriet-cover.png"));

const files = {
  wholeColour: "SkoleGPS_Efteraarsmysteriet_hele_pakken_farve.pdf",
  wholeInkSaver: "SkoleGPS_Efteraarsmysteriet_hele_pakken_blaekbesparende.pdf",
  student: "SkoleGPS_Efteraarsmysteriet_elevark.pdf",
  answerKey: "SkoleGPS_Efteraarsmysteriet_facit.pdf",
  teacherGuide: "SkoleGPS_Efteraarsmysteriet_laerervejledning.pdf",
  preview: "SkoleGPS_Efteraarsmysteriet_forhaandsvisning.pdf",
};

const stations = [
  {
    title: "Kastanjekransene",
    skill: "Multiplikation",
    prompt: "I værkstedet hænger 8 kastanjekranse. På hver krans sidder 7 kastanjer. Hvor mange kastanjer sidder der i alt?",
    answer: "56 kastanjer",
    strategy: "8 gange 7 = 56. Lad holdet forklare med gentagen addition eller tabelviden.",
    clue: "LYG",
    motif: "Kastanjer i en rund krans",
    artwork: "kastanjekranse.png",
  },
  {
    title: "Bladarkivet",
    skill: "Division",
    prompt: "96 pressede blade skal fordeles ligeligt i 8 små kuverter. Hvor mange blade kommer der i hver kuvert?",
    answer: "12 blade",
    strategy: "96 delt med 8 = 12. Eleverne kan kontrollere med 12 gange 8.",
    clue: "TEN",
    motif: "Blade i små papirkuverter",
    artwork: "bladarkivet.png",
  },
  {
    title: "Æblemosten",
    skill: "Decimaltal og division",
    prompt: "Der er 3,6 liter æblemost. Den hældes ligeligt i 6 små flasker. Hvor meget er der i hver flaske?",
    answer: "0,6 liter eller 600 ml",
    strategy: "3,6 delt med 6 = 0,6. Begge enheder accepteres, når de er korrekte.",
    clue: "ER",
    motif: "Et glas med ravfarvet æblemost",
    artwork: "aeblemosten.png",
  },
  {
    title: "Lanterneruden",
    skill: "Areal",
    prompt: "En gennemsigtig rude til lanternen er 9 cm lang og 6 cm bred. Hvor stort er rudens areal?",
    answer: "54 cm²",
    strategy: "9 gange 6 = 54. Mind klassen om, at spørgsmålet er areal og ikke omkreds.",
    clue: "I",
    motif: "En varm, gylden lanternerude",
    artwork: "lanterneruden.png",
  },
  {
    title: "Farveværkstedet",
    skill: "Brøker af et antal",
    prompt: "Af 42 papirblade skal 5/6 farves gyldne. Hvor mange blade bliver gyldne?",
    answer: "35 papirblade",
    strategy: "En sjettedel af 42 er 7. Fem sjettedele er 5 gange 7 = 35.",
    clue: "DEN",
    motif: "Papirblade i efterårsfarver",
    artwork: "farvevaerkstedet.png",
  },
  {
    title: "Skumringsuret",
    skill: "Tidsinterval",
    prompt: "Lanterneværkstedet starter kl. 14.25 og slutter kl. 15.10. Hvor længe varer det?",
    answer: "45 minutter",
    strategy: "35 minutter til kl. 15.00 og 10 minutter videre. I alt 45 minutter.",
    clue: "RØDE KURV",
    motif: "Et ur ved skumringstid",
    artwork: "skumringsuret.png",
  },
];

const stationArtwork = Object.fromEntries(await Promise.all(
  stations.map(async ({ artwork }) => [artwork, await readFile(join(stationArtworkDirectory, artwork))]),
));

const palette = {
  navy: "#153f61",
  blue: "#0b74bb",
  teal: "#367b85",
  cream: "#fffaf0",
  paper: "#fffdf8",
  gold: "#e5a63b",
  rust: "#a7542d",
  leaf: "#8f5c27",
  ink: "#1a2732",
  muted: "#5a6e78",
  line: "#c6d6d9",
  paleBlue: "#e9f6f8",
};

function makeStyles(inkSaver) {
  const ink = inkSaver ? "#141414" : palette.ink;
  const accent = inkSaver ? "#262626" : palette.blue;
  return StyleSheet.create({
    page: {
      backgroundColor: inkSaver ? "#ffffff" : palette.cream,
      color: ink,
      fontFamily: "Helvetica",
      fontSize: 10.5,
      paddingTop: 40,
      paddingRight: 42,
      paddingBottom: 42,
      paddingLeft: 42,
    },
    cover: {
      position: "relative",
      backgroundColor: inkSaver ? "#ffffff" : "#e9d0a0",
      color: inkSaver ? "#101010" : palette.navy,
      padding: 0,
    },
    coverImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity: inkSaver ? 0 : 1,
    },
    coverPanel: {
      position: "absolute",
      top: 52,
      left: 42,
      width: 320,
      borderWidth: inkSaver ? 1.5 : 0,
      borderColor: "#111111",
      borderRadius: inkSaver ? 0 : 14,
      paddingTop: 22,
      paddingRight: 22,
      paddingBottom: 20,
      paddingLeft: 22,
      backgroundColor: inkSaver ? "#ffffff" : "rgba(255,253,247,0.94)",
    },
    coverKicker: { color: inkSaver ? "#111111" : palette.rust, fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" },
    coverTitle: { marginTop: 8, color: inkSaver ? "#111111" : palette.navy, fontSize: 30, fontFamily: "Helvetica-Bold", lineHeight: 0.96 },
    coverSubtitle: { marginTop: 11, color: inkSaver ? "#222222" : palette.muted, fontSize: 12, lineHeight: 1.45 },
    coverFacts: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 15 },
    coverFact: { borderWidth: 1, borderColor: inkSaver ? "#222222" : "#d3b97d", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 7, color: inkSaver ? "#111111" : palette.leaf, fontSize: 8.5, fontWeight: 700 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1.4, borderBottomColor: inkSaver ? "#111111" : palette.blue, paddingBottom: 8, marginBottom: 16 },
    eyebrow: { color: inkSaver ? "#111111" : palette.blue, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase" },
    heading: { marginTop: 4, color: inkSaver ? "#111111" : palette.navy, fontFamily: "Helvetica-Bold", fontSize: 21, lineHeight: 1.05 },
    pageNumber: { color: inkSaver ? "#111111" : palette.muted, fontSize: 8.5, fontWeight: 700 },
    intro: { color: inkSaver ? "#282828" : palette.muted, fontSize: 11, lineHeight: 1.55 },
    sectionTitle: { marginTop: 14, color: inkSaver ? "#111111" : palette.navy, fontFamily: "Helvetica-Bold", fontSize: 13.5 },
    body: { marginTop: 5, color: inkSaver ? "#222222" : palette.muted, fontSize: 10.3, lineHeight: 1.5 },
    note: { marginTop: 12, borderLeftWidth: 4, borderLeftColor: inkSaver ? "#111111" : palette.gold, paddingTop: 8, paddingRight: 10, paddingBottom: 8, paddingLeft: 11, backgroundColor: inkSaver ? "#f4f4f4" : "#fff2d2" },
    noteText: { color: inkSaver ? "#222222" : "#644214", fontSize: 10, lineHeight: 1.45 },
    stationBand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15 },
    stationNumber: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: inkSaver ? 0 : 12, backgroundColor: inkSaver ? "#111111" : palette.rust, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 16 },
    stationSkill: { color: inkSaver ? "#222222" : palette.rust, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase" },
    stationTitle: { marginTop: 3, color: inkSaver ? "#111111" : palette.navy, fontFamily: "Helvetica-Bold", fontSize: 20 },
    visualPanel: { height: 105, overflow: "hidden", borderWidth: 1, borderColor: inkSaver ? "#333333" : "#c69f67", borderRadius: inkSaver ? 0 : 14, backgroundColor: inkSaver ? "#fafafa" : "#f6e4bd", marginBottom: 16, padding: 13, justifyContent: "space-between" },
    visualTitle: { color: inkSaver ? "#222222" : palette.leaf, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" },
    visualLine: { height: 4, width: "82%", backgroundColor: inkSaver ? "#444444" : palette.gold, borderRadius: 3 },
    visualShapes: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
    visualShape: { width: 27, height: 27, borderRadius: 12, backgroundColor: inkSaver ? "#d7d7d7" : palette.rust, opacity: 0.85 },
    visualShapeSmall: { width: 17, height: 17, borderRadius: 8, backgroundColor: inkSaver ? "#9c9c9c" : palette.teal, opacity: 0.86 },
    stationArtwork: { width: "100%", height: 105, objectFit: "cover", borderWidth: 1, borderColor: inkSaver ? "#333333" : "#c69f67", borderRadius: inkSaver ? 0 : 14, marginBottom: 16 },
    promptBox: { borderWidth: 1.3, borderColor: inkSaver ? "#222222" : "#b6ced2", borderRadius: inkSaver ? 0 : 12, padding: 15, backgroundColor: "#ffffff" },
    promptLabel: { color: accent, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase" },
    prompt: { marginTop: 8, color: inkSaver ? "#111111" : palette.ink, fontFamily: "Helvetica-Bold", fontSize: 13, lineHeight: 1.42 },
    answerArea: { marginTop: 16, borderWidth: 1, borderColor: inkSaver ? "#333333" : "#a9c4cb", borderRadius: inkSaver ? 0 : 10, padding: 12, minHeight: 175, backgroundColor: inkSaver ? "#ffffff" : "#fbfefd" },
    answerLabel: { color: inkSaver ? "#222222" : palette.blue, fontSize: 9.5, fontWeight: 700 },
    ruledLine: { borderBottomWidth: 0.7, borderBottomColor: inkSaver ? "#7b7b7b" : "#b5d4da", marginTop: 22 },
    teacherFlag: { alignSelf: "flex-start", borderWidth: 1, borderColor: inkSaver ? "#111111" : palette.rust, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 7, color: inkSaver ? "#111111" : palette.rust, fontSize: 8, fontWeight: 700, textTransform: "uppercase" },
    answerCard: { borderWidth: 1, borderColor: inkSaver ? "#333333" : "#c5d8db", borderRadius: inkSaver ? 0 : 11, padding: 12, marginTop: 10, backgroundColor: "#ffffff" },
    answerTitle: { color: inkSaver ? "#111111" : palette.navy, fontFamily: "Helvetica-Bold", fontSize: 12.2 },
    answerText: { marginTop: 4, color: inkSaver ? "#222222" : palette.muted, fontSize: 9.6, lineHeight: 1.42 },
    answerStrong: { marginTop: 7, color: inkSaver ? "#111111" : palette.rust, fontFamily: "Helvetica-Bold", fontSize: 10.3 },
    clueBox: { marginTop: 7, borderWidth: 1, borderStyle: "dashed", borderColor: inkSaver ? "#222222" : palette.gold, borderRadius: inkSaver ? 0 : 9, padding: 8, backgroundColor: inkSaver ? "#ffffff" : "#fff6df" },
    clueText: { color: inkSaver ? "#111111" : "#754717", fontFamily: "Helvetica-Bold", fontSize: 10 },
    checklist: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
    checkbox: { width: 11, height: 11, borderWidth: 1, borderColor: inkSaver ? "#111111" : palette.blue, marginTop: 2 },
    footer: { position: "absolute", left: 42, right: 42, bottom: 18, flexDirection: "row", justifyContent: "space-between", color: inkSaver ? "#333333" : palette.muted, fontSize: 7.7 },
    holdGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 15 },
    holdCell: { width: "47%", minHeight: 90, borderWidth: 1, borderColor: inkSaver ? "#333333" : "#b4cbd0", borderRadius: inkSaver ? 0 : 10, padding: 10, backgroundColor: "#ffffff" },
    holdCellTitle: { color: inkSaver ? "#111111" : palette.navy, fontFamily: "Helvetica-Bold", fontSize: 10 },
    wordSlots: { flexDirection: "row", gap: 5, marginTop: 17 },
    wordSlot: { width: 34, height: 29, borderBottomWidth: 1.3, borderBottomColor: inkSaver ? "#111111" : palette.rust },
  });
}

function DecoratedBand({ styles, label, inkSaver }) {
  return h(View, { style: styles.visualPanel }, [
    h(Text, { key: "label", style: styles.visualTitle }, label),
    h(View, { key: "line", style: styles.visualLine }),
    h(View, { key: "shapes", style: styles.visualShapes }, [
      h(View, { key: "shape-1", style: styles.visualShape }),
      h(View, { key: "shape-2", style: styles.visualShapeSmall }),
      h(View, { key: "shape-3", style: { ...styles.visualShape, width: 20, height: 20, backgroundColor: inkSaver ? "#a3a3a3" : palette.gold } }),
      h(View, { key: "shape-4", style: styles.visualShapeSmall }),
    ]),
  ]);
}

function Header({ styles, page, title, label = "SkoleGPS Printpakker" }) {
  return h(View, { style: styles.header }, [
    h(View, { key: "title" }, [
      h(Text, { key: "label", style: styles.eyebrow }, label),
      h(Text, { key: "heading", style: styles.heading }, title),
    ]),
    h(Text, { key: "page", style: styles.pageNumber }, `Side ${page}`),
  ]);
}

function Footer({ styles, page }) {
  return h(View, { style: styles.footer, fixed: true }, [
    h(Text, { key: "left" }, "Efterårsmysteriet · SkoleGPS"),
    h(Text, { key: "right" }, `Printpakker v1.0 · ${page}`),
  ]);
}

function CoverPage({ inkSaver = false, student = false }) {
  const styles = makeStyles(inkSaver);
  return h(Page, { size: "A4", style: styles.cover }, [
    h(Image, { key: "image", fixed: true, src: coverImage, style: styles.coverImage, wrap: false }),
    h(View, { key: "panel", style: styles.coverPanel }, [
      h(Text, { key: "kicker", style: styles.coverKicker }, student ? "Elevmateriale · Matematik" : "SkoleGPS Printpakker · Matematik"),
      h(Text, { key: "title", style: styles.coverTitle }, "Efterårs\nmysteriet"),
      h(Text, { key: "subtitle", style: styles.coverSubtitle }, student ? "Den forsvundne lanterne\nSeks poster til makkerarbejde" : "Den forsvundne lanterne\nEn færdig, analog pakke til 5.-6. klasse"),
      h(View, { key: "facts", style: styles.coverFacts }, [
        h(Text, { key: "f1", style: styles.coverFact }, "6 poster"),
        h(Text, { key: "f2", style: styles.coverFact }, "55-60 min."),
        h(Text, { key: "f3", style: styles.coverFact }, "Makkerarbejde"),
      ]),
    ]),
  ]);
}

function TeacherGuidePageOne({ inkSaver = false }) {
  const styles = makeStyles(inkSaver);
  const items = [
    "Print elevmaterialet: forside, seks poster og holdarket.",
    "Læg en post i hver konvolut eller placer dem rundt i klasselokalet.",
    "Klip de seks sporbrikker fra facitarket ud, men behold dem hos læreren.",
    "Aftal en rød kurv eller en slutkonvolut til den fælles afsløring.",
  ];
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", styles, page: 2, title: "Lærervejledning" }),
    h(Text, { key: "intro", style: styles.intro }, "Efterårsmysteriet er bygget til roligt makkerarbejde: eleverne viser en beregning, får en sporbrik af læreren og samler til sidst klassens besked."),
    h(Text, { key: "s1", style: styles.sectionTitle }, "Før timen"),
    ...items.map((item, index) => h(View, { key: `item-${index}`, style: styles.checklist }, [
      h(View, { key: "check", style: styles.checkbox }),
      h(Text, { key: "text", style: styles.body }, item),
    ])),
    h(View, { key: "note", style: styles.note }, h(Text, { style: styles.noteText }, "Elevarkene er facitfri. Sporbrikker og facit bliver først brugt af læreren, når et hold kan forklare sin løsning.")),
    h(Text, { key: "s2", style: styles.sectionTitle }, "Materialer"),
    h(Text, { key: "body", style: styles.body }, "Seks A4-poster, holdark, blyanter eller kladdepapir, lineal til post 4, seks sporbrikker og en afsluttende konvolut. Ingen farveinformation er nødvendig for at løse opgaverne."),
    h(Footer, { key: "footer", styles, page: "2" }),
  ]);
}

function TeacherGuidePageTwo({ inkSaver = false }) {
  const styles = makeStyles(inkSaver);
  const steps = [
    ["Start", "Fortæl, at lanternen er flyttet i ly for regnen. Ingen er mistænkt; klassen skal regne sig frem."],
    ["Poster", "Lad holdene begynde forskellige steder. Bed om en kort forklaring eller en kontrolregning før en sporbrik udleveres."],
    ["Afsløring", "Når alle seks brikker er på plads i stationsrækkefølge, læser holdene den fælles besked højt."],
    ["Opsamling", "Vælg to forskellige strategier fra hver sin post og lad klassen kontrollere dem sammen."],
  ];
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", styles, page: 3, title: "Gennemførsel" }),
    h(DecoratedBand, { key: "band", styles, inkSaver, label: "Lærerstyret mysteriejagt" }),
    ...steps.map(([title, body], index) => h(View, { key: `step-${index}`, style: styles.answerCard }, [
      h(Text, { key: "title", style: styles.answerTitle }, `${index + 1}. ${title}`),
      h(Text, { key: "body", style: styles.answerText }, body),
    ])),
    h(View, { key: "note", style: styles.note }, h(Text, { style: styles.noteText }, "Tidsramme: ca. 7 min. intro, 6 x 6 min. ved poster, 8 min. fælles afsløring og 5 min. matematisk opsamling.")),
    h(Footer, { key: "footer", styles, page: "3" }),
  ]);
}

function StationPage({ station, index, inkSaver = false, pageNumber = index + 4 }) {
  const styles = makeStyles(inkSaver);
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", styles, page: pageNumber, title: "Elevpost", label: "Efterårsmysteriet · Elevmateriale" }),
    h(View, { key: "band", style: styles.stationBand }, [
      h(View, { key: "number", style: styles.stationNumber }, h(Text, null, String(index + 1))),
      h(View, { key: "titles" }, [
        h(Text, { key: "skill", style: styles.stationSkill }, station.skill),
        h(Text, { key: "title", style: styles.stationTitle }, station.title),
      ]),
    ]),
    h(Image, {
      key: "visual",
      src: stationArtwork[station.artwork],
      style: { ...styles.stationArtwork, opacity: inkSaver ? 0.16 : 1 },
    }),
    h(View, { key: "promptBox", style: styles.promptBox }, [
      h(Text, { key: "label", style: styles.promptLabel }, "Opgaven"),
      h(Text, { key: "prompt", style: styles.prompt }, station.prompt),
    ]),
    h(View, { key: "answerArea", style: styles.answerArea }, [
      h(Text, { key: "label", style: styles.answerLabel }, "Vores beregning og forklaring"),
      ...Array.from({ length: 6 }, (_, line) => h(View, { key: `line-${line}`, style: styles.ruledLine })),
    ]),
    h(Text, { key: "teacher", style: styles.body }, "Vis jeres forklaring til læreren, før I får næste sporbrik."),
    h(Footer, { key: "footer", styles, page: String(pageNumber) }),
  ]);
}

function HoldSheetPage({ inkSaver = false, pageNumber = 10 }) {
  const styles = makeStyles(inkSaver);
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", styles, page: pageNumber, title: "Holdark", label: "Efterårsmysteriet · Elevmateriale" }),
    h(Text, { key: "intro", style: styles.intro }, "Skriv jeres holdnavn, noter korte spor fra læreren og gem plads til klassens fælles besked. I skal ikke gætte; løs posterne først."),
    h(Text, { key: "section", style: styles.sectionTitle }, "Vores hold"),
    h(View, { key: "name", style: { ...styles.answerArea, minHeight: 65 } }, [
      h(Text, { key: "label", style: styles.answerLabel }, "Holdnavn og navne"),
      h(View, { key: "line", style: styles.ruledLine }),
    ]),
    h(Text, { key: "section2", style: styles.sectionTitle }, "Vores seks spor"),
    h(View, { key: "grid", style: styles.holdGrid }, stations.map((station, index) => h(View, { key: station.title, style: styles.holdCell }, [
      h(Text, { key: "title", style: styles.holdCellTitle }, `Post ${index + 1}: ${station.title}`),
      h(View, { key: "line", style: styles.ruledLine }),
    ]))),
    h(Text, { key: "section3", style: styles.sectionTitle }, "Vores samlede besked"),
    h(View, { key: "slots", style: styles.wordSlots }, Array.from({ length: stations.length }, (_, index) => h(View, { key: index, style: styles.wordSlot }))),
    h(Footer, { key: "footer", styles, page: String(pageNumber) }),
  ]);
}

function AnswerKeyPages({ inkSaver = false, startPage = 11 }) {
  const styles = makeStyles(inkSaver);
  const pages = [];
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const stationSlice = stations.slice(pageIndex * 2, pageIndex * 2 + 2);
    pages.push(h(Page, { key: `answer-page-${pageIndex}`, size: "A4", style: styles.page }, [
      h(Header, { key: "header", styles, page: startPage + pageIndex, title: "Facit og sporbrikker", label: "Lærermateriale · Beskyttet download" }),
      h(Text, { key: "intro", style: styles.intro }, "Brug facit som en samtale: Bed først holdet vise sin strategi. Del derefter den angivne sporbrik ud."),
      ...stationSlice.map((station, stationIndex) => h(View, { key: station.title, style: styles.answerCard }, [
        h(Text, { key: "title", style: styles.answerTitle }, `Post ${pageIndex * 2 + stationIndex + 1}: ${station.title}`),
        h(Text, { key: "answer", style: styles.answerStrong }, `Korrekt svar: ${station.answer}`),
        h(Text, { key: "strategy", style: styles.answerText }, station.strategy),
        h(View, { key: "clue", style: styles.clueBox }, h(Text, { style: styles.clueText }, `Sporbrik til holdet: ${station.clue}`)),
      ])),
      pageIndex === 2 ? h(View, { key: "final", style: styles.note }, h(Text, { style: styles.noteText }, "Sæt sporbrikkerne i stationsrækkefølge: LYG + TEN + ER + I + DEN + RØDE KURV. Den samlede besked er: LYG TEN ER I DEN RØDE KURV. Læs den naturligt som 'Lygten er i den røde kurv.'")) : null,
      h(Footer, { key: "footer", styles, page: String(startPage + pageIndex) }),
    ]));
  }
  return pages;
}

function StudentPages({ inkSaver = false, includeCover = true, firstStationPage = includeCover ? 2 : 1 }) {
  return [
    ...(includeCover ? [h(CoverPage, { key: "cover", inkSaver, student: true })] : []),
    ...stations.map((station, index) => h(StationPage, { key: station.title, station, index, inkSaver, pageNumber: firstStationPage + index })),
    h(HoldSheetPage, { key: "hold-sheet", inkSaver, pageNumber: firstStationPage + stations.length }),
  ];
}

function TeacherGuideDocument({ inkSaver = false } = {}) {
  return h(Document, { title: "Efterårsmysteriet - Lærervejledning", author: "SkoleGPS" }, [
    h(CoverPage, { key: "cover", inkSaver }),
    h(TeacherGuidePageOne, { key: "guide-1", inkSaver }),
    h(TeacherGuidePageTwo, { key: "guide-2", inkSaver }),
  ]);
}

function StudentDocument({ inkSaver = false } = {}) {
  return h(Document, { title: "Efterårsmysteriet - Elevark", author: "SkoleGPS" }, StudentPages({ inkSaver }));
}

function AnswerKeyDocument({ inkSaver = false } = {}) {
  const styles = makeStyles(inkSaver);
  return h(Document, { title: "Efterårsmysteriet - Facit", author: "SkoleGPS" }, [
    h(Page, { key: "cover", size: "A4", style: styles.page }, [
      h(Header, { key: "header", styles, page: 1, title: "Facit", label: "Efterårsmysteriet · Lærermateriale" }),
      h(Text, { key: "title", style: styles.heading }, "Kontrolleret lærerfacit"),
      h(Text, { key: "body", style: styles.intro }, "Dette ark er kun til læreren. Elevmaterialet og den offentlige forhåndsvisning indeholder ikke svar eller tekst fra sporbrikkerne."),
      h(View, { key: "note", style: styles.note }, h(Text, { style: styles.noteText }, "Brug løsningerne til at stille et opfølgende spørgsmål: Hvad regnede I først? Hvordan kan I kontrollere svaret?")),
      h(Footer, { key: "footer", styles, page: "1" }),
    ]),
    ...AnswerKeyPages({ inkSaver, startPage: 2 }),
  ]);
}

function WholePackageDocument({ inkSaver = false } = {}) {
  return h(Document, { title: "Efterårsmysteriet - Hele pakken", author: "SkoleGPS" }, [
    h(CoverPage, { key: "cover", inkSaver }),
    h(TeacherGuidePageOne, { key: "guide-1", inkSaver }),
    h(TeacherGuidePageTwo, { key: "guide-2", inkSaver }),
    ...stations.map((station, index) => h(StationPage, { key: station.title, station, index, inkSaver, pageNumber: index + 4 })),
    h(HoldSheetPage, { key: "hold-sheet", inkSaver, pageNumber: 10 }),
    ...AnswerKeyPages({ inkSaver, startPage: 11 }),
  ]);
}

function PublicPreviewDocument() {
  return h(Document, { title: "Efterårsmysteriet - Facitfri forhåndsvisning", author: "SkoleGPS" }, [
    h(CoverPage, { key: "cover", student: true }),
    h(StationPage, { key: "station", station: stations[0], index: 0, pageNumber: 2 }),
  ]);
}

async function renderDocument(filename, document, copyToProtectedAssets = true) {
  const buffer = await pdf(document).toBuffer();
  const outputPath = join(outputDirectory, filename);
  await writeFile(outputPath, buffer);
  if (copyToProtectedAssets) await copyFile(outputPath, join(protectedAssetDirectory, filename));
  return outputPath;
}

async function main() {
  await Promise.all([
    mkdir(outputDirectory, { recursive: true }),
    mkdir(protectedAssetDirectory, { recursive: true }),
    mkdir(publicPreviewDirectory, { recursive: true }),
  ]);

  await renderDocument(files.wholeColour, WholePackageDocument());
  await renderDocument(files.wholeInkSaver, WholePackageDocument({ inkSaver: true }));
  await renderDocument(files.student, StudentDocument());
  await renderDocument(files.answerKey, AnswerKeyDocument());
  await renderDocument(files.teacherGuide, TeacherGuideDocument());
  const previewOutput = await renderDocument(files.preview, PublicPreviewDocument(), false);
  await copyFile(previewOutput, join(publicPreviewDirectory, "afteraarsmysteriet-forhaandsvisning.pdf"));

  process.stdout.write(`Generated ${Object.keys(files).length} Printpakker PDFs in ${outputDirectory}\n`);
}

await main();
