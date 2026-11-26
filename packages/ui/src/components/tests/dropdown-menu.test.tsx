import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../dropdown-menu.js";

describe("DropdownMenu", () => {
    test("opens from the keyboard, skips disabled items, and closes on Escape", async () => {
        const user = userEvent.setup();
        render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button">Project actions</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>Rename</DropdownMenuItem>
                    <DropdownMenuItem disabled>Archive</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>,
        );

        const trigger = screen.getByRole("button", { name: "Project actions" });
        trigger.focus();
        await user.keyboard("{Enter}");

        const menu = await screen.findByRole("menu");
        expect(menu).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
        expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveAttribute(
            "aria-disabled",
            "true",
        );

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });

    test("checkbox items expose a checked state", async () => {
        const user = userEvent.setup();
        const onCheckedChange = vi.fn();
        render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button">Columns</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuCheckboxItem checked onCheckedChange={onCheckedChange}>
                        Name
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>,
        );

        await user.click(screen.getByRole("button", { name: "Columns" }));
        const item = await screen.findByRole("menuitemcheckbox", { name: "Name" });
        expect(item).toBeChecked();
        await user.click(item);
        expect(onCheckedChange).toHaveBeenCalledWith(false);
    });
});
