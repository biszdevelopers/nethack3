import { useState, type ReactNode } from "react";
import type { ReviewSubmissionRequest, SubmissionDetail } from "@nethack/contracts";
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Select,
    Textarea,
    useToast,
} from "@nethack/ui";
import { describeError } from "../../shared/errors.js";
import { useReviewSubmission } from "../hooks/use-submissions.js";

type ReviewStatus = ReviewSubmissionRequest["status"];

const STATUS_LABELS: Record<ReviewStatus, string> = {
    under_review: "Under review",
    changes_requested: "Changes requested",
    accepted: "Accepted",
    rejected: "Rejected",
    disqualified: "Disqualified",
};

function reviewOptions(status: SubmissionDetail["status"]): readonly ReviewStatus[] {
    switch (status) {
        case "submitted":
            return ["under_review", "changes_requested", "accepted", "rejected", "disqualified"];
        case "under_review":
            return ["changes_requested", "accepted", "rejected", "disqualified"];
        case "changes_requested":
            return ["under_review", "accepted", "rejected"];
        default:
            return [];
    }
}

export function ReviewSubmissionDialog({
    submission,
}: {
    readonly submission: SubmissionDetail;
}): ReactNode {
    const { toast } = useToast();
    const review = useReviewSubmission(submission.id);
    const options = reviewOptions(submission.status);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<ReviewStatus>(options[0] ?? "under_review");
    const [note, setNote] = useState("");

    if (options.length === 0) {
        return null;
    }

    const close = (next: boolean): void => {
        if (!next) {
            review.reset();
            setNote("");
            setStatus(options[0] ?? "under_review");
        }
        setOpen(next);
    };

    const onSubmit = async (): Promise<void> => {
        try {
            await review.mutateAsync({ status, note });
            toast({ title: "Submission reviewed", tone: "success" });
            close(false);
        } catch {
            // The mutation error is rendered below.
        }
    };

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                Review submission
            </Button>
            <Dialog open={open} onOpenChange={close}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review submission</DialogTitle>
                        <DialogDescription>
                            Record the next decision for {submission.projectTitle}. The participant
                            sees the review note on their submission.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Select
                                label="Decision"
                                options={options.map((value) => ({
                                    value,
                                    label: STATUS_LABELS[value],
                                }))}
                                value={status}
                                onValueChange={(value) => setStatus(value as ReviewStatus)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="review-note" className="text-sm font-medium text-ink">
                                Review note <span className="text-ink-subtle">(optional)</span>
                            </label>
                            <Textarea
                                id="review-note"
                                rows={4}
                                value={note}
                                maxLength={4000}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder="Explain the decision to the participant."
                            />
                        </div>
                        {review.error === null ? null : (
                            <Alert tone="critical" title="The review could not be saved">
                                {describeError(review.error)}
                            </Alert>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => close(false)}>
                            Cancel
                        </Button>
                        <Button loading={review.isPending} onClick={() => void onSubmit()}>
                            Save review
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
