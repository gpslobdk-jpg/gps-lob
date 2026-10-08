export type TeacherSoundPresetId =
  | "afteraarsskov"
  | "regn-ved-vinduet"
  | "stille-klaver"
  | "bibliotekets-ro";

export type TeacherSoundAssetId =
  | "afteraarsskov"
  | "regn-ved-vinduet"
  | "stille-klaver"
  | "papir-1"
  | "papir-2"
  | "papir-3";

export type TeacherSoundAsset = {
  id: TeacherSoundAssetId;
  label: string;
  role: "musik" | "natur" | "materiale";
  src: string;
  loop: boolean;
  volume: number;
  attribution?: {
    text: string;
    license: string;
    sourceUrl: string;
  };
};

export type TeacherSoundPreset = {
  id: TeacherSoundPresetId;
  title: string;
  description: string;
  kind: "musik" | "natur" | "rum";
  musicAssetId?: TeacherSoundAssetId;
  ambienceAssetId?: TeacherSoundAssetId;
  available: boolean;
  unavailableReason?: string;
};

export const TEACHER_SOUND_STORAGE_KEY = "skolegps.teacher-sound.preferences.v1";
export const TEACHER_SOUND_CHANNEL_NAME = "skolegps.teacher-sound.v1";
export const TEACHER_SOUND_CLAIM_STORAGE_KEY = "skolegps.teacher-sound.claim.v1";

/**
 * Each playable source has a documented license and source in
 * docs/skolegps/teacher-sound-assets.md. Keep an unavailable preset out of
 * this registry rather than pointing it at an unreviewed placeholder.
 */
export const TEACHER_SOUND_ASSETS: Record<TeacherSoundAssetId, TeacherSoundAsset> = {
  afteraarsskov: {
    id: "afteraarsskov",
    label: "Efterårsskov",
    role: "natur",
    src: "/audio/teacher/afteraarsskov.mp3",
    loop: true,
    volume: 0.34,
    attribution: {
      text: "Forest Ambience — TinyWorlds",
      license: "CC0",
      sourceUrl: "https://opengameart.org/content/forest-ambience",
    },
  },
  "regn-ved-vinduet": {
    id: "regn-ved-vinduet",
    label: "Regn ved vinduet",
    role: "natur",
    src: "/audio/teacher/regn-ved-vinduet.mp3",
    loop: true,
    volume: 0.29,
    attribution: {
      text: "Rain against the window — cori",
      license: "Public domain",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg",
    },
  },
  "stille-klaver": {
    id: "stille-klaver",
    label: "Stille klaver",
    role: "musik",
    src: "/audio/teacher/stille-klaver.mp3",
    loop: true,
    volume: 0.24,
    attribution: {
      text: "Meditation Impromptu 01 — Kevin MacLeod (incompetech.com)",
      license: "CC BY 4.0",
      sourceUrl:
        "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100163",
    },
  },
  "papir-1": {
    id: "papir-1",
    label: "Papir 1",
    role: "materiale",
    src: "/audio/teacher/papir-1.mp3",
    loop: false,
    volume: 0.16,
    attribution: {
      text: "Book Flip Sounds — Voltiment555",
      license: "CC0",
      sourceUrl: "https://opengameart.org/content/book-flip-sounds",
    },
  },
  "papir-2": {
    id: "papir-2",
    label: "Papir 2",
    role: "materiale",
    src: "/audio/teacher/papir-2.mp3",
    loop: false,
    volume: 0.14,
    attribution: {
      text: "Book Flip Sounds — Voltiment555",
      license: "CC0",
      sourceUrl: "https://opengameart.org/content/book-flip-sounds",
    },
  },
  "papir-3": {
    id: "papir-3",
    label: "Papir 3",
    role: "materiale",
    src: "/audio/teacher/papir-3.mp3",
    loop: false,
    volume: 0.15,
    attribution: {
      text: "Book Flip Sounds — Voltiment555",
      license: "CC0",
      sourceUrl: "https://opengameart.org/content/book-flip-sounds",
    },
  },
};

export const TEACHER_SOUND_PRESETS: readonly TeacherSoundPreset[] = [
  {
    id: "afteraarsskov",
    title: "Efterårsskov",
    description: "Rolig skovbund med plads til koncentration.",
    kind: "natur",
    ambienceAssetId: "afteraarsskov",
    available: true,
  },
  {
    id: "regn-ved-vinduet",
    title: "Regn ved vinduet",
    description: "Jævn regn og vind mod ruden.",
    kind: "natur",
    ambienceAssetId: "regn-ved-vinduet",
    available: true,
  },
  {
    id: "stille-klaver",
    title: "Stille klaver",
    description: "Varm, instrumental klavermusik uden tale.",
    kind: "musik",
    musicAssetId: "stille-klaver",
    available: true,
  },
  {
    id: "bibliotekets-ro",
    title: "Bibliotekets ro",
    description: "Et stemmefrit læserum er ikke klar endnu.",
    kind: "rum",
    available: false,
    unavailableReason:
      "Afventer en rettighedsafklaret optagelse uden stemmer. Derfor kan den ikke afspilles endnu.",
  },
] as const;

export const TEACHER_SOUND_MATERIAL_ASSET_IDS: readonly TeacherSoundAssetId[] = [
  "papir-1",
  "papir-2",
  "papir-3",
] as const;

const PUBLIC_TEACHER_SUBROUTES = new Set([
  "/gdpr",
  "/hjaelp",
  "/it-afdelinger",
  "/manden-bag-skolegps",
  "/mobil-i-skolen",
  "/om",
  "/opdateringer",
  "/ophavsret",
  "/ophavsret/jura",
  "/ophavsret-podcast",
  "/privacy",
  "/priser",
  "/teknologi",
  "/laerervaerktoejer-preview",
  "/printpakker",
  "/projektvaerkstedet",
  "/vaerktojer/skak",
]);

export function getTeacherSoundPreset(id: TeacherSoundPresetId) {
  return TEACHER_SOUND_PRESETS.find((preset) => preset.id === id);
}

export function getTeacherSoundAsset(id: TeacherSoundAssetId) {
  return TEACHER_SOUND_ASSETS[id];
}

export function isTeacherSoundPublicSubroute(pathname: string) {
  return (
    PUBLIC_TEACHER_SUBROUTES.has(pathname) ||
    pathname.startsWith("/printpakker/") ||
    pathname.startsWith("/nyheder/")
  );
}

/**
 * The root player stays mounted for eligible internal navigation, but no
 * player is available on student, shared or live/projection routes.
 */
export function isTeacherSoundRoute(pathname: string) {
  if (pathname === "/" || isTeacherSoundPublicSubroute(pathname)) {
    return true;
  }

  if (!pathname.startsWith("/dashboard")) {
    return false;
  }

  return !(
    pathname.startsWith("/dashboard/live") ||
    pathname.startsWith("/dashboard/print") ||
    pathname.startsWith("/dashboard/resultater") ||
    pathname.startsWith("/dashboard/opret/musikquiz") ||
    pathname.includes("/tavle")
  );
}
