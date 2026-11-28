import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    LoadingBlock,
    PageHeader,
    Statistics,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { useOrganizerEditions } from "../capabilities/competitions/hooks.js";
import {
    downloadStandingsCsv,
    useAdministrationPreflight,
} from "../capabilities/administration/hooks.js";
import { JudgingResultsPanel } from "../capabilities/judging/components/judging-results-panel.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { describeError } from "../capabilities/shared/errors.js";
import { RequestError } from "../capabilities/shared/states.jsx";

export function AdminStandingsPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const organizationId = membership?.organizationId ?? null;
    const canManage = membership?.role === "owner" || membership?.role === "organizer";
    const { toast } = useToast();

    const organizerEditions = useOrganizerEditions(organizationId, canManage);
    const [selectedEditionId, setSelectedEditionId] = useState("");
    const editionId =
        selectedEditionId === "" ? (organizerEditions.editions[0]?.id ?? "") : selectedEditionId;
    const [downloading, setDownloading] = useState(false);

    const preflight = useAdministrationPreflight(organizationId, editionId, canManage);

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading standings" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Standings"
                    description="Preflight counts and the judging standings export."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization to inspect its edition standings."
                />
            </div>
        );
    }
    if (!canManage) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Standings"
                    description="Preflight counts and the judging standings export."
                />
                <Alert tone="warning" title="Organizer access required">
                    Only an owner or organizer of{" "}
                    {membership?.organizationName ?? "this organization"} can inspect standings.
                </Alert>
            </div>
        );
    }

    const onDownload = async (): Promise<void> => {
        if (editionId === "") {
            return;
        }
        setDownloading(true);
        try {
            await downloadStandingsCsv(organizationId, editionId);
            toast({ title: "Standings CSV generated", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not generate the standings CSV",
                description: describeError(error),
                tone: "critical",
            });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Standings"
                description={`Judging standings and preflight counts for ${membership.organizationName}.`}
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link to="/admin">Back to administration</Link>
                    </Button>
                }
            />

            {organizerEditions.query.isPending ? (
                <LoadingBlock rows={2} label="Loading editions" />
            ) : organizerEditions.query.isError ? (
                <RequestError
                    error={organizerEditions.query.error}
                    onRetry={() => void organizerEditions.query.refetch()}
                />
            ) : organizerEditions.editions.length === 0 ? (
                <EmptyState
                    title="No editions"
                    description="Create a competition edition before generating standings."
                />
            ) : (
                <>
                    <Card className="max-w-md">
                        <div className="p-4">
                            <EditionSelect
                                editions={organizerEditions.editions}
                                value={editionId}
                                onValueChange={setSelectedEditionId}
                            />
                        </div>
                    </Card>

                    {editionId === "" ? (
                        <EmptyState
                            title="No edition selected"
                            description="Choose a competition edition to inspect preflight counts."
                        />
                    ) : preflight.isPending ? (
                        <LoadingBlock rows={3} label="Loading preflight counts" />
                    ) : preflight.isError ? (
                        <RequestError
                            error={preflight.error}
                            onRetry={() => void preflight.refetch()}
                        />
                    ) : preflight.data === null || preflight.data === undefined ? (
                        <EmptyState
                            title="No preflight data"
                            description="Select an edition to load preflight counts."
                        />
                    ) : (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Preflight</CardTitle>
                                    <CardDescription>
                                        Counts come from the same contracts the public and organizer
                                        screens read.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <Statistics
                                        columns={4}
                                        items={[
                                            { label: "Teams", value: preflight.data.teams },
                                            { label: "Projects", value: preflight.data.projects },
                                            {
                                                label: "Submissions",
                                                value: preflight.data.submissions,
                                            },
                                            {
                                                label: "Assignments",
                                                value: preflight.data.assignments,
                                            },
                                            {
                                                label: "Submitted evaluations",
                                                value: preflight.data.submittedEvaluations,
                                            },
                                            {
                                                label: "Open event flags",
                                                value: preflight.data.openFlags,
                                            },
                                            {
                                                label: "Results published",
                                                value: preflight.data.publishedResults
                                                    ? "Yes"
                                                    : "No",
                                            },
                                        ]}
                                    />
                                    <div
                                        className="flex flex-wrap gap-2"
                                        aria-label="Readiness checks"
                                    >
                                        <Badge
                                            tone={
                                                preflight.data.readiness.hasTeams
                                                    ? "primary"
                                                    : "neutral"
                                            }
                                        >
                                            {preflight.data.readiness.hasTeams
                                                ? "Teams ready"
                                                : "Teams missing"}
                                        </Badge>
                                        <Badge
                                            tone={
                                                preflight.data.readiness.hasSubmissions
                                                    ? "primary"
                                                    : "neutral"
                                            }
                                        >
                                            {preflight.data.readiness.hasSubmissions
                                                ? "Submissions ready"
                                                : "Submissions missing"}
                                        </Badge>
                                        <Badge
                                            tone={
                                                preflight.data.readiness.hasAssignments
                                                    ? "primary"
                                                    : "neutral"
                                            }
                                        >
                                            {preflight.data.readiness.hasAssignments
                                                ? "Assignments ready"
                                                : "Assignments missing"}
                                        </Badge>
                                        <Badge
                                            tone={
                                                preflight.data.readiness.hasSubmittedEvaluations
                                                    ? "primary"
                                                    : "neutral"
                                            }
                                        >
                                            {preflight.data.readiness.hasSubmittedEvaluations
                                                ? "Evaluations ready"
                                                : "Evaluations missing"}
                                        </Badge>
                                    </div>
                                    <div>
                                        <Button
                                            type="button"
                                            loading={downloading}
                                            onClick={() => void onDownload()}
                                        >
                                            Download CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <JudgingResultsPanel
                                organizationId={organizationId}
                                editionId={editionId}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
