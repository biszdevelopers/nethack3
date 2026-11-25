import { Suspense, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import {
    Avatar,
    AvatarFallback,
    Badge,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    LoadingBlock,
    Separator,
    StatusIndicator,
} from "@nethack/ui";
import { Menu as MenuIcon, X } from "lucide-react";
import type { OrganizationRole, Session } from "@nethack/contracts";
import { api } from "./api.js";
import { organizationSelectionStore } from "./organization-store.js";
import { SESSION_QUERY_KEY, useActiveMembership, useSession } from "./session.js";
import { useQueryClient } from "@tanstack/react-query";

interface NavigationItem {
    readonly label: string;
    readonly to: string;
    readonly end?: boolean;
    readonly roles?: readonly OrganizationRole[];
}

const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
    { label: "Overview", to: "/", end: true },
    { label: "Competitions", to: "/competitions" },
    { label: "Teams", to: "/teams" },
    { label: "Projects", to: "/projects" },
    { label: "Submissions", to: "/submissions" },
];

const REVIEW_NAVIGATION: readonly NavigationItem[] = [
    { label: "Judging", to: "/judging", roles: ["owner", "organizer", "judge"] },
    { label: "Voting", to: "/voting", roles: ["owner", "organizer", "judge", "participant"] },
];

const ORGANIZATION_NAVIGATION: readonly NavigationItem[] = [
    { label: "Organization", to: "/organization", roles: ["owner", "organizer"] },
];

const ACCOUNT_NAVIGATION: readonly NavigationItem[] = [
    { label: "Notifications", to: "/notifications" },
    { label: "Settings", to: "/settings" },
];

export function AppShell(): ReactNode {
    const session = useSession();
    const { membership } = useActiveMembership();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

    if (session.data === undefined || session.data === null) {
        return null;
    }

    const data = session.data;
    const role = membership?.role ?? null;
    const visible = (item: NavigationItem): boolean =>
        item.roles === undefined || (role !== null && item.roles.includes(role));

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

    return (
        <div className="flex min-h-dvh bg-app">
            <aside className="hidden w-64 shrink-0 border-r border-line lg:flex lg:flex-col">
                <SidebarContent
                    session={data}
                    visible={visible}
                    activeOrganizationId={membership?.organizationId ?? null}
                    onSelectOrganization={onSelectOrganization}
                />
            </aside>

            {mobileNavigationOpen ? (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/70"
                        role="presentation"
                        onClick={() => setMobileNavigationOpen(false)}
                    />
                    <aside className="relative z-50 flex h-full w-72 flex-col border-r border-line bg-panel">
                        <div className="flex items-center justify-between border-b border-line p-4">
                            <span className="text-sm font-semibold">nethack</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Close navigation"
                                onClick={() => setMobileNavigationOpen(false)}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        </div>
                        <SidebarContent
                            session={data}
                            visible={visible}
                            activeOrganizationId={membership?.organizationId ?? null}
                            onSelectOrganization={(organizationId) => {
                                onSelectOrganization(organizationId);
                                setMobileNavigationOpen(false);
                            }}
                        />
                    </aside>
                </div>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-16 items-center gap-3 border-b border-line px-4 sm:px-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        aria-label="Open navigation"
                        onClick={() => setMobileNavigationOpen(true)}
                    >
                        <MenuIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <Link to="/" className="text-sm font-semibold tracking-tight">
                        nethack
                    </Link>
                    <Separator orientation="vertical" className="h-5" />
                    <div className="min-w-0 flex-1">
                        {membership === null ? (
                            <span className="text-xs text-ink-muted">No organization selected</span>
                        ) : (
                            <span className="block truncate text-xs text-ink-muted">
                                {membership.organizationName}
                            </span>
                        )}
                    </div>
                    {membership === null ? null : (
                        <Badge tone="neutral" size="sm">
                            {roleLabel(membership.role)}
                        </Badge>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex items-center gap-2 rounded-md p-1 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                aria-label="Account menu"
                            >
                                <Avatar className="size-8">
                                    <AvatarFallback>
                                        {initials(data.user.displayName)}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{data.user.displayName}</DropdownMenuLabel>
                            {data.user.email === null ? null : (
                                <DropdownMenuLabel>{data.user.email}</DropdownMenuLabel>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => navigate("/settings")}>
                                Account settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void onLogout()}>
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>

                <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
                    <Suspense fallback={<LoadingBlock rows={4} label="Loading page" />}>
                        <Outlet />
                    </Suspense>
                </main>
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
    const activeMemberships = session.memberships.filter(
        (membership) => membership.status === "active",
    );
    return (
        <>
            <div className="border-b border-line p-4">
                <label
                    htmlFor="organization-select"
                    className="mb-1 block text-xs text-ink-subtle"
                >
                    Organization
                </label>
                <select
                    id="organization-select"
                    className="h-9 w-full rounded-md border border-line bg-app px-2 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={activeOrganizationId ?? ""}
                    onChange={(event) => onSelectOrganization(event.target.value)}
                    disabled={activeMemberships.length === 0}
                >
                    {activeMemberships.length === 0 ? (
                        <option value="">No organizations</option>
                    ) : null}
                    {activeMemberships.map((membership) => (
                        <option
                            key={membership.organizationId}
                            value={membership.organizationId}
                        >
                            {membership.organizationName}
                        </option>
                    ))}
                </select>
            </div>
            <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3" aria-label="Workspace">
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
            <p className="px-2 text-xs text-ink-subtle">{heading}</p>
            {items.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end === true}
                    className={({ isActive }) =>
                        `rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            isActive
                                ? "bg-raised text-ink"
                                : "text-ink-muted hover:bg-raised hover:text-ink"
                        }`
                    }
                >
                    {item.label}
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
