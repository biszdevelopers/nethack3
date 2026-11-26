import { useState, type ReactNode } from "react";
import { Alert, AlertDialog, Button } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useWithdrawSubmission } from "../hooks/use-submissions.js";

export function WithdrawSubmissionButton({
    submissionId,
    onWithdrawn,
}: {
    readonly submissionId: string;
    readonly onWithdrawn?: () => void;
}): ReactNode {
    const [open, setOpen] = useState(false);
    const withdraw = useWithdrawSubmission(submissionId);

    return (
        <div className="flex flex-col items-start gap-2">
            <Button variant="outline" onClick={() => setOpen(true)}>
                Withdraw submission
            </Button>
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
                title="Withdraw submission"
                description="The submission leaves review. Its versions and files remain in the history."
                confirmLabel="Withdraw"
                tone="destructive"
                loading={withdraw.isPending}
                onConfirm={async () => {
                    try {
                        await withdraw.mutateAsync();
                        setOpen(false);
                        onWithdrawn?.();
                    } catch {
                        // The mutation error is rendered above.
                    }
                }}
            />
        </div>
    );
}
