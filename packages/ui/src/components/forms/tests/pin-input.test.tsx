import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { PinInput } from "../pin-input.js";

describe("PinInput", () => {
    test("labels each digit and links description and error text", () => {
        render(
            <PinInput
                label="Verification code"
                length={4}
                description="Enter the four digit code."
                error="The code is incorrect."
            />,
        );

        const digits = screen.getAllByRole("textbox");
        expect(digits).toHaveLength(4);
        expect(digits[0]).toHaveAccessibleName("Digit 1 of 4");
        expect(digits[3]).toHaveAccessibleName("Digit 4 of 4");
        expect(screen.getByLabelText("Verification code", { selector: "input" })).toBe(digits[0]);

        const describedBy = digits[0]?.getAttribute("aria-describedby") ?? "";
        expect(describedBy).toContain("description");
        expect(describedBy).toContain("error");
        expect(digits[0]).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent("The code is incorrect.");
    });

    test("advances on entry and supports arrows, Home, End, Backspace, and paste", async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(<PinInput label="Code" length={4} onValueChange={onValueChange} />);

        const digits = screen.getAllByRole("textbox");
        const first = digits[0] as HTMLInputElement;
        const second = digits[1] as HTMLInputElement;
        const fourth = digits[3] as HTMLInputElement;

        await user.type(first, "12");
        expect(first).toHaveValue("1");
        expect(second).toHaveValue("2");
        expect(digits[2]).toHaveFocus();

        await user.keyboard("{ArrowLeft}");
        expect(second).toHaveFocus();
        await user.keyboard("{End}");
        expect(fourth).toHaveFocus();
        await user.keyboard("{Home}");
        expect(first).toHaveFocus();

        await user.keyboard("{ArrowRight}{ArrowRight}");
        expect(digits[2]).toHaveFocus();
        await user.keyboard("{Backspace}{Backspace}");
        await waitFor(() => expect(first).toHaveValue(""));

        await user.click(first);
        await user.paste("9876");
        expect(first).toHaveValue("9");
        expect(second).toHaveValue("8");
        expect(digits[2]).toHaveValue("7");
        expect(fourth).toHaveValue("6");
        expect(onValueChange).toHaveBeenLastCalledWith("9876");
    });
});
