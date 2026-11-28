import { useState, type ChangeEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { PROFILE_THEME_MAX_BYTES } from "@nethack/contracts";
import {
    Alert,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    PageHeader,
    useToast,
} from "@nethack/ui";
import { ArrowUpRight, ExternalLink, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "../application/session.js";
import { formatDate } from "../lib/format.js";
import { errorMessage } from "../lib/errors.js";
import { readImageDataUrl, usePublicProfile, useUpdateProfileTheme } from "./profile-theme.js";

const PROFILE_THEME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

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
    const { toast } = useToast();
    const user = session.data?.user ?? null;
    const [themeDraft, setThemeDraft] = useState<string | null | undefined>(undefined);
    const [themeError, setThemeError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const userId = user?.id ?? "";
    const publicProfile = usePublicProfile(userId);
    const saveTheme = useUpdateProfileTheme(userId);

    if (user === null) {
        return null;
    }

    const siteOrigin = import.meta.env.VITE_SITE_ORIGIN ?? "http://localhost:3000";
    const publicProfileUrl = new URL(`/users/${user.id}`, siteOrigin).toString();
    const fallback = initials(user.displayName);
    const savedTheme = publicProfile.data?.profileTheme ?? null;
    const shownTheme = themeDraft === undefined ? savedTheme : themeDraft;

    const submitTheme = (profileTheme: string | null): void => {
        saveTheme.mutate(profileTheme, {
            onSuccess: (updated) => {
                setThemeDraft(undefined);
                setThemeError(null);
                toast({
                    title:
                        updated.profileTheme === null
                            ? "Profile theme removed"
                            : "Profile theme updated",
                    description: "The public profile page uses the new theme.",
                    tone: "success",
                });
            },
            onError: (error) => setThemeError(errorMessage(error)),
        });
    };

    const onFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file === undefined) {
            return;
        }
        setThemeError(null);
        if (!PROFILE_THEME_TYPES.includes(file.type as (typeof PROFILE_THEME_TYPES)[number])) {
            setThemeError("Choose a PNG, JPEG, or WebP image. SVG is not accepted.");
            return;
        }
        if (file.size > PROFILE_THEME_MAX_BYTES) {
            setThemeError("The image must be 1 MB or smaller.");
            return;
        }
        setUploading(true);
        try {
            setThemeDraft(await readImageDataUrl(file));
        } catch {
            setThemeError("The selected image could not be read.");
        } finally {
            setUploading(false);
        }
    };

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
                        <div
                            data-testid="profile-theme-preview"
                            className="relative h-36 overflow-hidden rounded-md border border-line bg-raised"
                        >
                            {shownTheme === null ? (
                                <span className="flex size-full items-center justify-center text-xs text-ink-subtle">
                                    No profile theme image
                                </span>
                            ) : (
                                <img
                                    src={shownTheme}
                                    alt="Profile theme preview"
                                    className="absolute inset-0 size-full object-cover opacity-50"
                                />
                            )}
                            <div className="relative flex h-full items-center gap-3 p-4">
                                <Avatar className="size-12 border border-line">
                                    <AvatarFallback>
                                        {fallback.length > 0 ? (
                                            fallback
                                        ) : (
                                            <UserRound className="size-5" aria-hidden="true" />
                                        )}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-sm font-medium">
                                    {user.displayName}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="profile-theme-image" className="text-sm font-medium">
                                Profile theme image
                            </label>
                            <input
                                id="profile-theme-image"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => void onFileChange(event)}
                                disabled={uploading || saveTheme.isPending}
                                aria-describedby="profile-theme-help"
                                className="h-10 w-full rounded-md border border-line bg-app px-2 text-xs text-ink-muted file:mr-3 file:h-7 file:rounded-sm file:border-0 file:bg-raised file:px-2 file:text-xs file:text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                            />
                            <p id="profile-theme-help" className="text-xs text-ink-muted">
                                PNG, JPEG, or WebP up to 1 MB. The image becomes the background of
                                your public profile.
                            </p>
                        </div>

                        {themeError === null ? null : (
                            <Alert tone="critical" title="The profile theme was not saved">
                                {themeError}
                            </Alert>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                loading={saveTheme.isPending}
                                disabled={themeDraft === undefined || uploading}
                                onClick={() => {
                                    if (themeDraft !== undefined) {
                                        submitTheme(themeDraft);
                                    }
                                }}
                            >
                                Save theme
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                loading={saveTheme.isPending && saveTheme.variables === null}
                                disabled={savedTheme === null || saveTheme.isPending || uploading}
                                onClick={() => submitTheme(null)}
                            >
                                Remove theme
                            </Button>
                        </div>

                        <div className="flex items-start gap-3">
                            <ShieldCheck
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <p className="text-sm leading-6 text-ink-muted">
                                The public profile publishes your display name, avatar, profile
                                theme, and join date. It does not publish your email, sessions, or
                                organization memberships.
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
                                    Edit display name
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
