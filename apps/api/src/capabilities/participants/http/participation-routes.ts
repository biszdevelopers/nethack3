import { z } from "zod";
import {
    decideRegistrationRequestSchema,
    listResponseSchema,
    myParticipationSchema,
    registerForCompetitionRequestSchema,
    registrationSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { RegistrationService } from "../application/registration-service.js";

const editionParams = z.object({ editionId: z.uuid() });
const decisionParams = z.object({ editionId: z.uuid(), registrationId: z.uuid() });

export async function registerParticipationRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: RegistrationService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.post(
        "/api/v1/competitions/:editionId/registrations",
        {
            schema: {
                params: editionParams,
                body: registerForCompetitionRequestSchema,
                response: { 201: registrationSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const registration = await service.register(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(registration);
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/registrations",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(registrationSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const items = await service.list(access.organizationId, request.params.editionId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/registrations/:registrationId/decision",
        {
            schema: {
                params: decisionParams,
                body: decideRegistrationRequestSchema,
                response: { 200: registrationSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.decide(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.registrationId,
                request.body,
                request.ip,
            );
        },
    );

    app.delete(
        "/api/v1/competitions/:editionId/registrations/me",
        { schema: { params: editionParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            await service.withdraw(
                auth,
                access.organizationId,
                request.params.editionId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/me/participations",
        {
            schema: {
                response: { 200: listResponseSchema(myParticipationSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const items = await service.myParticipations(auth);
            return { items: [...items], nextCursor: null };
        },
    );
}
