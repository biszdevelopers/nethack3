import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui";
import { useActiveMembership } from "../../../application/session.js";
import { OrganizationRequired } from "../../../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";
import { errorMessage } from "../../../lib/errors.js";
import { formatDateTime } from "../../../lib/format.js";
import {
    useAcceptTeamInvitation,
    useAcceptTeamInvitationById,
    useDeclineTeamInvitation,
    useMyTeamInvitations,
} from "../hooks/use-teams.js";

export function InvitationsPage(): ReactNode {
    const { membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const token = searchParams.get("token");
    const invitations = useMyTeamInvitations();
    const acceptToken = useAcceptTeamInvitation();
    const acceptById = useAcceptTeamInvitationById();
    const decline = useDeclineTeamInvitation();

    if (membership === null) {
        return (
            <div className="flex flex-col gap-6">
                <Heading />
                <OrganizationRequired />
            </div>
        );
    }

    const clearToken = (): void => {
        const next = new URLSearchParams(searchParams);
        next.delete("token");
        setSearchParams(next, { replace: true });
    };
    const accepted = acceptById.data ?? null;
    const error = acceptById.error ?? decline.error ?? null;

    return (
        <div className="flex flex-col gap-6">
            <Heading />

            {token === null ? null : (
                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Team invitation</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-ink-muted">
                            Accept the invitation link to join the team for the current
                            organization.
                        </p>
                        {acceptToken.error === null ? null : (
                            <Alert tone="critical" title="The invitation could not be accepted">
                                {errorMessage(acceptToken.error)}
                            </Alert>
                        )}
                        {acceptToken.data === undefined ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    loading={acceptToken.isPending}
                                    onClick={() => {
                                        acceptToken.mutate(token);
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
                                    You joined {acceptToken.data.teamName}.
                                </Alert>
                                <Button asChild variant="outline" className="w-fit">
                                    <Link to={`/teams/${acceptToken.data.teamId}`}>Open team</Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {accepted === null ? null : (
                <Alert tone="success" title="Invitation accepted">
                    You joined {accepted.teamName}.{" "}
                    <Link
                        to={`/teams/${accepted.teamId}`}
                        className="text-primary underline-offset-4 hover:underline"
                    >
                        Open team
                    </Link>
                </Alert>
            )}

            {error === null ? null : (
                <Alert tone="critical" title="The invitation could not be updated">
                    {errorMessage(error)}
                </Alert>
            )}

            <section className="flex flex-col gap-3" aria-label="Pending invitations">
                <h2 className="text-lg font-bold tracking-tight">Pending invitations</h2>
                {invitations.isPending ? (
                    <QueryLoading label="Loading invitations" />
                ) : invitations.error !== null ? (
                    <QueryErrorState error={invitations.error} />
                ) : invitations.data.items.length === 0 ? (
                    <EmptyState
                        title="No pending invitations"
                        description="Team invitations sent to your email address appear here."
                    />
                ) : (
                    <ul className="flex flex-col gap-3">
                        {invitations.data.items.map((invitation) => (
                            <li key={invitation.id}>
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-3">
                                            <CardTitle>{invitation.teamName}</CardTitle>
                                            <Badge tone="neutral" size="sm">
                                                Pending
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-ink-subtle">
                                            {invitation.editionName}
                                            {invitation.divisionName === null
                                                ? ""
                                                : ` · ${invitation.divisionName}`}
                                        </p>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-3">
                                        <p className="text-sm text-ink-muted">
                                            Invited by {invitation.inviterDisplayName}. Expires{" "}
                                            {formatDateTime(invitation.expiresAt)}.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                loading={
                                                    acceptById.isPending &&
                                                    acceptById.variables === invitation.id
                                                }
                                                onClick={() => {
                                                    acceptById.mutate(invitation.id);
                                                    if (token !== null) {
                                                        clearToken();
                                                    }
                                                }}
                                            >
                                                Accept
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                loading={
                                                    decline.isPending &&
                                                    decline.variables === invitation.id
                                                }
                                                onClick={() => {
                                                    decline.mutate(invitation.id);
                                                }}
                                            >
                                                Decline
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function Heading(): ReactNode {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight">Invitations</h1>
            <p className="text-sm text-ink-muted">
                Review team invitations sent to your email address.
            </p>
        </div>
    );
}
