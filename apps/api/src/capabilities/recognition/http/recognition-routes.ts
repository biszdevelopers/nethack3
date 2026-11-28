import { z } from "zod";
import {
    assignAwardRequestSchema,
    awardCatalogSchema,
    awardSchema,
    createAwardRequestSchema,
    myResultsSchema,
    publicCertificateSchema,
    publicResultsSchema,
    resultsStatusSchema,
    teamAwardSchema,
    updateAwardRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import { setPublicCache } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { RecognitionService } from "../application/recognition-service.js";

const editionParams = z.object({ editionId: z.uuid() });
const awardParams = z.object({ editionId: z.uuid(), awardId: z.uuid() });
const teamAwardParams = z.object({
    editionId: z.uuid(),
    teamId: z.uuid(),
    awardId: z.uuid(),
});
const publicSlugParams = z.object({ slug: z.string().min(2).max(80) });
const teamParams = z.object({ teamId: z.string().min(1).max(64) });

export async function registerRecognitionRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: RecognitionService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/competitions/:editionId/awards",
        {
            schema: {
                params: editionParams,
                response: { 200: awardCatalogSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.catalog(access.organizationId, request.params.editionId);
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/awards",
        {
            schema: {
                params: editionParams,
                body: createAwardRequestSchema,
                response: { 201: awardSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const award = await service.createAward(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(award);
        },
    );

    app.patch(
        "/api/v1/competitions/:editionId/awards/:awardId",
        {
            schema: {
                params: awardParams,
                body: updateAwardRequestSchema,
                response: { 200: awardSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.updateAward(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.awardId,
                request.body,
                request.ip,
            );
        },
    );

    app.delete(
        "/api/v1/competitions/:editionId/awards/:awardId",
        { schema: { params: awardParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await service.deleteAward(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.awardId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/teams/:teamId/awards/:awardId",
        {
            schema: {
                params: teamAwardParams,
                body: assignAwardRequestSchema,
                response: { 201: teamAwardSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const assignment = await service.assignAward(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.teamId,
                request.params.awardId,
                request.body.note,
                request.ip,
            );
            return reply.status(201).send(assignment);
        },
    );

    app.delete(
        "/api/v1/competitions/:editionId/teams/:teamId/awards/:awardId",
        { schema: { params: teamAwardParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await service.unassignAward(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.teamId,
                request.params.awardId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/results-status",
        {
            schema: {
                params: editionParams,
                response: { 200: resultsStatusSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.status(access.organizationId, request.params.editionId);
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/results/publish",
        {
            schema: {
                params: editionParams,
                response: { 200: publicResultsSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.publish(
                auth,
                access.organizationId,
                request.params.editionId,
                request.ip,
            );
        },
    );

    app.delete(
        "/api/v1/competitions/:editionId/results/publish",
        { schema: { params: editionParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await service.unpublish(
                auth,
                access.organizationId,
                request.params.editionId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/my-results",
        {
            schema: {
                params: editionParams,
                response: { 200: myResultsSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.myResults(auth, access.organizationId, request.params.editionId);
        },
    );

    app.get(
        "/api/v1/public/competitions/:slug/results",
        {
            schema: {
                params: publicSlugParams,
                response: { 200: publicResultsSchema },
            },
        },
        async (request, reply) => {
            const results = await service.publicResults(request.params.slug);
            setPublicCache(reply);
            return results;
        },
    );

    app.get(
        "/api/v1/public/certificates/:teamId",
        {
            schema: {
                params: teamParams,
                response: { 200: publicCertificateSchema },
            },
        },
        async (request, reply) => {
            const certificate = await service.publicCertificate(request.params.teamId);
            setPublicCache(reply);
            return certificate;
        },
    );
}
