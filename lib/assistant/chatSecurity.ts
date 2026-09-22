import { createHmac } from "node:crypto";

export const ASSISTANT_MAX_REQUEST_BYTES = 16_000;
export const ASSISTANT_MAX_TURNS = 8;
export const ASSISTANT_MAX_MESSAGE_CHARS = 1_600;
export const ASSISTANT_MAX_TOTAL_CHARS = 9_600;
export const ASSISTANT_MAX_OUTPUT_TOKENS = 420;

type AssistantChatRole = "user" | "assistant";

export type AssistantModelMessage = {
  role: AssistantChatRole;
  content: string;
};

export type AssistantChatRequest = {
  messages: AssistantModelMessage[];
  pathname: string;
  routeContext: string;
};

export type AssistantChatRequestErrorCode =
  | "ASSISTANT_INVALID_CONTENT_TYPE"
  | "ASSISTANT_INVALID_CONTENT_LENGTH"
  | "ASSISTANT_REQUEST_TOO_LARGE"
  | "ASSISTANT_INVALID_JSON"
  | "ASSISTANT_INVALID_PAYLOAD"
  | "ASSISTANT_UNKNOWN_ROUTE"
  | "ASSISTANT_TOO_MANY_TURNS"
  | "ASSISTANT_UNSUPPORTED_ROLE"
  | "ASSISTANT_UNSUPPORTED_MESSAGE_PART"
  | "ASSISTANT_MESSAGE_TOO_LARGE"
  | "ASSISTANT_EMPTY_MESSAGE";

export class AssistantChatRequestError extends Error {
  readonly code: AssistantChatRequestErrorCode;
  readonly status: 400 | 413 | 415;

  constructor(
    code: AssistantChatRequestErrorCode,
    status: 400 | 413 | 415 = 400,
  ) {
    super(code);
    this.name = "AssistantChatRequestError";
    this.code = code;
    this.status = status;
  }
}

type RouteDefinition = {
  context: string;
  pattern: RegExp;
};

const ROUTE_DEFINITIONS: readonly RouteDefinition[] = [
  {
    pattern: /^\/$/,
    context:
      "Aktuel side: SkoleGPS-forsiden. Start med den mest relevante lærerrettede vej videre.",
  },
  {
    pattern: /^\/dashboard$/,
    context:
      "Aktuel side: lærerens dashboard. Hjælp med at vælge et enkelt næste skridt.",
  },
  {
    pattern: /^\/dashboard\/arkiv$/,
    context:
      "Aktuel side: lærerens arkiv. Hjælp kort med at finde eller genbruge et tidligere løb.",
  },
  {
    pattern: /^\/dashboard\/indstillinger$/,
    context:
      "Aktuel side: indstillinger. Giv kun generel vejledning og henvis til support ved konto- eller adgangsproblemer.",
  },
  {
    pattern: /^\/dashboard\/laerervaerktoejer$/,
    context:
      "Aktuel side: Lærerværktøjer. Hjælp med at vælge det værktøj, der matcher lærerens opgave.",
  },
  {
    pattern: /^\/dashboard\/laerervaerktoejer\/skak$/,
    context: "Aktuel side: Skak under Lærerværktøjer.",
  },
  {
    pattern: /^\/dashboard\/laerervaerktoejer\/oevekort(?:\/(?:print|tavle))?$/,
    context: "Aktuel side: Øvekort under Lærerværktøjer.",
  },
  {
    pattern: /^\/dashboard\/laerervaerktoejer\/skemapilot$/,
    context: "Aktuel side: SkemaPilot under Lærerværktøjer.",
  },
  {
    pattern: /^\/dashboard\/laerervaerktoejer\/aarsplan-generator$/,
    context: "Aktuel side: Årsplan-generator under Lærerværktøjer.",
  },
  {
    pattern: /^\/dashboard\/mobilspil$/,
    context: "Aktuel side: Mobilspil.",
  },
  {
    pattern: /^\/dashboard\/mobilspil\/find-bedrageren$/,
    context: "Aktuel side: Find Bedrageren.",
  },
  {
    pattern: /^\/dashboard\/opret$/,
    context: "Aktuel side: Opret nyt GPS-løb.",
  },
  {
    pattern: /^\/dashboard\/opret\/valg$/,
    context:
      "Aktuel side: valg af, hvordan læreren vil starte et nyt GPS-løb.",
  },
  {
    pattern:
      /^\/dashboard\/opret\/(?:dansk|engelsk|escape|find-bedrageren|foto|lynbygger|manuel|matematik|musikquiz|podcast|rollespil|scanner|selfie|stratego|zone-krig)$/,
    context:
      "Aktuel side: en kendt GPS-løb-builder. Hjælp med et kort næste skridt uden at opfinde builderfunktioner.",
  },
  {
    pattern: /^\/dashboard\/opret\/stjerneloeb(?:\/bibliotek(?:\/[a-z0-9-]{1,64})?)?$/,
    context: "Aktuel side: Stjerneløb-builderen eller dens bibliotek.",
  },
  {
    pattern: /^\/dashboard\/admin(?:\/(?:logs|stjerneloeb-upload))?$/,
    context:
      "Aktuel side: en administrativ lærerside. Hjælp kun med generel produktvejledning og henvis til support ved tekniske eller adgangsrelaterede problemer.",
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function fail(
  code: AssistantChatRequestErrorCode,
  status: 400 | 413 | 415 = 400,
): never {
  throw new AssistantChatRequestError(code, status);
}

function getTextPartText(part: Record<string, unknown>): string {
  if (!hasOnlyKeys(part, ["type", "text", "state"])) {
    return fail("ASSISTANT_UNSUPPORTED_MESSAGE_PART");
  }

  if (typeof part.text !== "string") {
    return fail("ASSISTANT_UNSUPPORTED_MESSAGE_PART");
  }

  if (
    part.state !== undefined &&
    part.state !== "streaming" &&
    part.state !== "done"
  ) {
    return fail("ASSISTANT_UNSUPPORTED_MESSAGE_PART");
  }

  return part.text.trim();
}

function parseMessage(
  value: unknown,
  index: number,
): AssistantModelMessage | null {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ["id", "role", "parts"])) {
    return fail("ASSISTANT_INVALID_PAYLOAD");
  }

  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 160 ||
    typeof value.role !== "string" ||
    !Array.isArray(value.parts)
  ) {
    return fail("ASSISTANT_INVALID_PAYLOAD");
  }

  if (value.role !== "user" && value.role !== "assistant") {
    return fail("ASSISTANT_UNSUPPORTED_ROLE");
  }

  if (index === 0 && value.role !== "user") {
    return fail("ASSISTANT_UNSUPPORTED_ROLE");
  }

  const textParts: string[] = [];
  for (const part of value.parts) {
    if (!isPlainObject(part) || typeof part.type !== "string") {
      return fail("ASSISTANT_UNSUPPORTED_MESSAGE_PART");
    }

    if (part.type === "text") {
      textParts.push(getTextPartText(part));
      continue;
    }

    if (part.type === "step-start" && value.role === "assistant") {
      if (!hasOnlyKeys(part, ["type"])) {
        return fail("ASSISTANT_UNSUPPORTED_MESSAGE_PART");
      }
      continue;
    }

    return fail("ASSISTANT_UNSUPPORTED_MESSAGE_PART");
  }

  const content = textParts.filter(Boolean).join("\n");
  if (!content) {
    if (value.role === "assistant") return null;
    return fail("ASSISTANT_EMPTY_MESSAGE");
  }

  if (content.length > ASSISTANT_MAX_MESSAGE_CHARS) {
    return fail("ASSISTANT_MESSAGE_TOO_LARGE", 413);
  }

  return { role: value.role, content };
}

export function resolveAssistantRouteContext(pathname: unknown): string | null {
  if (
    typeof pathname !== "string" ||
    pathname.length === 0 ||
    pathname.length > 180 ||
    !pathname.startsWith("/") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    pathname.includes("\\") ||
    pathname.includes("\u0000")
  ) {
    return null;
  }

  return (
    ROUTE_DEFINITIONS.find((definition) => definition.pattern.test(pathname))
      ?.context ?? null
  );
}

export function parseAssistantChatPayload(value: unknown): AssistantChatRequest {
  if (!isPlainObject(value) || !hasOnlyKeys(value, ["messages", "pathname"])) {
    return fail("ASSISTANT_INVALID_PAYLOAD");
  }

  if (!Array.isArray(value.messages)) {
    return fail("ASSISTANT_INVALID_PAYLOAD");
  }

  if (value.messages.length === 0) {
    return fail("ASSISTANT_EMPTY_MESSAGE");
  }

  if (value.messages.length > ASSISTANT_MAX_TURNS) {
    return fail("ASSISTANT_TOO_MANY_TURNS", 413);
  }

  const routeContext = resolveAssistantRouteContext(value.pathname);
  if (!routeContext || typeof value.pathname !== "string") {
    return fail("ASSISTANT_UNKNOWN_ROUTE");
  }

  if (value.messages[value.messages.length - 1]?.role !== "user") {
    return fail("ASSISTANT_UNSUPPORTED_ROLE");
  }

  const messages = value.messages
    .map((message, index) => parseMessage(message, index))
    .filter((message): message is AssistantModelMessage => message !== null);

  const totalCharacters = messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  if (totalCharacters > ASSISTANT_MAX_TOTAL_CHARS) {
    return fail("ASSISTANT_MESSAGE_TOO_LARGE", 413);
  }

  if (!messages.some((message) => message.role === "user")) {
    return fail("ASSISTANT_EMPTY_MESSAGE");
  }

  return {
    messages,
    pathname: value.pathname,
    routeContext,
  };
}

async function readLimitedRequestText(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > ASSISTANT_MAX_REQUEST_BYTES) {
      return fail("ASSISTANT_INVALID_CONTENT_LENGTH", 413);
    }
  }

  if (!request.body) {
    return fail("ASSISTANT_INVALID_JSON");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > ASSISTANT_MAX_REQUEST_BYTES) {
        await reader.cancel();
        return fail("ASSISTANT_REQUEST_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("ASSISTANT_INVALID_JSON");
  }
}

export async function readAssistantChatRequest(
  request: Request,
): Promise<AssistantChatRequest> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return fail("ASSISTANT_INVALID_CONTENT_TYPE", 415);
  }

  const rawBody = await readLimitedRequestText(request);
  try {
    return parseAssistantChatPayload(JSON.parse(rawBody) as unknown);
  } catch (error) {
    if (error instanceof AssistantChatRequestError) throw error;
    return fail("ASSISTANT_INVALID_JSON");
  }
}

function getRequestAddress(request: Request): string {
  const headerValues = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ];

  for (const headerValue of headerValues) {
    const address = headerValue?.split(",", 1)[0]?.trim() ?? "";
    if (address && address.length <= 256 && !/[\r\n]/.test(address)) {
      return address;
    }
  }

  return "";
}

/**
 * Uses a UTC-day HMAC so the database never receives an address or a durable
 * cross-day identifier. A dedicated secret wins; the existing server-only
 * Supabase service key is a domain-separated fallback. Missing both fails
 * closed.
 */
export function createAssistantRateLimitFingerprint(
  request: Request,
  now = new Date(),
): string | null {
  const secret =
    process.env.ASSISTANT_RATE_LIMIT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  const address = getRequestAddress(request);
  if (!secret || !address || Number.isNaN(now.getTime())) return null;

  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", secret)
    .update(`skolegps-assistant-rate-limit:v1:${day}:${address}`, "utf8")
    .digest("hex");
}
