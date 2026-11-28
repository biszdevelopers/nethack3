import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    KeyValue,
    LoadingBlock,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import { usePublicEditionOptions } from "../capabilities/competitions/hooks.js";
import { buildJudgeEditionOptions } from "../capabilities/judging/edition-options.js";
import { useJudgingHistory, useMyAssignments } from "../capabilities/judging/hooks.js";

function scoreLabel(score: number | null): string {
    return score === null ? "Not scored" : `${score.toFixed(2)} / 100`;
}

export function JudgingHistoryPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useParams<{ editionId?: string }>();
    const organizationId = membership?.organizationId ?? null;
    const myAssignments = useMyAssignments(organizationId);
    const publicEditions = usePublicEditionOptions(membership?.organizationSlug ?? null);
    const editions = buildJudgeEditionOptions(
        myAssignments.data?.items ?? [],
        publicEditions.editions,
    );
    const requestedEditionId = params.editionId ?? searchParams.get("edition");
    const editionId =
        editions.find((edition) => edition.id === requestedEditionId)?.id ??
        editions[0]?.id ??
        null;
    const history = useJudgingHistory(organizationId, editionId);

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
    };

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading judging history" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Judging history"
                    description="Your submitted evaluations for a competition edition."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization membership to review your judging history."
                />
            </div>
        );
    }

    if (myAssignments.isPending) {
        return <LoadingBlock rows={3} label="Loading judging history" />;
    }
    if (myAssignments.isError) {
        return (
            <RequestError
                error={myAssignments.error}
                onRetry={() => void myAssignments.refetch()}
            />
        );
    }

    const items = history.data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/judging">Back to judging</Link>
                </Button>
            </div>

            <PageHeader
                title="Judging history"
                description="Your submitted evaluations, including every criterion score and comment. This view stays available after judging closes."
            />

            {editions.length === 0 ? (
                <EmptyState
                    title="No judging assignments"
                    description="Your submitted evaluations appear here after you complete judging work."
                />
            ) : (
                <div className="max-w-md">
                    <EditionSelect
                        editions={[...editions]}
                        value={editionId ?? ""}
                        onValueChange={setEdition}
                    />
                </div>
            )}

            {editionId === null ? null : history.isPending ? (
                <LoadingBlock rows={4} label="Loading submitted evaluations" />
            ) : history.isError ? (
                <RequestError error={history.error} onRetry={() => void history.refetch()} />
            ) : items.length === 0 ? (
                <EmptyState
                    title="No submitted evaluations"
                    description="Submitted evaluations for this edition appear here after you finish scoring."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {items.map((item) => (
                        <Card key={item.assignmentId}>
                            <CardHeader>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>{item.projectTitle}</CardTitle>
                                        <CardDescription>
                                            {item.teamName ?? "No team"} · {item.rubricName}
                                        </CardDescription>
                                    </div>
                                    <Badge tone="primary">{scoreLabel(item.weightedScore)}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <KeyValue
                                    columns={2}
                                    items={[
                                        {
                                            label: "Submitted",
                                            value: formatDateTime(item.submittedAt),
                                        },
                                        {
                                            label: "Weighted score",
                                            value: scoreLabel(item.weightedScore),
                                        },
                                        {
                                            label: "Assignment",
                                            value: item.assignmentId,
                                        },
                                    ]}
                                />
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Criterion</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Weight</TableHead>
                                            <TableHead>Comment</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {item.scores.map((score) => (
                                            <TableRow key={score.criterionId}>
                                                <TableCell className="font-medium">
                                                    {score.criterionName}
                                                </TableCell>
                                                <TableCell className="tabular-nums">
                                                    {String(score.score)} / {String(score.maxScore)}
                                                </TableCell>
                                                <TableCell className="tabular-nums">
                                                    {String(score.weight)}
                                                </TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {score.comment.length === 0
                                                        ? "No comment"
                                                        : score.comment}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">Overall comment</span>
                                    <p className="text-sm text-ink-muted">
                                        {item.overallComment.length === 0
                                            ? "No overall comment"
                                            : item.overallComment}
                                    </p>
                                </div>
                                <div>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link to={`/judging/assignments/${item.assignmentId}`}>
                                            Open assignment
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
