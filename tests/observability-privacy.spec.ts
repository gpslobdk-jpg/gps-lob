import { expect, test } from "@playwright/test";

import {
  CIRCULAR_OBSERVABILITY_VALUE,
  REDACTED_OBSERVABILITY_VALUE,
  TRUNCATED_OBSERVABILITY_VALUE,
  UNSANITIZABLE_OBSERVABILITY_VALUE,
  sanitizeObservabilityData,
  sanitizeObservabilityObject,
  sanitizeSentryEvent,
} from "../lib/observability/privacy";

test.describe("observability privacy sanitizer", () => {
  test("replaces a direct self-reference without throwing", () => {
    const input: Record<string, unknown> = {
      message: "safe message",
    };
    input.self = input;

    const sanitized = sanitizeObservabilityData(input) as Record<
      string,
      unknown
    >;

    expect(sanitized).not.toBe(input);
    expect(sanitized.message).toBe("safe message");
    expect(sanitized.self).toBe(CIRCULAR_OBSERVABILITY_VALUE);
  });

  test("replaces mutually referential objects without throwing", () => {
    const first: Record<string, unknown> = { label: "first" };
    const second: Record<string, unknown> = { label: "second" };
    first.second = second;
    second.first = first;

    const sanitized = sanitizeObservabilityData(first) as {
      second: { first: unknown };
    };

    expect(sanitized.second.first).toBe(CIRCULAR_OBSERVABILITY_VALUE);
  });

  test("replaces circular array entries without throwing", () => {
    const input: unknown[] = ["safe"];
    input.push(input);

    const sanitized = sanitizeObservabilityData(input) as unknown[];

    expect(sanitized).toEqual(["safe", CIRCULAR_OBSERVABILITY_VALUE]);
  });

  test("truncates extremely deep alternating objects and arrays", () => {
    const input: Record<string, unknown> = {};
    let cursor: Record<string, unknown> | unknown[] = input;

    for (let index = 0; index < 10_000; index += 1) {
      if (Array.isArray(cursor)) {
        const next: Record<string, unknown> = {};
        cursor.push(next);
        cursor = next;
      } else {
        const next: unknown[] = [];
        cursor.next = next;
        cursor = next;
      }
    }

    const sanitized = sanitizeObservabilityData(input);

    expect(JSON.stringify(sanitized)).toContain(
      TRUNCATED_OBSERVABILITY_VALUE
    );
  });

  test("bounds oversized collections and strings", () => {
    const sanitizedArray = sanitizeObservabilityData(
      Array.from({ length: 1_000 }, (_, index) => `value-${index}`)
    ) as unknown[];
    const sanitizedObject = sanitizeObservabilityData(
      Object.fromEntries(
        Array.from({ length: 1_000 }, (_, index) => [
          `field-${index}`,
          index,
        ])
      )
    ) as Record<string, unknown>;

    expect(sanitizedArray).toHaveLength(251);
    expect(sanitizedArray.at(-1)).toBe(TRUNCATED_OBSERVABILITY_VALUE);
    expect(Object.keys(sanitizedObject)).toHaveLength(251);
    expect(sanitizedObject.__truncated__).toBe(
      TRUNCATED_OBSERVABILITY_VALUE
    );
    expect(sanitizeObservabilityData("x".repeat(25_000))).toBe(
      TRUNCATED_OBSERVABILITY_VALUE
    );
  });

  test("sanitizes repeated non-circular references independently", () => {
    const shared = {
      url: "https://gpslob.dk/join?pin=ABC123",
    };

    const sanitized = sanitizeObservabilityData({
      first: shared,
      second: shared,
    }) as {
      first: { url: string };
      second: { url: string };
    };

    expect(sanitized.first).toEqual({ url: "https://gpslob.dk/join" });
    expect(sanitized.second).toEqual(sanitized.first);
    expect(sanitized.first).not.toBe(sanitized.second);
  });

  test("strips normal URL queries and Facebook fbclid referers", () => {
    const sanitized = sanitizeObservabilityData({
      request: {
        url: "https://gpslob.dk/join?pin=ABC123#name",
        headers: {
          Referer:
            "https://l.facebook.com/l.php?u=https%3A%2F%2Fgpslob.dk%2Fjoin&fbclid=secret-click-id",
        },
      },
    }) as {
      request: {
        url: string;
        headers: { Referer: string };
      };
    };

    expect(sanitized.request.url).toBe("https://gpslob.dk/join");
    expect(sanitized.request.headers.Referer).toBe(
      "https://l.facebook.com/l.php"
    );
    expect(JSON.stringify(sanitized)).not.toContain("fbclid");
    expect(JSON.stringify(sanitized)).not.toContain("secret-click-id");
  });

  test("preserves the existing key, token, identifier, and location rules", () => {
    const sanitized = sanitizeObservabilityData({
      email: "elev@example.com",
      Authorization: "Bearer secret-token",
      requestUrl: "https://gpslob.dk/play/11111111-2222-4333-8444-555555555555?answer=yes",
      message:
        "participant_id=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee join_code=ABC123 latitude=55.6761",
      coordinates: {
        lat: 55.6761,
        lng: 12.5683,
      },
    }) as Record<string, unknown>;
    const serialized = JSON.stringify(sanitized);

    expect(sanitized.email).toBe(REDACTED_OBSERVABILITY_VALUE);
    expect(sanitized.Authorization).toBe(REDACTED_OBSERVABILITY_VALUE);
    expect(sanitized.coordinates).toEqual({
      lat: REDACTED_OBSERVABILITY_VALUE,
      lng: REDACTED_OBSERVABILITY_VALUE,
    });
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain(
      "11111111-2222-4333-8444-555555555555"
    );
    expect(serialized).not.toContain(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    );
    expect(serialized).not.toContain("ABC123");
    expect(serialized).not.toContain("55.6761");
    expect(serialized).not.toContain("12.5683");
  });

  test("fails closed for roots that cannot be inspected", () => {
    const revocable = Proxy.revocable<Record<string, unknown>>({}, {});
    revocable.revoke();

    expect(sanitizeObservabilityData(revocable.proxy)).toBe(
      UNSANITIZABLE_OBSERVABILITY_VALUE
    );
    expect(sanitizeObservabilityObject(revocable.proxy)).toBeNull();
    expect(sanitizeSentryEvent(revocable.proxy)).toBeNull();
  });

  test("does not invoke throwing accessors", () => {
    const input = Object.defineProperty({}, "dangerous", {
      enumerable: true,
      get() {
        throw new Error("must not be invoked");
      },
    });

    expect(sanitizeObservabilityData(input)).toEqual({
      dangerous: UNSANITIZABLE_OBSERVABILITY_VALUE,
    });
  });
});
