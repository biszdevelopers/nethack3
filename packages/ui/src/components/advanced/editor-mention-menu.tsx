import type { ReactNode } from "react";
import { EditorSuggestionMenu, type EditorSuggestion } from "./editor-suggestion-menu.js";

export interface EditorMention {
    readonly id: string;
    readonly name: string;
    readonly detail?: string;
}

export interface EditorMentionMenuProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly anchor: ReactNode;
    readonly mentions: readonly EditorMention[];
    readonly onSelect: (mention: EditorMention) => void;
    readonly label?: string;
    readonly emptyLabel?: string;
}

export function EditorMentionMenu({
    open,
    onOpenChange,
    anchor,
    mentions,
    onSelect,
    label = "Mentions",
    emptyLabel = "No people found",
}: EditorMentionMenuProps): ReactNode {
    const mentionById = new Map(mentions.map((mention) => [mention.id, mention]));
    const suggestions: readonly EditorSuggestion[] = mentions.map((mention) => ({
        id: mention.id,
        label: `@${mention.name}`,
        ...(mention.detail === undefined ? {} : { description: mention.detail }),
    }));

    return (
        <EditorSuggestionMenu
            open={open}
            onOpenChange={onOpenChange}
            anchor={anchor}
            suggestions={suggestions}
            label={label}
            emptyLabel={emptyLabel}
            onSelect={(suggestion) => {
                const mention = mentionById.get(suggestion.id);
                if (mention !== undefined) {
                    onSelect(mention);
                }
            }}
        />
    );
}
