import { describe, expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "../drawer.js";

describe("Drawer", () => {
    test("exposes a named modal, traps focus, closes with Escape, and restores focus", async () => {
        const user = userEvent.setup();
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open navigation</button>
                </DrawerTrigger>
                <DrawerContent
                    title="Navigation"
                    description="Primary destinations."
                    footer={<button type="button">Footer action</button>}
                >
                    <a href="#home">Home</a>
                    <DrawerClose asChild>
                        <button type="button">Close navigation</button>
                    </DrawerClose>
                </DrawerContent>
            </Drawer>,
        );

        const trigger = screen.getByRole("button", { name: "Open navigation" });
        await user.click(trigger);

        const drawer = await screen.findByRole("dialog", { name: "Navigation" });
        expect(drawer).toHaveAccessibleDescription("Primary destinations.");
        expect(drawer).toHaveAttribute("data-slot", "drawer-content");
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

        for (let index = 0; index < 6; index += 1) {
            await user.tab();
            expect(drawer).toContainElement(document.activeElement as HTMLElement);
        }

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });

    test("closes from the footer and the labelled close button", async () => {
        const user = userEvent.setup();
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open panel</button>
                </DrawerTrigger>
                <DrawerContent
                    title="Filters"
                    description="Narrow the result set."
                    closeLabel="Dismiss filters"
                >
                    <p>Filter body</p>
                </DrawerContent>
            </Drawer>,
        );

        await user.click(screen.getByRole("button", { name: "Open panel" }));
        await user.click(await screen.findByRole("button", { name: "Dismiss filters" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Open panel" })).toHaveFocus();
    });
});
