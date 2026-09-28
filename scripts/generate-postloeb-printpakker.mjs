import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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

import { POSTLOEB_PACKAGES } from "./printpakker/package-data.mjs";

const h = React.createElement;
const workspace = process.cwd();
const outputDirectory = join(workspace, "output", "pdf");
const publicArtworkDirectory = join(workspace, "public", "printpakker");
const previewDirectory = join(publicArtworkDirectory, "previews");
const stationArtworkDirectory = join(workspace, "scripts", "printpakker", "artwork");
const protectedAssetsDirectory = join(workspace, "assets", "printpakker");

const palette = {
  navy: "#163C5C",
  blue: "#1E719A",
  teal: "#3F8C86",
  cream: "#FFF9EC",
  paper: "#FFFEFA",
  gold: "#E6AD48",
  rust: "#A75436",
  leaf: "#527B5E",
  ink: "#1E2B32",
  muted: "#52646B",
  line: "#B5CDD1",
  paleBlue: "#E6F3F4",
  paleGold: "#FFF1D4",
};

const variants = {
  wholeColour: "hele_pakken_farve",
  wholeInkSaver: "hele_pakken_blaekbesparende",
  student: "elevark",
  answerKey: "facit",
  teacherGuide: "laerervejledning",
};

function displayText(value) {
  return value;
}

function makeStyles(inkSaver) {
  const ink = inkSaver ? "#161616" : palette.ink;
  const accent = inkSaver ? "#202020" : palette.blue;

  return StyleSheet.create({
    page: {
      backgroundColor: inkSaver ? "#FFFFFF" : palette.cream,
      color: ink,
      fontFamily: "Helvetica",
      fontSize: 10.4,
      paddingTop: 39,
      paddingRight: 42,
      paddingBottom: 42,
      paddingLeft: 42,
    },
    cover: {
      backgroundColor: inkSaver ? "#FFFFFF" : "#DDEBE6",
      color: ink,
      padding: 0,
      position: "relative",
    },
    coverImage: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      position: "absolute",
      top: 0,
      left: 0,
      opacity: 1,
    },
    coverPanel: {
      width: 330,
      borderWidth: inkSaver ? 1.4 : 0,
      borderColor: "#171717",
      borderRadius: inkSaver ? 0 : 15,
      backgroundColor: inkSaver ? "#FFFFFF" : "rgba(255,254,250,0.94)",
      paddingTop: 22,
      paddingRight: 22,
      paddingBottom: 20,
      paddingLeft: 22,
      position: "absolute",
      top: 52,
      left: 42,
    },
    coverKicker: {
      color: inkSaver ? "#151515" : palette.rust,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 1.15,
      textTransform: "uppercase",
    },
    coverTitle: {
      color: inkSaver ? "#151515" : palette.navy,
      fontFamily: "Helvetica-Bold",
      fontSize: 27,
      lineHeight: 1.03,
      marginTop: 8,
    },
    coverSubtitle: {
      color: inkSaver ? "#292929" : palette.muted,
      fontSize: 11.2,
      lineHeight: 1.45,
      marginTop: 10,
    },
    coverFacts: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      marginTop: 15,
    },
    coverFact: {
      borderWidth: 1,
      borderColor: inkSaver ? "#1E1E1E" : "#C9A971",
      borderRadius: inkSaver ? 0 : 10,
      color: inkSaver ? "#151515" : palette.leaf,
      fontSize: 8.2,
      fontWeight: 700,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    header: {
      alignItems: "flex-start",
      borderBottomColor: inkSaver ? "#171717" : palette.blue,
      borderBottomWidth: 1.4,
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 15,
      paddingBottom: 8,
    },
    eyebrow: {
      color: accent,
      fontSize: 8.3,
      fontWeight: 700,
      letterSpacing: 1.05,
      textTransform: "uppercase",
    },
    heading: {
      color: inkSaver ? "#151515" : palette.navy,
      fontFamily: "Helvetica-Bold",
      fontSize: 20.5,
      lineHeight: 1.05,
      marginTop: 4,
    },
    pageNumber: {
      color: inkSaver ? "#222222" : palette.muted,
      fontSize: 8.3,
      fontWeight: 700,
    },
    intro: {
      color: inkSaver ? "#292929" : palette.muted,
      fontSize: 10.7,
      lineHeight: 1.52,
    },
    sectionTitle: {
      color: inkSaver ? "#171717" : palette.navy,
      fontFamily: "Helvetica-Bold",
      fontSize: 13.4,
      marginTop: 14,
    },
    body: {
      color: inkSaver ? "#282828" : palette.muted,
      fontSize: 10.1,
      lineHeight: 1.46,
      marginTop: 5,
    },
    note: {
      backgroundColor: inkSaver ? "#F2F2F2" : palette.paleGold,
      borderLeftColor: inkSaver ? "#171717" : palette.gold,
      borderLeftWidth: 4,
      marginTop: 12,
      paddingTop: 8,
      paddingRight: 10,
      paddingBottom: 8,
      paddingLeft: 11,
    },
    noteText: {
      color: inkSaver ? "#222222" : "#694513",
      fontSize: 9.8,
      lineHeight: 1.45,
    },
    visualPanel: {
      backgroundColor: inkSaver ? "#FAFAFA" : "#E5F0EC",
      borderColor: inkSaver ? "#2B2B2B" : "#A6C3B7",
      borderRadius: inkSaver ? 0 : 14,
      borderWidth: 1,
      height: 96,
      justifyContent: "space-between",
      marginBottom: 15,
      overflow: "hidden",
      padding: 13,
    },
    visualTitle: {
      color: inkSaver ? "#242424" : palette.leaf,
      fontSize: 8.4,
      fontWeight: 700,
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    visualLine: {
      backgroundColor: inkSaver ? "#404040" : palette.gold,
      borderRadius: 3,
      height: 4,
      width: "82%",
    },
    visualShapes: {
      alignItems: "flex-end",
      display: "flex",
      flexDirection: "row",
      gap: 8,
    },
    visualShape: {
      backgroundColor: inkSaver ? "#B7B7B7" : palette.rust,
      borderRadius: 12,
      height: 26,
      opacity: 0.85,
      width: 26,
    },
    visualShapeSmall: {
      backgroundColor: inkSaver ? "#898989" : palette.teal,
      borderRadius: 8,
      height: 16,
      opacity: 0.88,
      width: 16,
    },
    stationBand: {
      alignItems: "center",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      marginBottom: 14,
    },
    stationNumber: {
      alignItems: "center",
      backgroundColor: inkSaver ? "#181818" : palette.rust,
      borderRadius: inkSaver ? 0 : 12,
      color: "#FFFFFF",
      display: "flex",
      fontFamily: "Helvetica-Bold",
      fontSize: 15.5,
      height: 33,
      justifyContent: "center",
      width: 33,
    },
    stationSkill: {
      color: inkSaver ? "#202020" : palette.rust,
      fontSize: 8.1,
      fontWeight: 700,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    stationTitle: {
      color: inkSaver ? "#171717" : palette.navy,
      fontFamily: "Helvetica-Bold",
      fontSize: 18.7,
      lineHeight: 1.08,
      marginTop: 3,
    },
    stationArtwork: {
      borderColor: inkSaver ? "#2B2B2B" : "#A8C4B9",
      borderRadius: inkSaver ? 0 : 13,
      borderWidth: 1,
      height: 116,
      marginBottom: 15,
      objectFit: "cover",
      width: "100%",
    },
    promptBox: {
      backgroundColor: "#FFFFFF",
      borderColor: inkSaver ? "#232323" : palette.line,
      borderRadius: inkSaver ? 0 : 12,
      borderWidth: 1.2,
      padding: 14,
    },
    promptLabel: {
      color: accent,
      fontSize: 8.4,
      fontWeight: 700,
      letterSpacing: 0.85,
      textTransform: "uppercase",
    },
    prompt: {
      color: inkSaver ? "#151515" : palette.ink,
      fontFamily: "Helvetica-Bold",
      fontSize: 11.25,
      lineHeight: 1.37,
      marginTop: 7,
    },
    responsePrompt: {
      color: inkSaver ? "#2B2B2B" : palette.muted,
      fontSize: 9.35,
      fontStyle: "italic",
      lineHeight: 1.36,
      marginTop: 9,
    },
    answerArea: {
      backgroundColor: inkSaver ? "#FFFFFF" : "#FBFEFD",
      borderColor: inkSaver ? "#303030" : "#B6D0D1",
      borderRadius: inkSaver ? 0 : 10,
      borderWidth: 1,
      marginTop: 14,
      minHeight: 142,
      padding: 11,
    },
    answerLabel: {
      color: accent,
      fontSize: 9.1,
      fontWeight: 700,
    },
    ruledLine: {
      borderBottomColor: inkSaver ? "#777777" : "#B7D4D6",
      borderBottomWidth: 0.7,
      marginTop: 19,
    },
    answerCard: {
      backgroundColor: "#FFFFFF",
      borderColor: inkSaver ? "#343434" : "#C6D9D9",
      borderRadius: inkSaver ? 0 : 11,
      borderWidth: 1,
      marginTop: 10,
      padding: 12,
    },
    answerTitle: {
      color: inkSaver ? "#161616" : palette.navy,
      fontFamily: "Helvetica-Bold",
      fontSize: 11.6,
    },
    answerText: {
      color: inkSaver ? "#282828" : palette.muted,
      fontSize: 9.35,
      lineHeight: 1.4,
      marginTop: 4,
    },
    answerStrong: {
      color: inkSaver ? "#171717" : palette.rust,
      fontFamily: "Helvetica-Bold",
      fontSize: 9.9,
      lineHeight: 1.36,
      marginTop: 7,
    },
    clueBox: {
      backgroundColor: inkSaver ? "#FFFFFF" : "#FFF6DF",
      borderColor: inkSaver ? "#242424" : palette.gold,
      borderRadius: inkSaver ? 0 : 9,
      borderStyle: "dashed",
      borderWidth: 1,
      marginTop: 8,
      padding: 8,
    },
    clueText: {
      color: inkSaver ? "#171717" : "#754717",
      fontFamily: "Helvetica-Bold",
      fontSize: 9.7,
    },
    checklist: {
      alignItems: "flex-start",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    checkbox: {
      borderColor: inkSaver ? "#171717" : palette.blue,
      borderWidth: 1,
      height: 10.5,
      marginTop: 2,
      width: 10.5,
    },
    flowCard: {
      backgroundColor: "#FFFFFF",
      borderColor: inkSaver ? "#343434" : "#C6D9D9",
      borderRadius: inkSaver ? 0 : 11,
      borderWidth: 1,
      marginTop: 9,
      padding: 10,
    },
    flowNumber: {
      color: inkSaver ? "#191919" : palette.rust,
      fontFamily: "Helvetica-Bold",
      fontSize: 10.3,
    },
    holdGrid: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 14,
    },
    holdCell: {
      backgroundColor: "#FFFFFF",
      borderColor: inkSaver ? "#343434" : "#B6D0D1",
      borderRadius: inkSaver ? 0 : 10,
      borderWidth: 1,
      minHeight: 84,
      padding: 9,
      width: "47%",
    },
    holdCellTitle: {
      color: inkSaver ? "#171717" : palette.navy,
      fontFamily: "Helvetica-Bold",
      fontSize: 9.5,
      lineHeight: 1.2,
    },
    wordSlots: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 12,
    },
    wordSlot: {
      borderBottomColor: inkSaver ? "#191919" : palette.rust,
      borderBottomWidth: 1.25,
      height: 25,
      width: 38,
    },
    footer: {
      bottom: 18,
      color: inkSaver ? "#343434" : palette.muted,
      display: "flex",
      flexDirection: "row",
      fontSize: 7.5,
      justifyContent: "space-between",
      left: 42,
      position: "absolute",
      right: 42,
    },
  });
}

function Header({ label, page, styles, title }) {
  return h(View, { style: styles.header }, [
    h(View, { key: "title" }, [
      h(Text, { key: "label", style: styles.eyebrow }, displayText(label)),
      h(Text, { key: "heading", style: styles.heading }, displayText(title)),
    ]),
    h(Text, { key: "page", style: styles.pageNumber }, `Side ${page}`),
  ]);
}

function Footer({ packageData, page, styles }) {
  return h(View, { fixed: true, style: styles.footer }, [
    h(Text, { key: "left" }, `${displayText(packageData.title)} - SkoleGPS`),
    h(Text, { key: "right" }, `Printpakker v${packageData.version ?? "1.0"} - ${page}`),
  ]);
}

function DecoratedBand({ inkSaver = false, label, styles }) {
  return h(View, { style: styles.visualPanel }, [
    h(Text, { key: "label", style: styles.visualTitle }, displayText(label)),
    h(View, { key: "line", style: styles.visualLine }),
    h(View, { key: "shapes", style: styles.visualShapes }, [
      h(View, { key: "one", style: styles.visualShape }),
      h(View, { key: "two", style: styles.visualShapeSmall }),
      h(View, { key: "three", style: { ...styles.visualShape, backgroundColor: inkSaver ? "#9A9A9A" : palette.gold, height: 20, width: 20 } }),
      h(View, { key: "four", style: styles.visualShapeSmall }),
    ]),
  ]);
}

function CoverPage({ images, inkSaver = false, packageData, student = false }) {
  const styles = makeStyles(inkSaver);
  const kicker = student
    ? `Elevmateriale - ${packageData.subject}`
    : `SkoleGPS Printpakker - ${packageData.subject}`;

  return h(Page, { size: "A4", style: styles.cover }, [
    !inkSaver ? h(Image, {
      key: "cover-image",
      fixed: true,
      src: images.hero,
      style: styles.coverImage,
      wrap: false,
    }) : null,
    h(View, { key: "cover-panel", style: styles.coverPanel }, [
      h(Text, { key: "kicker", style: styles.coverKicker }, displayText(kicker)),
      h(Text, { key: "title", style: styles.coverTitle }, displayText(packageData.title)),
      h(Text, { key: "subtitle", style: styles.coverSubtitle }, displayText(packageData.subtitle)),
      h(View, { key: "facts", style: styles.coverFacts }, [
        h(Text, { key: "posts", style: styles.coverFact }, "6 poster"),
        h(Text, { key: "duration", style: styles.coverFact }, displayText(packageData.duration)),
        h(Text, { key: "type", style: styles.coverFact }, displayText(packageData.activityType)),
      ]),
    ]),
  ]);
}

function TeacherGuidePageOne({ inkSaver = false, packageData }) {
  const styles = makeStyles(inkSaver);
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Lærermateriale", page: 2, styles, title: "Lærervejledning" }),
    h(Text, { key: "intro", style: styles.intro }, displayText(packageData.mission)),
    h(DecoratedBand, { key: "band", inkSaver, label: packageData.subtitle, styles }),
    h(Text, { key: "before", style: styles.sectionTitle }, "Før timen"),
    ...packageData.preparation.map((item, index) => h(View, { key: `item-${index}`, style: styles.checklist }, [
      h(View, { key: "check", style: styles.checkbox }),
      h(Text, { key: "text", style: styles.body }, displayText(item)),
    ])),
    h(Text, { key: "materials-title", style: styles.sectionTitle }, "Materialer"),
    h(Text, { key: "materials", style: styles.body }, displayText(packageData.materials.join(", ") + ".")),
    h(View, { key: "note", style: styles.note }, h(Text, { style: styles.noteText }, "Elevmaterialet og den offentlige forhåndsvisning er facitfri. Udlever kun lærerens brikker, når et hold kan vise sin tænkning.")),
    h(Footer, { key: "footer", packageData, page: 2, styles }),
  ]);
}

function TeacherGuidePageTwo({ inkSaver = false, packageData }) {
  const styles = makeStyles(inkSaver);
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, { key: "header", label: "Lærermateriale", page: 3, styles, title: "Gennemførsel" }),
    ...packageData.flow.map(([title, body], index) => h(View, { key: `${title}-${index}`, style: styles.flowCard }, [
      h(Text, { key: "title", style: styles.flowNumber }, `${index + 1}. ${displayText(title)}`),
      h(Text, { key: "body", style: styles.answerText }, displayText(body)),
    ])),
    h(Text, { key: "reflection-title", style: styles.sectionTitle }, "Afsluttende samtale"),
    ...packageData.debrief.map((question, index) => h(View, { key: `question-${index}`, style: styles.checklist }, [
      h(View, { key: "box", style: styles.checkbox }),
      h(Text, { key: "text", style: styles.body }, displayText(question)),
    ])),
    h(Footer, { key: "footer", packageData, page: 3, styles }),
  ]);
}

function StationPage({ images, inkSaver = false, index, packageData, pageNumber, station }) {
  const styles = makeStyles(inkSaver);
  const visual = inkSaver
    ? h(DecoratedBand, { inkSaver, label: station.skill, styles })
    : h(Image, {
      src: images.stations[index],
      style: styles.stationArtwork,
    });

  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, {
      key: "header",
      label: `${packageData.title} - elevmateriale`,
      page: pageNumber,
      styles,
      title: "Elevpost",
    }),
    h(View, { key: "station-band", style: styles.stationBand }, [
      h(View, { key: "number", style: styles.stationNumber }, h(Text, null, String(index + 1))),
      h(View, { key: "title-group" }, [
        h(Text, { key: "skill", style: styles.stationSkill }, displayText(station.skill)),
        h(Text, { key: "title", style: styles.stationTitle }, displayText(station.title)),
      ]),
    ]),
    h(View, { key: "visual" }, visual),
    h(View, { key: "prompt-box", style: styles.promptBox }, [
      h(Text, { key: "prompt-label", style: styles.promptLabel }, "Opgaven"),
      h(Text, { key: "prompt", style: styles.prompt }, displayText(station.prompt)),
      h(Text, { key: "response", style: styles.responsePrompt }, displayText(station.responsePrompt)),
    ]),
    h(View, { key: "answer-area", style: styles.answerArea }, [
      h(Text, { key: "label", style: styles.answerLabel }, "Vores svar og begrundelse"),
      ...Array.from({ length: 5 }, (_, line) => h(View, { key: `line-${line}`, style: styles.ruledLine })),
    ]),
    h(Text, { key: "teacher", style: styles.body }, "Vis jeres forklaring til læreren, før I får næste brik."),
    h(Footer, { key: "footer", packageData, page: pageNumber, styles }),
  ]);
}

function TeamSheetPage({ inkSaver = false, packageData, pageNumber }) {
  const styles = makeStyles(inkSaver);
  return h(Page, { size: "A4", style: styles.page }, [
    h(Header, {
      key: "header",
      label: `${packageData.title} - elevmateriale`,
      page: pageNumber,
      styles,
      title: "Holdark",
    }),
    h(Text, { key: "intro", style: styles.intro }, "Skriv korte noter fra hver post. I skal ikke gætte på slutningen - vis jeres tænkning og saml først brikkerne, når læreren har godkendt dem."),
    h(Text, { key: "team-title", style: styles.sectionTitle }, "Vores hold"),
    h(View, { key: "team", style: { ...styles.answerArea, minHeight: 60 } }, [
      h(Text, { key: "label", style: styles.answerLabel }, "Holdnavn og navne"),
      h(View, { key: "line", style: styles.ruledLine }),
    ]),
    h(Text, { key: "notes-title", style: styles.sectionTitle }, "Noter fra posterne"),
    h(View, { key: "grid", style: styles.holdGrid }, packageData.stations.map((station, index) => h(View, {
      key: station.title,
      style: styles.holdCell,
    }, [
      h(Text, { key: "title", style: styles.holdCellTitle }, `Post ${index + 1}: ${displayText(station.title)}`),
      h(View, { key: "line", style: styles.ruledLine }),
    ]))),
    h(Text, { key: "message-title", style: styles.sectionTitle }, "Vores fælles besked"),
    h(View, { key: "slots", style: styles.wordSlots }, Array.from(
      { length: packageData.stations.length },
      (_, index) => h(View, { key: `slot-${index}`, style: styles.wordSlot }),
    )),
    h(Footer, { key: "footer", packageData, page: pageNumber, styles }),
  ]);
}

function AnswerKeyPages({ inkSaver = false, packageData, startPage }) {
  const styles = makeStyles(inkSaver);
  return Array.from({ length: 3 }, (_, pageIndex) => {
    const stationSlice = packageData.stations.slice(pageIndex * 2, pageIndex * 2 + 2);
    const page = startPage + pageIndex;
    return h(Page, { key: `answers-${pageIndex}`, size: "A4", style: styles.page }, [
      h(Header, {
        key: "header",
        label: "Lærermateriale - beskyttet download",
        page,
        styles,
        title: "Facit og brikker",
      }),
      h(Text, { key: "intro", style: styles.intro }, "Brug facit som samtalestøtte. Bed først holdet vise sin strategi eller sit tekstbevis. Udlever derefter den angivne brik."),
      ...stationSlice.map((station, stationIndex) => h(View, { key: station.title, style: styles.answerCard }, [
        h(Text, { key: "title", style: styles.answerTitle }, `Post ${pageIndex * 2 + stationIndex + 1}: ${displayText(station.title)}`),
        h(Text, { key: "answer", style: styles.answerStrong }, `Korrekt svar: ${displayText(station.answer)}`),
        h(Text, { key: "strategy", style: styles.answerText }, displayText(station.strategy)),
        h(View, { key: "clue", style: styles.clueBox }, h(Text, { style: styles.clueText }, `Brik til holdet: ${displayText(station.clue)}`)),
      ])),
      pageIndex === 2 ? h(View, { key: "final", style: styles.note }, h(Text, {
        style: styles.noteText,
      }, `Sæt brikkerne i posternes rækkefølge: ${packageData.stations.map((station) => displayText(station.clue)).join(" + ")}. Den fælles besked er: ${displayText(packageData.finalMessage)} ${displayText(packageData.finalInstruction)}`)) : null,
      h(Footer, { key: "footer", packageData, page, styles }),
    ]);
  });
}

function StudentPages({ images, includeCover = true, inkSaver = false, packageData, startPage = 2 }) {
  const firstStationPage = includeCover ? startPage : 1;
  return [
    ...(includeCover ? [h(CoverPage, { key: "cover", images, inkSaver, packageData, student: true })] : []),
    ...packageData.stations.map((station, index) => h(StationPage, {
      key: station.title,
      images,
      inkSaver,
      index,
      packageData,
      pageNumber: firstStationPage + index,
      station,
    })),
    h(TeamSheetPage, {
      key: "team-sheet",
      inkSaver,
      packageData,
      pageNumber: firstStationPage + packageData.stations.length,
    }),
  ];
}

function TeacherGuideDocument({ images, inkSaver = false, packageData }) {
  return h(Document, { author: "SkoleGPS", title: `${displayText(packageData.title)} - Lærervejledning` }, [
    h(CoverPage, { key: "cover", images, inkSaver, packageData }),
    h(TeacherGuidePageOne, { key: "guide-one", images, inkSaver, packageData }),
    h(TeacherGuidePageTwo, { key: "guide-two", inkSaver, packageData }),
  ]);
}

function StudentDocument({ images, inkSaver = false, packageData }) {
  return h(Document, { author: "SkoleGPS", title: `${displayText(packageData.title)} - Elevark` }, StudentPages({
    images,
    inkSaver,
    packageData,
  }));
}

function AnswerKeyDocument({ inkSaver = false, packageData }) {
  const styles = makeStyles(inkSaver);
  return h(Document, { author: "SkoleGPS", title: `${displayText(packageData.title)} - Facit` }, [
    h(Page, { key: "cover", size: "A4", style: styles.page }, [
      h(Header, { key: "header", label: "Lærermateriale - beskyttet download", page: 1, styles, title: "Facit" }),
      h(Text, { key: "intro", style: styles.intro }, "Dette ark er kun til læreren. Elevmaterialet og den offentlige forhåndsvisning indeholder ikke facit, briktekst eller slutbesked."),
      h(View, { key: "note", style: styles.note }, h(Text, {
        style: styles.noteText,
      }, "Brug løsningerne til at spørge videre: Hvad gjorde I først? Hvilket tekstbevis eller hvilken kontrol viser, at svaret holder?")),
      h(Footer, { key: "footer", packageData, page: 1, styles }),
    ]),
    ...AnswerKeyPages({ inkSaver, packageData, startPage: 2 }),
  ]);
}

function WholePackageDocument({ images, inkSaver = false, packageData }) {
  return h(Document, { author: "SkoleGPS", title: `${displayText(packageData.title)} - Hele pakken` }, [
    h(CoverPage, { key: "cover", images, inkSaver, packageData }),
    h(TeacherGuidePageOne, { key: "guide-one", images, inkSaver, packageData }),
    h(TeacherGuidePageTwo, { key: "guide-two", inkSaver, packageData }),
    ...packageData.stations.map((station, index) => h(StationPage, {
      key: station.title,
      images,
      inkSaver,
      index,
      packageData,
      pageNumber: index + 4,
      station,
    })),
    h(TeamSheetPage, { key: "team", inkSaver, packageData, pageNumber: 10 }),
    ...AnswerKeyPages({ inkSaver, packageData, startPage: 11 }),
  ]);
}

function PublicPreviewDocument({ images, packageData }) {
  return h(Document, { author: "SkoleGPS", title: `${displayText(packageData.title)} - Facitfri forhåndsvisning` }, [
    h(CoverPage, { key: "cover", images, packageData, student: true }),
    h(StationPage, {
      key: "station",
      images,
      index: 0,
      packageData,
      pageNumber: 2,
      station: packageData.stations[0],
    }),
  ]);
}

function getRequiredArtwork(packageData) {
  return [
    join(publicArtworkDirectory, packageData.heroArtwork),
    ...packageData.stationArtwork.map((filename) => join(stationArtworkDirectory, filename)),
  ];
}

async function assertArtworkExists(packageData) {
  const required = getRequiredArtwork(packageData);
  const missing = [];

  for (const artworkPath of required) {
    try {
      await access(artworkPath);
    } catch {
      missing.push(artworkPath);
    }
  }

  if (missing.length > 0) {
    throw new Error([
      `Mangler ${missing.length} illustration(er) til ${packageData.slug}.`,
      ...missing.map((artworkPath) => `- ${artworkPath}`),
      "Tilføj heroen og seks postillustrationer på de viste stier, og kør kommandoen igen.",
    ].join("\n"));
  }
}

async function importSharp() {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Kan ikke indlæse sharp til kompakt PDF-billedbehandling. Kør npm.cmd ci i worktreeet først. (${detail})`);
  }
}

async function optimiseArtwork(sharp, artworkPath, maxWidth) {
  const source = await readFile(artworkPath);
  return sharp(source)
    .rotate()
    .resize({
      width: maxWidth,
      height: 1100,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#FFFFFF" })
    .jpeg({
      quality: 80,
      progressive: true,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer();
}

async function loadPackageArtwork(packageData) {
  await assertArtworkExists(packageData);
  const sharp = await importSharp();
  const [hero, ...stations] = await Promise.all([
    optimiseArtwork(sharp, join(publicArtworkDirectory, packageData.heroArtwork), 1600),
    ...packageData.stationArtwork.map((filename) => optimiseArtwork(sharp, join(stationArtworkDirectory, filename), 1450)),
  ]);

  return { hero, stations };
}

async function renderPdf({ document, destination, protectedDestination }) {
  const stream = await pdf(document).toBuffer();
  await writeFile(destination, stream);
  if (protectedDestination) await copyFile(destination, protectedDestination);
  const file = await stat(destination);
  return { destination, size: file.size };
}

function runCommand(command, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, { shell: false });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`Kan ikke starte ${command}. Installér Poppler eller gør pdftoppm tilgængelig på PATH. (${error.message})`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} afsluttede med kode ${code}. ${stderr.trim()}`));
    });
  });
}

async function renderPreviewPngs(packageData, previewPdfPath) {
  const prefix = join(previewDirectory, `${packageData.slug}-preview`);
  await runCommand("pdftoppm", [
    "-png",
    "-r",
    "144",
    "-f",
    "1",
    "-l",
    "2",
    previewPdfPath,
    prefix,
  ]);
}

function parseOnlySlug() {
  const argument = process.argv.find((value) => value.startsWith("--only="));
  return argument ? argument.slice("--only=".length) : undefined;
}

function selectPackages() {
  const onlySlug = parseOnlySlug();
  if (!onlySlug) return POSTLOEB_PACKAGES;

  const selected = POSTLOEB_PACKAGES.filter((packageData) => packageData.slug === onlySlug);
  if (selected.length === 0) {
    throw new Error(`Ukendt --only-slug: ${onlySlug}. Gyldige slugs: ${POSTLOEB_PACKAGES.map((item) => item.slug).join(", ")}`);
  }
  return selected;
}

async function renderPackage(packageData) {
  const images = await loadPackageArtwork(packageData);
  const protectedDirectory = join(protectedAssetsDirectory, packageData.slug);
  await Promise.all([
    mkdir(outputDirectory, { recursive: true }),
    mkdir(protectedDirectory, { recursive: true }),
    mkdir(publicArtworkDirectory, { recursive: true }),
    mkdir(previewDirectory, { recursive: true }),
  ]);

  const file = (suffix) => `${packageData.assetStem}_${suffix}.pdf`;
  const jobs = [
    {
      filename: file(variants.wholeColour),
      document: WholePackageDocument({ images, packageData }),
      protected: true,
    },
    {
      filename: file(variants.wholeInkSaver),
      document: WholePackageDocument({ images, inkSaver: true, packageData }),
      protected: true,
    },
    {
      filename: file(variants.student),
      document: StudentDocument({ images, packageData }),
      protected: true,
    },
    {
      filename: file(variants.answerKey),
      document: AnswerKeyDocument({ packageData }),
      protected: true,
    },
    {
      filename: file(variants.teacherGuide),
      document: TeacherGuideDocument({ images, packageData }),
      protected: true,
    },
    {
      filename: `${packageData.slug}-forhaandsvisning.pdf`,
      document: PublicPreviewDocument({ images, packageData }),
      protected: false,
    },
  ];

  const rendered = [];
  for (const job of jobs) {
    const destination = join(outputDirectory, job.filename);
    const protectedDestination = job.protected ? join(protectedDirectory, job.filename) : undefined;
    rendered.push(await renderPdf({ document: job.document, destination, protectedDestination }));
  }

  const preview = rendered.at(-1);
  if (preview) {
    await copyFile(preview.destination, join(publicArtworkDirectory, preview.destination.split(/[\\/]/).at(-1)));
    await renderPreviewPngs(packageData, preview.destination);
  }
  return rendered;
}

async function main() {
  const packageSelection = selectPackages();
  const results = [];

  for (const packageData of packageSelection) {
    results.push(...await renderPackage(packageData));
  }

  const megabytes = results.reduce((sum, result) => sum + result.size, 0) / 1024 / 1024;
  process.stdout.write(`Generated ${results.length} PDFs for ${packageSelection.length} Printpakker package(s) in ${outputDirectory} (${megabytes.toFixed(1)} MiB).\n`);
}

await main();
