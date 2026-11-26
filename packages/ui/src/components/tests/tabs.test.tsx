import { describe, expect, test } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs.js";

function TabsFixture(): ReactNode {
    return (
        <Tabs defaultValue="overview">
            <TabsList aria-label="Workspace views">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history" disabled>
                    History
                </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview panel</TabsContent>
            <TabsContent value="details">Details panel</TabsContent>
        </Tabs>
    );
}

describe("Tabs", () => {
    test("supports arrow, Home, and End navigation while skipping disabled tabs", async () => {
        const user = userEvent.setup();
        render(<TabsFixture />);

        const overview = screen.getByRole("tab", { name: "Overview" });
        const details = screen.getByRole("tab", { name: "Details" });
        const history = screen.getByRole("tab", { name: "History" });

        expect(overview).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tablist", { name: "Workspace views" })).toBeInTheDocument();
        expect(history).toBeDisabled();

        overview.focus();
        await user.keyboard("{ArrowRight}");
        expect(details).toHaveFocus();
        expect(details).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText("Details panel")).toBeInTheDocument();

        await user.keyboard("{ArrowRight}");
        expect(overview).toHaveFocus();

        await user.keyboard("{End}");
        expect(details).toHaveFocus();

        await user.keyboard("{Home}");
        expect(overview).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(screen.getByText("Overview panel")).toBeInTheDocument();
    });
});
