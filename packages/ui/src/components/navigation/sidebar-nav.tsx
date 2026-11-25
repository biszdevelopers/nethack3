import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useDisclosure } from "../../hooks/state.js";
import { Button } from "../button.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../dialog.js";

export interface SidebarNavItem {
    readonly id: string;
    readonly label: string;
    readonly href?: string;
    readonly icon?: ReactNode;
    readonly badge?: ReactNode;
    readonly active?: boolean;
    readonly onSelect?: () => void;
}

export interface SidebarNavSection {
    readonly id: string;
    readonly title?: string;
    readonly items: readonly SidebarNavItem[];
    readonly collapsible?: boolean;
    readonly defaultOpen?: boolean;
}

export interface SidebarNavigationProps {
    readonly sections: readonly SidebarNavSection[];
    readonly activeId?: string;
    readonly onSelect?: (item: SidebarNavItem) => void;
    readonly label?: string;
    readonly mobileTitle?: string;
    readonly className?: string;
}

interface SectionProps {
    readonly section: SidebarNavSection;
    readonly activeId?: string | undefined;
    readonly onSelect?: (item: SidebarNavItem) => void;
    readonly collapsed: boolean;
    readonly onToggle: () => void;
}

function SidebarNavigationSection({
    section,
    activeId,
    onSelect,
    collapsed,
    onToggle,
}: SectionProps): ReactNode {
    const contentId = useId();
    const canCollapse = section.collapsible === true;
    return (
        <div className="flex flex-col gap-0.5">
            {section.title === undefined ? null : canCollapse ? (
                <button
                    type="button"
                    aria-expanded={!collapsed}
                    aria-controls={contentId}
                    onClick={onToggle}
                    className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2 py-1 text-xs font-medium text-ink-subtle transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <span className="flex-1 text-left">{section.title}</span>
                    <ChevronDown
                        className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")}
                        aria-hidden="true"
                    />
                </button>
            ) : (
                <p className="px-2 py-1 text-xs font-medium text-ink-subtle">{section.title}</p>
            )}
            <ul id={contentId} hidden={collapsed} className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                    const isActive =
                        activeId === undefined ? item.active === true : activeId === item.id;
                    const itemClass = cn(
                        "flex min-h-9 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isActive
                            ? "bg-raised font-medium text-ink"
                            : "text-ink-muted hover:bg-raised hover:text-ink",
                    );
                    const content = (
                        <>
                            {item.icon === undefined ? null : (
                                <span className="shrink-0">{item.icon}</span>
                            )}
                            <span className="truncate">{item.label}</span>
                            {item.badge === undefined ? null : (
                                <span className="ml-auto shrink-0">{item.badge}</span>
                            )}
                        </>
                    );
                    const handleSelect = (): void => {
                        onSelect?.(item);
                        item.onSelect?.();
                    };
                    return (
                        <li key={item.id}>
                            {item.href === undefined ? (
                                <button
                                    type="button"
                                    aria-current={isActive ? "page" : undefined}
                                    onClick={handleSelect}
                                    className={cn(itemClass, "text-left")}
                                >
                                    {content}
                                </button>
                            ) : (
                                <a
                                    href={item.href}
                                    aria-current={isActive ? "page" : undefined}
                                    onClick={handleSelect}
                                    className={itemClass}
                                >
                                    {content}
                                </a>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function SidebarNavigation({
    sections,
    activeId,
    onSelect,
    label = "Sidebar",
    mobileTitle = "Navigation",
    className,
}: SidebarNavigationProps): ReactNode {
    const drawer = useDisclosure(false);
    const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(
        () =>
            new Set(
                sections
                    .filter((section) => section.defaultOpen === false)
                    .map((section) => section.id),
            ),
    );
    const hasItems = sections.some((section) => section.items.length > 0);

    const toggleSection = (id: string): void => {
        setCollapsedSections((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderSections = (afterSelect?: () => void): ReactNode => (
        <div className="flex flex-col gap-4">
            {sections.map((section) => {
                const collapsible = section.collapsible === true;
                const collapsed = collapsible && collapsedSections.has(section.id);
                return (
                    <SidebarNavigationSection
                        key={section.id}
                        section={section}
                        activeId={activeId}
                        onSelect={(item) => {
                            onSelect?.(item);
                            afterSelect?.();
                        }}
                        collapsed={collapsed}
                        onToggle={() => toggleSection(section.id)}
                    />
                );
            })}
        </div>
    );

    return (
        <div data-slot="sidebar-navigation" className={cn("flex flex-col gap-2", className)}>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="lg:hidden"
                aria-label="Open navigation"
                onClick={drawer.open}
            >
                <Menu className="size-4" aria-hidden="true" />
                Browse
            </Button>
            <nav aria-label={label} className="hidden lg:block">
                {hasItems ? (
                    renderSections()
                ) : (
                    <p className="text-sm text-ink-subtle">No navigation items.</p>
                )}
            </nav>
            <Dialog open={drawer.isOpen} onOpenChange={drawer.setOpen}>
                <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-80 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-4 rounded-none border-y-0 border-l-0 p-4">
                    <DialogTitle>{mobileTitle}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Links for this section.
                    </DialogDescription>
                    <nav aria-label={label} className="flex flex-col gap-4 overflow-y-auto">
                        {hasItems ? (
                            renderSections(drawer.close)
                        ) : (
                            <p className="text-sm text-ink-subtle">No navigation items.</p>
                        )}
                    </nav>
                </DialogContent>
            </Dialog>
        </div>
    );
}
