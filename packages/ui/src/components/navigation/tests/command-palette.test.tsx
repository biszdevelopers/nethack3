import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CommandPalette, type CommandPaletteGroup } from "../command-palette.js";
import { commandPaletteStore } from "../../../stores/ui-stores.js";

function groups(onSelect: (label: string) => void): CommandPaletteGroup[] {
    return [
        {
            heading: "Navigation",
            items: [
                {
                    id: "open-dashboard",
                    label: "Open dashboard",
                    onSelect: () => onSelect("dashboard"),
                },
                {
                    id: "open-settings",
                    label: "Open settings",
                    onSelect: () => onSelect("settings"),
                },
            ],
        },
    ];
}

describe("CommandPalette", () => {
    test("is a named dialog with listbox, filtering, keyboard selection, and Escape", async () => {
        commandPaletteStore.set(false);
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const onOpenChange = vi.fn();
        render(
            <CommandPalette
                open
                onOpenChange={onOpenChange}
                groups={groups(onSelect)}
                label="Command palette"
            />,
        );

        const dialog = await screen.findByRole("dialog", { name: "Command palette" });
        expect(dialog).toBeInTheDocument();

        const input = screen.getByRole("combobox", { name: "Command palette" });
        expect(input).toHaveFocus();
        expect(screen.getByRole("listbox", { name: "Command palette" })).toBeInTheDocument();

        await user.type(input, "settings");
        expect(screen.getByRole("option", { name: /Open settings/ })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: /Open dashboard/ })).not.toBeInTheDocument();

        await user.keyboard("{ArrowDown}");
        await user.keyboard("{Enter}");
        await waitFor(() => expect(onSelect).toHaveBeenCalledWith("settings"));
        expect(onOpenChange).toHaveBeenCalledWith(false);

        await user.keyboard("{Escape}");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    test("renders an empty state when nothing matches", async () => {
        const user = userEvent.setup();
        render(<CommandPalette open onOpenChange={() => {}} groups={groups(() => {})} />);
        const input = await screen.findByRole("combobox", { name: "Command palette" });
        await user.type(input, "no such command");
        expect(await screen.findByText("No commands found.")).toBeInTheDocument();
    });
});
