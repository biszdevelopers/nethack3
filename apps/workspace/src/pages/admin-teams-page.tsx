import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
    teamStatusSchema,
    type AdministrationTeam,
    type AdministrationTeamSubmission,
} from "@nethack/contracts";
import {
    Alert,
    AlertDialog,
    Badge,
    Button,
    Card,
    EmptyState,
    LoadingBlock,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { useOrganizerEditions } from "../capabilities/competitions/hooks.js";
import {
    useAdministrationTeams,
    useDeleteAdministrationTeam,
    useReopenAdministrationSubmission,
    useUpdateAdministrationTeamStatus,
} from "../capabilities/administration/hooks.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { describeError } from "../capabilities/shared/errors.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import { humanizeToken } from "../capabilities/shared/format.js";
import { TEAM_STATUS_OPTIONS, teamStatusLabel } from "../capabilities/teams/status.js";

interface PendingReopen {
    readonly team: AdministrationTeam;
    readonly submission: AdministrationTeamSubmission;
}

export function AdminTeamsPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const organizationId = membership?.organizationId ?? null;
    const canManage = membership?.role === "owner" || membership?.role === "organizer";
    const { toast } = useToast();

    const organizerEditions = useOrganizerEditions(organizationId, canManage);
    const [selectedEditionId, setSelectedEditionId] = useState("");
    const editionId =
        selectedEditionId === "" ? (organizerEditions.editions[0]?.id ?? "") : selectedEditionId;

    const teams = useAdministrationTeams(organizationId, editionId, canManage);
    const updateStatus = useUpdateAdministrationTeamStatus(organizationId, editionId);
    const deleteTeam = useDeleteAdministrationTeam(organizationId, editionId);
    const reopenSubmission = useReopenAdministrationSubmission(organizationId, editionId);

    const [pendingDelete, setPendingDelete] = useState<AdministrationTeam | null>(null);
    const [pendingReopen, setPendingReopen] = useState<PendingReopen | null>(null);

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading teams" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Teams"
                    description="Edition teams, membership, status, and submissions."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization to administer its teams."
                />
            </div>
        );
    }
    if (!canManage) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Teams"
                    description="Edition teams, membership, status, and submissions."
                />
                <Alert tone="warning" title="Organizer access required">
                    Only an owner or organizer of{" "}
                    {membership?.organizationName ?? "this organization"} can administer teams.
                </Alert>
            </div>
        );
    }

    const items = teams.data?.items ?? [];

    const changeStatus = (team: AdministrationTeam, value: string): void => {
        const parsed = teamStatusSchema.safeParse(value);
        if (!parsed.success) {
            return;
        }
        updateStatus.mutate(
            { teamId: team.id, status: parsed.data },
            {
                onSuccess: () =>
                    toast({
                        title: "Team status updated",
                        description: `${team.name} is now ${teamStatusLabel(parsed.data)}.`,
                        tone: "success",
                    }),
                onError: (error) =>
                    toast({
                        title: "Could not update the team status",
                        description: describeError(error),
                        tone: "critical",
                    }),
            },
        );
    };

    const onDelete = async (): Promise<void> => {
        if (pendingDelete === null) {
            return;
        }
        try {
            await deleteTeam.mutateAsync(pendingDelete.id);
            toast({ title: "Team deleted", description: pendingDelete.name, tone: "success" });
            setPendingDelete(null);
        } catch (error) {
            toast({
                title: "Could not delete the team",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onReopen = async (): Promise<void> => {
        if (pendingReopen === null) {
            return;
        }
        try {
            await reopenSubmission.mutateAsync({
                submissionId: pendingReopen.submission.id,
                body: { status: "draft" },
            });
            toast({
                title: "Submission reopened",
                description: `${pendingReopen.team.name} can edit and resubmit.`,
                tone: "success",
            });
            setPendingReopen(null);
        } catch (error) {
            toast({
                title: "Could not reopen the submission",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Teams"
                description={`Teams in ${membership.organizationName}, with members, status, and submissions.`}
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
                    description="Create a competition edition before administering teams."
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
                    <p className="text-xs text-ink-muted">
                        Withdrawn, disqualified, no show, and disbanded are final statuses and
                        cannot be reopened.
                    </p>

                    {editionId === "" ? (
                        <EmptyState
                            title="No edition selected"
                            description="Choose a competition edition to list its teams."
                        />
                    ) : teams.isPending ? (
                        <LoadingBlock rows={5} label="Loading teams" />
                    ) : teams.isError ? (
                        <RequestError error={teams.error} onRetry={() => void teams.refetch()} />
                    ) : items.length === 0 ? (
                        <EmptyState
                            title="No teams"
                            description="Teams appear here when participants create them in this edition."
                        />
                    ) : (
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Team</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Members</TableHead>
                                        <TableHead>Submissions</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((team) => {
                                        const deletable =
                                            team.memberCount === 0 && team.submissions.length === 0;
                                        return (
                                            <TableRow key={team.id}>
                                                <TableCell>
                                                    <span className="font-medium">{team.name}</span>
                                                    <span className="block text-xs text-ink-subtle">
                                                        {team.memberCount} of {team.maxMembers}{" "}
                                                        members
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <label
                                                        className="sr-only"
                                                        htmlFor={`status-${team.id}`}
                                                    >
                                                        Status for {team.name}
                                                    </label>
                                                    <select
                                                        id={`status-${team.id}`}
                                                        className="h-9 w-36 rounded-md border border-line bg-app px-2 text-xs text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                                        value={team.status}
                                                        disabled={updateStatus.isPending}
                                                        onChange={(event) =>
                                                            changeStatus(team, event.target.value)
                                                        }
                                                    >
                                                        {TEAM_STATUS_OPTIONS.map((option) => (
                                                            <option
                                                                key={option.value}
                                                                value={option.value}
                                                            >
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </TableCell>
                                                <TableCell>
                                                    {team.members.length === 0 ? (
                                                        <span className="text-ink-subtle">
                                                            No members
                                                        </span>
                                                    ) : (
                                                        <span className="flex flex-col gap-0.5 text-xs text-ink-muted">
                                                            {team.members.map((member) => (
                                                                <span key={member.userId}>
                                                                    {member.displayName}
                                                                    {member.role === "captain"
                                                                        ? " (captain)"
                                                                        : ""}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {team.submissions.length === 0 ? (
                                                        <span className="text-ink-subtle">
                                                            No submission
                                                        </span>
                                                    ) : (
                                                        <span className="flex flex-col gap-2">
                                                            {team.submissions.map((submission) => (
                                                                <span
                                                                    key={submission.id}
                                                                    className="flex flex-wrap items-center gap-2"
                                                                >
                                                                    <span className="text-xs text-ink-muted">
                                                                        {submission.projectTitle}
                                                                    </span>
                                                                    <Badge
                                                                        tone={
                                                                            submission.status ===
                                                                            "submitted"
                                                                                ? "primary"
                                                                                : "neutral"
                                                                        }
                                                                    >
                                                                        {humanizeToken(
                                                                            submission.status,
                                                                        )}
                                                                    </Badge>
                                                                    {submission.status ===
                                                                    "submitted" ? (
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            aria-label={`Reopen submission for ${team.name}`}
                                                                            onClick={() =>
                                                                                setPendingReopen({
                                                                                    team,
                                                                                    submission,
                                                                                })
                                                                            }
                                                                        >
                                                                            Reopen
                                                                        </Button>
                                                                    ) : null}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`Delete team ${team.name}`}
                                                        disabled={
                                                            !deletable || deleteTeam.isPending
                                                        }
                                                        title={
                                                            deletable
                                                                ? "Delete this empty team"
                                                                : "Remove all members and submissions before deleting the team"
                                                        }
                                                        onClick={() => setPendingDelete(team)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Card>
                    )}
                </>
            )}

            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
                title="Delete team"
                description={`Delete ${pendingDelete?.name ?? "this team"}? Only teams without members or submissions can be deleted. This cannot be undone.`}
                confirmLabel="Delete team"
                tone="destructive"
                loading={deleteTeam.isPending}
                onConfirm={onDelete}
            />

            <AlertDialog
                open={pendingReopen !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingReopen(null);
                    }
                }}
                title="Reopen submission"
                description={`Move ${pendingReopen?.submission.projectTitle ?? "this submission"} back to draft so the team can edit and resubmit? This is only allowed while no evaluation has been submitted.`}
                confirmLabel="Reopen submission"
                loading={reopenSubmission.isPending}
                onConfirm={onReopen}
            />
        </div>
    );
}
