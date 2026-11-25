import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Card } from "../card.js";
import { Grid, type GridColumns } from "../layout/container.js";
import { ContextualNavigation, type ContextualNavItem } from "../navigation/contextual-nav.js";
import { SearchNavigation, type SearchNavigationItem } from "../navigation/search-nav.js";

export function Page({ className, ...rest }: ComponentPropsWithoutRef<"div">): ReactNode {
    return <div data-slot="page" className={cn("flex flex-col gap-12", className)} {...rest} />;
}

export interface PageSectionProps extends ComponentPropsWithoutRef<"section"> {
    readonly title?: string;
    readonly description?: string;
    readonly actions?: ReactNode;
}

export function PageSection({
    title,
    description,
    actions,
    className,
    children,
    ...rest
}: PageSectionProps): ReactNode {
    return (
        <section
            data-slot="page-section"
            className={cn("flex flex-col gap-6", className)}
            {...rest}
        >
            {title === undefined && description === undefined && actions === undefined ? null : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex max-w-2xl flex-col gap-1">
                        {title === undefined ? null : (
                            <h2 className="text-xl font-semibold text-balance">{title}</h2>
                        )}
                        {description === undefined ? null : (
                            <p className="text-sm text-ink-muted text-pretty">{description}</p>
                        )}
                    </div>
                    {actions === undefined ? null : (
                        <div className="flex flex-wrap items-center gap-2">{actions}</div>
                    )}
                </div>
            )}
            {children}
        </section>
    );
}

export interface PageHeroProps {
    readonly title: string;
    readonly description?: string;
    readonly actions?: ReactNode;
    readonly children?: ReactNode;
    readonly className?: string;
}

export function PageHero({
    title,
    description,
    actions,
    children,
    className,
}: PageHeroProps): ReactNode {
    return (
        <section
            data-slot="page-hero"
            className={cn("flex flex-col gap-6 border-b border-line pb-10", className)}
        >
            <div className="flex max-w-3xl flex-col gap-3">
                <h1 className="text-3xl font-semibold text-balance sm:text-4xl">{title}</h1>
                {description === undefined ? null : (
                    <p className="text-base text-ink-muted text-pretty">{description}</p>
                )}
            </div>
            {actions === undefined ? null : (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
            {children}
        </section>
    );
}

export interface PageFeatureProps {
    readonly title: string;
    readonly description: string;
    readonly icon?: ReactNode;
    readonly className?: string;
}

export function PageFeature({ title, description, icon, className }: PageFeatureProps): ReactNode {
    return (
        <div data-slot="page-feature" className={cn("flex flex-col gap-2", className)}>
            {icon === undefined ? null : (
                <div className="text-primary" aria-hidden="true">
                    {icon}
                </div>
            )}
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="text-sm text-ink-muted text-pretty">{description}</p>
        </div>
    );
}

export interface PageFeatureItem {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly icon?: ReactNode;
}

export interface PageFeaturesProps {
    readonly features: readonly PageFeatureItem[];
    readonly cols?: GridColumns;
    readonly className?: string;
}

export function PageFeatures({ features, cols = 3, className }: PageFeaturesProps): ReactNode {
    return (
        <Grid data-slot="page-features" cols={cols} gap="lg" className={className}>
            {features.map((feature) => (
                <PageFeature
                    key={feature.id}
                    title={feature.title}
                    description={feature.description}
                    icon={feature.icon}
                />
            ))}
        </Grid>
    );
}

export interface PageGridProps extends ComponentPropsWithoutRef<"div"> {
    readonly cols?: GridColumns;
}

export function PageGrid({ cols = 2, className, ...rest }: PageGridProps): ReactNode {
    return <Grid data-slot="page-grid" cols={cols} gap="lg" className={className} {...rest} />;
}

export interface PageLink {
    readonly id: string;
    readonly label: string;
    readonly href: string;
    readonly description?: string;
}

export interface PageLinksProps {
    readonly links: readonly PageLink[];
    readonly className?: string;
}

export function PageLinks({ links, className }: PageLinksProps): ReactNode {
    if (links.length === 0) {
        return null;
    }
    return (
        <ul data-slot="page-links" className={cn("grid gap-3 sm:grid-cols-2", className)}>
            {links.map((link) => (
                <li key={link.id}>
                    <a
                        href={link.href}
                        className="flex min-h-9 flex-col gap-1 rounded-md border border-line p-4 transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <span className="text-sm font-medium text-ink">{link.label}</span>
                        {link.description === undefined ? null : (
                            <span className="text-xs text-ink-muted">{link.description}</span>
                        )}
                    </a>
                </li>
            ))}
        </ul>
    );
}

export interface PageListItem {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly icon?: ReactNode;
}

export interface PageListProps {
    readonly items: readonly PageListItem[];
    readonly className?: string;
}

export function PageList({ items, className }: PageListProps): ReactNode {
    if (items.length === 0) {
        return <p className="text-sm text-ink-subtle">No items to show.</p>;
    }
    return (
        <ul data-slot="page-list" className={cn("flex flex-col divide-y divide-line", className)}>
            {items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3">
                    {item.icon === undefined ? null : (
                        <span className="shrink-0 text-ink-muted">{item.icon}</span>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-medium text-ink">{item.label}</span>
                        {item.description === undefined ? null : (
                            <span className="text-sm text-ink-muted">{item.description}</span>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}

export interface PageLogo {
    readonly id: string;
    readonly name: string;
    readonly src?: string;
    readonly href?: string;
}

export interface PageLogosProps {
    readonly logos: readonly PageLogo[];
    readonly className?: string;
}

export function PageLogos({ logos, className }: PageLogosProps): ReactNode {
    if (logos.length === 0) {
        return (
            <p
                data-slot="page-logos"
                className={cn(
                    "rounded-md border border-dashed border-line px-6 py-8 text-center text-sm text-ink-subtle",
                    className,
                )}
            >
                No logos to display.
            </p>
        );
    }
    return (
        <ul data-slot="page-logos" className={cn("flex flex-wrap items-center gap-8", className)}>
            {logos.map((logo) => {
                const content =
                    logo.src === undefined ? (
                        <span className="text-sm text-ink-muted">{logo.name}</span>
                    ) : (
                        <img src={logo.src} alt={logo.name} loading="lazy" className="h-6 w-auto" />
                    );
                return (
                    <li key={logo.id}>
                        {logo.href === undefined ? (
                            content
                        ) : (
                            <a
                                href={logo.href}
                                className="inline-flex min-h-9 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {content}
                            </a>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

export interface PageCardProps {
    readonly title: string;
    readonly description?: string;
    readonly href?: string;
    readonly icon?: ReactNode;
    readonly actions?: ReactNode;
    readonly children?: ReactNode;
    readonly className?: string;
}

export function PageCard({
    title,
    description,
    href,
    icon,
    actions,
    children,
    className,
}: PageCardProps): ReactNode {
    return (
        <Card data-slot="page-card" className={cn("flex flex-col gap-3 p-5", className)}>
            {icon === undefined ? null : (
                <div className="text-primary" aria-hidden="true">
                    {icon}
                </div>
            )}
            <div className="flex flex-col gap-1">
                {href === undefined ? (
                    <h3 className="text-sm font-semibold text-ink">{title}</h3>
                ) : (
                    <a
                        href={href}
                        className="rounded-sm text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        {title}
                    </a>
                )}
                {description === undefined ? null : (
                    <p className="text-sm text-ink-muted">{description}</p>
                )}
            </div>
            {children}
            {actions === undefined ? null : (
                <div className="mt-auto flex flex-wrap items-center gap-2">{actions}</div>
            )}
        </Card>
    );
}

export interface PageColumnsProps extends ComponentPropsWithoutRef<"div"> {
    readonly columns?: 2 | 3;
}

export function PageColumns({ columns = 2, className, ...rest }: PageColumnsProps): ReactNode {
    return (
        <div
            data-slot="page-columns"
            className={cn(
                "grid grid-cols-1 gap-6 sm:grid-cols-2",
                columns === 3 && "lg:grid-cols-3",
                className,
            )}
            {...rest}
        />
    );
}

export interface PageCtaProps {
    readonly title: string;
    readonly description?: string;
    readonly actions?: ReactNode;
    readonly className?: string;
}

export function PageCta({ title, description, actions, className }: PageCtaProps): ReactNode {
    return (
        <section
            data-slot="page-cta"
            className={cn(
                "flex flex-col gap-4 rounded-lg border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <div className="flex max-w-2xl flex-col gap-1">
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                {description === undefined ? null : (
                    <p className="text-sm text-ink-muted">{description}</p>
                )}
            </div>
            {actions === undefined ? null : (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
        </section>
    );
}

export interface ContentNavigationProps {
    readonly items: readonly ContextualNavItem[];
    readonly title?: string;
    readonly label?: string;
    readonly className?: string;
}

export function ContentNavigation({
    items,
    title,
    label = "Content navigation",
    className,
}: ContentNavigationProps): ReactNode {
    return (
        <ContextualNavigation
            items={items}
            label={label}
            {...(title === undefined ? {} : { title })}
            {...(className === undefined ? {} : { className })}
        />
    );
}

export interface ContentSearchProps {
    readonly items: readonly SearchNavigationItem[];
    readonly onSelect?: (item: SearchNavigationItem) => void;
    readonly placeholder?: string;
    readonly emptyMessage?: string;
    readonly className?: string;
}

export function ContentSearch({
    items,
    onSelect,
    placeholder = "Search content",
    emptyMessage = "No results",
    className,
}: ContentSearchProps): ReactNode {
    return (
        <SearchNavigation
            items={items}
            placeholder={placeholder}
            emptyMessage={emptyMessage}
            label="Search content"
            {...(onSelect === undefined ? {} : { onSelect })}
            {...(className === undefined ? {} : { className })}
        />
    );
}

export interface TableOfContentsItem {
    readonly id: string;
    readonly label: string;
    readonly level?: 2 | 3;
}

export interface TableOfContentsProps {
    readonly items: readonly TableOfContentsItem[];
    readonly title?: string;
    readonly label?: string;
    readonly className?: string;
}

export function TableOfContents({
    items,
    title = "On this page",
    label = "Table of contents",
    className,
}: TableOfContentsProps): ReactNode {
    const [activeId, setActiveId] = useState<string | undefined>(items[0]?.id);
    const idKey = items.map((item) => item.id).join("|");

    useEffect(() => {
        const headings = idKey
            .split("|")
            .map((id) => document.getElementById(id))
            .filter((element): element is HTMLElement => element !== null);
        if (headings.length === 0 || typeof IntersectionObserver === "undefined") {
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .toSorted((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                const first = visible[0];
                if (first !== undefined) {
                    setActiveId(first.target.id);
                }
            },
            { rootMargin: "0px 0px -70% 0px", threshold: 1 },
        );
        for (const heading of headings) {
            observer.observe(heading);
        }
        return () => observer.disconnect();
    }, [idKey]);

    return (
        <nav
            data-slot="table-of-contents"
            aria-label={label}
            className={cn("flex flex-col gap-2", className)}
        >
            <p className="text-xs font-medium text-ink-subtle">{title}</p>
            {items.length === 0 ? (
                <p className="text-sm text-ink-subtle">No sections.</p>
            ) : (
                <ul className="flex flex-col gap-0.5">
                    {items.map((item) => (
                        <li key={item.id}>
                            <a
                                href={`#${item.id}`}
                                aria-current={activeId === item.id ? "location" : undefined}
                                className={cn(
                                    "flex min-h-9 items-center rounded-sm px-2 text-sm transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    item.level === 3 && "pl-5",
                                    activeId === item.id
                                        ? "bg-raised font-medium text-ink"
                                        : "text-ink-muted hover:text-ink",
                                )}
                            >
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </nav>
    );
}

export interface ContentPaginationLink {
    readonly label: string;
    readonly href: string;
}

export interface ContentPaginationProps {
    readonly previous?: ContentPaginationLink;
    readonly next?: ContentPaginationLink;
    readonly label?: string;
    readonly className?: string;
}

export function ContentPagination({
    previous,
    next,
    label = "Document navigation",
    className,
}: ContentPaginationProps): ReactNode {
    if (previous === undefined && next === undefined) {
        return null;
    }
    return (
        <nav
            data-slot="content-pagination"
            aria-label={label}
            className={cn("grid gap-3 border-t border-line pt-6 sm:grid-cols-2", className)}
        >
            {previous === undefined ? null : (
                <a
                    href={previous.href}
                    className="flex min-h-9 flex-col gap-1 rounded-md border border-line p-4 transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <span className="flex items-center gap-1 text-xs text-ink-subtle">
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        Previous
                    </span>
                    <span className="text-sm font-medium text-ink">{previous.label}</span>
                </a>
            )}
            {next === undefined ? null : (
                <a
                    href={next.href}
                    className="flex min-h-9 flex-col items-end gap-1 rounded-md border border-line p-4 text-right transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:col-start-2"
                >
                    <span className="flex items-center gap-1 text-xs text-ink-subtle">
                        Next
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-ink">{next.label}</span>
                </a>
            )}
        </nav>
    );
}
