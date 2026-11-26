import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Select } from "../select.js";

const options = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
    { value: "gamma", label: "Gamma", disabled: true },
];

describe("Select", () => {
    test("names the trigger, selects with the keyboard, and skips disabled options", async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
            <Select
                label="Team"
                description="Choose a team."
                options={options}
                placeholder="Pick a team"
                onValueChange={onValueChange}
            />,
        );

        const trigger = screen.getByRole("combobox", { name: "Team" });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(trigger).toHaveAccessibleDescription("Choose a team.");

        trigger.focus();
        await user.keyboard("{Enter}");
        const listbox = await screen.findByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Gamma" })).toHaveAttribute(
            "aria-disabled",
            "true",
        );

        await user.keyboard("{Enter}");

        await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("alpha"));
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(trigger).toHaveTextContent("Alpha");
    });

    test("closes on Escape and reports invalid state through the trigger", async () => {
        const user = userEvent.setup();
        render(
            <Select label="Role" options={options} error="Choose a role." defaultValue="beta" />,
        );

        const trigger = screen.getByRole("combobox", { name: "Role" });
        expect(trigger).toHaveAttribute("aria-invalid", "true");
        expect(trigger).toHaveAccessibleDescription(/Choose a role/);

        await user.click(trigger);
        expect(await screen.findByRole("listbox")).toBeInTheDocument();
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });
});
