import type { ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { useToast, type ToastTone } from "../stores/ui-stores.js";
import { cn } from "../lib/cn.js";

const TONE_BORDER: Record<ToastTone, string> = {
    neutral: "border-line",
    success: "border-primary/50",
    critical: "border-ink",
};

export function ToastViewport(): ReactNode {
    const { toasts, dismiss } = useToast();
    return (
        <ToastPrimitive.Provider swipeDirection="right">
            {toasts.map((toast) => (
                <ToastPrimitive.Root
                    key={toast.id}
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            dismiss(toast.id);
                        }
                    }}
                    duration={toast.durationMs ?? 6000}
                    data-slot="toast"
                    className={cn(
                        "flex w-full animate-[ui-toast-in_220ms_cubic-bezier(0.16,1,0.3,1)] items-start gap-3 rounded-md border bg-panel p-4 text-ink",
                        TONE_BORDER[toast.tone ?? "neutral"],
                    )}
                >
                    <div className="flex min-w-0 flex-col gap-1">
                        <ToastPrimitive.Title className="text-sm font-medium">
                            {toast.title}
                        </ToastPrimitive.Title>
                        {toast.description === undefined ? null : (
                            <ToastPrimitive.Description className="text-xs text-ink-muted">
                                {toast.description}
                            </ToastPrimitive.Description>
                        )}
                    </div>
                    <ToastPrimitive.Close
                        className="relative ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-muted after:absolute after:-inset-1.5 after:content-[''] hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label="Dismiss notification"
                    >
                        <X className="size-3.5" aria-hidden="true" />
                    </ToastPrimitive.Close>
                </ToastPrimitive.Root>
            ))}
            <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
        </ToastPrimitive.Provider>
    );
}
