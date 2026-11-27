import type { ReactNode } from "react";
import { Link } from "react-router";
import {
    Badge,
    Button,
    Card,
    EmptyState,
    LoadingBlock,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@nethack/ui";
import { RequestError } from "../../shared/states.jsx";
import { useEditionJudgingResults } from "../hooks.js";

function scoreLabel(score: number | null): string {
    return score === null ? "Not scored" : `${score.toFixed(2)} / 100`;
}

export function JudgingResultsPanel({
    organizationId,
    editionId,
}: {
    readonly organizationId: string;
    readonly editionId: string;
}): ReactNode {
    const results = useEditionJudgingResults(organizationId, editionId);
    const items = results.data?.items ?? [];

    return (
        <section
            className="flex flex-col gap-4 border-t border-line pt-6"
            aria-labelledby="judging-results-heading"
        >
            <div className="flex flex-col gap-1">
                <h2 id="judging-results-heading" className="text-lg font-bold tracking-tight">
                    Results
                </h2>
                <p className="text-sm text-ink-muted">
                    Mean weighted score of submitted evaluations. Draft evaluations are excluded
                    from the ranking.
                </p>
            </div>

            {results.isPending ? (
                <LoadingBlock rows={3} label="Loading judging results" />
            ) : results.isError ? (
                <RequestError error={results.error} onRetry={() => void results.refetch()} />
            ) : items.length === 0 ? (
                <EmptyState
                    title="No judging results"
                    description="Results appear after an organizer assigns judges to submissions in this edition."
                />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Rank</TableHead>
                                <TableHead>Project</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Evaluations</TableHead>
                                <TableHead className="text-right">Open</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((result) => (
                                <TableRow key={result.submissionId}>
                                    <TableCell className="font-medium tabular-nums">
                                        {result.rank === null ? "—" : String(result.rank)}
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium">{result.projectTitle}</span>
                                        <span className="block text-xs text-ink-subtle">
                                            {result.teamName ?? "No team"}
                                        </span>
                                        <span className="mt-1 flex flex-wrap gap-2">
                                            {result.evaluations.map((evaluation) => (
                                                <Badge
                                                    key={evaluation.assignmentId}
                                                    tone={
                                                        evaluation.status === "submitted"
                                                            ? "primary"
                                                            : "neutral"
                                                    }
                                                    size="sm"
                                                >
                                                    {evaluation.judgeDisplayName}:{" "}
                                                    {scoreLabel(evaluation.weightedScore)}
                                                </Badge>
                                            ))}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-medium tabular-nums">
                                        {scoreLabel(result.averageScore)}
                                    </TableCell>
                                    <TableCell className="tabular-nums text-ink-muted">
                                        {result.submittedCount} of {result.assignmentCount}{" "}
                                        submitted
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="sm">
                                            <Link to={`/submissions/${result.submissionId}`}>
                                                Open submission
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </section>
    );
}
