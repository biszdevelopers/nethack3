import { useSyncExternalStore, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { overlayStore } from "../stores/ui-stores.js";

const EMPTY_OVERLAYS: readonly never[] = [];

export function OverlayViewport(): ReactNode {
    const entries = useSyncExternalStore(
        overlayStore.subscribe,
        overlayStore.getSnapshot,
        () => EMPTY_OVERLAYS,
    );

    return (
        <>
            {entries.map((entry) => (
                <DialogPrimitive.Root
                    key={entry.id}
                    open
                    onOpenChange={(open) => {
                        if (!open && entry.dismissible !== false) {
                            overlayStore.close(entry.id);
                        }
                    }}
                >
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
                        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-panel p-6 focus:outline-none">
                            <DialogPrimitive.Title className="text-base font-semibold text-ink">
                                {entry.label}
                            </DialogPrimitive.Title>
                            {entry.description === undefined ? null : (
                                <DialogPrimitive.Description className="text-sm text-ink-muted">
                                    {entry.description}
                                </DialogPrimitive.Description>
                            )}
                            {entry.content}
                            {entry.dismissible === false ? null : (
                                <DialogPrimitive.Close
                                    className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-sm text-ink-muted transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    aria-label="Close dialog"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </DialogPrimitive.Close>
                            )}
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            ))}
        </>
    );
}
