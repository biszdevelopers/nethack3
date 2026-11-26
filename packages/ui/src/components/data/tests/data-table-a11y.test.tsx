import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DataTable, type DataTableColumn } from "../data-table.js";

interface Member {
    readonly id: string;
    readonly name: string;
}

const columns: DataTableColumn<Member>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "id", header: "Id" },
];

const members: Member[] = Array.from({ length: 12 }, (_, index) => ({
    id: `member-${String(index + 1)}`,
    name: `Member ${String(index + 1)}`,
}));

describe("DataTable", () => {
    test("exposes an accessible table name, column scopes, and header sort semantics", async () => {
        const user = userEvent.setup();
        render(<DataTable label="Members" columns={columns} data={members.slice(0, 2)} />);

        const table = screen.getByRole("table", { name: "Members" });
        expect(table).toBeInTheDocument();
        const headers = within(table).getAllByRole("columnheader");
        expect(headers[0]).toHaveTextContent("Name");
        expect(headers[0]).toHaveAttribute("scope", "col");

        const sort = screen.getByRole("button", { name: "Sort by Name" });
        await user.click(sort);
        expect(within(table).getAllByRole("columnheader")[0]).toHaveAttribute(
            "aria-sort",
            "ascending",
        );
    });

    test("reports indeterminate selection and paginates", async () => {
        const user = userEvent.setup();
        render(
            <DataTable
                label="Members"
                columns={columns}
                data={members}
                selectable
                defaultPageSize={10}
            />,
        );

        const selectAll = screen.getByRole("checkbox", { name: "Select all rows on this page" });
        expect(selectAll).not.toBeChecked();
        expect((selectAll as HTMLInputElement).indeterminate).toBe(false);

        await user.click(screen.getByRole("checkbox", { name: "Select row 1" }));
        const selectAllAfter = screen.getByRole("checkbox", {
            name: "Select all rows on this page",
        });
        expect((selectAllAfter as HTMLInputElement).indeterminate).toBe(true);

        await user.click(screen.getByRole("checkbox", { name: "Select row 2" }));
        await user.click(screen.getByRole("checkbox", { name: "Select row 3" }));
        expect(screen.getByRole("checkbox", { name: "Select row 3" })).toBeChecked();

        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Next page" }));
        expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
        expect(screen.getByText("Member 12")).toBeInTheDocument();
        expect(screen.queryByText("Member 1")).not.toBeInTheDocument();
    });

    test("renders the empty state when there are no rows", () => {
        render(<DataTable label="Members" columns={columns} data={[]} />);
        expect(screen.getByText("No rows")).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
});
