import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  buildSafeLynbyggerErrorMetadata,
  classifyLynbyggerGenerationPhase,
  logLynbyggerPipelineError,
} from "../lib/lynbyggerObservability";

const context = {
  pipelinePhase: "reviewer" as const,
  model: "gpt-5.4-mini-2026-03-17",
  operation: "openai.responses.parse",
  correlationId: "c9ac6cef-fc63-41cb-b6e5-7dadb28c3612",
};

test.describe("Lynbygger provider-observability", () => {
  test("udtrækker kun allowlistede metadata fra AI_RetryError.lastError", () => {
    const lastError = Object.assign(new Error("providertekst må ikke logges"), {
      name: "AI_APICallError",
      statusCode: 429,
      responseHeaders: { "x-request-id": "req_quota789" },
      data: {
        error: {
          code: "insufficient_quota",
          type: "insufficient_quota",
        },
      },
      modelId: "gpt-4o-mini",
      operationName: "chat.completions.create",
    });
    const retryError = Object.assign(new Error("retrytekst må ikke logges"), {
      name: "AI_RetryError",
      reason: "maxRetriesExceeded",
      errors: [lastError, lastError, lastError],
      lastError,
    });

    expect(
      buildSafeLynbyggerErrorMetadata(retryError, {
        ...context,
        pipelinePhase: "candidate_generation",
        model: "gpt-4o-mini",
        operation: "ai.generateObject",
      }),
    ).toEqual({
      pipelinePhase: "candidate_generation",
      errorName: "AI_RetryError",
      retryReason: "maxRetriesExceeded",
      providerAttemptCount: 3,
      nestedErrorName: "AI_APICallError",
      providerStatus: 429,
      providerCode: "insufficient_quota",
      providerType: "insufficient_quota",
      providerRequestId: "req_quota789",
      providerModel: "gpt-4o-mini",
      providerOperation: "chat.completions.create",
      model: "gpt-4o-mini",
      operation: "ai.generateObject",
      correlationId: context.correlationId,
    });
  });

  test("bestemmer antal providerforsøg fra errors-array uden at læse fejlindholdet", () => {
    const retryError = {
      name: "AI_RetryError",
      reason: "errorNotRetryable",
      errors: [
        { message: "første private fejl" },
        { name: "AI_APICallError", status: "503", message: "anden private fejl" },
      ],
    };

    const metadata = buildSafeLynbyggerErrorMetadata(retryError, {
      ...context,
      pipelinePhase: "candidate_generation",
    });

    expect(metadata).toMatchObject({
      errorName: "AI_RetryError",
      retryReason: "errorNotRetryable",
      providerAttemptCount: 2,
      nestedErrorName: "AI_APICallError",
      providerStatus: 503,
    });
    expect(JSON.stringify(metadata)).not.toContain("private fejl");
  });

  test("AI_RetryError logger aldrig nested message, body, prompt, secrets eller persondata", () => {
    const forbidden = [
      "sk-proj-nested-secret",
      "Lav et løb om hemmelige vulkaner",
      "fortroligt AI-output",
      "laerer-nested@example.dk",
      "nested-user-456",
    ];
    const providerError = Object.assign(new Error(forbidden[1]), {
      name: "AI_APICallError",
      statusCode: 429,
      requestID: "req_nestedSafe123",
      requestBodyValues: { prompt: forbidden[1], apiKey: forbidden[0] },
      responseBody: forbidden[2],
      body: { output: forbidden[2], email: forbidden[3] },
      errorCode: forbidden[0],
      modelId: forbidden[0],
      cause: {
        message: forbidden.join(" | "),
        apiKey: forbidden[0],
        userId: forbidden[4],
        data: { error: { code: "insufficient_quota", type: "requests" } },
      },
    });
    const retryError = Object.assign(new Error(forbidden.join(" | ")), {
      name: "AI_RetryError",
      reason: "maxRetriesExceeded",
      errors: [providerError],
      lastError: providerError,
    });
    const calls: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => calls.push(args);

    try {
      logLynbyggerPipelineError(retryError, {
        ...context,
        pipelinePhase: "candidate_generation",
      });
    } finally {
      console.error = originalConsoleError;
    }

    const serializedLog = JSON.stringify(calls);
    for (const value of forbidden) {
      expect(serializedLog).not.toContain(value);
    }
    expect(serializedLog).not.toContain("requestBodyValues");
    expect(serializedLog).not.toContain("responseBody");
    expect(serializedLog).not.toContain("message");
    expect(serializedLog).toContain("insufficient_quota");
    expect(serializedLog).toContain("req_nestedSafe123");
  });

  test("logger fase og allowlistede provider-metadata", () => {
    const error = Object.assign(new Error("må ikke logges"), {
      statusCode: 429,
      requestID: "req_provider123",
      data: {
        error: {
          code: "rate_limit_exceeded",
          type: "requests",
        },
      },
    });

    expect(buildSafeLynbyggerErrorMetadata(error, context)).toEqual({
      pipelinePhase: "reviewer",
      errorName: "Error",
      providerStatus: 429,
      providerCode: "rate_limit_exceeded",
      providerType: "requests",
      providerRequestId: "req_provider123",
      model: "gpt-5.4-mini-2026-03-17",
      operation: "openai.responses.parse",
      correlationId: "c9ac6cef-fc63-41cb-b6e5-7dadb28c3612",
    });
  });

  test("logger aldrig secrets, prompts, output eller persondata", () => {
    const forbidden = [
      "sk-proj-super-secret",
      "Lav et matematikløb om brøker",
      "hemmeligt AI-output",
      "laerer@example.dk",
      "user-123-persondata",
      "session-cookie-token",
    ];
    const error = Object.assign(new Error(forbidden.join(" | ")), {
      statusCode: 400,
      requestID: "req_safe456",
      responseBody: forbidden[2],
      requestBodyValues: { prompt: forbidden[1] },
      headers: { authorization: `Bearer ${forbidden[0]}` },
      data: {
        prompt: forbidden[1],
        output: forbidden[2],
        email: forbidden[3],
        userId: forbidden[4],
        cookie: forbidden[5],
        error: { code: "invalid_request_error", type: "invalid_request_error" },
      },
    });
    const calls: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => calls.push(args);

    try {
      logLynbyggerPipelineError(error, context);
    } finally {
      console.error = originalConsoleError;
    }

    expect(calls).toHaveLength(1);
    const serializedLog = JSON.stringify(calls);
    for (const value of forbidden) {
      expect(serializedLog).not.toContain(value);
    }
    expect(serializedLog).not.toContain("OPENAI_API_KEY");
    expect(serializedLog).toContain("invalid_request_error");
    expect(serializedLog).toContain("req_safe456");
  });

  test("ukendte exceptions håndteres uden at serialisere vilkårlige felter", () => {
    const metadata = buildSafeLynbyggerErrorMetadata(
      {
        name: "UnexpectedProviderFailure",
        message: "privat prompt",
        body: "privat output",
        user: "laerer@example.dk",
      },
      { ...context, pipelinePhase: "candidate_generation" },
    );

    expect(metadata).toEqual({
      pipelinePhase: "candidate_generation",
      errorName: "UnexpectedProviderFailure",
      model: context.model,
      operation: context.operation,
      correlationId: context.correlationId,
    });
    expect(JSON.stringify(metadata)).not.toContain("privat");
    expect(JSON.stringify(metadata)).not.toContain("laerer@example.dk");
  });

  test("klassificerer parse- og schemafejl uden at læse fejlbeskeden", () => {
    expect(
      classifyLynbyggerGenerationPhase(
        Object.assign(new Error("hemmelig prompt"), { name: "AI_NoObjectGeneratedError" }),
        "candidate_generation",
      ),
    ).toBe("candidate_parse");
    expect(
      classifyLynbyggerGenerationPhase(
        Object.assign(new Error("hemmeligt output"), { name: "AI_TypeValidationError" }),
        "candidate_generation",
      ),
    ).toBe("candidate_validation");
  });

  test("route-kontrakten bevarer 422, generel 500 og succesrespons", () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), "app/api/manual-builder/interview/route.ts"),
      "utf8",
    );

    expect(routeSource).toContain("if (error instanceof LynbyggerQualityError)");
    expect(routeSource).toContain('{ status: 422 }');
    expect(routeSource).toContain('{ status: 500 }');
    expect(routeSource).toContain("title: normalizedRun.title");
    expect(routeSource).toContain("questions: normalizedRun.questions");
    expect(routeSource).toContain('"X-Lynbygger-Quality": "reviewed"');
    expect(routeSource).not.toContain("console.error(\"Fejl i manual-builder/interview:\", error)");
  });
});
