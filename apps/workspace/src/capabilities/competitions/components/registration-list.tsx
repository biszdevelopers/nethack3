import type { ReactNode } from "react";
import type { Division, Registration } from "@nethack/contracts";
import {
    Alert,
    Badge,
    Button,
    EmptyState,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { formatDateTime } from "../../../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import { useDecideRegistration, useEditionRegistrations } from "../hooks/use-competitions.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";

export function RegistrationList({
    editionId,
    divisions,
}: {
    readonly editionId: string;
    readonly divisions: readonly Division[];
}): ReactNode {
    const registrations = useEditionRegistrations(editionId, true);
    const decide = useDecideRegistration(editionId);

    if (registrations.isPending) {
        return <QueryLoading label="Loading registrations" />;
    }
    if (registrations.error !== null) {
        return <QueryErrorState error={registrations.error} />;
    }
    const items = registrations.data.items;
    if (items.length === 0) {
        return (
            <EmptyState
                title="No registrations yet"
                description="Registrations appear here when participants register for this edition."
            />
        );
    }

    const decideFor = (
        registration: Registration,
        status: "approved" | "rejected" | "waitlisted",
    ) => {
        decide.mutate({
            registrationId: registration.id,
            request: { status, note: registration.note },
        });
    };

    return (
        <div className="flex flex-col gap-3">
            {decide.error === null ? null : (
                <Alert tone="critical" title="The registration could not be updated">
                    {errorMessage(decide.error)}
                </Alert>
            )}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead className="text-right">Decision</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((registration) => {
                        const division =
                            divisions.find(
                                (candidate) => candidate.id === registration.divisionId,
                            ) ?? null;
                        const decidable =
                            registration.status === "pending" ||
                            registration.status === "waitlisted";
                        return (
                            <TableRow key={registration.id}>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm text-ink">
                                            {registration.displayName}
                                        </span>
                                        <span className="text-xs text-ink-subtle">
                                            {registration.email ?? "No email on file"}
                                        </span>
                                        {registration.note.length === 0 ? null : (
                                            <span className="max-w-md text-xs text-ink-muted">
                                                {registration.note}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {division === null ? "No division" : division.name}
                                </TableCell>
                                <TableCell>
                                    <Badge tone={statusBadgeTone(registration.status)} size="sm">
                                        {humanizeStatus(registration.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="tabular-nums">
                                    {formatDateTime(registration.createdAt)}
                                </TableCell>
                                <TableCell>
                                    {decidable ? (
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button
                                                size="sm"
                                                disabled={decide.isPending}
                                                onClick={() => decideFor(registration, "approved")}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={decide.isPending}
                                                onClick={() =>
                                                    decideFor(registration, "waitlisted")
                                                }
                                            >
                                                Waitlist
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={decide.isPending}
                                                onClick={() => decideFor(registration, "rejected")}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-right text-xs text-ink-subtle">
                                            {registration.decidedAt === null
                                                ? "No decision recorded"
                                                : `Decided ${formatDateTime(registration.decidedAt)}`}
                                        </p>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
