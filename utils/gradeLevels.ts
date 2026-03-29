export const GRADE_LEVEL_OPTIONS = [
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

export type GradeLevel = (typeof GRADE_LEVEL_OPTIONS)[number];

export const DEFAULT_SELECTED_GRADE_LEVELS: GradeLevel[] = ["4. klasse"];

export function isGradeLevel(value: unknown): value is GradeLevel {
  return GRADE_LEVEL_OPTIONS.includes(value as GradeLevel);
}

export function normalizeGradeLevels(value: unknown): GradeLevel[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const uniqueSelections = new Set<GradeLevel>();

  for (const candidate of values) {
    if (isGradeLevel(candidate)) {
      uniqueSelections.add(candidate);
    }
  }

  return GRADE_LEVEL_OPTIONS.filter((option) => uniqueSelections.has(option));
}

export function toggleGradeLevelSelection(
  currentSelections: readonly GradeLevel[],
  gradeLevel: GradeLevel
): GradeLevel[] {
  const normalizedSelections = normalizeGradeLevels(currentSelections);

  if (normalizedSelections.includes(gradeLevel)) {
    return normalizedSelections.filter((selection) => selection !== gradeLevel);
  }

  return normalizeGradeLevels([...normalizedSelections, gradeLevel]);
}

export function parseGradeLevelNumbers(gradeLevels: readonly string[]): number[] {
  return gradeLevels
    .map((gradeLevel) => {
      const match = gradeLevel.match(/(\d+)/);
      return match ? Number.parseInt(match[1] ?? "", 10) : null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

export function formatGradeLevelsForPrompt(gradeLevels: readonly string[]): string {
  const normalizedSelections = normalizeGradeLevels(gradeLevels);

  if (normalizedSelections.length === 0) {
    return "det valgte klassetrin";
  }

  const gradeNumbers = parseGradeLevelNumbers(normalizedSelections);

  if (gradeNumbers.length === normalizedSelections.length) {
    const formattedNumbers = gradeNumbers.map((gradeNumber) => `${gradeNumber}.`);

    if (formattedNumbers.length === 1) {
      return `${formattedNumbers[0]} klasse`;
    }

    if (formattedNumbers.length === 2) {
      return `${formattedNumbers[0]} og ${formattedNumbers[1]} klasse`;
    }

    return `${formattedNumbers.slice(0, -1).join(", ")} og ${formattedNumbers.at(-1)} klasse`;
  }

  if (normalizedSelections.length === 1) {
    return normalizedSelections[0];
  }

  if (normalizedSelections.length === 2) {
    return `${normalizedSelections[0]} og ${normalizedSelections[1]}`;
  }

  return `${normalizedSelections.slice(0, -1).join(", ")} og ${normalizedSelections.at(-1)}`;
}

export function formatGradeLevelBadge(gradeLevel: string): string {
  const match = gradeLevel.match(/(\d+)/);
  return match ? `${match[1]}. kl` : gradeLevel;
}

export function getGradeLevelRange(gradeLevels: readonly string[]) {
  const gradeNumbers = parseGradeLevelNumbers(gradeLevels);

  if (gradeNumbers.length === 0) {
    return {
      lowestGrade: null,
      highestGrade: null,
      representativeGrade: null,
    };
  }

  const lowestGrade = Math.min(...gradeNumbers);
  const highestGrade = Math.max(...gradeNumbers);
  const representativeGrade = Math.round((lowestGrade + highestGrade) / 2);

  return {
    lowestGrade,
    highestGrade,
    representativeGrade,
  };
}
