import { useState, type ReactNode } from "react";
import type { TeamDetail } from "@nethack/contracts";
import { Alert, AlertDialog, Badge, Button, Separator } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { formatDateTime } from "../../../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import {
    useLeaveTeam,
    useRemoveTeamMember,
    useTransferCaptain,
    useUpdateTeam,
} from "../hooks/use-teams.js";
import { InviteMemberForm } from "./invite-member-form.js";

type PendingAction =
    | { readonly kind: "transfer"; readonly userId: string; readonly name: string }
    | { readonly kind: "remove"; readonly userId: string; readonly name: string }
    | { readonly kind: "leave" }
    | { readonly kind: "ready" };

export function TeamMembers({
    team,
    userId,
    isOrganizer,
}: {
    readonly team: TeamDetail;
    readonly userId: string | null;
    readonly isOrganizer: boolean;
}): ReactNode {
    const [pending, setPending] = useState<PendingAction | null>(null);
    const transfer = useTransferCaptain(team.id);
    const remove = useRemoveTeamMember(team.id);
    const leave = useLeaveTeam(team.id);
    const update = useUpdateTeam(team.id);

    const isCaptain = userId !== null && team.captainUserId === userId;
    const canManage = isCaptain || isOrganizer;
    const currentMember =
        userId === null ? null : (team.members.find((member) => member.userId === userId) ?? null);

    const error = transfer.error ?? remove.error ?? leave.error ?? update.error ?? null;

    const confirm = async (): Promise<void> => {
        if (pending === null) {
            return;
        }
        try {
            if (pending.kind === "transfer") {
                await transfer.mutateAsync(pending.userId);
            } else if (pending.kind === "remove") {
                await remove.mutateAsync(pending.userId);
            } else if (pending.kind === "leave") {
                await leave.mutateAsync();
            } else {
                await update.mutateAsync({ status: "ready" });
            }
            setPending(null);
        } catch {
            // The mutation error is rendered above the member list.
        }
    };

    const dialog = (() => {
        if (pending === null) {
            return null;
        }
        switch (pending.kind) {
            case "transfer":
                return {
                    title: "Transfer captaincy",
                    description: `${pending.name} becomes the team captain. You stay a regular member.`,
                    confirmLabel: "Transfer",
                    tone: "brand" as const,
                };
            case "remove":
                return {
                    title: "Remove team member",
                    description: `${pending.name} is removed from the team.`,
                    confirmLabel: "Remove",
                    tone: "destructive" as const,
                };
            case "leave":
                return {
                    title: "Leave team",
                    description: "You are removed from the team and its project access.",
                    confirmLabel: "Leave",
                    tone: "destructive" as const,
                };
            case "ready":
                return {
                    title: "Mark team ready",
                    description:
                        "A ready team confirms its roster. The server checks the minimum team size.",
                    confirmLabel: "Mark ready",
                    tone: "brand" as const,
                };
        }
    })();

    return (
        <div className="flex flex-col gap-4">
            {error === null ? null : (
                <Alert tone="critical" title="The team could not be updated">
                    {errorMessage(error)}
                </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusBadgeTone(team.status)} size="sm">
                    {humanizeStatus(team.status)}
                </Badge>
                <span className="text-xs text-ink-subtle">
                    {team.memberCount} of {team.maxMembers} members
                </span>
                {canManage && team.status === "forming" ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPending({ kind: "ready" })}
                    >
                        Mark ready
                    </Button>
                ) : null}
                {currentMember !== null && !isCaptain ? (
                    <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "leave" })}>
                        Leave team
                    </Button>
                ) : null}
            </div>

            <ul className="flex flex-col divide-y divide-line">
                {team.members.map((member) => (
                    <li
                        key={member.userId}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm text-ink">{member.displayName}</span>
                            <span className="text-xs text-ink-subtle">
                                Joined {formatDateTime(member.joinedAt)}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                tone={member.role === "captain" ? "primary" : "neutral"}
                                size="sm"
                            >
                                {humanizeStatus(member.role)}
                            </Badge>
                            {canManage && member.role !== "captain" ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setPending({
                                                kind: "transfer",
                                                userId: member.userId,
                                                name: member.displayName,
                                            })
                                        }
                                    >
                                        Make captain
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setPending({
                                                kind: "remove",
                                                userId: member.userId,
                                                name: member.displayName,
                                            })
                                        }
                                    >
                                        Remove
                                    </Button>
                                </>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ul>

            {canManage ? (
                <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">Invite a member</h3>
                        <InviteMemberForm teamId={team.id} />
                    </div>
                </>
            ) : null}

            {canManage ? (
                <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">Invitations</h3>
                        {team.invitations.length === 0 ? (
                            <p className="text-sm text-ink-muted">No invitations have been sent.</p>
                        ) : (
                            <ul className="flex flex-col divide-y divide-line">
                                {team.invitations.map((invitation) => (
                                    <li
                                        key={invitation.id}
                                        className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                                    >
                                        <span className="text-sm text-ink">{invitation.email}</span>
                                        <span className="flex items-center gap-2">
                                            <Badge
                                                tone={statusBadgeTone(invitation.status)}
                                                size="sm"
                                            >
                                                {humanizeStatus(invitation.status)}
                                            </Badge>
                                            <span className="text-xs text-ink-subtle">
                                                Expires {formatDateTime(invitation.expiresAt)}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : null}

            {dialog === null ? null : (
                <AlertDialog
                    open={pending !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            transfer.reset();
                            remove.reset();
                            leave.reset();
                            update.reset();
                            setPending(null);
                        }
                    }}
                    title={dialog.title}
                    description={dialog.description}
                    confirmLabel={dialog.confirmLabel}
                    tone={dialog.tone}
                    loading={
                        transfer.isPending ||
                        remove.isPending ||
                        leave.isPending ||
                        update.isPending
                    }
                    onConfirm={confirm}
                />
            )}
        </div>
    );
}
