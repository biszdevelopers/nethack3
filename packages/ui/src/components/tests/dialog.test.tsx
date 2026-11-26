import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
    ConfirmDialog,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "../dialog.js";

describe("Dialog", () => {
    test("traps focus, announces its name, closes on Escape, and restores focus", async () => {
        const user = userEvent.setup();
        render(
            <Dialog>
                <DialogTrigger asChild>
                    <button type="button">Open settings</button>
                </DialogTrigger>
                <DialogContent>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>Adjust workspace preferences.</DialogDescription>
                    <button type="button">First action</button>
                    <DialogClose asChild>
                        <button type="button">Cancel</button>
                    </DialogClose>
                </DialogContent>
            </Dialog>,
        );

        const trigger = screen.getByRole("button", { name: "Open settings" });
        await user.click(trigger);

        const dialog = await screen.findByRole("dialog", { name: "Settings" });
        expect(dialog).toHaveAccessibleDescription("Adjust workspace preferences.");
        expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();

        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });

    test("ConfirmDialog reports busy and keeps layout while confirming", async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onOpenChange={() => {}}
                title="Delete project"
                description="This cannot be undone."
                confirmLabel="Delete"
                loading
                onConfirm={onConfirm}
            />,
        );

        const confirm = screen.getByRole("button", { name: "Delete" });
        expect(confirm).toBeDisabled();
        expect(confirm).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(onConfirm).not.toHaveBeenCalled();
        await user.keyboard("{Escape}");
        expect(screen.getByRole("dialog", { name: "Delete project" })).toBeInTheDocument();
    });
});
