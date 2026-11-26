import { z } from "zod";
import type { FastifyRequest } from "fastify";
import type { OrganizationRole } from "@nethack/contracts";
import type { AuthContext, RequestMetadata } from "../authentication/types.js";
import type { BearerAuthenticator } from "../authentication/bearer-authenticator.js";
import { extractBearerToken } from "../authentication/bearer-authenticator.js";
import type { SessionService } from "../authentication/session-service.js";
import type { AppConfig } from "../core/configuration.js";
import { AuthenticationError, ForbiddenError, ValidationError } from "../core/errors.js";
import { hashesEqual, sha256Hex } from "../authentication/crypto.js";

const uuidSchema = z.uuid();
const ORGANIZER_ROLES: readonly OrganizationRole[] = ["owner", "organizer"];

export interface OrganizationAccess {
    readonly organizationId: string;
    readonly role: OrganizationRole;
    readonly isGlobalAdministrator: boolean;
}

export class AuthGuard {
    private readonly config: AppConfig;
    private readonly sessions: SessionService;
    private readonly bearer: BearerAuthenticator;

    constructor(config: AppConfig, sessions: SessionService, bearer: BearerAuthenticator) {
        this.config = config;
        this.sessions = sessions;
        this.bearer = bearer;
    }

    requestMetadata(request: FastifyRequest): RequestMetadata {
        return {
            ip: request.ip,
            userAgent:
                typeof request.headers["user-agent"] === "string"
                    ? request.headers["user-agent"]
                    : "",
        };
    }

    async resolve(request: FastifyRequest): Promise<AuthContext | null> {
        if (request.authContext !== null) {
            return request.authContext;
        }
        const cookieToken = request.cookies[this.config.session.cookieName];
        if (
            typeof cookieToken === "string" &&
            cookieToken.length >= 16 &&
            cookieToken.length <= 256
        ) {
            const authenticated = await this.sessions.resolve(
                cookieToken,
                this.requestMetadata(request),
            );
            if (authenticated !== null) {
                request.authContext = authenticated;
                return authenticated;
            }
        }
        const bearerToken = extractBearerToken(request.headers.authorization);
        if (bearerToken !== null) {
            const authenticated = await this.bearer.authenticate(bearerToken);
            if (authenticated !== null) {
                request.authContext = authenticated;
                return authenticated;
            }
        }
        return null;
    }

    async require(request: FastifyRequest): Promise<AuthContext> {
        const auth = await this.resolve(request);
        if (auth === null) {
            throw new AuthenticationError();
        }
        return auth;
    }

    assertOriginAndCsrf(request: FastifyRequest, auth: AuthContext): void {
        if (auth.method === "bearer") {
            return;
        }
        const origin = request.headers.origin;
        if (origin !== undefined && !this.isAllowedOrigin(origin)) {
            throw new ForbiddenError("The request origin is not allowed.");
        }
        if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
            return;
        }
        // Browsers always send Origin on cross-site unsafe requests. Same-origin
        // requests from the workspace still send it; a missing Origin on a
        // cookie-authenticated write is treated as untrusted.
        if (origin === undefined) {
            throw new ForbiddenError("The request origin is required.");
        }
        const provided = request.headers[this.config.session.csrfHeader];
        const token = Array.isArray(provided) ? provided[0] : provided;
        if (typeof token !== "string" || token.length === 0 || auth.csrfHash === null) {
            throw new ForbiddenError("A valid CSRF token is required.");
        }
        if (!hashesEqual(sha256Hex(token), auth.csrfHash)) {
            throw new ForbiddenError("A valid CSRF token is required.");
        }
    }

    async requireOrganization(
        request: FastifyRequest,
        auth: AuthContext,
        explicitOrganizationId?: string,
    ): Promise<OrganizationAccess> {
        const headerValue = request.headers["x-nethack-organization-id"];
        const headerOrganizationId = typeof headerValue === "string" ? headerValue : undefined;
        const organizationId = explicitOrganizationId ?? headerOrganizationId;
        if (organizationId === undefined) {
            throw new ValidationError("An organization context is required.");
        }
        if (!uuidSchema.safeParse(organizationId).success) {
            throw new ValidationError("The organization context is invalid.");
        }
        if (
            explicitOrganizationId !== undefined &&
            headerOrganizationId !== undefined &&
            headerOrganizationId !== explicitOrganizationId
        ) {
            throw new ForbiddenError("The organization context does not match the resource.");
        }
        const membership = auth.memberships.find(
            (candidate) => candidate.organizationId === organizationId,
        );
        if (membership === undefined || membership.status !== "active") {
            throw new ForbiddenError("You are not an active member of this organization.");
        }
        return {
            organizationId,
            role: membership.role,
            isGlobalAdministrator: auth.globalAdministrator,
        };
    }

    requireRole(access: OrganizationAccess, roles: readonly OrganizationRole[]): void {
        if (!roles.includes(access.role)) {
            throw new ForbiddenError("Your organization role does not permit this action.");
        }
    }

    requireOrganizer(access: OrganizationAccess): void {
        this.requireRole(access, ORGANIZER_ROLES);
    }

    requireGlobalAdministrator(auth: AuthContext): void {
        if (!auth.globalAdministrator) {
            throw new ForbiddenError("Global administrator privileges are required.");
        }
    }

    isAllowedOrigin(origin: string): boolean {
        return origin === this.config.origins.workspace || origin === this.config.origins.api;
    }
}

export function isOrganizerRole(role: OrganizationRole): boolean {
    return ORGANIZER_ROLES.includes(role);
}
