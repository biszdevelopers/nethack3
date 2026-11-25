import type { ReactNode } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Button } from "../button.js";
import { cn } from "../../lib/cn.js";

export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export type AlertDialogTone = "brand" | "destructive";

export interface AlertDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly cancelLabel?: string;
    readonly onConfirm: () => void | Promise<void>;
    readonly tone?: AlertDialogTone;
    readonly loading?: boolean;
    readonly confirmDisabled?: boolean;
}

export function AlertDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    onConfirm,
    tone = "brand",
    loading = false,
    confirmDisabled = false,
}: AlertDialogProps): ReactNode {
    return (
        <AlertDialogPrimitive.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (loading && !nextOpen) {
                    return;
                }
                onOpenChange(nextOpen);
            }}
        >
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-app/80" />
                <AlertDialogPrimitive.Content
                    onEscapeKeyDown={(event) => {
                        if (loading) {
                            event.preventDefault();
                        }
                    }}
                    className={cn(
                        "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5",
                        "rounded-lg border border-line bg-panel p-6 text-ink focus:outline-none",
                    )}
                >
                    <div className="flex flex-col gap-1.5">
                        <AlertDialogPrimitive.Title className="text-base font-semibold text-ink">
                            {title}
                        </AlertDialogPrimitive.Title>
                        <AlertDialogPrimitive.Description className="text-sm text-ink-muted">
                            {description}
                        </AlertDialogPrimitive.Description>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={() => {
                                onOpenChange(false);
                            }}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            type="button"
                            loading={loading}
                            disabled={confirmDisabled}
                            onClick={() => {
                                void onConfirm();
                            }}
                            className={
                                tone === "destructive"
                                    ? "bg-ink text-app hover:bg-ink/90"
                                    : undefined
                            }
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </AlertDialogPrimitive.Content>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
}
