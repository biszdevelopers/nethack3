import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../button.js";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../card.js";
import { ConfirmDialog } from "../dialog.js";

export interface SubmissionDecision {
    readonly id: string;
    readonly label: string;
    readonly tone?: "default" | "critical";
}

export interface SubmissionReviewConfirmation {
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
}

export interface SubmissionReviewPanelProps {
    readonly title: string;
    readonly description?: string;
    readonly summary: ReactNode;
    readonly files?: ReactNode;
    readonly rubric?: ReactNode;
    readonly decisions: readonly SubmissionDecision[];
    readonly onDecision: (decisionId: string) => void | Promise<void>;
    readonly confirmation: SubmissionReviewConfirmation;
    readonly className?: string;
}

export function SubmissionReviewPanel({
    title,
    description,
    summary,
    files,
    rubric,
    decisions,
    onDecision,
    confirmation,
    className,
}: SubmissionReviewPanelProps): ReactNode {
    const [pendingDecision, setPendingDecision] = useState<SubmissionDecision | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestDecision = (decision: SubmissionDecision): void => {
        setError(null);
        setPendingDecision(decision);
    };

    const handleConfirm = async (): Promise<void> => {
        if (pendingDecision === null) {
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onDecision(pendingDecision.id);
            setPendingDecision(null);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "The decision could not be recorded. Try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className={cn("overflow-hidden", className)} data-slot="submission-review-panel">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description === undefined ? null : (
                    <CardDescription>{description}</CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-ink">Summary</h3>
                    <div className="text-sm text-ink-muted">{summary}</div>
                </section>
                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-ink">Files</h3>
                    {files === undefined ? (
                        <p className="text-sm text-ink-subtle">No files attached.</p>
                    ) : (
                        files
                    )}
                </section>
                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium text-ink">Rubric</h3>
                    {rubric === undefined ? (
                        <p className="text-sm text-ink-subtle">No rubric provided.</p>
                    ) : (
                        rubric
                    )}
                </section>
            </CardContent>
            {decisions.length === 0 ? null : (
                <CardFooter className="flex-wrap">
                    {decisions.map((decision) => (
                        <Button
                            key={decision.id}
                            type="button"
                            variant={decision.tone === "critical" ? "outline" : "solid"}
                            onClick={() => requestDecision(decision)}
                        >
                            {decision.label}
                        </Button>
                    ))}
                </CardFooter>
            )}
            <ConfirmDialog
                open={pendingDecision !== null}
                onOpenChange={(open) => {
                    if (!open && !submitting) {
                        setPendingDecision(null);
                        setError(null);
                    }
                }}
                title={confirmation.title}
                description={error ?? confirmation.description}
                confirmLabel={confirmation.confirmLabel}
                onConfirm={handleConfirm}
                tone={pendingDecision?.tone === "critical" ? "critical" : "default"}
                loading={submitting}
            />
        </Card>
    );
}
