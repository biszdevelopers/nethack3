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
    editionLifecycleRequestSchema,
    listResponseSchema,
    milestoneSchema,
    organizerEditionSchema,
    pageQuerySchema,
    publicCompetitionDetailSchema,
    publicCompetitionSchema,
    publicOrganizationSchema,
    updateDivisionRequestSchema,
    updateEditionRequestSchema,
    updateMilestoneRequestSchema,
    updateSeriesRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { decodeCursor, encodeCursor, setPublicCache } from "../../../http/pagination.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { CompetitionService, EditionPage } from "../application/competition-service.js";

const organizationParams = z.object({ organizationId: z.uuid() });
const editionParams = z.object({ editionId: z.uuid() });
const editionCollectionParams = z.object({
    organizationId: z.uuid(),
    seriesId: z.uuid(),
});
const divisionParams = z.object({ editionId: z.uuid(), divisionId: z.uuid() });
const milestoneParams = z.object({ editionId: z.uuid(), milestoneId: z.uuid() });
const organizerEditionQuery = pageQuerySchema.extend({ seriesId: z.uuid().optional() });
const publicSlugParams = z.object({ slug: z.string().min(2).max(80) });

function editionPageResponse(page: EditionPage) {
    const last = page.items[page.items.length - 1];
    return {
        items: [...page.items],
        nextCursor:
            page.hasMore && last !== undefined
                ? encodeCursor(new Date(last.createdAt), last.id)
                : null,
    };
}

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

    app.get(
        "/api/v1/organizations/:organizationId/editions",
        {
            schema: {
                params: organizationParams,
                querystring: organizerEditionQuery,
                response: { 200: listResponseSchema(organizerEditionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            const cursor = decodeCursor(request.query.cursor);
            const page = await service.organizerEditions(access.organizationId, {
                limit: request.query.limit ?? 20,
                seriesId: request.query.seriesId ?? null,
                before: cursor === null ? null : new Date(cursor.createdAt),
                beforeId: cursor === null ? null : cursor.id,
            });
            return editionPageResponse(page);
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId/competitions/:seriesId/editions",
        {
            schema: {
                params: editionCollectionParams,
                querystring: pageQuerySchema,
                response: { 200: listResponseSchema(organizerEditionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            const cursor = decodeCursor(request.query.cursor);
            const page = await service.seriesEditions(
                access.organizationId,
                request.params.seriesId,
                {
                    limit: request.query.limit ?? 20,
                    before: cursor === null ? null : new Date(cursor.createdAt),
                    beforeId: cursor === null ? null : cursor.id,
                },
            );
            return editionPageResponse(page);
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

    app.patch(
        "/api/v1/organizations/:organizationId/competitions/:seriesId",
        {
            schema: {
                params: editionCollectionParams,
                body: updateSeriesRequestSchema,
                response: { 200: competitionSeriesSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            return service.updateSeries(
                auth,
                access.organizationId,
                request.params.seriesId,
                request.body,
                request.ip,
            );
        },
    );

    app.delete(
        "/api/v1/organizations/:organizationId/competitions/:seriesId",
        { schema: { params: editionCollectionParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            await service.deleteSeries(
                auth,
                access.organizationId,
                request.params.seriesId,
                request.ip,
            );
            return reply.status(204).send();
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

    app.post(
        "/api/v1/competitions/:editionId/lifecycle",
        {
            schema: {
                params: editionParams,
                body: editionLifecycleRequestSchema,
                response: { 200: competitionEditionSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.lifecycle(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
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

    app.patch(
        "/api/v1/competitions/:editionId/divisions/:divisionId",
        {
            schema: {
                params: divisionParams,
                body: updateDivisionRequestSchema,
                response: { 200: divisionSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.updateDivision(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.divisionId,
                request.body,
                request.ip,
            );
        },
    );

    app.delete(
        "/api/v1/competitions/:editionId/divisions/:divisionId",
        { schema: { params: divisionParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await service.deleteDivision(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.divisionId,
                request.ip,
            );
            return reply.status(204).send();
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

    app.patch(
        "/api/v1/competitions/:editionId/milestones/:milestoneId",
        {
            schema: {
                params: milestoneParams,
                body: updateMilestoneRequestSchema,
                response: { 200: milestoneSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.updateMilestone(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.milestoneId,
                request.body,
                request.ip,
            );
        },
    );

    app.delete(
        "/api/v1/competitions/:editionId/milestones/:milestoneId",
        { schema: { params: milestoneParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await service.deleteMilestone(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.milestoneId,
                request.ip,
            );
            return reply.status(204).send();
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
