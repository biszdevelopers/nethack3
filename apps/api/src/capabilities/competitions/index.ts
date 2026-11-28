import type { CapabilityDefinition } from "../../core/capability.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { CompetitionService } from "./application/competition-service.js";
import {
    COMPETITIONS_CONTRACT,
    type CompetitionsContract,
    type EditionSummary,
} from "./contracts.js";
import { registerCompetitionRoutes } from "./http/competition-routes.js";
import { CompetitionRepository } from "./infrastructure/competition-repository.js";

export const competitionsCapability: CapabilityDefinition = {
    id: "competitions",
    version: "1.0.0",
    dependencies: ["organizations"],
    async register(context) {
        const repository = new CompetitionRepository();
        const organizations = context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT);
        const service = new CompetitionService(
            context.database,
            repository,
            context.events,
            context.audit,
            context.clock,
            organizations,
        );

        const contract: CompetitionsContract = {
            async getEdition(organizationId, editionId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const row = await repository.findEdition(session.db, organizationId, editionId);
                    return row === null ? null : toEditionSummary(row);
                });
            },
            async getDivision(organizationId, divisionId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const row = await repository.findDivision(
                        session.db,
                        organizationId,
                        divisionId,
                    );
                    return row === null
                        ? null
                        : {
                              id: row.id,
                              organizationId: row.organizationId,
                              editionId: row.editionId,
                              name: row.name,
                              slug: row.slug,
                              description: row.description,
                              minTeamSize: row.minTeamSize,
                              maxTeamSize: row.maxTeamSize,
                          };
                });
            },
            async listEditions(organizationId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const rows = await repository.listEditions(session.db, organizationId);
                    return rows.map(toEditionSummary);
                });
            },
            async isPublicEdition(editionId) {
                const row = await repository.findVisibleEditionById(context.database.db, editionId);
                return row !== null;
            },
            freezeForResults(session, organizationId, editionId) {
                return service.freezeForResults(session, organizationId, editionId);
            },
            restoreEditionStatus(session, organizationId, editionId, status) {
                return service.restoreEditionStatus(session, organizationId, editionId, status);
            },
        };

        return {
            contracts: { [COMPETITIONS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerCompetitionRoutes(app, context, service);
            },
        };
    },
};

function toEditionSummary(row: {
    id: string;
    organizationId: string;
    seriesId: string;
    seriesName: string;
    name: string;
    slug: string;
    description: string;
    themeName: string | null;
    themeDescription: string | null;
    showScores: boolean;
    showRanking: boolean;
    status: EditionSummary["status"];
    timezone: string;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    startsAt: Date | null;
    endsAt: Date | null;
    teamMinSize: number;
    teamMaxSize: number;
    maxParticipants: number | null;
    rulesMarkdown: string;
    publishedAt: Date | null;
}): EditionSummary {
    return {
        id: row.id,
        organizationId: row.organizationId,
        seriesId: row.seriesId,
        seriesName: row.seriesName,
        name: row.name,
        slug: row.slug,
        description: row.description,
        themeName: row.themeName,
        themeDescription: row.themeDescription,
        showScores: row.showScores,
        showRanking: row.showRanking,
        status: row.status,
        timezone: row.timezone,
        registrationOpensAt: nullableIso(row.registrationOpensAt),
        registrationClosesAt: nullableIso(row.registrationClosesAt),
        startsAt: nullableIso(row.startsAt),
        endsAt: nullableIso(row.endsAt),
        teamMinSize: row.teamMinSize,
        teamMaxSize: row.teamMaxSize,
        maxParticipants: row.maxParticipants,
        rulesMarkdown: row.rulesMarkdown,
        publishedAt: nullableIso(row.publishedAt),
    };
}

function nullableIso(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
}
