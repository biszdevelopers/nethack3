import { useState, type ReactNode } from "react";
import type { TeamDetail, TeamInvitation } from "@nethack/contracts";
import { Alert, Badge, Button } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { formatDateTime } from "../../../lib/format.js";
import { useInvitationLink, useRevokeTeamInvitation } from "../hooks/use-teams.js";
import { InviteLink } from "./invite-link.js";

export function TeamInvitations({ team }: { readonly team: TeamDetail }): ReactNode {
    const pending = team.invitations.filter((invitation) => invitation.status === "pending");

    if (pending.length === 0) {
        return <p className="text-sm text-ink-muted">No pending invitations.</p>;
    }
    return (
        <ul className="flex flex-col divide-y divide-line">
            {pending.map((invitation) => (
                <PendingInvitation key={invitation.id} teamId={team.id} invitation={invitation} />
            ))}
        </ul>
    );
}

function PendingInvitation({
    teamId,
    invitation,
}: {
    readonly teamId: string;
    readonly invitation: TeamInvitation;
}): ReactNode {
    const [linkPath, setLinkPath] = useState<string | null>(null);
    const link = useInvitationLink(teamId);
    const revoke = useRevokeTeamInvitation(teamId);
    const error = link.error ?? revoke.error ?? null;

    const showLink = async (): Promise<void> => {
        try {
            const result = await link.mutateAsync(invitation.id);
            setLinkPath(result.inviteUrl);
        } catch {
            setLinkPath(null);
        }
    };

    return (
        <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-ink">{invitation.email}</span>
                <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral" size="sm">
                        Pending
                    </Badge>
                    <span className="text-xs text-ink-subtle">
                        Expires {formatDateTime(invitation.expiresAt)}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        loading={link.isPending}
                        onClick={() => void showLink()}
                    >
                        Copy link
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        loading={revoke.isPending}
                        onClick={() => {
                            revoke.mutate(invitation.id);
                        }}
                    >
                        Revoke
                    </Button>
                </span>
            </div>
            {linkPath === null ? null : <InviteLink path={linkPath} />}
            {error === null ? null : (
                <Alert tone="critical" title="The invitation could not be updated">
                    {errorMessage(error)}
                </Alert>
            )}
        </li>
    );
}
