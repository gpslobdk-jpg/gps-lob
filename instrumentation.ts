import type { Instrumentation } from "next";

import { logInstrumentationException } from "@/utils/telemetry/serverLogs";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const errorWithDigest = error as { digest?: unknown };

  await logInstrumentationException({
    route: context.routePath,
    method: request.method,
    status: 500,
    error,
    requestPath: request.path,
    routeType: context.routeType,
    digest: typeof errorWithDigest.digest === "string" ? errorWithDigest.digest : null,
  });
};