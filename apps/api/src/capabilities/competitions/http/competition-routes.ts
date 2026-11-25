import { z } from "zod";
import {
    competitionEditionDetailSchema,
    competitionEditionSchema,
    competitionSeriesSchema,
    createDivisionRequestSchema,
    createEditionRequestSchema,
    createMilestoneRequestSchema,
    createSeriesRequestSchema,
    divisionSchema,
    listResponseSchema,
    milestoneSchema,
    pageQuerySchema,
    publicCompetitionDetailSchema,
    publicCompetitionSchema,
    publicOrganizationSchema,
    updateEditionRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { setPublicCache } from "../../../http/pagination.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { CompetitionService } from "../application/competition-service.js";

const organizationParams = z.object({ organizationId: z.uuid() });
const editionParams = z.object({ editionId: z.uuid() });
const editionCollectionParams = z.object({
    organizationId: z.uuid(),
    seriesId: z.uuid(),
});
const publicSlugParams = z.object({ slug: z.string().min(2).max(80) });

export async function registerCompetitionRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: CompetitionService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/organizations/:organizationId/competitions",
        {
            schema: {
                params: organizationParams,
                response: { 200: listResponseSchema(competitionSeriesSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            await guard.requireOrganization(request, auth, request.params.organizationId);
            const items = await service.listSeries(request.params.organizationId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/organizations/:organizationId/competitions",
        {
            schema: {
                params: organizationParams,
                body: createSeriesRequestSchema,
                response: { 201: competitionSeriesSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            const series = await service.createSeries(
                auth,
                request.params.organizationId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(series);
        },
    );

    app.post(
        "/api/v1/organizations/:organizationId/competitions/:seriesId/editions",
        {
            schema: {
                params: editionCollectionParams,
                body: createEditionRequestSchema,
                response: { 201: competitionEditionSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            const edition = await service.createEdition(
                auth,
                request.params.organizationId,
                request.params.seriesId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(edition);
        },
    );

    app.get(
        "/api/v1/competitions/:editionId",
        {
            schema: {
                params: editionParams,
                response: { 200: competitionEditionDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.detail(access.organizationId, request.params.editionId);
        },
    );

    app.patch(
        "/api/v1/competitions/:editionId",
        {
            schema: {
                params: editionParams,
                body: updateEditionRequestSchema,
                response: { 200: competitionEditionSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.update(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/publish",
        {
            schema: {
                params: editionParams,
                response: { 200: competitionEditionSchema },
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

    app.get(
        "/api/v1/competitions/:editionId/divisions",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(divisionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.divisions(access.organizationId, request.params.editionId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/divisions",
        {
            schema: {
                params: editionParams,
                body: createDivisionRequestSchema,
                response: { 201: divisionSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const division = await service.createDivision(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(division);
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/milestones",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(milestoneSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.milestones(access.organizationId, request.params.editionId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/milestones",
        {
            schema: {
                params: editionParams,
                body: createMilestoneRequestSchema,
                response: { 201: milestoneSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const milestone = await service.createMilestone(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(milestone);
        },
    );

    app.get(
        "/api/v1/public/competitions",
        {
            schema: {
                querystring: pageQuerySchema,
                response: { 200: listResponseSchema(publicCompetitionSchema) },
            },
        },
        async (request, reply) => {
            setPublicCache(reply);
            const items = await service.publicCompetitions(request.query.limit ?? 20);
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/public/competitions/:slug",
        {
            schema: {
                params: publicSlugParams,
                response: { 200: publicCompetitionDetailSchema },
            },
        },
        async (request, reply) => {
            setPublicCache(reply);
            return service.publicCompetitionDetail(request.params.slug);
        },
    );

    app.get(
        "/api/v1/public/organizations/:slug",
        {
            schema: {
                params: publicSlugParams,
                response: { 200: publicOrganizationSchema },
            },
        },
        async (request, reply) => {
            setPublicCache(reply);
            return service.publicOrganization(request.params.slug);
        },
    );
}
