import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@nethack/ui";
import type { MyParticipation, Team } from "@nethack/contracts";
import { useActiveMembership } from "../application/session.js";
import { OrganizationRequired } from "../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../components/query-state.js";
import { errorMessage } from "../lib/errors.js";
import { humanizeStatus } from "../lib/status.js";
import {
    useEdition,
    useMyParticipations,
} from "../capabilities/competitions/hooks/use-competitions.js";
import { CreateTeamDialog } from "../capabilities/teams/components/create-team-dialog.js";
import {
    useAcceptTeamInvitation,
    useEditionTeams,
    useMyTeamInvitations,
    useMyTeams,
} from "../capabilities/teams/hooks/use-teams.js";
import { teamStatusLabel, teamStatusTone } from "../capabilities/teams/status.js";
import { useProjects } from "../capabilities/projects/hooks/use-projects.js";
import { useSubmissions } from "../capabilities/submissions/hooks/use-submissions.js";

function editionNameFor(team: Team, participations: readonly MyParticipation[]): string | null {
    return (
        participations.find((participation) => participation.editionId === team.editionId)
            ?.editionName ?? null
    );
}

export function TeamsPage(): ReactNode {
    const { membership } = useActiveMembership();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const accept = useAcceptTeamInvitation();
    const myTeams = useMyTeams();
    const invitations = useMyTeamInvitations();
    const participations = useMyParticipations();
    const projects = useProjects({});
    const organizationParticipations = (participations.data?.items ?? []).filter(
        (participation) =>
            membership !== null && participation.organizationId === membership.organizationId,
    );
    const approved = organizationParticipations.filter(
        (participation) => participation.status === "approved",
    );
    const selectedApprovedEditionId =
        selectedEditionId !== null &&
        approved.some((participation) => participation.editionId === selectedEditionId)
            ? selectedEditionId
            : null;
    const effectiveEditionId = selectedApprovedEditionId ?? approved[0]?.editionId ?? null;
    const edition = useEdition(effectiveEditionId);
    const editionTeams = useEditionTeams(effectiveEditionId);
    const submissions = useSubmissions({
        editionId: effectiveEditionId ?? undefined,
    });

    if (membership === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeading />
                <OrganizationRequired />
            </div>
        );
    }

    const token = searchParams.get("token");
    const teams = myTeams.data?.items ?? [];
    const projectsById = projects.data?.items ?? [];
    const submissionsForEdition = submissions.data?.items ?? [];

    const clearToken = (): void => {
        const next = new URLSearchParams(searchParams);
        next.delete("token");
        setSearchParams(next, { replace: true });
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <PageHeading />
                <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={approved.length === 0}
                    aria-describedby={approved.length === 0 ? "create-team-requirement" : undefined}
                >
                    Create team
                </Button>
            </div>
            {approved.length === 0 ? (
                <p id="create-team-requirement" className="text-xs text-ink-muted">
                    Create a team after an organizer approves your registration for an edition.
                </p>
            ) : null}

            {token === null ? null : (
                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Team invitation</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-ink-muted">
                            Accept the invitation to join the team for the current organization.
                        </p>
                        {accept.error === null ? null : (
                            <Alert tone="critical" title="The invitation could not be accepted">
                                {errorMessage(accept.error)}
                            </Alert>
                        )}
                        {accept.data === undefined ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    loading={accept.isPending}
                                    onClick={() => {
                                        accept.mutate(token);
                                    }}
                                >
                                    Accept invitation
                                </Button>
                                <Button variant="outline" onClick={clearToken}>
                                    Dismiss
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Alert tone="success" title="Invitation accepted">
                                    You joined {accept.data.teamName}.
                                </Alert>
                                <Button asChild variant="outline" className="w-fit">
                                    <Link to={`/teams/${accept.data.teamId}`}>Open team</Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {(invitations.data?.items.length ?? 0) > 0 ? (
                <Card hoverable>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium text-ink">
                                {invitations.data?.items.length} pending team invitation
                                {invitations.data?.items.length === 1 ? "" : "s"}
                            </p>
                            <p className="text-xs text-ink-muted">
                                Invitations sent to your email address are waiting for a response.
                            </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link to="/invitations">Review invitations</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : null}

            <section className="flex flex-col gap-3" aria-label="Your teams">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold tracking-tight">Your teams</h2>
                    <p className="text-sm text-ink-muted">
                        Teams you belong to in {membership.organizationName}.
                    </p>
                </div>
                {myTeams.isPending ? (
                    <QueryLoading label="Loading your teams" />
                ) : myTeams.error !== null ? (
                    <QueryErrorState error={myTeams.error} />
                ) : teams.length === 0 ? (
                    <EmptyState
                        title="No team yet"
                        description="Create a team after your competition registration is approved, or accept an invitation."
                    />
                ) : (
                    <ul className="grid gap-4 md:grid-cols-2">
                        {teams.map((team) => {
                            const teamProjects = projectsById.filter(
                                (project) => project.teamId === team.id,
                            );
                            const submission =
                                submissionsForEdition.find(
                                    (candidate) => candidate.teamId === team.id,
                                ) ?? null;
                            return (
                                <li key={team.id}>
                                    <Card hoverable className="flex h-full flex-col">
                                        <CardHeader>
                                            <div className="flex items-start justify-between gap-3">
                                                <CardTitle>{team.name}</CardTitle>
                                                <Badge tone={teamStatusTone(team.status)} size="sm">
                                                    {teamStatusLabel(team.status)}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-ink-subtle">
                                                {editionNameFor(team, organizationParticipations) ??
                                                    "Edition"}
                                            </p>
                                        </CardHeader>
                                        <CardContent className="flex flex-1 flex-col gap-3">
                                            <p className="text-sm text-ink-muted">
                                                {team.memberCount} of {team.maxMembers} members
                                            </p>
                                            <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
                                                <Badge
                                                    tone={
                                                        teamProjects.length > 0
                                                            ? "primary"
                                                            : "outline"
                                                    }
                                                    size="sm"
                                                >
                                                    {teamProjects.length > 0
                                                        ? "project created"
                                                        : "no project"}
                                                </Badge>
                                                <Badge
                                                    tone={
                                                        submission === null ? "outline" : "primary"
                                                    }
                                                    size="sm"
                                                >
                                                    {submission === null
                                                        ? "no submission"
                                                        : humanizeStatus(submission.status)}
                                                </Badge>
                                            </div>
                                            <div className="mt-auto">
                                                <Button asChild variant="outline" size="sm">
                                                    <Link to={`/teams/${team.id}`}>Open team</Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="flex flex-col gap-3" aria-label="Edition teams">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-bold tracking-tight">Edition teams</h2>
                        <p className="text-sm text-ink-muted">
                            Teams formed in an edition you are registered for.
                        </p>
                    </div>
                    {approved.length === 0 ? null : (
                        <div className="w-full sm:w-72">
                            <Select
                                label="Edition"
                                options={approved.map((participation) => ({
                                    value: participation.editionId,
                                    label: participation.editionName,
                                }))}
                                value={effectiveEditionId ?? ""}
                                onValueChange={(value) => setSelectedEditionId(value)}
                                placeholder="Select an edition"
                            />
                        </div>
                    )}
                </div>

                {effectiveEditionId === null ? (
                    <EmptyState
                        title="No approved registration"
                        description="Register for a competition first. Edition teams appear here after approval."
                    />
                ) : editionTeams.isPending ? (
                    <QueryLoading label="Loading edition teams" />
                ) : editionTeams.error !== null ? (
                    <QueryErrorState error={editionTeams.error} />
                ) : editionTeams.data.items.length === 0 ? (
                    <EmptyState
                        title="No teams in this edition"
                        description="The first team appears after an approved participant creates one."
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Team</TableHead>
                                <TableHead>Division</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Members</TableHead>
                                <TableHead className="text-right">Open</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {editionTeams.data.items.map((team) => {
                                const division =
                                    edition.data?.divisions.find(
                                        (candidate) => candidate.id === team.divisionId,
                                    ) ?? null;
                                return (
                                    <TableRow key={team.id}>
                                        <TableCell className="font-medium">{team.name}</TableCell>
                                        <TableCell>
                                            {division === null ? "No division" : division.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge tone={teamStatusTone(team.status)} size="sm">
                                                {teamStatusLabel(team.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {team.memberCount} of {team.maxMembers}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="sm">
                                                <Link to={`/teams/${team.id}`}>View</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </section>

            <CreateTeamDialog
                participations={organizationParticipations}
                defaultEditionId={effectiveEditionId}
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(teamId) => {
                    navigate(`/teams/${teamId}`);
                }}
            />
        </div>
    );
}

function PageHeading(): ReactNode {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight">Teams</h1>
            <p className="text-sm text-ink-muted">
                Form a team, invite participants, and prepare your submission together.
            </p>
        </div>
    );
}
