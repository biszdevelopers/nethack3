import type { ReactNode } from "react";
import { Link } from "react-router";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    PageHeader,
} from "@nethack/ui";
import { ArrowUpRight, ExternalLink, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "../application/session.js";
import { formatDate } from "../lib/format.js";

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("");
}

export function ProfilePage(): ReactNode {
    const session = useSession();
    const user = session.data?.user ?? null;
    if (user === null) {
        return null;
    }

    const siteOrigin = import.meta.env.VITE_SITE_ORIGIN ?? "http://localhost:3000";
    const publicProfileUrl = new URL(`/users/${user.id}`, siteOrigin).toString();
    const fallback = initials(user.displayName);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={user.displayName}
                description="Your profile as it appears to you and, separately, to the public site."
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link to="/settings">
                            <Settings className="size-4" aria-hidden="true" />
                            Edit in settings
                        </Link>
                    </Button>
                }
            />

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Account details</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <div className="flex items-center gap-4">
                            <Avatar className="size-16">
                                {user.avatarUrl === null ? null : (
                                    <AvatarImage
                                        src={user.avatarUrl}
                                        alt={`${user.displayName} avatar`}
                                    />
                                )}
                                <AvatarFallback>
                                    {fallback.length > 0 ? (
                                        fallback
                                    ) : (
                                        <UserRound className="size-6" aria-hidden="true" />
                                    )}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-base font-medium">
                                    {user.displayName}
                                </span>
                                <span className="truncate text-xs text-ink-subtle">
                                    Joined {formatDate(user.createdAt)}
                                </span>
                            </div>
                        </div>

                        <dl className="flex flex-col divide-y divide-line text-sm">
                            <div className="flex flex-col gap-1 py-3 first:pt-0">
                                <dt className="text-xs text-ink-subtle">Display name</dt>
                                <dd>{user.displayName}</dd>
                            </div>
                            <div className="flex flex-col gap-1 py-3">
                                <dt className="text-xs text-ink-subtle">Email</dt>
                                <dd>{user.email ?? "No email on file"}</dd>
                            </div>
                            <div className="flex flex-col gap-1 py-3 last:pb-0">
                                <dt className="text-xs text-ink-subtle">Locale</dt>
                                <dd>{user.locale}</dd>
                            </div>
                        </dl>

                        <p className="text-xs leading-6 text-ink-muted">
                            Your email is visible only inside the authenticated workspace. It is
                            never included in the public profile response.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Public profile</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <ShieldCheck
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <p className="text-sm leading-6 text-ink-muted">
                                The public profile publishes your display name and avatar. It does
                                not publish your email, sessions, or organization memberships.
                            </p>
                        </div>

                        <code className="break-all rounded-sm border border-line bg-app px-2 py-1.5 text-xs text-ink-muted">
                            {publicProfileUrl}
                        </code>

                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm">
                                <a
                                    href={publicProfileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View public profile
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                </a>
                            </Button>
                            <Button asChild variant="subtle" color="neutral" size="sm">
                                <Link to="/settings">
                                    Change display name
                                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
