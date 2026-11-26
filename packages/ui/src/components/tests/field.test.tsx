import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "../field.js";

describe("Field", () => {
    test("links the label, description, error, invalid and required state", () => {
        render(
            <Field
                label="Email"
                description="Use your work email."
                error="Enter a valid email address."
                required
            >
                {(props) => <input {...props} type="email" />}
            </Field>,
        );

        const input = screen.getByRole("textbox", { name: /Email/ });
        expect(input).toHaveAccessibleName(/Email.*required/);
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAttribute("aria-required", "true");

        const describedBy = input.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        const descriptions = (describedBy ?? "")
            .split(" ")
            .map((id) => document.getElementById(id));
        expect(descriptions.map((element) => element?.textContent)).toEqual([
            "Use your work email.",
            expect.stringContaining("Enter a valid email address."),
        ]);
        expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");

        const label = screen.getByText("Email").closest("label");
        expect(label).toHaveAttribute("for", input.id);
    });

    test("renders the optional marker without required semantics", () => {
        render(
            <Field label="Nickname" optionalLabel="Optional">
                {(props) => <input {...props} />}
            </Field>,
        );

        const input = screen.getByRole("textbox", { name: /Nickname/ });
        expect(input).toHaveAccessibleName(/Nickname.*Optional/);
        expect(input).not.toHaveAttribute("aria-required");
        expect(input).not.toHaveAttribute("aria-invalid");
        expect(input).not.toHaveAttribute("aria-describedby");
    });
});
