import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Combobox } from "../combobox.js";

const options = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
];

describe("Combobox", () => {
    test("filters, announces listbox semantics, and selects an option", async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
            <Combobox
                label="Framework"
                options={options}
                searchPlaceholder="Search frameworks"
                onValueChange={onValueChange}
            />,
        );

        const trigger = screen.getByRole("combobox", { name: "Framework" });
        expect(trigger).toHaveAttribute("aria-expanded", "false");

        await user.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");

        const listbox = await screen.findByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "React" })).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText("Search frameworks"), "vue");
        await user.click(await screen.findByRole("option", { name: "Vue" }));

        await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("vue"));
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(trigger).toHaveTextContent("Vue");
    });

    test("closes on Escape and restores the trigger focus", async () => {
        const user = userEvent.setup();
        render(<Combobox label="Framework" options={options} />);

        const trigger = screen.getByRole("combobox", { name: "Framework" });
        await user.click(trigger);
        await screen.findByRole("listbox");
        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
    });

    test("shows a loading status without an empty message", async () => {
        render(<Combobox label="Framework" options={[]} loading />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("combobox", { name: "Framework" }));
        expect(await screen.findByText("Searching")).toBeInTheDocument();
        expect(screen.queryByText("No results.")).not.toBeInTheDocument();
    });
});
