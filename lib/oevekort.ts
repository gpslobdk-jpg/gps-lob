export const OEVEKORT_OWNER_PATH = "/dashboard/laerervaerktoejer/oevekort";
export const OEVEKORT_PUBLIC_SHARE_PATH = "/oevekort/del";

export const OEVEKORT_MAX_TITLE_LENGTH = 120;
export const OEVEKORT_MAX_CARD_TEXT_LENGTH = 1_000;
export const OEVEKORT_MAX_ALTERNATIVE_ANSWER_LENGTH = 250;
export const OEVEKORT_MAX_ALTERNATIVE_ANSWERS = 12;
export const OEVEKORT_MAX_CARDS_PER_SET = 200;
export const OEVEKORT_MAX_IMPORT_CHARACTERS = 200_000;

const OEVEKORT_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OEVEKORT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type OevekortCardInput = {
  front: string;
  back: string;
  acceptedAnswers: string[];
};

export type OevekortSetInput = {
  title: string;
  cards: OevekortCardInput[];
};

export type OevekortValidationError = {
  field: string;
  message: string;
};

export type OevekortValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: OevekortValidationError[] };

export type OevekortImportDelimiter = "tab" | "semicolon";

export type OevekortImportResult =
  | {
      ok: true;
      delimiter: OevekortImportDelimiter;
      cards: OevekortCardInput[];
    }
  | { ok: false; errors: OevekortValidationError[] };

export type OevekortFlashRating = "known" | "again";

/**
 * Keeps editor ordering local until the regular set save occurs. The helper is
 * deliberately generic so it never adds UI-only data to a persisted card.
 */
export function moveOevekortItem<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number
) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items];
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  if (item === undefined) return nextItems;
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

/**
 * Advances the private, in-browser flashcard queue. "Again" moves the
 * current card to the end; no learner choice or queue is persisted or sent.
 */
export function advanceOevekortFlashQueue(
  cardIds: readonly string[],
  rating: OevekortFlashRating
) {
  if (!cardIds.length) return [];
  if (rating === "known") return cardIds.slice(1);
  if (cardIds.length === 1) return [...cardIds];
  return [...cardIds.slice(1), cardIds[0]!];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function countCharacters(value: string) {
  return Array.from(value).length;
}

function cleanText(value: string, singleLine: boolean) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return singleLine ? normalized.replace(/\s+/gu, " ") : normalized;
}

function parseRequiredText(
  value: unknown,
  options: {
    field: string;
    label: string;
    maxLength: number;
    singleLine?: boolean;
  }
): OevekortValidationResult<string> {
  if (typeof value !== "string") {
    return {
      ok: false,
      errors: [{ field: options.field, message: `${options.label} mangler.` }],
    };
  }

  const text = cleanText(value, Boolean(options.singleLine));
  if (!text) {
    return {
      ok: false,
      errors: [{ field: options.field, message: `${options.label} må ikke være tom.` }],
    };
  }

  if (UNSAFE_TEXT_CONTROL_PATTERN.test(text)) {
    return {
      ok: false,
      errors: [
        {
          field: options.field,
          message: `${options.label} indeholder ugyldige kontroltegn.`,
        },
      ],
    };
  }

  if (countCharacters(text) > options.maxLength) {
    return {
      ok: false,
      errors: [
        {
          field: options.field,
          message: `${options.label} må højst være ${options.maxLength} tegn.`,
        },
      ],
    };
  }

  return { ok: true, value: text };
}

export function normalizeOevekortAnswerForComparison(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("da-DK");
}

function parseAcceptedAnswers(
  value: unknown,
  cardIndex: number,
  back: string
): OevekortValidationResult<string[]> {
  if (value === undefined) return { ok: true, value: [] };

  if (!Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        {
          field: `cards[${cardIndex}].acceptedAnswers`,
          message: "Alternative svar skal være en liste.",
        },
      ],
    };
  }

  if (value.length > OEVEKORT_MAX_ALTERNATIVE_ANSWERS) {
    return {
      ok: false,
      errors: [
        {
          field: `cards[${cardIndex}].acceptedAnswers`,
          message: `Der må højst være ${OEVEKORT_MAX_ALTERNATIVE_ANSWERS} alternative svar pr. kort.`,
        },
      ],
    };
  }

  const errors: OevekortValidationError[] = [];
  const answers: string[] = [];
  const seen = new Set([normalizeOevekortAnswerForComparison(back)]);

  value.forEach((candidate, answerIndex) => {
    const parsed = parseRequiredText(candidate, {
      field: `cards[${cardIndex}].acceptedAnswers[${answerIndex}]`,
      label: "Det alternative svar",
      maxLength: OEVEKORT_MAX_ALTERNATIVE_ANSWER_LENGTH,
      singleLine: true,
    });

    if (!parsed.ok) {
      errors.push(...parsed.errors);
      return;
    }

    const comparable = normalizeOevekortAnswerForComparison(parsed.value);
    if (!seen.has(comparable)) {
      seen.add(comparable);
      answers.push(parsed.value);
    }
  });

  return errors.length ? { ok: false, errors } : { ok: true, value: answers };
}

export function parseOevekortCardInput(
  value: unknown,
  cardIndex = 0
): OevekortValidationResult<OevekortCardInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [
        {
          field: `cards[${cardIndex}]`,
          message: "Kortet skal have en forside og en bagside.",
        },
      ],
    };
  }

  const front = parseRequiredText(value.front, {
    field: `cards[${cardIndex}].front`,
    label: "Forsiden",
    maxLength: OEVEKORT_MAX_CARD_TEXT_LENGTH,
  });
  const back = parseRequiredText(value.back, {
    field: `cards[${cardIndex}].back`,
    label: "Bagsiden",
    maxLength: OEVEKORT_MAX_CARD_TEXT_LENGTH,
  });

  const errors: OevekortValidationError[] = [
    ...(front.ok ? [] : front.errors),
    ...(back.ok ? [] : back.errors),
  ];

  if (!front.ok || !back.ok) {
    return { ok: false, errors };
  }

  const acceptedAnswers = parseAcceptedAnswers(
    value.acceptedAnswers,
    cardIndex,
    back.value
  );
  if (!acceptedAnswers.ok) {
    return { ok: false, errors: acceptedAnswers.errors };
  }

  return {
    ok: true,
    value: {
      front: front.value,
      back: back.value,
      acceptedAnswers: acceptedAnswers.value,
    },
  };
}

export function parseOevekortSetInput(
  value: unknown
): OevekortValidationResult<OevekortSetInput> {
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [{ field: "form", message: "Sættet kunne ikke læses." }],
    };
  }

  const title = parseRequiredText(value.title, {
    field: "title",
    label: "Titlen",
    maxLength: OEVEKORT_MAX_TITLE_LENGTH,
    singleLine: true,
  });
  const errors: OevekortValidationError[] = title.ok ? [] : title.errors;

  if (!Array.isArray(value.cards)) {
    errors.push({ field: "cards", message: "Tilføj mindst ét kort." });
  } else if (
    value.cards.length < 1 ||
    value.cards.length > OEVEKORT_MAX_CARDS_PER_SET
  ) {
    errors.push({
      field: "cards",
      message: `Et sæt skal have mellem 1 og ${OEVEKORT_MAX_CARDS_PER_SET} kort.`,
    });
  } else {
    value.cards.forEach((card, index) => {
      const parsed = parseOevekortCardInput(card, index);
      if (!parsed.ok) errors.push(...parsed.errors);
    });
  }

  if (errors.length || !title.ok || !Array.isArray(value.cards)) {
    return { ok: false, errors };
  }

  const cards = value.cards.map((card, index) => {
    const parsed = parseOevekortCardInput(card, index);
    if (!parsed.ok) {
      throw new Error("Validated Øvekort data could not be parsed.");
    }
    return parsed.value;
  });

  return { ok: true, value: { title: title.value, cards } };
}

export function parseOevekortImport(
  value: unknown,
  delimiter?: OevekortImportDelimiter
): OevekortImportResult {
  if (typeof value !== "string") {
    return {
      ok: false,
      errors: [{ field: "import", message: "Indsæt tekst med to kolonner." }],
    };
  }

  const text = value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (text.length > OEVEKORT_MAX_IMPORT_CHARACTERS) {
    return {
      ok: false,
      errors: [
        {
          field: "import",
          message: "Importen er for stor. Del den op i mindre sæt.",
        },
      ],
    };
  }

  const rows = text
    .split("\n")
    .map((row, index) => ({ row, lineNumber: index + 1 }))
    .filter(({ row }) => row.trim().length > 0);

  if (!rows.length) {
    return {
      ok: false,
      errors: [{ field: "import", message: "Importen er tom." }],
    };
  }

  const selectedDelimiter =
    delimiter ?? (rows.some(({ row }) => row.includes("\t")) ? "tab" : "semicolon");
  const separator = selectedDelimiter === "tab" ? "\t" : ";";
  const separatorName = selectedDelimiter === "tab" ? "en tabulator" : "et semikolon";
  const errors: OevekortValidationError[] = [];
  const cards: OevekortCardInput[] = [];

  if (rows.length > OEVEKORT_MAX_CARDS_PER_SET) {
    errors.push({
      field: "import",
      message: `Et sæt må højst have ${OEVEKORT_MAX_CARDS_PER_SET} kort.`,
    });
  }

  rows.forEach(({ row, lineNumber }, index) => {
    const columns = row.split(separator);
    if (columns.length !== 2) {
      errors.push({
        field: `import.line.${lineNumber}`,
        message: `Linje ${lineNumber} skal have præcis to kolonner adskilt med ${separatorName}.`,
      });
      return;
    }

    const parsed = parseOevekortCardInput(
      { front: columns[0], back: columns[1] },
      index
    );
    if (!parsed.ok) {
      errors.push(
        ...parsed.errors.map((error) => ({
          ...error,
          field: `import.line.${lineNumber}`,
        }))
      );
      return;
    }
    cards.push(parsed.value);
  });

  return errors.length
    ? { ok: false, errors }
    : { ok: true, delimiter: selectedDelimiter, cards };
}

export function compareOevekortAnswer(
  answer: unknown,
  card: Pick<OevekortCardInput, "back" | "acceptedAnswers">
) {
  const normalizedAnswer = normalizeOevekortAnswerForComparison(answer);
  const acceptedAnswers = [card.back, ...card.acceptedAnswers];
  const matchedAnswer = acceptedAnswers.find(
    (candidate) =>
      normalizeOevekortAnswerForComparison(candidate) === normalizedAnswer
  );

  return {
    correct: Boolean(normalizedAnswer && matchedAnswer),
    correctAnswer: card.back,
    normalizedAnswer,
  };
}

export function isOevekortUuid(value: unknown): value is string {
  return typeof value === "string" && OEVEKORT_UUID_PATTERN.test(value);
}

export function normalizeOevekortShareToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  return OEVEKORT_SHARE_TOKEN_PATTERN.test(token) ? token : null;
}

export function buildOevekortShareLink(origin: string, tokenValue: unknown) {
  const token = normalizeOevekortShareToken(tokenValue);
  if (!token) return null;

  try {
    const url = new URL(OEVEKORT_PUBLIC_SHARE_PATH, new URL(origin).origin);
    url.hash = token;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseOevekortShareExpiry(
  value: unknown,
  now = new Date()
):
  | { ok: true; value: string | null }
  | { ok: false; error: OevekortValidationError } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
    return {
      ok: false,
      error: {
        field: "expiresAt",
        message: "Udløbstidspunktet skal være en gyldig dato og et gyldigt klokkeslæt.",
      },
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: {
        field: "expiresAt",
        message: "Udløbstidspunktet skal ligge i fremtiden.",
      },
    };
  }

  return { ok: true, value: parsed.toISOString() };
}
