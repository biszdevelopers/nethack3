import type { ReactNode } from "react";
import type { CompetitionEditionDetail, MyParticipation } from "@nethack/contracts";
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@nethack/ui";
import { formatDateTime } from "../../../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import { RegisterForCompetitionButton } from "./register-dialog.js";
import { WithdrawRegistrationButton } from "./withdraw-registration-button.js";

function isRegistrationWindowOpen(edition: CompetitionEditionDetail): boolean {
    if (edition.status !== "registration_open") {
        return false;
    }
    const now = Date.now();
    if (
        edition.registrationOpensAt !== null &&
        now < new Date(edition.registrationOpensAt).getTime()
    ) {
        return false;
    }
    if (
        edition.registrationClosesAt !== null &&
        now > new Date(edition.registrationClosesAt).getTime()
    ) {
        return false;
    }
    return true;
}

export function RegistrationPanel({
    edition,
    registration,
}: {
    readonly edition: CompetitionEditionDetail;
    readonly registration: MyParticipation | null;
}): ReactNode {
    const windowOpen = isRegistrationWindowOpen(edition);
    const division =
        registration === null
            ? null
            : (edition.divisions.find((candidate) => candidate.id === registration.divisionId) ??
              null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your registration</CardTitle>
                <CardDescription>
                    Registration status for the signed-in account in this organization.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {registration === null ? (
                    <>
                        <p className="text-sm text-ink-muted">
                            {windowOpen
                                ? "Registration is open. Submit your registration to join this competition."
                                : "You are not registered for this competition, and registration is not open right now."}
                        </p>
                        {windowOpen ? (
                            <RegisterForCompetitionButton
                                editionId={edition.id}
                                divisions={edition.divisions}
                            />
                        ) : null}
                    </>
                ) : (
                    <>
                        <dl className="flex flex-col gap-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <dt className="text-ink-subtle">Status</dt>
                                <dd>
                                    <Badge tone={statusBadgeTone(registration.status)} size="sm">
                                        {humanizeStatus(registration.status)}
                                    </Badge>
                                </dd>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <dt className="text-ink-subtle">Division</dt>
                                <dd className="text-ink">
                                    {division === null ? "No division" : division.name}
                                </dd>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <dt className="text-ink-subtle">Registered</dt>
                                <dd className="text-ink">
                                    {formatDateTime(registration.registeredAt)}
                                </dd>
                            </div>
                        </dl>
                        {registration.status === "pending" ||
                        registration.status === "approved" ||
                        registration.status === "waitlisted" ? (
                            <WithdrawRegistrationButton
                                editionId={edition.id}
                                hasTeam={registration.teamId !== null}
                            />
                        ) : null}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
