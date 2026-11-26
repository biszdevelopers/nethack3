import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Slider } from "../slider.js";

describe("Slider", () => {
    test("exposes value semantics and responds to the keyboard", async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(
            <Slider
                label="Volume"
                defaultValue={[30]}
                min={0}
                max={100}
                step={5}
                onValueChange={onValueChange}
            />,
        );

        const thumb = screen.getByRole("slider", { name: "Volume" });
        expect(thumb).toHaveAttribute("aria-valuemin", "0");
        expect(thumb).toHaveAttribute("aria-valuemax", "100");
        expect(thumb).toHaveAttribute("aria-valuenow", "30");

        thumb.focus();
        await user.keyboard("{ArrowRight}");
        await waitFor(() => expect(thumb).toHaveAttribute("aria-valuenow", "35"));
        expect(onValueChange).toHaveBeenLastCalledWith([35]);

        await user.keyboard("{Home}");
        await waitFor(() => expect(thumb).toHaveAttribute("aria-valuenow", "0"));

        await user.keyboard("{End}");
        await waitFor(() => expect(thumb).toHaveAttribute("aria-valuenow", "100"));
    });

    test("describes errors and reflects disabled state", () => {
        render(
            <Slider
                label="Budget"
                defaultValue={[50]}
                min={0}
                max={100}
                error="Budget is out of range."
                disabled
            />,
        );

        const thumb = screen.getByRole("slider", { name: "Budget" });
        expect(thumb).toHaveAttribute("aria-valuenow", "50");
        expect(thumb).toHaveAttribute("aria-describedby");
        expect(thumb.getAttribute("aria-describedby")).toContain("error");
        expect(screen.getByRole("alert")).toHaveTextContent("Budget is out of range.");
        expect(thumb).toHaveAttribute("data-disabled");
    });
});
