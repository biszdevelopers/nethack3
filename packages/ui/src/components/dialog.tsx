import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/cn.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
        readonly showCloseButton?: boolean;
    }
>(function DialogContent({ className, children, showCloseButton = true, ...rest }, ref) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
                className={cn(
                    "fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                )}
            />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(
                    "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4",
                    "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-line bg-panel p-6 shadow-none",
                    "focus:outline-none",
                    className,
                )}
                {...rest}
            >
                {children}
                {showCloseButton ? (
                    <DialogPrimitive.Close
                        className="absolute right-4 top-4 rounded-sm p-1 text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label="Close dialog"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </DialogPrimitive.Close>
                ) : null}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
});

export function DialogHeader({ className, ...rest }: ComponentPropsWithoutRef<"div">): ReactNode {
    return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...rest} />;
}

export function DialogFooter({ className, ...rest }: ComponentPropsWithoutRef<"div">): ReactNode {
    return (
        <div
            className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
            {...rest}
        />
    );
}

export const DialogTitle = forwardRef<
    HTMLHeadingElement,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...rest }, ref) {
    return (
        <DialogPrimitive.Title
            ref={ref}
            className={cn("text-base font-semibold text-ink", className)}
            {...rest}
        />
    );
});

export const DialogDescription = forwardRef<
    HTMLParagraphElement,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...rest }, ref) {
    return (
        <DialogPrimitive.Description
            ref={ref}
            className={cn("text-sm text-ink-muted", className)}
            {...rest}
        />
    );
});

export interface ConfirmDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly cancelLabel?: string;
    readonly onConfirm: () => void | Promise<void>;
    readonly tone?: "default" | "critical";
    readonly loading?: boolean;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    onConfirm,
    tone = "default",
    loading = false,
}: ConfirmDialogProps): ReactNode {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <button
                            type="button"
                            className="inline-flex h-10 items-center justify-center rounded-md border border-line-strong px-4 text-sm text-ink hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            {cancelLabel}
                        </button>
                    </DialogClose>
                    <button
                        type="button"
                        onClick={() => void onConfirm()}
                        disabled={loading}
                        className={cn(
                            "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:opacity-50",
                            tone === "critical"
                                ? "bg-ink text-app hover:bg-ink/90"
                                : "bg-primary text-primary-ink hover:bg-primary-hover",
                        )}
                    >
                        {confirmLabel}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
