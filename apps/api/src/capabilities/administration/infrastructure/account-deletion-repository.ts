import { eq, sql } from "drizzle-orm";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    ballots,
    debugAiSessions,
    evaluations,
    externalIdentities,
    globalAdministrators,
    idempotencyKeys,
    judgeAssignments,
    notificationPreferences,
    notifications,
    organizationInvitations,
    organizationMemberships,
    participants,
    projectMembers,
    registrations,
    sessions,
    teamInvitations,
    teamMembers,
    users,
    userProfileThemes,
    votes,
} from "../../../infrastructure/database/schema/index.js";
import type { UserDeletionBlockers } from "../domain/administration-rules.js";

export interface DeletableUserRow {
    readonly id: string;
    readonly displayName: string;
    readonly email: string | null;
}

/**
 * Platform account removal. Every dependent row is deleted explicitly so the
 * operation does not rely on cascade clauses that can change with the schema.
 */
export class AccountDeletionRepository {
    async findUser(db: DatabaseExecutor, userId: string): Promise<DeletableUserRow | null> {
        const rows = await db
            .select({ id: users.id, displayName: users.displayName, email: users.email })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return rows[0] ?? null;
    }

    async countBlockers(
        db: DatabaseExecutor,
        userId: string,
        organizationIds: readonly string[],
    ): Promise<UserDeletionBlockers> {
        const totals = {
            captainedTeams: 0,
            ownedProjects: 0,
            authoredAnnouncements: 0,
            submissionVersions: 0,
            submissionFiles: 0,
            awards: 0,
            teamAwards: 0,
            editionResults: 0,
            judgeFlags: 0,
            flaggedAssignments: 0,
            submittedEvaluations: 0,
        };
        // Tenant tables are row level secured, so the counts run once per
        // organization with that organization's context.
        for (const organizationId of organizationIds) {
            await db.execute(
                sql`select set_config('nethack.organization_id', ${organizationId}, true)`,
            );
            const result = await db.execute(sql`
                select
                    (select count(*)::int from teams
                        where captain_user_id = ${userId}) as captained_teams,
                    (select count(*)::int from projects
                        where owner_user_id = ${userId}) as owned_projects,
                    (select count(*)::int from announcements
                        where author_user_id = ${userId}) as authored_announcements,
                    (select count(*)::int from submission_versions
                        where created_by_user_id = ${userId}) as submission_versions,
                    (select count(*)::int from submission_files
                        where uploaded_by_user_id = ${userId}) as submission_files,
                    (select count(*)::int from awards
                        where created_by_user_id = ${userId}) as awards,
                    (select count(*)::int from team_awards
                        where assigned_by_user_id = ${userId}) as team_awards,
                    (select count(*)::int from edition_results
                        where published_by_user_id = ${userId}) as edition_results,
                    (select count(*)::int from judge_flags
                        where reported_by_user_id = ${userId}) as judge_flags,
                    (select count(*)::int from judge_flags flag
                        join judge_assignments assignment
                            on assignment.id = flag.assignment_id
                        where assignment.judge_user_id = ${userId}) as flagged_assignments,
                    (select count(*)::int from evaluations
                        where judge_user_id = ${userId}
                          and status = 'submitted') as submitted_evaluations
            `);
            const row = result.rows[0] as Record<string, unknown> | undefined;
            totals.captainedTeams += count(row, "captained_teams");
            totals.ownedProjects += count(row, "owned_projects");
            totals.authoredAnnouncements += count(row, "authored_announcements");
            totals.submissionVersions += count(row, "submission_versions");
            totals.submissionFiles += count(row, "submission_files");
            totals.awards += count(row, "awards");
            totals.teamAwards += count(row, "team_awards");
            totals.editionResults += count(row, "edition_results");
            totals.judgeFlags += count(row, "judge_flags");
            totals.flaggedAssignments += count(row, "flagged_assignments");
            totals.submittedEvaluations += count(row, "submitted_evaluations");
        }

        const globalResult = await db.execute(sql`
            select
                (select count(*)::int from organization_memberships own
                    where own.user_id = ${userId}
                      and own.role = 'owner'
                      and not exists (
                          select 1 from organization_memberships other
                          where other.organization_id = own.organization_id
                            and other.role = 'owner'
                            and other.user_id <> own.user_id
                      )) as sole_owned_organizations
        `);
        const globalRow = globalResult.rows[0] as Record<string, unknown> | undefined;
        return {
            ...totals,
            soleOwnedOrganizations: count(globalRow, "sole_owned_organizations"),
        };
    }

    async deleteDependents(
        session: DatabaseSession,
        userId: string,
        organizationIds: readonly string[],
    ): Promise<void> {
        // User-owned tables are protected by a user policy rather than an
        // organization policy, so the transaction must switch to the target.
        await session.db.execute(sql`select set_config('nethack.user_id', ${userId}, true)`);
        await session.db.delete(debugAiSessions).where(eq(debugAiSessions.userId, userId));
        await session.db.delete(userProfileThemes).where(eq(userProfileThemes.userId, userId));

        // Tenant tables enforce organization scope. Switch context for every
        // organization so no membership row can hide behind row level security.
        for (const organizationId of organizationIds) {
            await session.db.execute(
                sql`select set_config('nethack.organization_id', ${organizationId}, true)`,
            );
            await session.db.delete(votes).where(eq(votes.userId, userId));
            await session.db.delete(ballots).where(eq(ballots.userId, userId));
            await session.db
                .delete(teamInvitations)
                .where(eq(teamInvitations.invitedByUserId, userId));
            await session.db.delete(teamMembers).where(eq(teamMembers.userId, userId));
            await session.db.delete(registrations).where(eq(registrations.userId, userId));
            await session.db.delete(participants).where(eq(participants.userId, userId));
            await session.db.delete(projectMembers).where(eq(projectMembers.userId, userId));
            await session.db.delete(evaluations).where(eq(evaluations.judgeUserId, userId));
            await session.db
                .delete(judgeAssignments)
                .where(eq(judgeAssignments.judgeUserId, userId));
        }

        await session.db.delete(notifications).where(eq(notifications.userId, userId));
        await session.db
            .delete(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId));
        await session.db.delete(idempotencyKeys).where(eq(idempotencyKeys.userId, userId));
        await session.db.delete(externalIdentities).where(eq(externalIdentities.userId, userId));
        await session.db.delete(sessions).where(eq(sessions.userId, userId));
        await session.db
            .delete(organizationMemberships)
            .where(eq(organizationMemberships.userId, userId));
        await session.db
            .delete(organizationInvitations)
            .where(eq(organizationInvitations.invitedByUserId, userId));
        await session.db
            .delete(globalAdministrators)
            .where(eq(globalAdministrators.userId, userId));
        await session.db.delete(users).where(eq(users.id, userId));
    }
}

function count(row: Record<string, unknown> | undefined, key: string): number {
    const value = row?.[key];
    return typeof value === "number" ? value : Number(value ?? 0);
}
