import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
    csrfTokenSchema,
    idSchema,
    logoutResponseSchema,
    publicUserProfileSchema,
    sessionSchema,
    updateProfileRequestSchema,
    userSchema,
    type Session,
    type User,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthenticationError, NotFoundError, ValidationError } from "../../../core/errors.js";
import { AuthGuard } from "../../../http/guards.js";
import { setPublicCache } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { AuthContext, UserRow } from "../../../authentication/types.js";
import { normalizeReturnTo } from "../../../authentication/login-service.js";
import { callbackQuerySchema, loginQuerySchema } from "../domain/identity-schemas.js";

const publicUserParams = z.object({ userId: idSchema });

export async function registerIdentityRoutes(
    app: NethackServer,
    context: CapabilityContext,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/auth/login",
        {
            schema: { querystring: loginQuerySchema, hide: true },
            config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
        },
        async (request, reply) => {
            const returnTo = normalizeReturnTo(
                request.query.returnTo ?? null,
                context.config.origins.workspace,
            );
            const result = await context.auth.login.start(returnTo, guard.requestMetadata(request));
            return reply.redirect(result.authorizationUrl, 302);
        },
    );

    app.get(
        "/api/v1/auth/callback",
        {
            schema: { querystring: callbackQuerySchema, hide: true },
            config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
        },
        async (request, reply) => {
            const previousSession = request.cookies[context.config.session.cookieName];
            const result = await context.auth.login.complete(
                new URLSearchParams(
                    Object.entries(request.query).filter(
                        (entry): entry is [string, string] => entry[1] !== undefined,
                    ),
                ),
                guard.requestMetadata(request),
                typeof previousSession === "string" ? previousSession : null,
            );
            if (result.sessionToken.length > 0) {
                reply.setCookie(
                    context.config.session.cookieName,
                    result.sessionToken,
                    context.auth.sessions.cookieOptions(),
                );
            }
            return reply.redirect(result.redirectUrl, 302);
        },
    );

    app.get(
        "/api/v1/auth/session",
        { schema: { response: { 200: sessionSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            return toSessionDto(auth);
        },
    );

    app.get(
        "/api/v1/auth/csrf",
        { schema: { response: { 200: csrfTokenSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            return { csrfToken: auth.csrfToken ?? "" };
        },
    );

    app.post(
        "/api/v1/auth/logout",
        {
            schema: { response: { 200: logoutResponseSchema } },
            config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            let providerLogoutUrl: string | null = null;
            if (auth.sessionId !== null) {
                const tokens = await context.auth.sessions.readTokens(auth.sessionId);
                if (tokens?.refreshToken !== null && tokens?.refreshToken !== undefined) {
                    try {
                        await context.auth.client.revoke(tokens.refreshToken, "refresh_token");
                    } catch {
                        context.logger.warn("Refresh token revocation failed during logout.", {
                            sessionId: auth.sessionId,
                        });
                    }
                }
                await context.auth.sessions.revoke(auth.sessionId, "user_logout");
            }
            providerLogoutUrl = await context.auth.login.providerLogoutUrl();
            clearSessionCookie(reply, context);
            return { providerLogoutUrl };
        },
    );

    app.post(
        "/api/v1/auth/backchannel",
        { schema: { hide: true }, config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
        async (request, reply) => {
            if (!(request.body instanceof URLSearchParams)) {
                throw new ValidationError("A form-encoded backchannel event is required.");
            }
            const status = await context.auth.backchannel.handle(request.body);
            return reply.status(status).send();
        },
    );

    app.get("/api/v1/me", { schema: { response: { 200: userSchema } } }, async (request) => {
        const auth = await guard.require(request);
        return toUserDto(auth.user);
    });

    app.patch(
        "/api/v1/me",
        { schema: { body: updateProfileRequestSchema, response: { 200: userSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            const updated = await context.auth.users.updateProfile(auth.user.id, {
                ...(request.body.displayName === undefined
                    ? {}
                    : { displayName: request.body.displayName }),
                ...(request.body.locale === undefined ? {} : { locale: request.body.locale }),
            });
            return toUserDto(updated);
        },
    );

    app.get(
        "/api/v1/public/users/:userId",
        {
            schema: {
                params: publicUserParams,
                response: { 200: publicUserProfileSchema },
            },
        },
        async (request, reply) => {
            const user = await context.auth.users.getById(request.params.userId);
            if (user === null) {
                throw new NotFoundError("The requested user was not found.");
            }
            setPublicCache(reply);
            return {
                id: user.id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt.toISOString(),
            };
        },
    );
}

function clearSessionCookie(reply: FastifyReply, context: CapabilityContext): void {
    reply.clearCookie(context.config.session.cookieName, {
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
    });
}

export function toUserDto(user: UserRow): User {
    return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}

export function toSessionDto(auth: AuthContext): Session {
    return {
        user: toUserDto(auth.user),
        memberships: auth.memberships.map((membership) => ({
            organizationId: membership.organizationId,
            organizationName: membership.organizationName,
            organizationSlug: membership.organizationSlug,
            role: membership.role,
            status: membership.status,
        })),
        globalAdministrator: auth.globalAdministrator,
        csrfToken: auth.csrfToken ?? "",
        expiresAt: auth.expiresAt.toISOString(),
    };
}

export function requireAuthContext(request: FastifyRequest): AuthContext {
    if (request.authContext === null) {
        throw new AuthenticationError();
    }
    return request.authContext;
}
