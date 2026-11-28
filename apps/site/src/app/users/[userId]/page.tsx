import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { idSchema } from "@nethack/contracts";
import { ArrowLeft, FolderGit2, ShieldCheck, UserRound } from "lucide-react";
import { Button, Card, CardContent } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";
import { PublicApiError, getPublicUserProfile } from "../../../lib/public-api";

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("");
}

function parseUserId(userId: string): string | null {
    const parsed = idSchema.safeParse(userId);
    return parsed.success ? parsed.data : null;
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ userId: string }>;
}): Promise<Metadata> {
    const { userId } = await params;
    const id = parseUserId(userId);
    if (id === null) {
        return { title: "Profile" };
    }
    try {
        const user = await getPublicUserProfile(id);
        return {
            title: user.displayName,
            description: `Public profile for ${user.displayName} on nethack.`,
            openGraph: {
                title: user.displayName,
                description: `Public profile for ${user.displayName} on nethack.`,
                type: "profile",
            },
        };
    } catch {
        return { title: "Profile" };
    }
}

export default async function PublicUserPage({
    params,
}: {
    readonly params: Promise<{ userId: string }>;
}): Promise<ReactNode> {
    const { userId } = await params;
    const id = parseUserId(userId);
    if (id === null) {
        notFound();
    }

    let user;
    try {
        user = await getPublicUserProfile(id);
    } catch (error) {
        if (error instanceof PublicApiError && error.message === "Not found") {
            notFound();
        }
        throw error;
    }

    const fallback = initials(user.displayName);

    return (
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
            <Reveal>
                <Link
                    href="/projects"
                    className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-primary"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Project showcase
                </Link>
            </Reveal>

            <Reveal className="grid gap-6 rounded-lg border border-line bg-panel/70 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center md:p-8">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-md border border-line bg-raised sm:size-28">
                    {user.avatarUrl === null ? (
                        <span
                            aria-hidden="true"
                            className="flex size-full items-center justify-center text-2xl font-bold text-ink-muted"
                        >
                            {fallback.length > 0 ? fallback : <UserRound className="size-8" />}
                        </span>
                    ) : (
                        <img
                            src={user.avatarUrl}
                            alt=""
                            width={112}
                            height={112}
                            className="size-full object-cover"
                            referrerPolicy="no-referrer"
                        />
                    )}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <span className="text-xs text-primary">Public profile</span>
                    <h1 className="truncate text-3xl font-extrabold tracking-tight sm:text-4xl">
                        {user.displayName}
                    </h1>
                    <p className="max-w-xl text-sm text-ink-muted">
                        nethack publishes the display name and avatar of this account. Email
                        addresses, sign-in activity, and organization memberships stay private.
                    </p>
                </div>
            </Reveal>

            <Reveal delay={0.08}>
                <Card variant="soft">
                    <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <ShieldCheck
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <p className="max-w-xl text-sm text-ink-muted">
                                This page is generated from public account data. It does not grant
                                access to any workspace record or competition submission.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" color="neutral" size="sm">
                                <Link href="/projects">
                                    <FolderGit2 className="size-3.5" aria-hidden="true" />
                                    Browse projects
                                </Link>
                            </Button>
                            <Button asChild variant="subtle" color="neutral" size="sm">
                                <Link href="/competitions">Browse competitions</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </Reveal>
        </div>
    );
}
