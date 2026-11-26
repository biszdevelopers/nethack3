import { Suspense, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
    Avatar,
    AvatarFallback,
    Badge,
    Button,
    Drawer,
    DrawerClose,
    DrawerContent,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    LoadingBlock,
    PageTransition,
    CommandPalette,
    useGsapStagger,
    Separator,
    StatusIndicator,
    cn,
    gsap,
    useColorMode,
    useIsoLayoutEffect,
} from "@nethack/ui";
import {
    Bell,
    Building2,
    ChevronDown,
    FolderGit2,
    Gavel,
    LayoutDashboard,
    LogOut,
    Menu as MenuIcon,
    Moon,
    Send,
    Settings,
    Shield,
    FlaskConical,
    Sun,
    Trophy,
    UserRound,
    Users,
    Vote,
    X,
} from "lucide-react";
import type { OrganizationRole, Session } from "@nethack/contracts";
import { api } from "./api.js";
import { organizationSelectionStore } from "./organization-store.js";
import { useActiveMembership, useSession } from "./session.js";

interface NavigationItem {
    readonly label: string;
    readonly to: string;
    readonly end?: boolean;
    readonly roles?: readonly OrganizationRole[];
    readonly icon: ReactNode;
}

const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
    { label: "Overview", to: "/", end: true, icon: <LayoutDashboard className="size-4" /> },
    { label: "Competitions", to: "/competitions", icon: <Trophy className="size-4" /> },
    { label: "Teams", to: "/teams", icon: <Users className="size-4" /> },
    { label: "Projects", to: "/projects", icon: <FolderGit2 className="size-4" /> },
    { label: "Submissions", to: "/submissions", icon: <Send className="size-4" /> },
];

const REVIEW_NAVIGATION: readonly NavigationItem[] = [
    {
        label: "Judging",
        to: "/judging",
        roles: ["owner", "organizer", "judge"],
        icon: <Gavel className="size-4" />,
    },
    {
        label: "Voting",
        to: "/voting",
        roles: ["owner", "organizer", "judge", "participant"],
        icon: <Vote className="size-4" />,
    },
];

const ORGANIZATION_NAVIGATION: readonly NavigationItem[] = [
    {
        label: "Organization",
        to: "/organization",
        roles: ["owner", "organizer"],
        icon: <Building2 className="size-4" />,
    },
];

const ACCOUNT_NAVIGATION: readonly NavigationItem[] = [
    { label: "Notifications", to: "/notifications", icon: <Bell className="size-4" /> },
    { label: "Settings", to: "/settings", icon: <Settings className="size-4" /> },
];

export function AppShell(): ReactNode {
    const session = useSession();
    const { membership } = useActiveMembership();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const headerRef = useRef<HTMLElement | null>(null);
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
    const { colorMode, toggleColorMode } = useColorMode();

    useIsoLayoutEffect(() => {
        const header = headerRef.current;
        if (header === null) {
            return;
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }
        const context = gsap.context(() => {
            gsap.fromTo(
                header,
                { yPercent: -100, autoAlpha: 0 },
                { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" },
            );
        }, header);
        return () => context.revert();
    }, []);

    if (session.data === undefined || session.data === null) {
        return null;
    }

    const data = session.data;
    const role = membership?.role ?? null;
    const visible = (item: NavigationItem): boolean =>
        item.roles === undefined || (role !== null && item.roles.includes(role));

    const commandItems = [
        ...PRIMARY_NAVIGATION,
        ...REVIEW_NAVIGATION,
        ...ORGANIZATION_NAVIGATION,
        ...ACCOUNT_NAVIGATION,
    ]
        .filter(visible)
        .map((item) => ({
            id: item.to,
            label: item.label,
            description: `Go to ${item.label.toLowerCase()}`,
            onSelect: () => navigate(item.to),
        }));
    const commandGroups = [
        {
            heading: "Navigate",
            items: [
                ...commandItems,
                {
                    id: "toggle-theme",
                    label: colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode",
                    description: "Change the workspace appearance",
                    onSelect: toggleColorMode,
                },
            ],
        },
    ];

    const onSelectOrganization = (organizationId: string): void => {
        organizationSelectionStore.select(organizationId);
        void queryClient.invalidateQueries();
    };

    const onLogout = async (): Promise<void> => {
        try {
            const result = await api.auth.logout();
            queryClient.clear();
            if (result.providerLogoutUrl !== null) {
                window.location.assign(result.providerLogoutUrl);
                return;
            }
        } catch {
            queryClient.clear();
        }
        navigate("/sign-in", { replace: true });
    };

    const sidebar = (
        <SidebarContent
            session={data}
            visible={visible}
            activeOrganizationId={membership?.organizationId ?? null}
            onSelectOrganization={onSelectOrganization}
        />
    );

    return (
        <div className="flex min-h-dvh bg-app">
            <aside className="hidden w-64 shrink-0 border-r border-line lg:flex lg:flex-col">
                <div className="flex h-16 items-center border-b border-line px-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
                    >
                        <span className="text-primary glow">nethack</span>
                        <span
                            aria-hidden="true"
                            className="inline-block h-3.5 w-1.5 animate-pulse rounded-[2px] bg-primary/80"
                        />
                    </Link>
                </div>
                {sidebar}
            </aside>

            <Drawer open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
                <DrawerContent
                    title="nethack"
                    description="Competition workspace."
                    side="left"
                    className="bg-panel"
                >
                    <div className="mb-4 flex items-center justify-between">
                        <span className="text-primary glow text-lg font-extrabold">nethack</span>
                        <DrawerClose asChild>
                            <Button variant="ghost" size="icon" aria-label="Close navigation">
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        </DrawerClose>
                    </div>
                    {sidebar}
                </DrawerContent>
            </Drawer>

            <div className="flex min-w-0 flex-1 flex-col">
                <header
                    ref={headerRef}
                    className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-app/80 px-4 backdrop-blur-xl sm:px-6"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        aria-label="Open navigation"
                        onClick={() => setMobileNavigationOpen(true)}
                    >
                        <MenuIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <Link to="/" className="text-sm font-extrabold tracking-tight lg:hidden">
                        <span className="text-primary glow-sm">nethack</span>
                    </Link>
                    <Separator orientation="vertical" className="hidden h-5 lg:block" />
                    <div className="min-w-0 flex-1">
                        {membership === null ? (
                            <span className="text-xs text-ink-muted">No organization selected</span>
                        ) : (
                            <span className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
                                <Building2
                                    className="size-3.5 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <span className="truncate">{membership.organizationName}</span>
                            </span>
                        )}
                    </div>
                    {membership === null ? null : (
                        <Badge variant="soft" color="primary" size="sm">
                            {roleLabel(membership.role)}
                        </Badge>
                    )}
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                aria-label={`Account menu ${initials(data.user.displayName)}`}
                            >
                                <Avatar className="size-8">
                                    <AvatarFallback>
                                        {initials(data.user.displayName)}
                                    </AvatarFallback>
                                </Avatar>
                                <ChevronDown
                                    className="hidden size-3.5 text-ink-subtle sm:block"
                                    aria-hidden="true"
                                />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-56">
                            <DropdownMenuLabel>{data.user.displayName}</DropdownMenuLabel>
                            {data.user.email === null ? null : (
                                <DropdownMenuLabel>{data.user.email}</DropdownMenuLabel>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => navigate("/settings")}>
                                <UserRound className="size-4" aria-hidden="true" />
                                Account settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => void onLogout()}>
                                <LogOut className="size-4" aria-hidden="true" />
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
                    <PageTransition routeKey={`${location.pathname}${location.search}`}>
                        <Suspense fallback={<LoadingBlock rows={4} label="Loading page" />}>
                            <Outlet />
                        </Suspense>
                    </PageTransition>
                </main>
                <CommandPalette groups={commandGroups} />
            </div>
        </div>
    );
}

function SidebarContent({
    session,
    visible,
    activeOrganizationId,
    onSelectOrganization,
}: {
    readonly session: Session;
    readonly visible: (item: NavigationItem) => boolean;
    readonly activeOrganizationId: string | null;
    readonly onSelectOrganization: (organizationId: string) => void;
}): ReactNode {
    const navRef = useGsapStagger<HTMLElement>({ selector: ":scope > div", stagger: 0.06 });
    const activeMemberships = session.memberships.filter(
        (membership) => membership.status === "active",
    );
    return (
        <>
            <div className="border-b border-line p-4">
                <label
                    htmlFor="organization-select"
                    className="mb-1.5 block text-xs text-ink-subtle"
                >
                    Organization
                </label>
                <select
                    id="organization-select"
                    className="h-9 w-full rounded-md border border-line bg-app px-2 text-xs text-ink transition-colors hover:border-line-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    value={activeOrganizationId ?? ""}
                    onChange={(event) => onSelectOrganization(event.target.value)}
                    disabled={activeMemberships.length === 0}
                >
                    {activeMemberships.length === 0 ? (
                        <option value="">No organizations</option>
                    ) : null}
                    {activeMemberships.map((membership) => (
                        <option key={membership.organizationId} value={membership.organizationId}>
                            {membership.organizationName}
                        </option>
                    ))}
                </select>
            </div>
            <nav
                ref={navRef}
                className="flex flex-1 flex-col gap-6 overflow-y-auto p-3"
                aria-label="Workspace"
            >
                <NavigationGroup heading="Participate" items={PRIMARY_NAVIGATION.filter(visible)} />
                {REVIEW_NAVIGATION.some(visible) ? (
                    <NavigationGroup heading="Review" items={REVIEW_NAVIGATION.filter(visible)} />
                ) : null}
                {ORGANIZATION_NAVIGATION.some(visible) ? (
                    <NavigationGroup
                        heading="Organize"
                        items={ORGANIZATION_NAVIGATION.filter(visible)}
                    />
                ) : null}
                <NavigationGroup heading="Account" items={ACCOUNT_NAVIGATION.filter(visible)} />
                {session.globalAdministrator ? (
                    <NavigationGroup
                        heading="Platform"
                        items={[
                            {
                                label: "Administration",
                                to: "/admin",
                                icon: <Shield className="size-4" />,
                            },
                        ]}
                    />
                ) : null}
                {import.meta.env.DEV ? (
                    <NavigationGroup
                        heading="Development"
                        items={[
                            {
                                label: "Component lab",
                                to: "/lab",
                                icon: <FlaskConical className="size-4" />,
                            },
                        ]}
                    />
                ) : null}
            </nav>
            <div className="border-t border-line p-4">
                <StatusIndicator tone="success" label="Session active" />
            </div>
        </>
    );
}

function NavigationGroup({
    heading,
    items,
}: {
    readonly heading: string;
    readonly items: readonly NavigationItem[];
}): ReactNode {
    if (items.length === 0) {
        return null;
    }
    return (
        <div className="flex flex-col gap-1">
            <p className="px-2 text-[11px] tracking-[0.12em] text-ink-subtle">{heading}</p>
            {items.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end === true}
                    className={({ isActive }) =>
                        cn(
                            "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
                            isActive
                                ? "bg-raised text-primary"
                                : "text-ink-muted hover:bg-raised/60 hover:text-ink",
                        )
                    }
                >
                    {({ isActive }) => (
                        <>
                            <span
                                className={cn(
                                    "transition-colors",
                                    isActive
                                        ? "text-primary"
                                        : "text-ink-subtle group-hover:text-ink-muted",
                                )}
                                aria-hidden="true"
                            >
                                {item.icon}
                            </span>
                            {item.label}
                        </>
                    )}
                </NavLink>
            ))}
        </div>
    );
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("");
}

function roleLabel(role: OrganizationRole): string {
    switch (role) {
        case "owner":
            return "Owner";
        case "organizer":
            return "Organizer";
        case "judge":
            return "Judge";
        case "participant":
            return "Participant";
    }
}
