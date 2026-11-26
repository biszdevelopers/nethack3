import {
    createServer,
    request as createUpstreamRequest,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from "node:http";
import { z } from "zod";
import { MockOidcProvider } from "../../../apps/api/tests/support/mock-oidc-provider.js";
import { AUTH, AUTH_ORIGIN, AUTH_PORT, USERS } from "./config.js";

/**
 * Standalone OIDC provider for Playwright.
 *
 * MockOidcProvider binds an ephemeral HTTP port and derives the issuer from it,
 * so this wrapper gives it the fixed E2E issuer and a stable client secret while
 * a small reverse proxy keeps the public origin on AUTH_PORT. The control
 * endpoints exist only in this test process; no production code imports it.
 */

const userRequestSchema = z.object({
    subject: z.string().min(1).max(256),
    email: z.email().max(254),
    name: z.string().min(1).max(80),
});

const errorRequestSchema = z.object({
    mode: z.enum(["access_denied", "login_required"]).nullable(),
});

const provider = await MockOidcProvider.create({
    redirectUri: AUTH.redirectUri,
    enableTls: false,
});
await provider.start();

const upstreamPort = Number(new URL(provider.httpUrl).port);
Object.defineProperty(provider, "httpBaseUrl", { value: AUTH_ORIGIN, configurable: true });
Object.defineProperty(provider, "clientId", { value: AUTH.clientId, configurable: true });
Object.defineProperty(provider, "clientSecret", { value: AUTH.clientSecret, configurable: true });
Object.defineProperty(provider, "resource", { value: AUTH.resource, configurable: true });
Object.defineProperty(provider, "resourceSecret", {
    value: AUTH.resourceSecret,
    configurable: true,
});
provider.setUserClaims(USERS.participant);

const servers: Server[] = [];

const proxy = createServer((request, response) => {
    void handleRequest(request, response);
});
servers.push(proxy);

await new Promise<void>((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(AUTH_PORT, "127.0.0.1", () => {
        proxy.off("error", reject);
        resolve();
    });
});

console.log(`Mock OIDC provider listening on ${AUTH_ORIGIN} (upstream ${String(upstreamPort)}).`);

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
        const path = (request.url ?? "/").split("?")[0] ?? "/";
        if (request.method === "GET" && path === "/health") {
            writeJson(response, 200, { status: "ok" });
            return;
        }
        if (request.method === "POST" && path === "/__test/user") {
            const body = userRequestSchema.parse(JSON.parse(await readBody(request)));
            provider.setUserClaims(body);
            writeJson(response, 200, { user: body });
            return;
        }
        if (request.method === "POST" && path === "/__test/error") {
            const body = errorRequestSchema.parse(JSON.parse(await readBody(request)));
            provider.setErrorMode(body.mode);
            writeJson(response, 200, { mode: body.mode });
            return;
        }
        forward(request, response);
    } catch (error) {
        if (!response.headersSent) {
            writeJson(response, 400, {
                error: "invalid_request",
                error_description: error instanceof Error ? error.message : "unknown",
            });
        } else {
            response.end();
        }
    }
}

function forward(request: IncomingMessage, response: ServerResponse): void {
    const headers = { ...request.headers };
    delete headers.host;
    headers.host = `127.0.0.1:${String(upstreamPort)}`;
    const upstream = createUpstreamRequest(
        {
            hostname: "127.0.0.1",
            port: upstreamPort,
            path: request.url ?? "/",
            method: request.method ?? "GET",
            headers,
        },
        (upstreamResponse) => {
            response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
        },
    );
    upstream.on("error", (error) => {
        if (!response.headersSent) {
            writeJson(response, 502, {
                error: "upstream_error",
                error_description: error.message,
            });
        } else {
            response.end();
        }
    });
    request.pipe(upstream);
}

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request as AsyncIterable<Buffer>) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
    });
    response.end(JSON.stringify(body));
}

async function shutdown(): Promise<void> {
    for (const server of servers) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await provider.stop();
    process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
