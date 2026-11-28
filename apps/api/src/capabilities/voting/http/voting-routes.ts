import { z } from "zod";
import {
    ballotSchema,
    castBallotRequestSchema,
    createVotingRoundRequestSchema,
    listResponseSchema,
    voteResultSchema,
    votableSubmissionSchema,
    votingRoundSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { VotingService } from "../application/voting-service.js";

const editionParams = z.object({ editionId: z.uuid() });
const roundParams = z.object({ roundId: z.uuid() });

export async function registerVotingRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: VotingService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/competitions/:editionId/voting-rounds",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(votingRoundSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.listRounds(access.organizationId, request.params.editionId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/votable-submissions",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(votableSubmissionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.votableSubmissions(
                access.organizationId,
                access.role,
                request.params.editionId,
                auth.user.id,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/voting-rounds",
        {
            schema: {
                params: editionParams,
                body: createVotingRoundRequestSchema,
                response: { 201: votingRoundSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const round = await service.createRound(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(round);
        },
    );

    app.post(
        "/api/v1/voting-rounds/:roundId/open",
        {
            schema: {
                params: roundParams,
                response: { 200: votingRoundSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.openRound(
                auth,
                access.organizationId,
                request.params.roundId,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/voting-rounds/:roundId/close",
        {
            schema: {
                params: roundParams,
                response: { 200: votingRoundSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.closeRound(
                auth,
                access.organizationId,
                request.params.roundId,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/voting-rounds/:roundId/publish",
        {
            schema: {
                params: roundParams,
                response: { 200: votingRoundSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.publishRound(
                auth,
                access.organizationId,
                request.params.roundId,
                request.ip,
            );
        },
    );

    app.get(
        "/api/v1/voting-rounds/:roundId/ballot",
        {
            schema: {
                params: roundParams,
                response: { 200: ballotSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.ballot(auth, access.organizationId, access.role, request.params.roundId);
        },
    );

    app.post(
        "/api/v1/voting-rounds/:roundId/ballot",
        {
            schema: {
                params: roundParams,
                body: castBallotRequestSchema,
                response: { 201: ballotSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const ballot = await service.castBallot(
                auth,
                access.organizationId,
                access.role,
                request.params.roundId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(ballot);
        },
    );

    app.get(
        "/api/v1/voting-rounds/:roundId/results",
        {
            schema: {
                params: roundParams,
                response: { 200: voteResultSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.roundResults(access.organizationId, access.role, request.params.roundId);
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/results",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(voteResultSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.editionResults(
                access.organizationId,
                access.role,
                request.params.editionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );
}
