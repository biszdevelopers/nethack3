import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import { ballots, votes, votingRounds } from "../../../infrastructure/database/schema/index.js";

export type VotingRoundRow = typeof votingRounds.$inferSelect;
export type BallotRow = typeof ballots.$inferSelect;

export interface NewRoundValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly name: string;
    readonly description: string;
    readonly eligibleRoles: readonly string[];
    readonly maxSelections: number;
    readonly maxVotesPerUser: number;
    readonly opensAt: Date | null;
    readonly closesAt: Date | null;
}

export interface RoundStatusUpdate {
    readonly organizationId: string;
    readonly roundId: string;
    readonly status: "open" | "closed" | "published";
    readonly updatedAt: Date;
    readonly publishedAt?: Date;
}

export interface NewBallotValues {
    readonly organizationId: string;
    readonly roundId: string;
    readonly userId: string;
    readonly reasoning: string;
    readonly submittedAt: Date;
}

export interface NewVoteValues {
    readonly organizationId: string;
    readonly roundId: string;
    readonly ballotId: string;
    readonly userId: string;
    readonly submissionId: string;
    readonly stars: number;
}

export interface BallotWithVotes {
    readonly ballot: BallotRow;
    readonly scores: readonly { readonly submissionId: string; readonly stars: number }[];
}

export interface VoteTallyRow {
    readonly submissionId: string;
    readonly votes: number;
    readonly totalStars: number;
}

export class VotingRepository {
    async insertRound(session: DatabaseSession, values: NewRoundValues): Promise<VotingRoundRow> {
        const [row] = await session.db
            .insert(votingRounds)
            .values({
                organizationId: values.organizationId,
                editionId: values.editionId,
                name: values.name,
                description: values.description,
                eligibleRoles: [...values.eligibleRoles],
                maxSelections: values.maxSelections,
                maxVotesPerUser: values.maxVotesPerUser,
                opensAt: values.opensAt,
                closesAt: values.closesAt,
            })
            .returning();
        if (row === undefined) {
            throw new Error("The voting round could not be created.");
        }
        return row;
    }

    async listRounds(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly VotingRoundRow[]> {
        return db
            .select()
            .from(votingRounds)
            .where(
                and(
                    eq(votingRounds.organizationId, organizationId),
                    eq(votingRounds.editionId, editionId),
                ),
            )
            .orderBy(asc(votingRounds.createdAt), asc(votingRounds.id));
    }

    async listPublishedRounds(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly VotingRoundRow[]> {
        return db
            .select()
            .from(votingRounds)
            .where(
                and(
                    eq(votingRounds.organizationId, organizationId),
                    eq(votingRounds.editionId, editionId),
                    eq(votingRounds.status, "published"),
                ),
            )
            .orderBy(asc(votingRounds.createdAt), asc(votingRounds.id));
    }

    async findRound(
        db: DatabaseExecutor,
        organizationId: string,
        roundId: string,
    ): Promise<VotingRoundRow | null> {
        const rows = await db
            .select()
            .from(votingRounds)
            .where(
                and(eq(votingRounds.organizationId, organizationId), eq(votingRounds.id, roundId)),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async lockRound(
        session: DatabaseSession,
        organizationId: string,
        roundId: string,
    ): Promise<VotingRoundRow | null> {
        const rows = await session.db
            .select()
            .from(votingRounds)
            .where(
                and(eq(votingRounds.organizationId, organizationId), eq(votingRounds.id, roundId)),
            )
            .for("update")
            .limit(1);
        return rows[0] ?? null;
    }

    async updateRound(
        session: DatabaseSession,
        values: RoundStatusUpdate,
    ): Promise<VotingRoundRow | null> {
        const rows = await session.db
            .update(votingRounds)
            .set({
                status: values.status,
                updatedAt: values.updatedAt,
                ...(values.publishedAt === undefined ? {} : { publishedAt: values.publishedAt }),
            })
            .where(
                and(
                    eq(votingRounds.organizationId, values.organizationId),
                    eq(votingRounds.id, values.roundId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async closeOpenRounds(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        updatedAt: Date,
    ): Promise<readonly VotingRoundRow[]> {
        return session.db
            .update(votingRounds)
            .set({ status: "closed", updatedAt })
            .where(
                and(
                    eq(votingRounds.organizationId, organizationId),
                    eq(votingRounds.editionId, editionId),
                    eq(votingRounds.status, "open"),
                ),
            )
            .returning();
    }

    async findBallot(
        db: DatabaseExecutor,
        organizationId: string,
        roundId: string,
        userId: string,
    ): Promise<BallotRow | null> {
        const rows = await db
            .select()
            .from(ballots)
            .where(
                and(
                    eq(ballots.organizationId, organizationId),
                    eq(ballots.roundId, roundId),
                    eq(ballots.userId, userId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findBallotWithVotes(
        db: DatabaseExecutor,
        organizationId: string,
        roundId: string,
        userId: string,
    ): Promise<BallotWithVotes | null> {
        const ballot = await this.findBallot(db, organizationId, roundId, userId);
        if (ballot === null) {
            return null;
        }
        const rows = await db
            .select({ submissionId: votes.submissionId, stars: votes.stars })
            .from(votes)
            .where(and(eq(votes.organizationId, organizationId), eq(votes.ballotId, ballot.id)))
            .orderBy(asc(votes.createdAt), asc(votes.id));
        return { ballot, scores: rows };
    }

    async listBallotsWithVotes(
        db: DatabaseExecutor,
        organizationId: string,
        roundId: string,
    ): Promise<readonly BallotWithVotes[]> {
        const ballotRows = await db
            .select()
            .from(ballots)
            .where(and(eq(ballots.organizationId, organizationId), eq(ballots.roundId, roundId)))
            .orderBy(asc(ballots.submittedAt), asc(ballots.id));
        if (ballotRows.length === 0) {
            return [];
        }
        const voteRows = await db
            .select({
                ballotId: votes.ballotId,
                submissionId: votes.submissionId,
                stars: votes.stars,
            })
            .from(votes)
            .where(and(eq(votes.organizationId, organizationId), eq(votes.roundId, roundId)))
            .orderBy(asc(votes.createdAt), asc(votes.id));
        const scoresByBallot = new Map<
            string,
            { readonly submissionId: string; readonly stars: number }[]
        >();
        for (const row of voteRows) {
            const scores = scoresByBallot.get(row.ballotId) ?? [];
            scores.push({ submissionId: row.submissionId, stars: row.stars });
            scoresByBallot.set(row.ballotId, scores);
        }
        return ballotRows.map((ballot) => ({
            ballot,
            scores: scoresByBallot.get(ballot.id) ?? [],
        }));
    }

    async insertBallot(session: DatabaseSession, values: NewBallotValues): Promise<BallotRow> {
        const [row] = await session.db.insert(ballots).values(values).returning();
        if (row === undefined) {
            throw new Error("The ballot could not be created.");
        }
        return row;
    }

    async insertVotes(session: DatabaseSession, values: readonly NewVoteValues[]): Promise<void> {
        await session.db.insert(votes).values([...values]);
    }

    async deleteVotes(
        session: DatabaseSession,
        organizationId: string,
        ballotId: string,
    ): Promise<void> {
        await session.db
            .delete(votes)
            .where(and(eq(votes.organizationId, organizationId), eq(votes.ballotId, ballotId)));
    }

    async touchBallot(
        session: DatabaseSession,
        organizationId: string,
        ballotId: string,
        submittedAt: Date,
        reasoning: string,
    ): Promise<BallotRow | null> {
        const rows = await session.db
            .update(ballots)
            .set({ submittedAt, reasoning })
            .where(and(eq(ballots.organizationId, organizationId), eq(ballots.id, ballotId)))
            .returning();
        return rows[0] ?? null;
    }

    async aggregateVotes(
        db: DatabaseExecutor,
        organizationId: string,
        roundId: string,
    ): Promise<readonly VoteTallyRow[]> {
        return db
            .select({
                submissionId: votes.submissionId,
                votes: sql<number>`count(*)::int`,
                totalStars: sql<number>`coalesce(sum(${votes.stars}), 0)::int`,
            })
            .from(votes)
            .where(and(eq(votes.organizationId, organizationId), eq(votes.roundId, roundId)))
            .groupBy(votes.submissionId)
            .orderBy(sql`count(*) desc`);
    }

    async countBallots(
        db: DatabaseExecutor,
        organizationId: string,
        roundId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(ballots)
            .where(and(eq(ballots.organizationId, organizationId), eq(ballots.roundId, roundId)));
        return rows[0]?.count ?? 0;
    }
}
