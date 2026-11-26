import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { updateProfileRequestSchema } from "@nethack/contracts";
import {
    Avatar,
    AvatarFallback,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    Input,
    useColorMode,
    useLocale,
} from "@nethack/ui";
import { Sun, Moon, UserRound } from "lucide-react";
import { useSession } from "../application/session.js";
import { api } from "../application/api.js";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../lib/errors.js";

export function SettingsPage(): ReactNode {
    const session = useSession();
    const queryClient = useQueryClient();
    const { colorMode, setColorMode } = useColorMode();
    const { locale, setLocale } = useLocale();
    const [displayName, setDisplayName] = useState("");
    const [localeDraft, setLocaleDraft] = useState<string | null>(null);
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [localeStatus, setLocaleStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [localeError, setLocaleError] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);
    const user = session.data?.user ?? null;

    const dirty = useMemo(
        () => displayName.length > 0 && displayName !== user?.displayName,
        [displayName, user?.displayName],
    );
    const localeValue = localeDraft ?? user?.locale ?? locale;

    if (user === null) {
        return null;
    }

    const saveProfile = async (): Promise<void> => {
        setStatus("saving");
        setProfileError(null);
        try {
            await api.auth.updateProfile({ displayName });
            await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
            setStatus("saved");
            setDisplayName("");
        } catch (error) {
            setProfileError(errorMessage(error));
            setStatus("error");
        }
    };

    const saveLocale = async (): Promise<void> => {
        const parsed = updateProfileRequestSchema.safeParse({ locale: localeValue });
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            setLocaleError(issue?.message ?? "Use a locale such as en or pt-BR.");
            setLocaleStatus("error");
            return;
        }
        setLocaleStatus("saving");
        setLocaleError(null);
        try {
            await api.auth.updateProfile({ locale: localeValue });
            await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
            setLocale(localeValue);
            setLocaleDraft(null);
            setLocaleStatus("saved");
        } catch (error) {
            setLocaleError(errorMessage(error));
            setLocaleStatus("error");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-extrabold tracking-tight glow-sm">Account settings</h1>
                <p className="text-sm text-ink-muted">
                    Profile details come from Basis Auth and can be refined here.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="size-11">
                                <AvatarFallback>
                                    <UserRound className="size-5" aria-hidden="true" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium">
                                    {user.displayName}
                                </span>
                                <span className="truncate text-xs text-ink-subtle">
                                    {user.email ?? "No email on file"}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="display-name" className="text-sm font-medium">
                                Display name
                            </label>
                            <Input
                                id="display-name"
                                value={displayName}
                                placeholder={user.displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                maxLength={80}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                onClick={() => void saveProfile()}
                                disabled={!dirty}
                                loading={status === "saving"}
                            >
                                Save changes
                            </Button>
                            {status === "saved" ? (
                                <output className="text-xs text-primary">Profile saved</output>
                            ) : null}
                            {profileError === null ? null : (
                                <span className="text-xs text-ink" role="alert">
                                    {profileError}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-ink-muted">
                            nethack uses the same neon green, black, and white palette in both
                            themes.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant={colorMode === "dark" ? "solid" : "outline"}
                                size="sm"
                                onClick={() => setColorMode("dark")}
                                iconLeft={<Moon className="size-4" aria-hidden="true" />}
                            >
                                Dark
                            </Button>
                            <Button
                                variant={colorMode === "light" ? "solid" : "outline"}
                                size="sm"
                                onClick={() => setColorMode("light")}
                                iconLeft={<Sun className="size-4" aria-hidden="true" />}
                            >
                                Light
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Language</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="locale" className="text-sm font-medium">
                                Locale
                            </label>
                            <Input
                                id="locale"
                                value={localeValue}
                                onChange={(event) => setLocaleDraft(event.target.value)}
                                aria-describedby="locale-description"
                                autoComplete="off"
                            />
                            <p id="locale-description" className="text-xs text-ink-muted">
                                A language tag such as en, pt-BR, or fr. The workspace interface is
                                currently written in English.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                onClick={() => void saveLocale()}
                                loading={localeStatus === "saving"}
                                disabled={localeValue === user.locale}
                            >
                                Save locale
                            </Button>
                            {localeStatus === "saved" ? (
                                <output className="text-xs text-primary">Locale saved</output>
                            ) : null}
                            {localeError === null ? null : (
                                <span className="text-xs text-ink" role="alert">
                                    {localeError}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-ink-muted">
                            Choose email and in-app delivery for decisions, invitations, and
                            announcements.
                        </p>
                        <Button asChild variant="outline" className="w-fit">
                            <Link to="/notifications">Notification preferences</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Organizations</CardTitle>
                </CardHeader>
                <CardContent>
                    {session.data?.memberships.length === 0 ? (
                        <EmptyState
                            title="No organization membership"
                            description="An organizer must add you to an organization before you can participate in its competitions."
                        />
                    ) : (
                        <ul className="flex flex-col divide-y divide-line">
                            {session.data?.memberships.map((membership) => (
                                <li
                                    key={membership.organizationId}
                                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm">
                                            {membership.organizationName}
                                        </span>
                                        <span className="truncate text-xs text-ink-subtle">
                                            {membership.organizationSlug}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge tone="neutral" size="sm">
                                            {membership.role}
                                        </Badge>
                                        <Badge
                                            tone={
                                                membership.status === "active"
                                                    ? "primary"
                                                    : "outline"
                                            }
                                            size="sm"
                                        >
                                            {membership.status}
                                        </Badge>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
