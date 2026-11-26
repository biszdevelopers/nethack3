import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export interface TreeNode {
    readonly id: string;
    readonly label: string;
    readonly children?: readonly TreeNode[];
}

export interface TreeViewProps {
    readonly nodes: readonly TreeNode[];
    readonly label: string;
    readonly selectedId: string | null;
    readonly onSelect: (id: string) => void;
    readonly defaultExpandedIds?: readonly string[];
    readonly className?: string;
}

interface FlatNode {
    readonly node: TreeNode;
    readonly depth: number;
    readonly parentId: string | null;
}

function flattenTree(
    nodes: readonly TreeNode[],
    expandedIds: ReadonlySet<string>,
    depth = 0,
    parentId: string | null = null,
    output: FlatNode[] = [],
): FlatNode[] {
    for (const node of nodes) {
        output.push({ node, depth, parentId });
        const children = node.children ?? [];
        if (children.length > 0 && expandedIds.has(node.id)) {
            flattenTree(children, expandedIds, depth + 1, node.id, output);
        }
    }
    return output;
}

interface TreeItemProps {
    readonly node: TreeNode;
    readonly depth: number;
    readonly expandedIds: ReadonlySet<string>;
    readonly selectedId: string | null;
    readonly focusedId: string;
    readonly registerRef: (id: string, element: HTMLLIElement | null) => void;
    readonly onActivate: (node: TreeNode) => void;
    readonly onKeyDown: (event: KeyboardEvent<HTMLLIElement>, node: TreeNode) => void;
}

function TreeItem({
    node,
    depth,
    expandedIds,
    selectedId,
    focusedId,
    registerRef,
    onActivate,
    onKeyDown,
}: TreeItemProps): ReactNode {
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && expandedIds.has(node.id);
    return (
        <li
            role="treeitem"
            aria-label={node.label}
            aria-level={depth + 1}
            aria-selected={node.id === selectedId}
            aria-expanded={hasChildren ? isExpanded : undefined}
            tabIndex={node.id === focusedId ? 0 : -1}
            ref={(element) => registerRef(node.id, element)}
            onKeyDown={(event) => onKeyDown(event, node)}
            className="group outline-none"
        >
            <div
                role="presentation"
                onClick={() => onActivate(node)}
                className={cn(
                    "flex cursor-pointer items-center gap-1 rounded-sm py-1 pr-2 text-sm",
                    "hover:bg-raised",
                    "group-focus-visible:bg-raised group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-inset",
                    node.id === selectedId ? "bg-primary-soft text-primary" : "text-ink",
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        "flex size-4 shrink-0 items-center justify-center text-ink-subtle",
                        isExpanded && "rotate-90",
                    )}
                >
                    {hasChildren ? <ChevronRight className="size-3.5" /> : null}
                </span>
                <span className="truncate">{node.label}</span>
            </div>
            {hasChildren && isExpanded ? (
                <ul role="group" className="ml-4 flex flex-col">
                    {children.map((child) => (
                        <TreeItem
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            expandedIds={expandedIds}
                            selectedId={selectedId}
                            focusedId={focusedId}
                            registerRef={registerRef}
                            onActivate={onActivate}
                            onKeyDown={onKeyDown}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

export function TreeView({
    nodes,
    label,
    selectedId,
    onSelect,
    defaultExpandedIds,
    className,
}: TreeViewProps): ReactNode {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => new Set(defaultExpandedIds ?? []),
    );
    const [focusedId, setFocusedId] = useState<string | null>(selectedId);
    const itemRefs = useRef(new Map<string, HTMLLIElement>());

    if (nodes.length === 0) {
        return (
            <EmptyState
                title="No items"
                description="This tree has no items to display."
                className={className ?? ""}
            />
        );
    }

    const visibleNodes = flattenTree(nodes, expandedIds);
    const firstVisibleId = visibleNodes[0]?.node.id ?? "";
    const effectiveFocusedId =
        focusedId !== null && visibleNodes.some((entry) => entry.node.id === focusedId)
            ? focusedId
            : visibleNodes.some((entry) => entry.node.id === selectedId)
              ? (selectedId ?? firstVisibleId)
              : firstVisibleId;

    const focusNode = (id: string): void => {
        setFocusedId(id);
        itemRefs.current.get(id)?.focus();
    };

    const toggleNode = (id: string): void => {
        setExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const activateNode = (node: TreeNode): void => {
        focusNode(node.id);
        onSelect(node.id);
        if ((node.children?.length ?? 0) > 0) {
            toggleNode(node.id);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>, node: TreeNode): void => {
        if (event.target !== event.currentTarget) {
            return;
        }
        const index = visibleNodes.findIndex((entry) => entry.node.id === node.id);
        const current = visibleNodes[index];
        if (current === undefined) {
            return;
        }
        const children = node.children ?? [];
        const hasChildren = children.length > 0;
        const isExpanded = hasChildren && expandedIds.has(node.id);

        switch (event.key) {
            case "ArrowDown": {
                const next = visibleNodes[index + 1];
                if (next !== undefined) {
                    event.preventDefault();
                    focusNode(next.node.id);
                }
                break;
            }
            case "ArrowUp": {
                const previous = visibleNodes[index - 1];
                if (previous !== undefined) {
                    event.preventDefault();
                    focusNode(previous.node.id);
                }
                break;
            }
            case "Home": {
                event.preventDefault();
                focusNode(firstVisibleId);
                break;
            }
            case "End": {
                const last = visibleNodes[visibleNodes.length - 1];
                if (last !== undefined) {
                    event.preventDefault();
                    focusNode(last.node.id);
                }
                break;
            }
            case "ArrowRight": {
                if (!hasChildren) {
                    break;
                }
                event.preventDefault();
                if (!isExpanded) {
                    toggleNode(node.id);
                } else {
                    const child = visibleNodes[index + 1];
                    if (child !== undefined && child.depth === current.depth + 1) {
                        focusNode(child.node.id);
                    }
                }
                break;
            }
            case "ArrowLeft": {
                if (hasChildren && isExpanded) {
                    event.preventDefault();
                    toggleNode(node.id);
                } else if (current.parentId !== null) {
                    event.preventDefault();
                    focusNode(current.parentId);
                }
                break;
            }
            case "Enter":
            case " ": {
                event.preventDefault();
                onSelect(node.id);
                setFocusedId(node.id);
                break;
            }
            default:
                break;
        }
    };

    return (
        <ul
            role="tree"
            aria-label={label}
            className={cn("flex flex-col", className)}
            data-slot="tree-view"
        >
            {nodes.map((node) => (
                <TreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={expandedIds}
                    selectedId={selectedId}
                    focusedId={effectiveFocusedId}
                    registerRef={(id, element) => {
                        if (element === null) {
                            itemRefs.current.delete(id);
                        } else {
                            itemRefs.current.set(id, element);
                        }
                    }}
                    onActivate={activateNode}
                    onKeyDown={handleKeyDown}
                />
            ))}
        </ul>
    );
}
