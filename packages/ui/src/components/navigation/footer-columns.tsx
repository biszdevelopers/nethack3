import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface FooterColumnLink {
    readonly label: string;
    readonly href: string;
}

export interface FooterColumn {
    readonly id: string;
    readonly title: string;
    readonly links: readonly FooterColumnLink[];
}

export interface FooterColumnsProps {
    readonly columns: readonly FooterColumn[];
    readonly brand?: ReactNode;
    readonly legal?: string;
    readonly className?: string;
}

export function FooterColumns({ columns, brand, legal, className }: FooterColumnsProps): ReactNode {
    return (
        <div data-slot="footer-columns" className={cn("flex flex-col gap-8", className)}>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {brand === undefined ? null : <div className="min-w-0">{brand}</div>}
                {columns.map((column) => (
                    <nav key={column.id} aria-label={column.title} className="min-w-0">
                        <p className="mb-2 text-xs font-medium text-ink-subtle">{column.title}</p>
                        <ul className="flex flex-col gap-1">
                            {column.links.map((link) => (
                                <li key={`${column.id}-${link.href}`}>
                                    <a
                                        href={link.href}
                                        className="inline-flex min-h-9 items-center rounded-sm text-sm text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                ))}
            </div>
            {legal === undefined ? null : (
                <p className="border-t border-line pt-6 text-xs text-ink-subtle">{legal}</p>
            )}
        </div>
    );
}
