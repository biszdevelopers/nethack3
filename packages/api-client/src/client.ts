import { z } from "zod";

export interface ApiClientOptions {
    readonly baseUrl: string;
    readonly fetchImpl?: typeof fetch;
    readonly getCsrfToken?: () => string | null;
    readonly getOrganizationId?: () => string | null;
    readonly onUnauthorized?: () => void;
}

export interface RequestOptions<T> {
    readonly body?: unknown;
    readonly query?: Record<string, string | number | boolean | undefined | null>;
    readonly schema?: z.ZodType<T>;
    readonly signal?: AbortSignal;
    readonly headers?: Record<string, string>;
}

export class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly requestId: string;
    readonly details: Record<string, string[]> | undefined;

    constructor(input: {
        status: number;
        code: string;
        message: string;
        requestId: string;
        details?: Record<string, string[]>;
    }) {
        super(input.message);
        this.name = "ApiError";
        this.status = input.status;
        this.code = input.code;
        this.requestId = input.requestId;
        this.details = input.details;
    }
}

const errorEnvelopeSchema = z.object({
    error: z.object({
        code: z.string(),
        message: z.string(),
        requestId: z.string(),
        details: z.record(z.string(), z.array(z.string())).optional(),
    }),
});

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiClient {
    private readonly baseUrl: string;
    private readonly fetchImpl: typeof fetch;
    private readonly getCsrfToken: () => string | null;
    private readonly getOrganizationId: () => string | null;
    private readonly onUnauthorized: () => void;

    constructor(options: ApiClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.fetchImpl =
            options.fetchImpl ??
            ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
        this.getCsrfToken = options.getCsrfToken ?? (() => null);
        this.getOrganizationId = options.getOrganizationId ?? (() => null);
        this.onUnauthorized = options.onUnauthorized ?? (() => undefined);
    }

    async request<T>(method: string, path: string, options: RequestOptions<T> = {}): Promise<T> {
        const url = this.buildUrl(path, options.query);
        const headers: Record<string, string> = {
            Accept: "application/json",
            ...options.headers,
        };
        const init: RequestInit = {
            method,
            credentials: "include",
            headers,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
        };
        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(options.body);
        }
        // Organization context is required by organization-scoped reads as well as
        // writes, so it is attached to every request that has one.
        const organizationId = this.getOrganizationId();
        if (organizationId !== null && organizationId.length > 0) {
            headers["X-Nethack-Organization-Id"] = organizationId;
        }
        if (UNSAFE_METHODS.has(method)) {
            const csrf = this.getCsrfToken();
            if (csrf !== null && csrf.length > 0) {
                headers["X-CSRF-Token"] = csrf;
            }
        }
        const response = await this.fetchImpl(url, init);
        if (response.status === 401) {
            this.onUnauthorized();
        }
        return this.parseResponse(response, options.schema);
    }

    async upload<T>(
        path: string,
        formData: FormData,
        options: { readonly schema?: z.ZodType<T>; readonly signal?: AbortSignal } = {},
    ): Promise<T> {
        const headers: Record<string, string> = { Accept: "application/json" };
        const csrf = this.getCsrfToken();
        if (csrf !== null && csrf.length > 0) {
            headers["X-CSRF-Token"] = csrf;
        }
        const organizationId = this.getOrganizationId();
        if (organizationId !== null && organizationId.length > 0) {
            headers["X-Nethack-Organization-Id"] = organizationId;
        }
        const response = await this.fetchImpl(this.buildUrl(path, undefined), {
            method: "POST",
            credentials: "include",
            headers,
            body: formData,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
        });
        if (response.status === 401) {
            this.onUnauthorized();
        }
        return this.parseResponse(response, options.schema);
    }

    buildUrl(
        path: string,
        query?: Record<string, string | number | boolean | undefined | null>,
    ): string {
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value === undefined || value === null || value === "") {
                continue;
            }
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }

    private async parseResponse<T>(response: Response, schema?: z.ZodType<T>): Promise<T> {
        if (response.status === 204) {
            return undefined as T;
        }
        const text = await response.text();
        let payload: unknown = undefined;
        if (text.length > 0) {
            try {
                payload = JSON.parse(text) as unknown;
            } catch {
                payload = undefined;
            }
        }
        if (!response.ok) {
            const parsed = errorEnvelopeSchema.safeParse(payload);
            if (parsed.success) {
                throw new ApiError({
                    status: response.status,
                    code: parsed.data.error.code,
                    message: parsed.data.error.message,
                    requestId: parsed.data.error.requestId,
                    ...(parsed.data.error.details === undefined
                        ? {}
                        : { details: parsed.data.error.details }),
                });
            }
            throw new ApiError({
                status: response.status,
                code: "internal_error",
                message: "The request could not be completed.",
                requestId: response.headers.get("x-request-id") ?? "",
            });
        }
        if (schema === undefined) {
            return payload as T;
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
            throw new ApiError({
                status: response.status,
                code: "internal_error",
                message: "The server returned an unexpected response.",
                requestId: response.headers.get("x-request-id") ?? "",
            });
        }
        return parsed.data;
    }
}
