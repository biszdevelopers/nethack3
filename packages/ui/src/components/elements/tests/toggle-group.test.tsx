import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group.js";

describe("ToggleGroup", () => {
    test("is a radiogroup with roving focus that skips disabled items", async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
            <ToggleGroup
                type="single"
                defaultValue="comfortable"
                aria-label="Density"
                onValueChange={onValueChange}
            >
                <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
                <ToggleGroupItem value="disabled" disabled>
                    Unavailable
                </ToggleGroupItem>
                <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
            </ToggleGroup>,
        );

        const group = screen.getByRole("radiogroup", { name: "Density" });
        const comfortable = screen.getByRole("radio", { name: "Comfortable" });
        const compact = screen.getByRole("radio", { name: "Compact" });
        expect(group).toBeInTheDocument();
        expect(comfortable).toBeChecked();
        expect(group).toHaveAttribute("tabindex", "0");

        group.focus();
        expect(comfortable).toHaveFocus();
        await user.keyboard("{ArrowRight}");
        expect(compact).toHaveFocus();

        await user.keyboard("[Space]");
        expect(compact).toBeChecked();
        expect(onValueChange).toHaveBeenCalledWith("compact");
    });

    test("supports multiple pressed items", async () => {
        const user = userEvent.setup();
        render(
            <ToggleGroup type="multiple" defaultValue={["bold"]} aria-label="Formatting">
                <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
                <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
            </ToggleGroup>,
        );

        const bold = screen.getByRole("button", { name: "Bold" });
        const italic = screen.getByRole("button", { name: "Italic" });
        expect(bold).toHaveAttribute("aria-pressed", "true");

        await user.click(italic);
        expect(italic).toHaveAttribute("aria-pressed", "true");
        expect(bold).toHaveAttribute("aria-pressed", "true");
    });
});
