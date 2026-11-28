"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Button,
    Drawer,
    DrawerClose,
    DrawerContent,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    cn,
    useColorMode,
} from "@nethack/ui";
import { gsap, useIsoLayoutEffect } from "@nethack/ui/motion";
import {
    House,
    Trophy,
    Archive,
    FolderGit2,
    Medal,
    Megaphone,
    Info,
    HelpCircle,
    Mail,
    GitPullRequest,
    ChevronDown,
    Moon,
    Sun,
    Menu,
    Ellipsis,
    UserRound,
    ArrowUpRight,
    X,
} from "lucide-react";

const PRIMARY_NAVIGATION = [
    { href: "/", label: "Home", icon: House },
    { href: "/competitions", label: "Competitions", icon: Trophy },
    { href: "/past", label: "Seasons", icon: Archive },
    { href: "/projects", label: "Showcase", icon: FolderGit2 },
    { href: "/results", label: "Results", icon: Medal },
    { href: "/announcements", label: "Announcements", icon: Megaphone },
] as const;

const MORE_NAVIGATION = [
    { href: "/about", label: "About", icon: Info },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
    { href: "/contact", label: "Contact", icon: Mail },
    { href: "/contributing", label: "Contributing", icon: GitPullRequest },
] as const;

const MOBILE_NAVIGATION = [...PRIMARY_NAVIGATION, ...MORE_NAVIGATION] as const;

export function SiteHeader({ workspaceOrigin }: { readonly workspaceOrigin: string }): ReactNode {
    const pathname = usePathname();
    const headerRef = useRef<HTMLElement | null>(null);
    const navRef = useRef<HTMLElement | null>(null);
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

    const isActive = (href: string): boolean => {
        if (href === "/") {
            return pathname === "/";
        }
        if (href === "/past") {
            return pathname.startsWith("/past") || pathname.startsWith("/seasons");
        }
        return pathname.startsWith(href);
    };
    const secondaryActive = MORE_NAVIGATION.some((item) => isActive(item.href));

    return (
        <header ref={headerRef} className="sticky top-0 z-50 border-b border-line bg-app/80">
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
                    <span className="text-primary">nethack</span>
                    <span
                        aria-hidden="true"
                        className="inline-block h-4 w-1.5 animate-pulse rounded-[2px] bg-primary/80"
                    />
                </Link>

                <nav
                    ref={navRef}
                    aria-label="Primary"
                    className="hidden flex-1 items-center justify-center gap-1 xl:flex"
                >
                    {PRIMARY_NAVIGATION.map((item) => {
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    "group inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
                                    secondaryActive
                                        ? "bg-raised text-primary"
                                        : "text-ink-muted hover:bg-raised/60 hover:text-ink",
                                )}
                            >
                                <Ellipsis
                                    className={cn(
                                        "size-4 transition-colors",
                                        secondaryActive
                                            ? "text-primary"
                                            : "text-ink-subtle group-hover:text-ink-muted",
                                    )}
                                    aria-hidden="true"
                                />
                                More
                                <ChevronDown className="size-3 opacity-70" aria-hidden="true" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                            {MORE_NAVIGATION.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <DropdownMenuItem key={item.href} asChild>
                                        <Link
                                            href={item.href}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "flex w-full items-center gap-2",
                                                active ? "text-primary" : undefined,
                                            )}
                                        >
                                            <Icon className="size-4" aria-hidden="true" />
                                            {item.label}
                                        </Link>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </nav>

                <div className="ml-auto flex items-center gap-1.5 xl:ml-0 xl:flex-1 xl:justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleColorMode}
                        aria-label={
                            colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode"
                        }
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
                        className="xl:hidden"
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
                    description="Competitions, seasons, projects, and announcements."
                    side="right"
                    className="bg-app"
                >
                    <nav aria-label="Mobile" className="flex flex-col gap-1">
                        {MOBILE_NAVIGATION.map((item) => {
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
