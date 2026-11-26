import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TreeView, type TreeNode } from "../tree-view.js";

const nodes: TreeNode[] = [
    {
        id: "parent",
        label: "Parent node",
        children: [
            { id: "child-one", label: "Child one" },
            { id: "child-two", label: "Child two" },
        ],
    },
    { id: "second-parent", label: "Second parent" },
];

describe("TreeView", () => {
    test("is a labelled tree with expanded, level, and group semantics", () => {
        render(
            <TreeView
                label="Project files"
                nodes={nodes}
                selectedId="child-one"
                onSelect={() => {}}
                defaultExpandedIds={["parent"]}
            />,
        );

        const tree = screen.getByRole("tree", { name: "Project files" });
        expect(tree).toBeInTheDocument();
        const parent = screen.getByRole("treeitem", { name: "Parent node" });
        expect(parent).toHaveAttribute("aria-expanded", "true");
        expect(parent).toHaveAttribute("aria-level", "1");
        expect(screen.getByRole("treeitem", { name: "Child one" })).toHaveAttribute(
            "aria-level",
            "2",
        );
        expect(screen.getByRole("group")).toBeInTheDocument();
    });

    test("supports arrow navigation, Home, End, expansion, and Enter selection", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <TreeView
                label="Project files"
                nodes={nodes}
                selectedId={null}
                onSelect={onSelect}
                defaultExpandedIds={["parent"]}
            />,
        );

        const parent = screen.getByRole("treeitem", { name: "Parent node" });
        parent.focus();
        expect(parent).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        const childOne = screen.getByRole("treeitem", { name: "Child one" });
        expect(childOne).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(screen.getByRole("treeitem", { name: "Child two" })).toHaveFocus();

        await user.keyboard("{End}");
        const secondParent = screen.getByRole("treeitem", { name: "Second parent" });
        expect(secondParent).toHaveFocus();

        await user.keyboard("{Home}");
        expect(parent).toHaveFocus();

        await user.keyboard("{ArrowLeft}");
        expect(parent).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("treeitem", { name: "Child one" })).not.toBeInTheDocument();

        await user.keyboard("{ArrowRight}");
        expect(parent).toHaveAttribute("aria-expanded", "true");
        await user.keyboard("{ArrowRight}");
        const expandedChild = screen.getByRole("treeitem", { name: "Child one" });
        expect(expandedChild).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(onSelect).toHaveBeenCalledWith("child-one");
    });
});
