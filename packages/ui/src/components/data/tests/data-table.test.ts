// @vitest-environment jsdom
import { createElement } from "react";
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DataTable, type DataTableColumn } from "../data-table.js";

interface Row {
    readonly id: string;
    readonly name: string;
}

const columns: DataTableColumn<Row>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "id", header: "Id" },
];

const rows: Row[] = [
    { id: "b", name: "Beta" },
    { id: "a", name: "Alpha" },
];

test("sorts, selects, and hides columns", async () => {
    const user = userEvent.setup();
    const { container } = render(
        createElement(DataTable<Row>, {
            columns,
            data: rows,
            selectable: true,
            defaultPageSize: 10,
        }),
    );

    const bodyText = () =>
        Array.from(container.querySelectorAll("tbody tr")).map((row) => row.textContent ?? "");
    expect(bodyText()[0]).toContain("Beta");

    await user.click(screen.getByRole("button", { name: "Sort by Name" }));
    expect(bodyText()[0]).toContain("Alpha");

    const rowCheckbox = screen.getByRole("checkbox", { name: "Select row 1" });
    await user.click(rowCheckbox);
    expect(rowCheckbox instanceof HTMLInputElement && rowCheckbox.checked).toBe(true);
    const firstPage = screen.getByRole("button", { name: "First page" });
    expect(firstPage instanceof HTMLButtonElement && firstPage.disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    const nameToggle = screen.getByRole("checkbox", { name: "Name" });
    await user.click(nameToggle);
    expect(screen.queryByRole("button", { name: "Sort by Name" })).toBeNull();
});
