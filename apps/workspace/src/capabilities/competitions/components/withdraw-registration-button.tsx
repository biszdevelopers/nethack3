import { useState, type ReactNode } from "react";
import { AlertDialog, Alert, Button } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useWithdrawRegistration } from "../hooks/use-competitions.js";

export function WithdrawRegistrationButton({
    editionId,
    hasTeam,
}: {
    readonly editionId: string;
    readonly hasTeam: boolean;
}): ReactNode {
    const [open, setOpen] = useState(false);
    const withdraw = useWithdrawRegistration(editionId);

    return (
        <div className="flex flex-col items-start gap-2">
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                disabled={hasTeam}
                aria-describedby={hasTeam ? "withdraw-team-hint" : undefined}
            >
                Withdraw
            </Button>
            {hasTeam ? (
                <p id="withdraw-team-hint" className="text-xs text-ink-muted">
                    Leave or disband your team before withdrawing from this competition.
                </p>
            ) : null}
            {withdraw.error === null ? null : (
                <Alert tone="critical" title="Withdrawal failed">
                    {errorMessage(withdraw.error)}
                </Alert>
            )}
            <AlertDialog
                open={open}
                onOpenChange={(next) => {
                    if (!next) {
                        withdraw.reset();
                    }
                    setOpen(next);
                }}
                title="Withdraw registration"
                description="Your registration and participant record for this competition are removed. You can register again while registration is open."
                confirmLabel="Withdraw"
                tone="destructive"
                loading={withdraw.isPending}
                onConfirm={async () => {
                    try {
                        await withdraw.mutateAsync();
                        setOpen(false);
                    } catch {
                        // The mutation error is rendered above.
                    }
                }}
            />
        </div>
    );
}
