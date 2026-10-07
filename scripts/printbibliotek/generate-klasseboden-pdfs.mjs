/**
 * Fixed local editorial export for the Klasseboden pilot.
 *
 * This is deliberately not a general runtime generator. It renders the
 * reviewed manuscript to named, static files and derives public previews from
 * the resulting facit-free student PDFs. No network, user input or provider
 * call is involved.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

const h = React.createElement;
const workspace = process.cwd();
const outputDirectory = join(workspace, "output", "printbibliotek", "klasseboden");
const assetsDirectory = join(workspace, "assets", "printpakker");
const publicDirectory = join(workspace, "public", "printpakker");
const version = "2026-10-07.1";

const palette = {
  accent: "#0F7665",
  ink: "#19342E",
  line: "#AAC5B9",
  muted: "#4D655D",
  orange: "#C65F22",
  paper: "#FFFEF8",
  pale: "#E8F3EC",
  warm: "#FFF2DC",
};

const stations = [
  {
    title: "To ting",
    situation: "En blyant koster 6 kr. Et kort koster 7 kr.",
    instruction: "Hvad koster de tilsammen? Vis din løsning på svararket.",
    items: [["Blyant", "6 kr."], ["Kort", "7 kr."]],
  },
  {
    title: "Hvor meget mangler?",
    situation: "Du har 13 kr. En lille notesbog koster 20 kr.",
    instruction: "Hvor mange kroner mangler du? Vis din løsning på svararket.",
    items: [["Du har", "13 kr."], ["Notesbog", "20 kr."]],
  },
  {
    title: "Penge tilbage",
    situation: "Du betaler med 20 kr. En pose perler koster 14 kr.",
    instruction: "Hvor mange kroner får du tilbage? Vis din løsning på svararket.",
    items: [["Du betaler", "20 kr."], ["Pose perler", "14 kr."]],
  },
  {
    title: "Har Maja ret?",
    situation: "Maja skriver: 14 - 8 = 8.",
    instruction: "Har Maja ret? Vis, hvordan du undersøger det.",
    items: [["Majas regnestykke", "14 - 8 = 8"], ["Undersøg", "med tegning, tallinje eller regning"]],
  },
  {
    title: "Vælg to forskellige ting",
    situation: "Du har 20 kr. En blyant koster 6 kr. Et kort koster 9 kr. En notesbog koster 12 kr.",
    instruction: "Vælg to forskellige ting, du har råd til. Hvor meget har du tilbage?",
    optional: "Prøv også: Kan du finde en anden mulighed?",
    items: [["Blyant", "6 kr."], ["Kort", "9 kr."], ["Notesbog", "12 kr."]],
  },
  {
    title: "Forskellen",
    situation: "Et kort koster 8 kr. En notesbog koster 15 kr.",
    instruction: "Hvor meget mere koster notesbogen end kortet? Vis din løsning.",
    items: [["Kort", "8 kr."], ["Notesbog", "15 kr."]],
  },
];

const stationAnswers = [
  ["13 kr.", "6 + 7 = 13. En tegning med to grupper er også en gyldig visning."],
  ["7 kr.", "Eleven kan tælle videre fra 13 til 20 eller bruge 20 - 13."],
  ["6 kr.", "Eleven kan bruge 20 - 14 eller tælle videre fra 14 til 20."],
  ["Nej. 14 - 8 = 6.", "Et nej alene er ikke nok. Se efter en tegning, en tallinje eller kontrollen 8 + 6 = 14."],
  ["To gyldige muligheder.", "Blyant + kort koster 15 kr., så 5 kr. er tilbage. Blyant + notesbog koster 18 kr., så 2 kr. er tilbage. Kort + notesbog koster 21 kr. og er ikke muligt."],
  ["7 kr.", "15 - 8 = 7. Det kan også vises som 8 + 7 = 15."],
];

function makeStyles(inkSaver) {
  const accent = inkSaver ? "#1C1C1C" : palette.accent;
  const body = inkSaver ? "#232323" : palette.ink;
  const muted = inkSaver ? "#424242" : palette.muted;
  const pale = inkSaver ? "#FFFFFF" : palette.pale;
  const border = inkSaver ? "#262626" : palette.line;

  return StyleSheet.create({
    page: {
      backgroundColor: inkSaver ? "#FFFFFF" : palette.paper,
      color: body,
      fontFamily: "Helvetica",
      fontSize: 11.2,
      paddingTop: 42,
      paddingRight: 42,
      paddingBottom: 42,
      paddingLeft: 42,
    },
    header: {
      alignItems: "flex-start",
      borderBottomColor: accent,
      borderBottomWidth: 1.2,
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 15,
      paddingBottom: 8,
    },
    eyebrow: {
      color: accent,
      fontSize: 8.4,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    heading: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 20,
      lineHeight: 1.08,
      marginTop: 4,
    },
    pageNumber: {
      color: muted,
      fontSize: 8.2,
      fontWeight: 700,
    },
    footer: {
      bottom: 22,
      color: muted,
      display: "flex",
      flexDirection: "row",
      fontSize: 7.8,
      justifyContent: "space-between",
      left: 42,
      position: "absolute",
      right: 42,
    },
    intro: {
      color: muted,
      fontSize: 10.8,
      lineHeight: 1.48,
    },
    stationBand: {
      alignItems: "center",
      display: "flex",
      flexDirection: "row",
      gap: 11,
      marginBottom: 12,
    },
    stationNumber: {
      alignItems: "center",
      backgroundColor: accent,
      borderColor: inkSaver ? "#1C1C1C" : accent,
      borderRadius: inkSaver ? 0 : 10,
      borderWidth: inkSaver ? 1 : 0,
      color: "#FFFFFF",
      display: "flex",
      fontFamily: "Helvetica-Bold",
      fontSize: 17,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    stationTitle: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 20,
      lineHeight: 1.05,
    },
    label: {
      color: accent,
      fontSize: 8.2,
      fontWeight: 700,
      letterSpacing: 0.85,
      textTransform: "uppercase",
    },
    priceRow: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    priceTag: {
      borderColor: border,
      borderRadius: inkSaver ? 0 : 8,
      borderWidth: 1,
      minWidth: 118,
      paddingHorizontal: 9,
      paddingVertical: 8,
    },
    priceName: {
      color: muted,
      fontSize: 8.7,
      fontWeight: 700,
    },
    priceValue: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 15,
      marginTop: 2,
    },
    promptBox: {
      backgroundColor: pale,
      borderColor: border,
      borderRadius: inkSaver ? 0 : 9,
      borderWidth: 1,
      marginTop: 15,
      padding: 13,
    },
    prompt: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 13.2,
      lineHeight: 1.34,
      marginTop: 6,
    },
    optional: {
      color: muted,
      fontSize: 9.6,
      fontStyle: "italic",
      lineHeight: 1.4,
      marginTop: 8,
    },
    answerArea: {
      borderColor: border,
      borderRadius: inkSaver ? 0 : 8,
      borderWidth: 1,
      marginTop: 13,
      minHeight: 255,
      padding: 11,
    },
    answerLabel: {
      color: accent,
      fontSize: 9,
      fontWeight: 700,
    },
    ruledLine: {
      borderBottomColor: inkSaver ? "#6A6A6A" : "#8CB8AA",
      borderBottomWidth: 0.6,
      marginTop: 23,
    },
    responseBox: {
      borderColor: border,
      borderRadius: inkSaver ? 0 : 8,
      borderWidth: 1,
      marginTop: 10,
      minHeight: 170,
      padding: 10,
    },
    responseTitle: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 12.2,
    },
    responseInstruction: {
      color: muted,
      fontSize: 9.5,
      lineHeight: 1.4,
      marginTop: 4,
    },
    answerLine: {
      borderBottomColor: inkSaver ? "#4A4A4A" : "#638E80",
      borderBottomWidth: 0.8,
      color: body,
      fontSize: 10.3,
      marginTop: 17,
      paddingBottom: 4,
    },
    choiceRow: {
      display: "flex",
      flexDirection: "row",
      gap: 16,
      marginTop: 12,
    },
    choice: {
      alignItems: "center",
      display: "flex",
      flexDirection: "row",
      gap: 5,
      color: body,
      fontSize: 10.2,
      fontWeight: 700,
    },
    checkbox: {
      borderColor: body,
      borderWidth: 1,
      height: 12,
      width: 12,
    },
    sectionTitle: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 14.4,
      marginTop: 11,
    },
    body: {
      color: muted,
      fontSize: 10.1,
      lineHeight: 1.48,
      marginTop: 5,
    },
    answerCard: {
      borderColor: border,
      borderRadius: inkSaver ? 0 : 8,
      borderWidth: 1,
      marginTop: 10,
      padding: 10,
    },
    answerTitle: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 11.6,
    },
    answerStrong: {
      color: inkSaver ? "#1C1C1C" : palette.orange,
      fontFamily: "Helvetica-Bold",
      fontSize: 10.6,
      lineHeight: 1.42,
      marginTop: 5,
    },
    note: {
      backgroundColor: inkSaver ? "#FFFFFF" : palette.warm,
      borderColor: inkSaver ? "#262626" : "#D9A763",
      borderLeftWidth: 3,
      borderTopWidth: inkSaver ? 1 : 0,
      borderRightWidth: inkSaver ? 1 : 0,
      borderBottomWidth: inkSaver ? 1 : 0,
      marginTop: 10,
      padding: 10,
    },
    noteText: {
      color: inkSaver ? "#2B2B2B" : "#734219",
      fontSize: 9.6,
      lineHeight: 1.43,
    },
    worksheetTask: {
      borderColor: border,
      borderRadius: inkSaver ? 0 : 8,
      borderWidth: 1,
      marginTop: 9,
      padding: 10,
    },
    worksheetTaskTitle: {
      color: body,
      fontFamily: "Helvetica-Bold",
      fontSize: 11.5,
    },
    worksheetTaskBody: {
      color: body,
      fontSize: 10.2,
      lineHeight: 1.42,
      marginTop: 4,
    },
    worksheetLines: {
      borderBottomColor: inkSaver ? "#626262" : "#9CBCAF",
      borderBottomWidth: 0.7,
      marginTop: 16,
    },
    numberLine: {
      alignItems: "flex-end",
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
    },
    numberMark: {
      alignItems: "center",
      display: "flex",
      flexDirection: "column",
      width: 20,
    },
    tick: {
      backgroundColor: body,
      height: 11,
      width: 1,
    },
    number: {
      color: body,
      fontSize: 7.4,
      marginTop: 4,
    },
    numberLineBase: {
      backgroundColor: body,
      height: 1,
      left: 4,
      position: "absolute",
      right: 4,
      top: 4,
    },
    tenFrame: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 14,
      width: 250,
    },
    tenCell: {
      borderColor: body,
      borderWidth: 0.8,
      height: 31,
      width: 50,
    },
  });
}

function Header({ label, page, styles, title }) {
  return h(View, { style: styles.header }, [
    h(View, { key: "copy" }, [
      h(Text, { key: "label", style: styles.eyebrow }, label),
      h(Text, { key: "title", style: styles.heading }, title),
    ]),
    h(Text, { key: "page", style: styles.pageNumber }, `Side ${page}`),
  ]);
}

function Footer({ page, styles, title }) {
  return h(View, { fixed: true, style: styles.footer }, [
    h(Text, { key: "left" }, `SkoleGPS Printbibliotek · ${title}`),
    h(Text, { key: "right" }, `v${version} · ${page}`),
  ]);
}

function PriceTag({ item, styles }) {
  return h(View, { style: styles.priceTag }, [
    h(Text, { key: "name", style: styles.priceName }, item[0]),
    h(Text, { key: "price", style: styles.priceValue }, item[1]),
  ]);
}

function StationPage({ index, inkSaver = false, station }) {
  const styles = makeStyles(inkSaver);
  const page = index + 1;
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · elevmateriale", page, styles, title: "Post" }),
    h(View, { key: "band", style: styles.stationBand }, [
      h(View, { key: "number", style: styles.stationNumber }, h(Text, null, String(page))),
      h(View, { key: "words" }, [
        h(Text, { key: "label", style: styles.label }, "Post"),
        h(Text, { key: "title", style: styles.stationTitle }, station.title),
      ]),
    ]),
    h(Text, { key: "situation", style: styles.intro }, station.situation),
    h(View, { key: "prices", style: styles.priceRow }, station.items.map((item) => h(PriceTag, { item, key: item[0], styles }))),
    h(View, { key: "prompt", style: styles.promptBox }, [
      h(Text, { key: "label", style: styles.label }, "Opgaven"),
      h(Text, { key: "instruction", style: styles.prompt }, station.instruction),
      station.optional ? h(Text, { key: "optional", style: styles.optional }, station.optional) : null,
    ]),
    h(View, { key: "area", style: styles.answerArea }, [
      h(Text, { key: "label", style: styles.answerLabel }, "Vis din løsning på svararket eller med kladdeark"),
      ...Array.from({ length: 6 }, (_, line) => h(View, { key: `line-${line}`, style: styles.ruledLine })),
    ]),
    h(Footer, { key: "footer", page, styles, title: "Klasseboden — postløb" }),
  ]);
}

function ResponseBox({ children, title, styles }) {
  return h(View, { style: styles.responseBox }, [
    h(Text, { key: "title", style: styles.responseTitle }, title),
    children,
  ]);
}

function AnswerSheetPage({ inkSaver = false, page }) {
  const styles = makeStyles(inkSaver);
  const isFirst = page === 1;
  const entries = isFirst
    ? [
        ["Post 1 — To ting", "Svar: ____________________ kr."],
        ["Post 2 — Hvor meget mangler?", "Svar: ____________________ kr."],
        ["Post 3 — Penge tilbage", "Svar: ____________________ kr."],
      ]
    : [
        ["Post 4 — Har Maja ret?", "Vis din undersøgelse."],
        ["Post 5 — Vælg to forskellige ting", "Jeg vælger: ____________________   Jeg har: __________ kr. tilbage."],
        ["Post 6 — Forskellen", "Svar: ____________________ kr."],
      ];

  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · elevmateriale", page, styles, title: `Svarark · ${isFirst ? "post 1–3" : "post 4–6"}` }),
    h(Text, { key: "intro", style: styles.intro }, "Skriv eller tegn, så I kan vise, hvordan I tænker. I behøver ikke bruge samme metode på alle poster."),
    ...entries.map(([title, instruction], index) => {
      const postNumber = (isFirst ? index : index + 3) + 1;
      const body = postNumber === 4
        ? [
            h(View, { key: "choices", style: styles.choiceRow }, [
              h(View, { key: "yes", style: styles.choice }, [h(View, { key: "box", style: styles.checkbox }), h(Text, { key: "text" }, "Ja")]),
              h(View, { key: "no", style: styles.choice }, [h(View, { key: "box", style: styles.checkbox }), h(Text, { key: "text" }, "Nej")]),
            ]),
            h(Text, { key: "instruction", style: styles.responseInstruction }, instruction),
            ...Array.from({ length: 4 }, (_, line) => h(View, { key: `line-${line}`, style: styles.ruledLine })),
          ]
        : [
            h(Text, { key: "instruction", style: styles.responseInstruction }, instruction),
            ...Array.from({ length: postNumber === 5 ? 3 : 4 }, (_, line) => h(View, { key: `line-${line}`, style: styles.ruledLine })),
          ];
      return h(ResponseBox, { key: title, styles, title }, body);
    }),
    h(Footer, { key: "footer", page, styles, title: "Klasseboden — svarark" }),
  ]);
}

function TeacherGuidePage({ format, inkSaver = false }) {
  const styles = makeStyles(inkSaver);
  const postloeb = format === "postloeb";
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · lærermateriale", page: 1, styles, title: "Lærervejledning" }),
    h(Text, { key: "intro", style: styles.intro }, postloeb
      ? "Planlagt 45-minutters postlektion for makkerpar. Tidsbudgettet og formuleringerne er ikke elevafprøvet endnu."
      : "Et selvstændigt arbejdsark til plus og minus inden for 20. Tidsbudget og læsbarhed afventer prøveprint og lærerafprøvning."),
    h(Text, { key: "before-title", style: styles.sectionTitle }, "Før timen"),
    h(Text, { key: "before", style: styles.body }, postloeb
      ? "Print seks poster én gang pr. klasse og ét tosiders svarark pr. makkerpar. Print eventuelt støttearket. Læreren beholder guide og facit."
      : "Print de to elevsider som ét sæt pr. elev. Læreren beholder guide og facit. Brug farve eller blækbesparende udgave — opgaverne er de samme."),
    h(Text, { key: "start-title", style: styles.sectionTitle }, "Fælles opstart"),
    h(Text, { key: "start", style: styles.body }, "Brug et andet eksempel: Du har 5 kr. og vil købe noget til 8 kr. Hvor meget mangler du? Vis både optælling videre og 8 - 5."),
    h(Text, { key: "during-title", style: styles.sectionTitle }, "Undervejs"),
    h(Text, { key: "during", style: styles.body }, "Lyt efter elevens valg af regneart. Ved læseudfordringer kan en makker eller lærer læse op. Spørg efter visning af strategi — ikke efter en bestemt algoritme."),
    h(Text, { key: "after-title", style: styles.sectionTitle }, "Opsamling"),
    h(Text, { key: "after", style: styles.body }, postloeb
      ? "Sammenlign optælling og subtraktion på post 2 og 6. Tal om post 4 som undersøgelse af en idé, ikke som udskamning."
      : "Lad eleverne sammenligne to måder at finde forskel eller et manglende beløb på. Tag Emils forklaring op som sammenhæng mellem to regneudtryk."),
    h(View, { key: "note", style: styles.note }, h(Text, { style: styles.noteText }, "Kort afslutning: Du har 11 kr. og vil købe noget til 17 kr. Hvor meget mangler du? Eleverne viser deres strategi. Svaret står kun i lærerfacit.")),
    h(Footer, { key: "footer", page: 1, styles, title: `Klasseboden — ${postloeb ? "postløb" : "arbejdsark"}` }),
  ]);
}

function AnswerKeyPage({ inkSaver = false, page }) {
  const styles = makeStyles(inkSaver);
  const start = page === 1 ? 0 : 3;
  const answerRows = stations.slice(start, start + 3).map((station, index) => {
    const [answer, explanation] = stationAnswers[start + index];
    return h(View, { key: station.title, style: styles.answerCard }, [
      h(Text, { key: "title", style: styles.answerTitle }, `Post ${start + index + 1} — ${station.title}`),
      h(Text, { key: "answer", style: styles.answerStrong }, `Facit: ${answer}`),
      h(Text, { key: "explanation", style: styles.body }, explanation),
    ]);
  });

  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · kun til læreren", page, styles, title: "Facit" }),
    h(Text, { key: "intro", style: styles.intro }, "Brug facit som samtalestøtte. Bed først eleverne vise deres strategi. Åbne visninger som tegning eller optælling er gyldige, når de viser den rigtige sammenhæng."),
    ...answerRows,
    h(Footer, { key: "footer", page, styles, title: "Klasseboden — postløb · facit" }),
  ]);
}

function SupportPage({ inkSaver = false }) {
  const styles = makeStyles(inkSaver);
  const marks = Array.from({ length: 21 }, (_, index) => h(View, { key: index, style: styles.numberMark }, [
    h(View, { key: "tick", style: styles.tick }),
    h(Text, { key: "number", style: styles.number }, String(index)),
  ]));
  const cells = Array.from({ length: 10 }, (_, index) => h(View, { key: index, style: styles.tenCell }));
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · elevmateriale", page: 1, styles, title: "Støtteark" }),
    h(Text, { key: "intro", style: styles.intro }, "Brug tallinjen eller de tomme ti-rammer, når det hjælper. Arket indeholder ingen løsninger."),
    h(Text, { key: "line-title", style: styles.sectionTitle }, "Tallinje fra 0 til 20"),
    h(View, { key: "number-line", style: { position: "relative" } }, [
      h(View, { key: "base", style: styles.numberLineBase }),
      h(View, { key: "marks", style: styles.numberLine }, marks),
    ]),
    h(Text, { key: "frames-title", style: styles.sectionTitle }, "To tomme ti-rammer"),
    h(View, { key: "frame-one", style: styles.tenFrame }, cells),
    h(View, { key: "frame-two", style: styles.tenFrame }, cells),
    h(Footer, { key: "footer", page: 1, styles, title: "Klasseboden — støtteark" }),
  ]);
}

const worksheetTasks = [
  ["A. To varer", "En blyant koster 5 kr. Et kort koster 8 kr. Hvad koster de tilsammen? Vis hvordan."],
  ["B. Der mangler noget", "Du har 12 kr. Noget, du vil købe, koster 18 kr. Hvor meget mangler du?"],
  ["C. Penge tilbage", "Du betaler 20 kr. Varen koster 16 kr. Hvor meget får du tilbage?"],
  ["D. Hvad er forskellen?", "To varer koster 7 kr. og 14 kr. Hvor meget dyrere er den dyreste? Vis med tegning eller regning."],
  ["E. Undersøg forklaringen", "Emil siger: 12 - 5 er 7, fordi 7 + 5 er 12. Er hans forklaring rigtig? Vis eller forklar."],
  ["F. Vælg selv", "Du har 20 kr. Tre forskellige varer koster 4 kr., 7 kr. og 11 kr. Vælg to forskellige varer, og vis, hvor meget du har tilbage. Prøv også: Find alle muligheder."],
];

function WorksheetTask({ task, styles }) {
  return h(View, { style: styles.worksheetTask }, [
    h(Text, { key: "title", style: styles.worksheetTaskTitle }, task[0]),
    h(Text, { key: "body", style: styles.worksheetTaskBody }, task[1]),
    ...Array.from({ length: 2 }, (_, index) => h(View, { key: index, style: styles.worksheetLines })),
  ]);
}

function WorksheetStudentPage({ inkSaver = false, page }) {
  const styles = makeStyles(inkSaver);
  const first = page === 1;
  const tasks = first ? worksheetTasks.slice(0, 3) : worksheetTasks.slice(3);
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · elevmateriale", page, styles, title: "Arbejdsark" }),
    first ? h(View, { key: "example", style: styles.note }, h(Text, { style: styles.noteText }, "Eksempel: 4 + 3 = 7. Man kan tegne fire og tre ting, tælle dem sammen eller skrive regnestykket. Eksemplet er ikke svaret på en opgave nedenfor.")) : h(Text, { key: "intro", style: styles.intro }, "Sammenlign og undersøg. Vis din tænkning med tegning, ord eller regning."),
    ...tasks.map((task) => h(WorksheetTask, { key: task[0], styles, task })),
    h(Footer, { key: "footer", page, styles, title: "Klasseboden — arbejdsark" }),
  ]);
}

function WorksheetAnswerPage({ inkSaver = false }) {
  const styles = makeStyles(inkSaver);
  const answers = [
    ["A", "13 kr.", "5 + 8 = 13."],
    ["B", "6 kr.", "18 - 12 = 6."],
    ["C", "4 kr.", "20 - 16 = 4."],
    ["D", "7 kr.", "14 - 7 = 7."],
    ["E", "Ja.", "12 - 5 = 7, og 7 + 5 = 12 viser den samme sammenhæng."],
    ["F", "Tre gyldige valg.", "4 + 7 = 11, rest 9. 4 + 11 = 15, rest 5. 7 + 11 = 18, rest 2. Det er ikke et krav at finde alle tre, medmindre ekstraopgaven vælges."],
  ];
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Klasseboden · kun til læreren", page: 1, styles, title: "Facit" }),
    h(Text, { key: "intro", style: styles.intro }, "Facit til det selvstændige arbejdsark. Flere elevvisninger kan være korrekte, når de viser den relevante sammenhæng."),
    ...answers.map(([letter, answer, explanation]) => h(View, { key: letter, style: styles.answerCard }, [
      h(Text, { key: "title", style: styles.answerTitle }, `${letter}.`),
      h(Text, { key: "answer", style: styles.answerStrong }, `Facit: ${answer}`),
      h(Text, { key: "explanation", style: styles.body }, explanation),
    ])),
    h(Footer, { key: "footer", page: 1, styles, title: "Klasseboden — arbejdsark · facit" }),
  ]);
}

function makeDocument(title, pages) {
  return h(Document, { author: "SkoleGPS", subject: "Klasseboden", title }, pages);
}

function postloebStudentDocument(inkSaver) {
  return makeDocument("Klasseboden — postløb · elevmateriale", [
    ...stations.map((station, index) => h(StationPage, { index, inkSaver, key: `station-${index}`, station })),
    h(AnswerSheetPage, { inkSaver, key: "answer-sheet-one", page: 1 }),
    h(AnswerSheetPage, { inkSaver, key: "answer-sheet-two", page: 2 }),
  ]);
}

function postloebStationsDocument(inkSaver) {
  return makeDocument("Klasseboden — postløb · poster", stations.map((station, index) => h(StationPage, { index, inkSaver, key: `station-${index}`, station })));
}

function postloebAnswerSheetDocument(inkSaver) {
  return makeDocument("Klasseboden — postløb · svarark", [
    h(AnswerSheetPage, { inkSaver, key: "answer-sheet-one", page: 1 }),
    h(AnswerSheetPage, { inkSaver, key: "answer-sheet-two", page: 2 }),
  ]);
}

function postloebAnswerDocument(inkSaver) {
  return makeDocument("Klasseboden — postløb · facit", [
    h(AnswerKeyPage, { inkSaver, key: "answers-one", page: 1 }),
    h(AnswerKeyPage, { inkSaver, key: "answers-two", page: 2 }),
  ]);
}

function postloebWholeDocument(inkSaver) {
  return makeDocument("Klasseboden — postløb · hele pakken", [
    ...stations.map((station, index) => h(StationPage, { index, inkSaver, key: `station-${index}`, station })),
    h(AnswerSheetPage, { inkSaver, key: "answer-sheet-one", page: 1 }),
    h(AnswerSheetPage, { inkSaver, key: "answer-sheet-two", page: 2 }),
    h(TeacherGuidePage, { format: "postloeb", inkSaver, key: "guide" }),
    h(AnswerKeyPage, { inkSaver, key: "answers-one", page: 1 }),
    h(AnswerKeyPage, { inkSaver, key: "answers-two", page: 2 }),
  ]);
}

function worksheetStudentDocument(inkSaver) {
  return makeDocument("Klasseboden — arbejdsark · elevmateriale", [
    h(WorksheetStudentPage, { inkSaver, key: "worksheet-one", page: 1 }),
    h(WorksheetStudentPage, { inkSaver, key: "worksheet-two", page: 2 }),
  ]);
}

function worksheetAnswerDocument(inkSaver) {
  return makeDocument("Klasseboden — arbejdsark · facit", [h(WorksheetAnswerPage, { inkSaver, key: "worksheet-answers" })]);
}

function worksheetWholeDocument(inkSaver) {
  return makeDocument("Klasseboden — arbejdsark · hele pakken", [
    h(WorksheetStudentPage, { inkSaver, key: "worksheet-one", page: 1 }),
    h(WorksheetStudentPage, { inkSaver, key: "worksheet-two", page: 2 }),
    h(TeacherGuidePage, { format: "worksheet", inkSaver, key: "guide" }),
    h(WorksheetAnswerPage, { inkSaver, key: "worksheet-answers" }),
  ]);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function renderPdf(document, destination) {
  const buffer = await pdf(document).toBuffer();
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(destination, buffer);
  return buffer;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => reject(new Error(`Kunne ikke starte ${command}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} afsluttede med kode ${code}: ${stderr.trim()}`));
    });
  });
}

const extractPagesScript = [
  "from pypdf import PdfReader, PdfWriter",
  "import sys",
  "reader = PdfReader(sys.argv[1])",
  "writer = PdfWriter()",
  "for raw_page in sys.argv[3].split(','):",
  "    writer.add_page(reader.pages[int(raw_page) - 1])",
  "writer.add_metadata({'/Title': sys.argv[4]})",
  "with open(sys.argv[2], 'wb') as target:",
  "    writer.write(target)",
].join("\n");

async function createPreview({ destination, imagePrefix, pageNumbers, source, title }) {
  const python = process.env.PYTHON ?? "python";
  await run(python, ["-c", extractPagesScript, source, destination, pageNumbers.join(","), title]);
  await mkdir(join(publicDirectory, "previews"), { recursive: true });
  await run("pdftoppm", ["-png", "-r", "144", destination, imagePrefix]);
  return { prefix: imagePrefix, pdfPath: destination };
}

async function artifactRecord({ destination, fileName, kind, materialId, mode, pageCount, privatePath, variant }) {
  const file = await stat(destination);
  const bytes = await readFile(destination);
  return {
    assetFile: fileName,
    byteSize: file.size,
    kind,
    materialId,
    mode,
    pageCount,
    privatePath,
    sha256: sha256(bytes),
    variant,
    version,
  };
}

async function renderPrivateArtifact({ document, fileName, kind, materialId, mode, pageCount, variant }) {
  const localPath = join(outputDirectory, fileName);
  const privateDirectory = join(assetsDirectory, materialId);
  const privatePath = join(privateDirectory, fileName);
  await mkdir(privateDirectory, { recursive: true });
  await renderPdf(document, localPath);
  await copyFile(localPath, privatePath);
  return artifactRecord({
    destination: privatePath,
    fileName,
    kind,
    materialId,
    mode,
    pageCount,
    privatePath: `assets/printpakker/${materialId}/${fileName}`,
    variant,
  });
}

async function main() {
  const postPrefix = "SkoleGPS_Klasseboden_Postloeb";
  const worksheetPrefix = "SkoleGPS_Klasseboden_Arbejdsark";
  const jobs = [
    ["klasseboden-postloeb", "student", "student", "colour", 8, `${postPrefix}_elevmateriale_farve.pdf`, postloebStudentDocument(false)],
    ["klasseboden-postloeb", "student-ink-saver", "student", "ink-saving", 8, `${postPrefix}_elevmateriale_blaekbesparende.pdf`, postloebStudentDocument(true)],
    ["klasseboden-postloeb", "stations", "stations", "colour", 6, `${postPrefix}_poster_farve.pdf`, postloebStationsDocument(false)],
    ["klasseboden-postloeb", "stations-ink-saver", "stations", "ink-saving", 6, `${postPrefix}_poster_blaekbesparende.pdf`, postloebStationsDocument(true)],
    ["klasseboden-postloeb", "answer-sheet", "answer-sheet", "colour", 2, `${postPrefix}_svarark_farve.pdf`, postloebAnswerSheetDocument(false)],
    ["klasseboden-postloeb", "answer-sheet-ink-saver", "answer-sheet", "ink-saving", 2, `${postPrefix}_svarark_blaekbesparende.pdf`, postloebAnswerSheetDocument(true)],
    ["klasseboden-postloeb", "answer-key", "answers", "colour", 2, `${postPrefix}_facit_farve.pdf`, postloebAnswerDocument(false)],
    ["klasseboden-postloeb", "answer-key-ink-saver", "answers", "ink-saving", 2, `${postPrefix}_facit_blaekbesparende.pdf`, postloebAnswerDocument(true)],
    ["klasseboden-postloeb", "teacher-guide", "teacher-guide", "colour", 1, `${postPrefix}_laerervejledning_farve.pdf`, makeDocument("Klasseboden — postløb · lærervejledning", [h(TeacherGuidePage, { format: "postloeb", key: "guide" })])],
    ["klasseboden-postloeb", "teacher-guide-ink-saver", "teacher-guide", "ink-saving", 1, `${postPrefix}_laerervejledning_blaekbesparende.pdf`, makeDocument("Klasseboden — postløb · lærervejledning", [h(TeacherGuidePage, { format: "postloeb", inkSaver: true, key: "guide" })])],
    ["klasseboden-postloeb", "support", "support", "colour", 1, `${postPrefix}_stoetteark_farve.pdf`, makeDocument("Klasseboden — postløb · støtteark", [h(SupportPage, { key: "support" })])],
    ["klasseboden-postloeb", "support-ink-saver", "support", "ink-saving", 1, `${postPrefix}_stoetteark_blaekbesparende.pdf`, makeDocument("Klasseboden — postløb · støtteark", [h(SupportPage, { inkSaver: true, key: "support" })])],
    ["klasseboden-postloeb", "whole-colour", "whole", "colour", 11, `${postPrefix}_hele_pakken_farve.pdf`, postloebWholeDocument(false)],
    ["klasseboden-postloeb", "whole-ink-saver", "whole", "ink-saving", 11, `${postPrefix}_hele_pakken_blaekbesparende.pdf`, postloebWholeDocument(true)],
    ["klasseboden-arbejdsark", "student", "student", "colour", 2, `${worksheetPrefix}_elevmateriale_farve.pdf`, worksheetStudentDocument(false)],
    ["klasseboden-arbejdsark", "student-ink-saver", "student", "ink-saving", 2, `${worksheetPrefix}_elevmateriale_blaekbesparende.pdf`, worksheetStudentDocument(true)],
    ["klasseboden-arbejdsark", "answer-key", "answers", "colour", 1, `${worksheetPrefix}_facit_farve.pdf`, worksheetAnswerDocument(false)],
    ["klasseboden-arbejdsark", "answer-key-ink-saver", "answers", "ink-saving", 1, `${worksheetPrefix}_facit_blaekbesparende.pdf`, worksheetAnswerDocument(true)],
    ["klasseboden-arbejdsark", "teacher-guide", "teacher-guide", "colour", 1, `${worksheetPrefix}_laerervejledning_farve.pdf`, makeDocument("Klasseboden — arbejdsark · lærervejledning", [h(TeacherGuidePage, { format: "worksheet", key: "guide" })])],
    ["klasseboden-arbejdsark", "teacher-guide-ink-saver", "teacher-guide", "ink-saving", 1, `${worksheetPrefix}_laerervejledning_blaekbesparende.pdf`, makeDocument("Klasseboden — arbejdsark · lærervejledning", [h(TeacherGuidePage, { format: "worksheet", inkSaver: true, key: "guide" })])],
    ["klasseboden-arbejdsark", "whole-colour", "whole", "colour", 4, `${worksheetPrefix}_hele_pakken_farve.pdf`, worksheetWholeDocument(false)],
    ["klasseboden-arbejdsark", "whole-ink-saver", "whole", "ink-saving", 4, `${worksheetPrefix}_hele_pakken_blaekbesparende.pdf`, worksheetWholeDocument(true)],
  ];

  const artifacts = [];
  for (const [materialId, variant, kind, mode, pageCount, fileName, document] of jobs) {
    artifacts.push(await renderPrivateArtifact({ document, fileName, kind, materialId, mode, pageCount, variant }));
  }

  await mkdir(publicDirectory, { recursive: true });
  const postStudent = artifacts.find((artifact) => artifact.materialId === "klasseboden-postloeb" && artifact.variant === "student");
  const worksheetStudent = artifacts.find((artifact) => artifact.materialId === "klasseboden-arbejdsark" && artifact.variant === "student");
  if (!postStudent || !worksheetStudent) throw new Error("Mangler elevmateriale til public preview.");

  const postPreviewPath = join(publicDirectory, "klasseboden-postloeb-forhaandsvisning.pdf");
  const worksheetPreviewPath = join(publicDirectory, "klasseboden-arbejdsark-forhaandsvisning.pdf");
  await createPreview({
    destination: postPreviewPath,
    imagePrefix: join(publicDirectory, "previews", "klasseboden-postloeb-preview"),
    pageNumbers: [5, 8],
    source: join(workspace, postStudent.privatePath),
    title: "Klasseboden — postløb · facitfri forhåndsvisning",
  });
  await createPreview({
    destination: worksheetPreviewPath,
    imagePrefix: join(publicDirectory, "previews", "klasseboden-arbejdsark-preview"),
    pageNumbers: [1, 2],
    source: join(workspace, worksheetStudent.privatePath),
    title: "Klasseboden — arbejdsark · facitfri forhåndsvisning",
  });

  const previews = [];
  for (const [materialId, pdfPath] of [
    ["klasseboden-postloeb", postPreviewPath],
    ["klasseboden-arbejdsark", worksheetPreviewPath],
  ]) {
    const bytes = await readFile(pdfPath);
    const file = await stat(pdfPath);
    previews.push({
      byteSize: file.size,
      materialId,
      pageCount: 2,
      publicPath: `public/printpakker/${pdfPath.split(/[\\/]/).at(-1)}`,
      sha256: sha256(bytes),
      version,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    artifacts,
    previews,
    version,
  };
  await writeFile(join(assetsDirectory, "klasseboden-artifacts.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated ${artifacts.length} protected PDFs and ${previews.length} facit-free previews for Klasseboden v${version}.\n`);
}

await main();
