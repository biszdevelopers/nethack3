import { type ReactNode } from "react";
import { Menu } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useDisclosure } from "../../hooks/state.js";
import { Button } from "../button.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../dialog.js";

export interface PageShellProps {
    readonly header?: ReactNode;
    readonly footer?: ReactNode;
    readonly sidebar?: ReactNode;
    readonly children: ReactNode;
    readonly className?: string;
    readonly contentClassName?: string;
}

export function PageShell({
    header,
    footer,
    sidebar,
    children,
    className,
    contentClassName,
}: PageShellProps): ReactNode {
    return (
        <div className={cn("flex min-h-dvh flex-col bg-app", className)}>
            {header === undefined ? null : (
                <header className="border-b border-line bg-app">{header}</header>
            )}
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                {sidebar === undefined ? null : (
                    <aside className="hidden shrink-0 border-line lg:flex lg:w-64 lg:flex-col lg:border-r">
                        {sidebar}
                    </aside>
                )}
                <main className={cn("min-w-0 flex-1", contentClassName)}>{children}</main>
            </div>
            {footer === undefined ? null : (
                <footer className="border-t border-line bg-app">{footer}</footer>
            )}
        </div>
    );
}

export interface ContentShellProps {
    readonly header?: ReactNode;
    readonly footer?: ReactNode;
    readonly sidebar?: ReactNode;
    readonly aside?: ReactNode;
    readonly children: ReactNode;
    readonly className?: string;
}

export function ContentShell({
    header,
    footer,
    sidebar,
    aside,
    children,
    className,
}: ContentShellProps): ReactNode {
    return (
        <div className={cn("flex min-h-dvh flex-col bg-app", className)}>
            {header === undefined ? null : (
                <header className="border-b border-line bg-app">{header}</header>
            )}
            <div className="mx-auto flex w-full max-w-[1280px] flex-1 items-start gap-8 px-6 py-8">
                {sidebar === undefined ? null : (
                    <aside
                        aria-label="Section navigation"
                        className="hidden w-56 shrink-0 lg:block"
                    >
                        {sidebar}
                    </aside>
                )}
                <main className="min-w-0 flex-1">{children}</main>
                {aside === undefined ? null : (
                    <aside aria-label="Page outline" className="hidden w-56 shrink-0 xl:block">
                        {aside}
                    </aside>
                )}
            </div>
            {footer === undefined ? null : (
                <footer className="border-t border-line bg-app">{footer}</footer>
            )}
        </div>
    );
}

export interface DashboardShellProps {
    readonly navbar?: ReactNode;
    readonly sidebar?: ReactNode;
    readonly footer?: ReactNode;
    readonly children: ReactNode;
    readonly className?: string;
}

export function DashboardShell({
    navbar,
    sidebar,
    footer,
    children,
    className,
}: DashboardShellProps): ReactNode {
    return (
        <div className={cn("flex min-h-dvh flex-col bg-app", className)}>
            {navbar === undefined ? null : (
                <header className="sticky top-0 z-30 border-b border-line bg-panel">
                    {navbar}
                </header>
            )}
            <div className="flex min-h-0 flex-1">
                {sidebar}
                <main className="min-w-0 flex-1">{children}</main>
            </div>
            {footer === undefined ? null : (
                <footer className="border-t border-line bg-app">{footer}</footer>
            )}
        </div>
    );
}

export interface ResponsiveNavigationShellProps {
    readonly brand?: ReactNode;
    readonly navigation: ReactNode;
    readonly actions?: ReactNode;
    readonly footer?: ReactNode;
    readonly children: ReactNode;
    readonly navigationLabel?: string;
    readonly className?: string;
}

export function ResponsiveNavigationShell({
    brand,
    navigation,
    actions,
    footer,
    children,
    navigationLabel = "Main",
    className,
}: ResponsiveNavigationShellProps): ReactNode {
    const drawer = useDisclosure(false);
    return (
        <div className={cn("flex min-h-dvh flex-col bg-app", className)}>
            <header className="sticky top-0 z-30 border-b border-line bg-app">
                <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 px-6">
                    {brand === undefined ? null : (
                        <div className="flex shrink-0 items-center gap-2">{brand}</div>
                    )}
                    <nav
                        aria-label={navigationLabel}
                        className="hidden flex-1 items-center gap-1 lg:flex"
                    >
                        {navigation}
                    </nav>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">{actions}</div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        aria-label="Open navigation"
                        aria-expanded={drawer.isOpen}
                        onClick={drawer.open}
                    >
                        <Menu className="size-4" aria-hidden="true" />
                    </Button>
                </div>
            </header>
            <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">{children}</main>
            {footer === undefined ? null : (
                <footer className="border-t border-line bg-app">
                    <div className="mx-auto w-full max-w-[1280px] px-6 py-8">{footer}</div>
                </footer>
            )}
            <Dialog open={drawer.isOpen} onOpenChange={drawer.setOpen}>
                <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-80 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-4 rounded-none border-y-0 border-l-0 p-4">
                    <DialogTitle>Navigation</DialogTitle>
                    <DialogDescription className="sr-only">
                        {navigationLabel} links for this page.
                    </DialogDescription>
                    <nav
                        aria-label={navigationLabel}
                        className="flex flex-col gap-1 overflow-y-auto"
                    >
                        {navigation}
                    </nav>
                </DialogContent>
            </Dialog>
        </div>
    );
}
