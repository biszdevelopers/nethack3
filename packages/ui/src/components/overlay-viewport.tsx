import { useSyncExternalStore, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { overlayStore } from "../stores/ui-stores.js";

export function OverlayViewport(): ReactNode {
    const entries = useSyncExternalStore(
        overlayStore.subscribe,
        overlayStore.getSnapshot,
        () => [],
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
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            ))}
        </>
    );
}
