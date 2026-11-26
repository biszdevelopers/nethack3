import type { ReactNode } from "react";
import { Command } from "cmdk";
import { cn } from "../../lib/cn.js";
import { useShortcuts } from "../../hooks/state.js";
import { useCommandPaletteState } from "../../stores/ui-stores.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../dialog.js";
import { Kbd } from "../kbd.js";

export interface CommandPaletteItem {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly icon?: ReactNode;
    readonly keywords?: readonly string[];
    readonly onSelect: () => void;
}

export interface CommandPaletteGroup {
    readonly heading?: string;
    readonly items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
    readonly groups: readonly CommandPaletteGroup[];
    readonly open?: boolean;
    readonly onOpenChange?: (open: boolean) => void;
    readonly placeholder?: string;
    readonly emptyMessage?: string;
    readonly label?: string;
}

export function CommandPalette({
    groups,
    open,
    onOpenChange,
    placeholder = "Search commands",
    emptyMessage = "No commands found.",
    label = "Command palette",
}: CommandPaletteProps): ReactNode {
    const palette = useCommandPaletteState();
    const resolvedOpen = open ?? palette.open;

    const setOpen = (next: boolean): void => {
        palette.setOpen(next);
        onOpenChange?.(next);
    };

    useShortcuts({ "mod+k": () => setOpen(true) });

    return (
        <Dialog open={resolvedOpen} onOpenChange={setOpen}>
            <DialogContent showCloseButton={false} className="max-w-xl gap-0 overflow-hidden p-0">
                <DialogTitle className="sr-only">{label}</DialogTitle>
                <DialogDescription className="sr-only">
                    Search available commands and open one with Enter.
                </DialogDescription>
                <Command label={label} data-slot="command-palette" className="flex flex-col">
                    <Command.Input
                        placeholder={placeholder}
                        className="h-12 w-full border-b border-line bg-transparent px-4 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    />
                    <Command.List label={label} className="max-h-80 overflow-y-auto p-2">
                        <Command.Empty className="px-4 py-8 text-center text-sm text-ink-muted">
                            {emptyMessage}
                        </Command.Empty>
                        {groups.map((group, groupIndex) =>
                            group.items.length === 0 ? null : (
                                <Command.Group
                                    key={group.heading ?? String(groupIndex)}
                                    heading={group.heading}
                                    className="py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-subtle"
                                >
                                    {group.items.map((item) => (
                                        <Command.Item
                                            key={item.id}
                                            value={`${item.label} ${item.id}`}
                                            {...(item.keywords === undefined
                                                ? {}
                                                : { keywords: [...item.keywords] })}
                                            onSelect={() => {
                                                setOpen(false);
                                                item.onSelect();
                                            }}
                                            className={cn(
                                                "flex min-h-9 cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm text-ink-muted",
                                                "data-[selected=true]:bg-raised data-[selected=true]:text-ink",
                                                "data-[disabled=true]:opacity-50",
                                            )}
                                        >
                                            {item.icon === undefined ? null : (
                                                <span className="shrink-0">{item.icon}</span>
                                            )}
                                            <span className="flex min-w-0 flex-col">
                                                <span className="truncate">{item.label}</span>
                                                {item.description === undefined ? null : (
                                                    <span className="truncate text-xs text-ink-subtle">
                                                        {item.description}
                                                    </span>
                                                )}
                                            </span>
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            ),
                        )}
                    </Command.List>
                    <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2 text-xs text-ink-subtle">
                        <Kbd>esc</Kbd>
                        <span>to close</span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
