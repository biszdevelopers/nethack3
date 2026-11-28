import type { ReactNode } from "react";
import {
    Alert,
    Badge,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    LoadingBlock,
} from "@nethack/ui";
import { formatDateTime } from "../../shared/datetime.js";
import { RequestError } from "../../shared/states.jsx";
import { useTeamFeedback } from "../hooks.js";

function scoreLabel(score: number | null): string {
    return score === null ? "Not scored" : `${score.toFixed(2)} / 100`;
}

export function TeamFeedbackPanel({
    organizationId,
    editionId,
    teamId,
    teamName,
}: {
    readonly organizationId: string;
    readonly editionId: string;
    readonly teamId: string;
    readonly teamName: string | null;
}): ReactNode {
    const feedback = useTeamFeedback(organizationId, editionId, teamId);

    let content: ReactNode;
    if (feedback.isPending) {
        content = <LoadingBlock rows={2} label="Loading anonymous feedback" />;
    } else if (feedback.isError) {
        content = <RequestError error={feedback.error} onRetry={() => void feedback.refetch()} />;
    } else if (feedback.data === null) {
        content = null;
    } else if (feedback.data.withheld) {
        content = (
            <Alert tone="warning" title="Feedback withheld for anonymity">
                Written feedback stays hidden until at least {String(feedback.data.threshold)}{" "}
                submitted evaluations exist. This team currently has{" "}
                {String(feedback.data.submittedCount)} of {String(feedback.data.threshold)}.
            </Alert>
        );
    } else if (feedback.data.feedback.length === 0) {
        content = (
            <EmptyState
                title="No written feedback"
                description="Submitted evaluations did not include a comment."
            />
        );
    } else {
        content = (
            <ul className="flex flex-col gap-3">
                {feedback.data.feedback.map((entry, index) => (
                    <li
                        key={`${entry.submittedAt}-${String(index)}`}
                        className="flex flex-col gap-2 rounded-md border border-line p-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">Anonymous evaluation</span>
                            <Badge tone="neutral">{scoreLabel(entry.weightedScore)}</Badge>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-ink">
                            {entry.comment.length === 0 ? "No written comment." : entry.comment}
                        </p>
                        <span className="text-xs text-ink-subtle">
                            Submitted {formatDateTime(entry.submittedAt)}
                        </span>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <Card role="region" aria-label="Anonymous team feedback">
            <CardHeader>
                <CardTitle>Anonymous team feedback</CardTitle>
                <CardDescription>
                    {teamName ?? "This team"} · judge names, accounts, and individual score
                    breakdowns are hidden. Written feedback appears only after at least{" "}
                    {String(feedback.data?.threshold ?? 3)} submitted evaluations.
                </CardDescription>
            </CardHeader>
            <CardContent>{content}</CardContent>
        </Card>
    );
}
