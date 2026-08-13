import { createServer } from "node:http";

if (process.env.LYNBYGGER_TEST_MODE !== "true") {
  throw new Error("Lynbygger-teststubben kræver LYNBYGGER_TEST_MODE=true.");
}

const host = "127.0.0.1";
const port = Number(process.env.LYNBYGGER_TEST_AUTH_PORT ?? "54330");
const allowedOrigin = process.env.LYNBYGGER_TEST_BASE_URL ?? "http://localhost:3218";
if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
  throw new Error("Ugyldig lokal auth-stubport.");
}
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(allowedOrigin).hostname)) {
  throw new Error("Lynbygger-teststubben må kun svare en lokal origin.");
}

const user = {
  id: "bbbbbbbb-1111-4222-8333-cccccccc0001",
  email: "lynbygger@test.invalid",
  role: "authenticated",
  aud: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Lynbygger Test Teacher" },
  created_at: "2024-01-01T00:00:00.000Z",
};

const session = {
  access_token: "local-lynbygger-test-access-token",
  token_type: "bearer",
  expires_in: 36_000,
  expires_at: Math.floor(Date.now() / 1000) + 36_000,
  refresh_token: "local-lynbygger-test-refresh-token",
  user,
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (request.headers.origin === allowedOrigin) {
    response.setHeader("access-control-allow-origin", allowedOrigin);
    response.setHeader("access-control-allow-headers", "apikey, authorization, content-type, x-client-info");
    response.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader("vary", "origin");
  }
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/health") {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/auth/v1/user") {
    response.writeHead(200);
    response.end(JSON.stringify(user));
    return;
  }

  if (url.pathname === "/auth/v1/session" || url.pathname === "/auth/v1/token") {
    response.writeHead(200);
    response.end(JSON.stringify(session));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: "local_lynbygger_auth_stub_only" }));
});

server.listen(port, host, () => {
  console.log(`LYNBYGGER_AUTH_STUB_READY ${host}:${port}`);
});

const close = () => server.close(() => process.exit(0));
process.on("SIGTERM", close);
process.on("SIGINT", close);
