import { beforeEach, describe, expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ToastViewport } from "../toast-viewport.js";
import { toastStore, useToast } from "../../stores/ui-stores.js";

function ToastHarness(): ReactNode {
    const { toast } = useToast();
    return (
        <button
            type="button"
            onClick={() =>
                toast({
                    title: "Changes saved",
                    description: "Your profile is up to date.",
                    tone: "success",
                })
            }
        >
            Show notification
        </button>
    );
}

describe("Toast", () => {
    beforeEach(() => {
        toastStore.clear();
    });

    test("announces a toast through the Radix viewport and dismisses it", async () => {
        const user = userEvent.setup();
        render(
            <>
                <ToastHarness />
                <ToastViewport />
            </>,
        );

        expect(screen.getByRole("region")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Show notification" }));
        expect(await screen.findByText("Changes saved")).toBeInTheDocument();
        expect(await screen.findByText("Your profile is up to date.")).toBeInTheDocument();

        const announcement = await screen.findByRole("status");
        expect(announcement).toHaveTextContent("Changes saved");
        expect(announcement).toHaveTextContent("Your profile is up to date.");
        expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
        await waitFor(() => expect(screen.queryByText("Changes saved")).not.toBeInTheDocument());
    });

    test("does not render a viewport region when there are no toasts", () => {
        render(<ToastViewport />);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
