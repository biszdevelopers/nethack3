import { z } from "zod";
import type {
    CreateDebugAiSessionRequest,
    DebugAiExchange,
    DebugAiMessage,
    DebugAiSession,
    DebugAiSessionDetail,
    DebugAiStatus,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { AppError, ExternalDependencyError, NotFoundError } from "../../../core/errors.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type {
    DebugAiMessageRow,
    DebugAiRepository,
    DebugAiSessionRow,
    DebugAiSessionSummaryRow,
} from "../infrastructure/debug-ai-repository.js";

const CONTEXT_MESSAGE_LIMIT = 40;
const RESPONSE_TOKEN_LIMIT = 800;
const SYSTEM_PROMPT =
    "You are the nethack operator assistant. Help organizers operate the platform. " +
    "Use only the conversation and general knowledge; never claim to read private data, " +
    "never invent results, and answer in concise American English.";

export interface AiConfiguration {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly model: string;
    readonly timeoutMs: number;
}

export class AiNotConfiguredError extends AppError {
    constructor() {
        super(
            "external_dependency_failure",
            503,
            "The AI assistant is not configured. Set OPENAI_API_KEY to enable operator chat.",
        );
    }
}

const completionSchema = z.object({
    choices: z
        .array(
            z.object({
                message: z.object({
                    content: z.string().nullable(),
                }),
            }),
        )
        .min(1),
});

const aiEnvironmentSchema = z.object({
    apiKey: z.string().trim().min(1),
    baseUrl: z.url().max(2048).default("https://api.openai.com/v1"),
    model: z.string().trim().min(1).max(120).default("gpt-4o-mini"),
});

/**
 * Configuration comes only from the process environment. No route accepts a
 * base URL, model, or credential from a request.
 */
export function loadAiConfiguration(environment: NodeJS.ProcessEnv): AiConfiguration | null {
    const apiKey = environment.OPENAI_API_KEY?.trim();
    if (apiKey === undefined || apiKey.length === 0) {
        return null;
    }
    const parsed = aiEnvironmentSchema.parse({
        apiKey,
        baseUrl: environment.OPENAI_BASE_URL?.trim() || undefined,
        model: environment.OPENAI_MODEL?.trim() || undefined,
    });
    const protocol = new URL(parsed.baseUrl).protocol;
    if (protocol !== "https:" && protocol !== "http:") {
        throw new Error("OPENAI_BASE_URL must use http or https.");
    }
    return {
        apiKey: parsed.apiKey,
        baseUrl: parsed.baseUrl,
        model: parsed.model,
        timeoutMs: 20_000,
    };
}

export class DebugAiService {
    private readonly database: DatabaseConnection;
    private readonly repository: DebugAiRepository;
    private readonly clock: Clock;
    private readonly configuration: AiConfiguration | null;
    private readonly fetchImpl: typeof fetch;

    constructor(
        database: DatabaseConnection,
        repository: DebugAiRepository,
        clock: Clock,
        configuration: AiConfiguration | null,
        fetchImpl: typeof fetch = fetch,
    ) {
        this.database = database;
        this.repository = repository;
        this.clock = clock;
        this.configuration = configuration;
        this.fetchImpl = fetchImpl;
    }

    status(): DebugAiStatus {
        return {
            configured: this.configuration !== null,
            model: this.configuration?.model ?? null,
        };
    }

    async listSessions(auth: AuthContext): Promise<readonly DebugAiSession[]> {
        const rows = await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (session) => this.repository.listSessions(session.db, auth.user.id),
        );
        return rows.map(toSession);
    }

    async createSession(
        auth: AuthContext,
        input: CreateDebugAiSessionRequest,
    ): Promise<DebugAiSession> {
        const row = await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (session) =>
                this.repository.insertSession(session, {
                    userId: auth.user.id,
                    name: input.name,
                    now: this.clock.now(),
                }),
        );
        return toSession({ ...row, messageCount: 0 });
    }

    async getSession(auth: AuthContext, sessionId: string): Promise<DebugAiSessionDetail> {
        const loaded = await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (session) => {
                const found = await this.repository.findSession(
                    session.db,
                    auth.user.id,
                    sessionId,
                );
                if (found === null) {
                    return null;
                }
                return {
                    session: found,
                    messages: await this.repository.listMessages(session.db, sessionId),
                };
            },
        );
        if (loaded === null) {
            throw new NotFoundError("The debug session was not found.");
        }
        return {
            ...toSession({ ...loaded.session, messageCount: loaded.messages.length }),
            messages: loaded.messages.map(toMessage),
        };
    }

    async deleteSession(auth: AuthContext, sessionId: string): Promise<void> {
        const deleted = await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (session) => this.repository.deleteSession(session, auth.user.id, sessionId),
        );
        if (!deleted) {
            throw new NotFoundError("The debug session was not found.");
        }
    }

    async sendMessage(
        auth: AuthContext,
        sessionId: string,
        content: string,
    ): Promise<DebugAiExchange> {
        const configuration = this.configuration;
        if (configuration === null) {
            throw new AiNotConfiguredError();
        }
        const history = await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (session) => {
                const found = await this.repository.findSession(
                    session.db,
                    auth.user.id,
                    sessionId,
                );
                if (found === null) {
                    throw new NotFoundError("The debug session was not found.");
                }
                return this.repository.listRecentMessages(
                    session.db,
                    sessionId,
                    CONTEXT_MESSAGE_LIMIT,
                );
            },
        );
        const reply = await this.complete(configuration, [
            ...history.map((message) => ({ role: message.role, content: message.content })),
            { role: "user", content },
        ]);

        const now = this.clock.now();
        const messages = await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (databaseSession) => {
                const userMessage = await this.repository.insertMessage(databaseSession, {
                    sessionId,
                    role: "user",
                    content,
                    now,
                });
                const assistantMessage = await this.repository.insertMessage(databaseSession, {
                    sessionId,
                    role: "assistant",
                    content: reply,
                    now,
                });
                await this.repository.touchSession(databaseSession, auth.user.id, sessionId, now);
                return { userMessage, assistantMessage };
            },
        );

        return {
            userMessage: toMessage(messages.userMessage),
            assistantMessage: toMessage(messages.assistantMessage),
        };
    }

    private async complete(
        configuration: AiConfiguration,
        messages: readonly { role: "user" | "assistant"; content: string }[],
    ): Promise<string> {
        const base = configuration.baseUrl.endsWith("/")
            ? configuration.baseUrl
            : `${configuration.baseUrl}/`;
        const endpoint = new URL("chat/completions", base);
        let response: Response;
        try {
            response = await this.fetchImpl(endpoint, {
                method: "POST",
                headers: {
                    authorization: `Bearer ${configuration.apiKey}`,
                    "content-type": "application/json",
                    accept: "application/json",
                },
                body: JSON.stringify({
                    model: configuration.model,
                    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
                    max_tokens: RESPONSE_TOKEN_LIMIT,
                    temperature: 0.2,
                }),
                signal: AbortSignal.timeout(configuration.timeoutMs),
            });
        } catch (error) {
            throw new ExternalDependencyError("The AI assistant is unavailable.", error);
        }
        if (!response.ok) {
            throw new ExternalDependencyError(
                `The AI assistant rejected the request (${String(response.status)}).`,
            );
        }
        let payload: unknown;
        try {
            payload = await response.json();
        } catch (error) {
            throw new ExternalDependencyError(
                "The AI assistant returned an unreadable response.",
                error,
            );
        }
        const parsed = completionSchema.safeParse(payload);
        const content = parsed.success ? parsed.data.choices[0]?.message.content : null;
        if (content === null || content === undefined || content.trim().length === 0) {
            throw new ExternalDependencyError("The AI assistant returned an empty response.");
        }
        return content;
    }
}

function toSession(
    row: DebugAiSessionSummaryRow | (DebugAiSessionRow & { messageCount: number }),
): DebugAiSession {
    return {
        id: row.id,
        name: row.name,
        messageCount: row.messageCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toMessage(row: DebugAiMessageRow): DebugAiMessage {
    return {
        id: row.id,
        sessionId: row.sessionId,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
    };
}
