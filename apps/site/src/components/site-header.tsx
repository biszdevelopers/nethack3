"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Drawer, DrawerClose, DrawerContent, cn, useColorMode } from "@nethack/ui";
import { gsap, useIsoLayoutEffect } from "@nethack/ui/motion";
import {
    House,
    Trophy,
    FolderGit2,
    Megaphone,
    Info,
    HelpCircle,
    Moon,
    Sun,
    Menu,
    UserRound,
    ArrowUpRight,
    X,
} from "lucide-react";

const NAVIGATION = [
    { href: "/", label: "Home", icon: House },
    { href: "/competitions", label: "Competitions", icon: Trophy },
    { href: "/projects", label: "Showcase", icon: FolderGit2 },
    { href: "/announcements", label: "Announcements", icon: Megaphone },
    { href: "/about", label: "About", icon: Info },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
] as const;

export function SiteHeader({ workspaceOrigin }: { readonly workspaceOrigin: string }): ReactNode {
    const pathname = usePathname();
    const headerRef = useRef<HTMLElement | null>(null);
    const navRef = useRef<HTMLDivElement | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const { colorMode, toggleColorMode } = useColorMode();

    useIsoLayoutEffect(() => {
        const header = headerRef.current;
        const nav = navRef.current;
        if (header === null || nav === null) {
            return;
        }
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            return;
        }
        const context = gsap.context(() => {
            gsap.fromTo(
                header,
                { yPercent: -100, autoAlpha: 0 },
                { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" },
            );
            gsap.fromTo(
                nav.children,
                { autoAlpha: 0, y: -8 },
                {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.5,
                    stagger: 0.05,
                    delay: 0.25,
                    ease: "power2.out",
                },
            );
        }, header);
        return () => context.revert();
    }, []);

    const isActive = (href: string): boolean =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <header
            ref={headerRef}
            className="sticky top-0 z-50 border-b border-line bg-app/80 backdrop-blur-xl"
        >
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
            >
                Skip to content
            </a>
            <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
                <Link
                    href="/"
                    aria-label="nethack home"
                    className="group flex shrink-0 items-center gap-2 rounded-md text-xl font-extrabold tracking-tight"
                >
                    <span className="text-primary glow">nethack</span>
                    <span
                        aria-hidden="true"
                        className="inline-block h-4 w-1.5 animate-pulse rounded-[2px] bg-primary/80"
                    />
                </Link>

                <div ref={navRef} className="hidden flex-1 items-center justify-center gap-1 lg:flex">
                    {NAVIGATION.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "group relative inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-raised text-primary"
                                        : "text-ink-muted hover:bg-raised/60 hover:text-ink",
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "size-4 transition-colors",
                                        active
                                            ? "text-primary"
                                            : "text-ink-subtle group-hover:text-ink-muted",
                                    )}
                                    aria-hidden="true"
                                />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                <div className="ml-auto flex items-center gap-1.5 lg:ml-0 lg:flex-1 lg:justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleColorMode}
                        aria-label={colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {colorMode === "dark" ? (
                            <Moon className="size-4" aria-hidden="true" />
                        ) : (
                            <Sun className="size-4" aria-hidden="true" />
                        )}
                    </Button>
                    <a
                        href={`${workspaceOrigin}/sign-in`}
                        className="hidden h-9 items-center gap-2 rounded-md px-3 text-sm text-ink-muted transition-colors hover:bg-primary/10 hover:text-primary sm:inline-flex"
                    >
                        <UserRound className="size-4" aria-hidden="true" />
                        Workspace
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                    </a>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        aria-label="Open navigation"
                        onClick={() => setMenuOpen(true)}
                    >
                        <Menu className="size-4" aria-hidden="true" />
                    </Button>
                </div>
            </div>

            <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
                <DrawerContent
                    title="nethack"
                    description="Competitions, projects, and announcements."
                    side="right"
                    className="bg-app"
                >
                    <nav aria-label="Mobile" className="flex flex-col gap-1">
                        {NAVIGATION.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <DrawerClose asChild key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                                            active
                                                ? "bg-raised text-primary"
                                                : "text-ink-muted hover:bg-raised hover:text-ink",
                                        )}
                                    >
                                        <Icon className="size-4" aria-hidden="true" />
                                        {item.label}
                                    </Link>
                                </DrawerClose>
                            );
                        })}
                    </nav>
                    <div className="mt-6 flex flex-col gap-2">
                        <Button asChild block>
                            <a href={`${workspaceOrigin}/sign-in`}>
                                Open workspace
                                <ArrowUpRight className="size-4" aria-hidden="true" />
                            </a>
                        </Button>
                        <div className="flex items-center justify-between rounded-md border border-line px-3 py-2">
                            <span className="text-xs text-ink-muted">Appearance</span>
                            <Button
                                variant="subtle"
                                size="sm"
                                onClick={toggleColorMode}
                                iconLeft={
                                    colorMode === "dark" ? (
                                        <Moon className="size-3.5" aria-hidden="true" />
                                    ) : (
                                        <Sun className="size-3.5" aria-hidden="true" />
                                    )
                                }
                            >
                                {colorMode === "dark" ? "Dark" : "Light"}
                            </Button>
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-xs text-ink-subtle">
                        <X className="size-3" aria-hidden="true" />
                        Press escape to close
                    </div>
                </DrawerContent>
            </Drawer>
        </header>
    );
}
