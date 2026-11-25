import { useState, type ReactNode } from "react";
import {
    columnVisibilityFeature,
    createPaginatedRowModel,
    createSortedRowModel,
    flexRender,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
    useTable,
    type ColumnDef,
    type ColumnVisibilityState,
    type Header,
    type PaginationState,
    type RowData,
    type RowSelectionState,
    type SortingState,
} from "@tanstack/react-table";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    Columns3,
} from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "../button.js";
import { EmptyState } from "../empty-state.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table.js";

const dataTableFeatures = tableFeatures({
    rowSortingFeature,
    columnVisibilityFeature,
    rowSelectionFeature,
    rowPaginationFeature,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    sortFns: {
        text: sortFn_text,
        alphanumeric: sortFn_alphanumeric,
        datetime: sortFn_datetime,
    },
});

export type DataTableFeatures = typeof dataTableFeatures;
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

export interface DataTableProps<TData extends RowData> {
    readonly columns: ReadonlyArray<DataTableColumn<TData>>;
    readonly data: readonly TData[];
    readonly label?: string;
    readonly getRowId?: (row: TData) => string;
    readonly selectable?: boolean;
    readonly onSelectedRowsChange?: (rowIds: string[]) => void;
    readonly defaultPageSize?: number;
    readonly sorting?: SortingState;
    readonly onSortingChange?: (sorting: SortingState) => void;
    readonly manualSorting?: boolean;
    readonly pagination?: PaginationState;
    readonly onPaginationChange?: (pagination: PaginationState) => void;
    readonly manualPagination?: boolean;
    readonly pageCount?: number;
    readonly rowCount?: number;
    readonly initialColumnVisibility?: ColumnVisibilityState;
    readonly emptyTitle?: string;
    readonly emptyDescription?: string;
    readonly emptyState?: ReactNode;
    readonly className?: string;
}

function columnDefinitionLabel<TData extends RowData>(
    header: Header<DataTableFeatures, TData>,
): string {
    const definition = header.column.columnDef.header;
    return typeof definition === "string" ? definition : header.column.id;
}

function createSelectionColumn<TData extends RowData>(): DataTableColumn<TData> {
    return {
        id: "__select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
            <input
                type="checkbox"
                className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                checked={table.getIsAllPageRowsSelected()}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
                aria-label="Select all rows on this page"
                ref={(element) => {
                    if (element !== null) {
                        element.indeterminate =
                            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                    }
                }}
            />
        ),
        cell: ({ row }) => (
            <input
                type="checkbox"
                className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                checked={row.getIsSelected()}
                disabled={!row.getCanSelect()}
                onChange={row.getToggleSelectedHandler()}
                aria-label={`Select row ${row.index + 1}`}
            />
        ),
    };
}

export function DataTable<TData extends RowData>({
    columns,
    data,
    label = "Data table",
    getRowId,
    selectable = false,
    onSelectedRowsChange,
    defaultPageSize = 10,
    sorting: controlledSorting,
    onSortingChange,
    manualSorting = false,
    pagination: controlledPagination,
    onPaginationChange,
    manualPagination = false,
    pageCount,
    rowCount,
    initialColumnVisibility,
    emptyTitle = "No rows",
    emptyDescription = "There are no rows to display.",
    emptyState,
    className,
}: DataTableProps<TData>): ReactNode {
    const [internalSorting, setInternalSorting] = useState<SortingState>([]);
    const [internalPagination, setInternalPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
        () => initialColumnVisibility ?? {},
    );

    const sorting = controlledSorting ?? internalSorting;
    const pagination = controlledPagination ?? internalPagination;

    const tableColumns = selectable ? [createSelectionColumn<TData>(), ...columns] : [...columns];

    const table = useTable<DataTableFeatures, TData>({
        features: dataTableFeatures,
        columns: tableColumns,
        data,
        state: {
            sorting,
            pagination,
            rowSelection,
            columnVisibility,
        },
        onSortingChange: (updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            if (controlledSorting === undefined) {
                setInternalSorting(next);
            }
            onSortingChange?.(next);
        },
        onPaginationChange: (updater) => {
            const next = typeof updater === "function" ? updater(pagination) : updater;
            if (controlledPagination === undefined) {
                setInternalPagination(next);
            }
            onPaginationChange?.(next);
        },
        onRowSelectionChange: (updater) => {
            const next = typeof updater === "function" ? updater(rowSelection) : updater;
            setRowSelection(next);
            onSelectedRowsChange?.(Object.keys(next));
        },
        onColumnVisibilityChange: (updater) => {
            setColumnVisibility(
                typeof updater === "function" ? updater(columnVisibility) : updater,
            );
        },
        manualSorting,
        manualPagination,
        ...(pageCount === undefined ? {} : { pageCount }),
        ...(rowCount === undefined ? {} : { rowCount }),
        ...(getRowId === undefined ? {} : { getRowId }),
    });

    const rows = table.getRowModel().rows;
    const pageCountValue = table.getPageCount();
    const totalPages = pageCountValue > 0 ? pageCountValue : 1;
    const visibleHideableColumnCount = table
        .getAllLeafColumns()
        .filter((column) => column.getCanHide() && column.getIsVisible()).length;

    if (rows.length === 0) {
        return (
            <div className={className}>
                {emptyState ?? <EmptyState title={emptyTitle} description={emptyDescription} />}
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-2", className)} data-slot="data-table">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-subtle">
                    <span className="tabular-nums">{table.getRowCount()}</span> rows
                </p>
                <PopoverPrimitive.Root>
                    <PopoverPrimitive.Trigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            iconLeft={<Columns3 className="size-4" aria-hidden="true" />}
                        >
                            Columns
                        </Button>
                    </PopoverPrimitive.Trigger>
                    <PopoverPrimitive.Portal>
                        <PopoverPrimitive.Content
                            align="end"
                            sideOffset={6}
                            aria-label="Column visibility"
                            className="z-50 w-56 rounded-md border border-line bg-panel p-2 focus:outline-none"
                        >
                            <p className="px-2 py-1 text-xs text-ink-subtle">Visible columns</p>
                            <ul className="flex flex-col">
                                {table
                                    .getAllLeafColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => (
                                        <li key={column.id}>
                                            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink hover:bg-raised">
                                                <input
                                                    type="checkbox"
                                                    className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                    checked={column.getIsVisible()}
                                                    disabled={
                                                        column.getIsVisible() &&
                                                        visibleHideableColumnCount <= 1
                                                    }
                                                    onChange={column.getToggleVisibilityHandler()}
                                                />
                                                <span className="truncate">
                                                    {typeof column.columnDef.header === "string"
                                                        ? column.columnDef.header
                                                        : column.id}
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                            </ul>
                        </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
            </div>
            <Table aria-label={label}>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => {
                                const sorted = header.column.getIsSorted();
                                const canSort = header.column.getCanSort();
                                return (
                                    <TableHead
                                        key={header.id}
                                        scope="col"
                                        aria-sort={
                                            sorted === "asc"
                                                ? "ascending"
                                                : sorted === "desc"
                                                  ? "descending"
                                                  : undefined
                                        }
                                        className="whitespace-nowrap"
                                    >
                                        {header.isPlaceholder ? null : canSort ? (
                                            <button
                                                type="button"
                                                onClick={header.column.getToggleSortingHandler()}
                                                aria-label={`Sort by ${columnDefinitionLabel(header)}`}
                                                className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                                {sorted === "asc" ? (
                                                    <ArrowUp
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                ) : sorted === "desc" ? (
                                                    <ArrowDown
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <ChevronsUpDown
                                                        className="size-3.5 text-ink-subtle"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </button>
                                        ) : (
                                            flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )
                                        )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() ? "selected" : undefined}
                            className="data-[state=selected]:bg-raised"
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="flex flex-col gap-2 border-t border-line px-1 py-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center justify-between gap-1 sm:justify-start">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="First page"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.firstPage()}
                    >
                        <ChevronsLeft className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Previous page"
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                    >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </Button>
                    <span
                        className="min-w-24 px-2 text-center text-xs tabular-nums text-ink-muted"
                        aria-live="polite"
                    >
                        Page {pagination.pageIndex + 1} of {totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Next page"
                        disabled={!table.getCanNextPage()}
                        onClick={() => table.nextPage()}
                    >
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Last page"
                        disabled={!table.getCanLastPage()}
                        onClick={() => table.lastPage()}
                    >
                        <ChevronsRight className="size-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
