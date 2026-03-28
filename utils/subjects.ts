export const BUILDER_SUBJECTS = [
  "Dansk",
  "Matematik",
  "Engelsk",
  "Natur/Teknologi",
  "Historie",
  "Idræt",
  "Kristendomskundskab",
  "Tysk",
  "Fransk",
  "Geografi",
  "Biologi",
  "Fysik/Kemi",
  "Samfundsfag",
  "Håndværk/Design",
  "Billedkunst",
  "Madkundskab",
  "Musik",
] as const;

export const ARCHIVE_SUBJECT_FILTER_OPTIONS = ["Alle", ...BUILDER_SUBJECTS] as const;

export type BuilderSubject = (typeof BUILDER_SUBJECTS)[number];
export type ArchiveSubjectFilterOption = (typeof ARCHIVE_SUBJECT_FILTER_OPTIONS)[number];
