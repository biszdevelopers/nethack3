import type { ReactNode } from "react";
import { Link } from "react-router";
import type { JudgeFlag, JudgingCalibration, JudgingCoverageJudge } from "@nethack/contracts";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    useToast,
} from "@nethack/ui";
import { formatDateTime } from "../../shared/datetime.js";
import { describeError } from "../../shared/errors.js";
import { RequestError } from "../../shared/states.jsx";
import { useJudgingCoverage, useResolveJudgingFlag } from "../hooks.js";

function scoreLabel(score: number | null): string {
    return score === null ? "—" : score.toFixed(2);
}

function deltaLabel(delta: number | null): string {
    if (delta === null) {
        return "—";
    }
    return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
}

function calibrationLabel(calibration: JudgingCalibration): string {
    switch (calibration) {
        case "above":
            return "Above edition average";
        case "in_line":
            return "In line with edition average";
        case "below":
            return "Below edition average";
        case "insufficient_data":
            return "Not enough submissions";
    }
}

function calibrationTone(calibration: JudgingCalibration): "neutral" | "primary" | "outline" {
    switch (calibration) {
        case "in_line":
            return "primary";
        case "insufficient_data":
            return "neutral";
        default:
            return "outline";
    }
}

export function JudgingCoveragePanel({
    organizationId,
    editionId,
}: {
    readonly organizationId: string;
    readonly editionId: string | null;
}): ReactNode {
    const { toast } = useToast();
    const coverage = useJudgingCoverage(organizationId, editionId);
    const resolveFlag = useResolveJudgingFlag(organizationId);

    if (editionId === null) {
        return (
            <EmptyState
                title="Select a competition edition"
                description="Judge coverage is reported per competition edition."
            />
        );
    }
    if (coverage.isPending) {
        return <LoadingBlock rows={4} label="Loading judge coverage" />;
    }
    if (coverage.isError) {
        return <RequestError error={coverage.error} onRetry={() => void coverage.refetch()} />;
    }
    const data = coverage.data;
    if (data === null || data === undefined) {
        return (
            <EmptyState
                title="No judge coverage"
                description="Coverage appears after judges are assigned in this edition."
            />
        );
    }

    const onResolve = (flag: JudgeFlag): void => {
        resolveFlag.mutate(flag.id, {
            onSuccess: () => toast({ title: "Flag resolved", tone: "success" }),
            onError: (error) =>
                toast({
                    title: "Could not resolve the flag",
                    description: describeError(error),
                    tone: "critical",
                }),
        });
    };

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>{data.editionName}</CardTitle>
                    <CardDescription>
                        Assignment progress, calibration against the edition average, and open
                        flags.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <KeyValue
                        columns={2}
                        items={[
                            { label: "Judges", value: String(data.judgeCount) },
                            { label: "Assignments", value: String(data.assignmentCount) },
                            { label: "Submitted", value: String(data.submittedCount) },
                            {
                                label: "Edition average",
                                value: scoreLabel(data.editionAverageScore),
                            },
                        ]}
                    />
                    {data.judges.length === 0 ? (
                        <EmptyState
                            title="No judges assigned"
                            description="Create assignments before judging coverage is available."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Judge</TableHead>
                                    <TableHead>Assignments</TableHead>
                                    <TableHead>Submitted</TableHead>
                                    <TableHead>Recusals</TableHead>
                                    <TableHead>Open flags</TableHead>
                                    <TableHead>Average</TableHead>
                                    <TableHead>Calibration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.judges.map((judge: JudgingCoverageJudge) => (
                                    <TableRow key={judge.judgeUserId}>
                                        <TableCell className="font-medium">
                                            {judge.judgeDisplayName}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {String(judge.assignmentCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {String(judge.submittedCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {String(judge.conflictCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {String(judge.openFlagCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {scoreLabel(judge.averageWeightedScore)}
                                        </TableCell>
                                        <TableCell>
                                            <span className="flex flex-col gap-1">
                                                <Badge tone={calibrationTone(judge.calibration)}>
                                                    {calibrationLabel(judge.calibration)}
                                                </Badge>
                                                <span className="text-xs text-ink-muted tabular-nums">
                                                    {deltaLabel(judge.calibrationDelta)} vs edition
                                                </span>
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Open flags</CardTitle>
                    <CardDescription>
                        Judge-reported concerns that still need an organizer decision.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {data.openFlags.length === 0 ? (
                        <EmptyState
                            title="No open flags"
                            description="Flags reported by judges appear here until they are resolved."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Reported by</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Reported</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.openFlags.map((flag) => (
                                    <TableRow key={flag.id}>
                                        <TableCell className="font-medium">
                                            {flag.reportedByDisplayName}
                                        </TableCell>
                                        <TableCell>{flag.reason}</TableCell>
                                        <TableCell className="text-ink-muted">
                                            {formatDateTime(flag.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="inline-flex flex-wrap justify-end gap-2">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link
                                                        to={`/judging/assignments/${flag.assignmentId}`}
                                                    >
                                                        Open assignment
                                                    </Link>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    loading={resolveFlag.isPending}
                                                    onClick={() => onResolve(flag)}
                                                >
                                                    Resolve
                                                </Button>
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
