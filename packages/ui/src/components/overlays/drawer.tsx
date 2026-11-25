import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export type DrawerSide = "left" | "right" | "bottom";

const SIDE_CLASS: Record<DrawerSide, string> = {
    left: "inset-y-0 left-0 h-dvh w-full max-w-sm border-r",
    right: "inset-y-0 right-0 h-dvh w-full max-w-sm border-l",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full border-t",
};

export interface DrawerContentProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    readonly title: string;
    readonly description: string;
    readonly footer?: ReactNode;
    readonly side?: DrawerSide;
    readonly showCloseButton?: boolean;
    readonly closeLabel?: string;
}

export const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
    function DrawerContent(
        {
            className,
            title,
            description,
            footer,
            side = "right",
            showCloseButton = true,
            closeLabel = "Close",
            children,
            ...rest
        },
        ref,
    ) {
        return (
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-app/80" />
                <DialogPrimitive.Content
                    ref={ref}
                    className={cn(
                        "fixed z-50 flex flex-col border-line bg-panel text-ink",
                        "focus:outline-none",
                        SIDE_CLASS[side],
                        className,
                    )}
                    {...rest}
                >
                    <div className="flex items-start gap-3 border-b border-line p-5">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <DialogPrimitive.Title className="text-base font-semibold text-ink">
                                {title}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description className="text-sm text-ink-muted">
                                {description}
                            </DialogPrimitive.Description>
                        </div>
                        {showCloseButton ? (
                            <DialogPrimitive.Close
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
                                aria-label={closeLabel}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </DialogPrimitive.Close>
                        ) : null}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
                    {footer === undefined ? null : (
                        <div className="flex flex-col-reverse gap-2 border-t border-line p-5 sm:flex-row sm:justify-end">
                            {footer}
                        </div>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        );
    },
);
