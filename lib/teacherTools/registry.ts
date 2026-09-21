import {
  getDagensTavleSsoOrigin,
  getFamilySsoOrigin,
} from "@/lib/familySso/config";

export { TEACHER_TOOL_FACEBOOK_GROUP_LINK } from "./community";

export const TEACHER_TOOL_IDS = [
  "gps-lob",
  "dagens-tavle",
  "printmit-arbejdsark",
  "skak",
  "kildegps",
  "oevekort",
] as const;

export type TeacherToolId = (typeof TEACHER_TOOL_IDS)[number];

export type TeacherToolTone = "blue" | "green" | "sand" | "yellow";

export type TeacherToolIcon =
  | "compass"
  | "file-text"
  | "map-pin"
  | "presentation"
  | "chess-knight"
  | "clock";

export type TeacherToolLink = {
  href: string;
  kind: "internal" | "external";
  target: "_blank" | "_self";
};

type TeacherToolBase = {
  cta: string;
  description: string;
  icon: TeacherToolIcon;
  id: TeacherToolId;
  imageSrc?: `/brand/tools/${string}.png`;
  title: string;
  tone: TeacherToolTone;
};

export type ActiveTeacherTool = TeacherToolBase & {
  link: TeacherToolLink;
  status: "active";
};

export type ComingSoonTeacherTool = TeacherToolBase & {
  link?: never;
  status: "coming_soon";
};

export type TeacherTool = ActiveTeacherTool | ComingSoonTeacherTool;

export type TeacherToolOrigins = {
  dagensTavle: string;
  printMitArbejdsark: string;
};

export const TEACHER_TOOL_FALLBACK_ORIGINS: TeacherToolOrigins = {
  dagensTavle: "https://dagenstavle.dk",
  printMitArbejdsark: "https://printmitarbejdsark.dk",
};

function familySsoStartHref(origin: string, next: string) {
  const target = new URL("/auth/family-sso/start", origin);
  target.searchParams.set("next", next);
  target.searchParams.set("source", "skolegps");
  return target.toString();
}

/**
 * Returns plain, serializable data so a Server Component can pass the tools to
 * client components such as the manually opened tool dialog.
 */
export function createTeacherToolRegistry(origins: TeacherToolOrigins): readonly TeacherTool[] {
  return [
    {
      id: "gps-lob",
      title: "GPS-løb",
      description: "Tag undervisningen med ud og lav faglige aktiviteter i bevægelse.",
      cta: "Åbn GPS-løb",
      status: "active",
      link: { href: "/dashboard/opret/valg", kind: "internal", target: "_self" },
      icon: "map-pin",
      imageSrc: "/brand/tools/gps-lob-illustration.png",
      tone: "green",
    },
    {
      id: "dagens-tavle",
      title: "DagensTavle",
      description: "Saml dagens program og klasseaktiviteter på skærmen.",
      cta: "Åbn DagensTavle",
      status: "active",
      link: {
        href: familySsoStartHref(origins.dagensTavle, "/tavle"),
        kind: "external",
        target: "_self",
      },
      icon: "presentation",
      imageSrc: "/brand/tools/dagenstavle-illustration.png",
      tone: "yellow",
    },
    {
      id: "printmit-arbejdsark",
      title: "PrintMitArbejdsark",
      description: "Lav arbejdsark med elev- og lærerudgaver klar til print.",
      cta: "Åbn arbejdsark",
      status: "active",
      link: {
        href: familySsoStartHref(origins.printMitArbejdsark, "/lav"),
        kind: "external",
        target: "_self",
      },
      icon: "file-text",
      imageSrc: "/brand/tools/arbejdsark-illustration.png",
      tone: "blue",
    },
    {
      id: "skak",
      title: "Skak",
      description: "Brug skak som læringsværktøj i undervisningen.",
      cta: "Åbn Skak",
      status: "active",
      link: { href: "/dashboard/laerervaerktoejer/skak", kind: "internal", target: "_self" },
      icon: "chess-knight",
      imageSrc: "/brand/tools/skak-illustration.png",
      tone: "sand",
    },
    {
      id: "kildegps",
      title: "KildeGPS",
      description: "Find udvalgte kilder til elevernes research.",
      cta: "Åbn KildeGPS",
      status: "active",
      link: { href: "https://www.kildegps.dk", kind: "external", target: "_blank" },
      icon: "compass",
      tone: "blue",
    },
    {
      id: "oevekort",
      title: "Øvekort",
      description: "Lav gloser og spørgsmål til træning, tavle og print.",
      cta: "Kommer snart",
      status: "coming_soon",
      icon: "clock",
      imageSrc: "/brand/tools/oevekort-illustration.png",
      tone: "blue",
    },
  ] satisfies readonly TeacherTool[];
}

/**
 * Uses the existing allowed Family SSO origins, with canonical public origins
 * when no allowed environment origin has been configured.
 */
export function getTeacherToolRegistry(): readonly TeacherTool[] {
  return createTeacherToolRegistry({
    dagensTavle: getDagensTavleSsoOrigin() ?? TEACHER_TOOL_FALLBACK_ORIGINS.dagensTavle,
    printMitArbejdsark:
      getFamilySsoOrigin("printmitarbejdsark") ?? TEACHER_TOOL_FALLBACK_ORIGINS.printMitArbejdsark,
  });
}

export function getActiveTeacherTools() {
  return getTeacherToolRegistry().filter(
    (tool): tool is ActiveTeacherTool => tool.status === "active",
  );
}

export function getTeacherTool(id: TeacherToolId) {
  return getTeacherToolRegistry().find((tool) => tool.id === id);
}
