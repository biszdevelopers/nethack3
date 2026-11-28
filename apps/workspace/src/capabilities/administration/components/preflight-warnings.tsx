import type { ReactNode } from "react";
import {
    Alert,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    LoadingBlock,
} from "@nethack/ui";
import { TEAM_FEEDBACK_MINIMUM_EVALUATIONS } from "@nethack/contracts";
import { useAdministrationPreflight } from "../hooks.js";
import { RequestError } from "../../shared/states.jsx";

interface PreflightWarningsProps {
    readonly organizationId: string;
    readonly editionId: string;
    readonly enabled: boolean;
}

/**
 * Warning lists backed by the preflight contract. Readiness booleans stay on the
 * standings page; this panel only surfaces problems an organizer can fix.
 */
export function PreflightWarnings({
    organizationId,
    editionId,
    enabled,
}: PreflightWarningsProps): ReactNode {
    const preflight = useAdministrationPreflight(organizationId, editionId, enabled);

    if (preflight.isPending) {
        return <LoadingBlock rows={2} label="Loading preflight warnings" />;
    }
    if (preflight.isError) {
        return <RequestError error={preflight.error} onRetry={() => void preflight.refetch()} />;
    }
    const data = preflight.data;
    if (data === null || data === undefined) {
        return null;
    }
    const hasWarnings =
        data.belowMinimumTeams.length > 0 ||
        data.scheduleWarnings.length > 0 ||
        data.voteCapWarnings.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preflight warnings</CardTitle>
                <CardDescription>
                    Schedule, feedback coverage, and voting-cap checks for this edition.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {hasWarnings ? null : (
                    <p className="text-sm text-ink-muted">No preflight warnings.</p>
                )}
                {data.belowMinimumTeams.length === 0 ? null : (
                    <Alert
                        tone="warning"
                        title={`${String(data.teamsBelowMinimumEvaluations)} teams below the ${String(TEAM_FEEDBACK_MINIMUM_EVALUATIONS)}-evaluation minimum`}
                    >
                        <ul className="flex list-disc flex-col gap-1 pl-5">
                            {data.belowMinimumTeams.map((team) => (
                                <li key={team.teamId ?? team.projectTitle}>
                                    {team.teamName ?? "No team"} · {team.projectTitle} (
                                    {String(team.submittedEvaluations)} of{" "}
                                    {String(TEAM_FEEDBACK_MINIMUM_EVALUATIONS)})
                                </li>
                            ))}
                        </ul>
                    </Alert>
                )}
                {data.scheduleWarnings.length === 0 ? null : (
                    <Alert tone="warning" title="Schedule">
                        <ul className="flex list-disc flex-col gap-1 pl-5">
                            {data.scheduleWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </Alert>
                )}
                {data.voteCapWarnings.length === 0 ? null : (
                    <Alert tone="warning" title="Voting capacity">
                        <ul className="flex list-disc flex-col gap-1 pl-5">
                            {data.voteCapWarnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
