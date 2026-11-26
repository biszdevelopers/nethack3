import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Checkbox } from "../checkbox.js";
import { Switch } from "../switch.js";

describe("Checkbox", () => {
    test("exposes a label, mixed state, and disabled state", () => {
        render(
            <>
                <Checkbox label="Select all" indeterminate />
                <Checkbox label="Unavailable" disabled />
            </>,
        );

        const selectAll = screen.getByRole("checkbox", { name: "Select all" });
        expect(selectAll).toHaveAttribute("aria-checked", "mixed");
        expect(selectAll).toHaveAccessibleName("Select all");

        const unavailable = screen.getByRole("checkbox", { name: "Unavailable" });
        expect(unavailable).toBeDisabled();
    });

    test("links description and error text", () => {
        render(
            <Checkbox
                label="Terms"
                description="Required to continue."
                error="Accept the terms."
            />,
        );

        const checkbox = screen.getByRole("checkbox", { name: "Terms" });
        expect(checkbox).toHaveAttribute("aria-invalid", "true");
        const describedBy = checkbox.getAttribute("aria-describedby") ?? "";
        expect(document.getElementById(describedBy.split(" ")[0] ?? "")).toHaveTextContent(
            "Required to continue.",
        );
        expect(screen.getByRole("alert")).toHaveTextContent("Accept the terms.");
    });
});

describe("Switch", () => {
    test("is a labelled switch that toggles with the keyboard", async () => {
        const user = userEvent.setup();
        const onCheckedChange = vi.fn();
        render(
            <Switch
                label="Notifications"
                description="Send activity updates."
                onCheckedChange={onCheckedChange}
            />,
        );

        const control = screen.getByRole("switch", { name: "Notifications" });
        expect(control).toHaveAttribute("aria-checked", "false");
        expect(control).toHaveAccessibleDescription("Send activity updates.");

        control.focus();
        await user.keyboard("[Space]");
        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
});
