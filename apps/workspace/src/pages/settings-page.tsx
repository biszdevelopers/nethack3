import { useMemo, useState, type ReactNode } from "react";
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
    useColorMode,
} from "@nethack/ui";
import { Sun, Moon, UserRound } from "lucide-react";
import { useSession } from "../application/session.js";
import { api } from "../application/api.js";
import { useQueryClient } from "@tanstack/react-query";

export function SettingsPage(): ReactNode {
    const session = useSession();
    const queryClient = useQueryClient();
    const { colorMode, setColorMode } = useColorMode();
    const [displayName, setDisplayName] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const user = session.data?.user ?? null;

    const dirty = useMemo(
        () => displayName.length > 0 && displayName !== user?.displayName,
        [displayName, user?.displayName],
    );

    if (user === null) {
        return null;
    }

    const saveProfile = async (): Promise<void> => {
        setStatus("saving");
        try {
            await api.auth.updateProfile({ displayName });
            await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
            setStatus("saved");
            setDisplayName("");
        } catch {
            setStatus("error");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
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
                            <input
                                id="display-name"
                                className="h-10 rounded-md border border-line bg-app px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                value={displayName}
                                placeholder={user.displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                maxLength={80}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => void saveProfile()}
                                disabled={!dirty}
                                loading={status === "saving"}
                            >
                                Save changes
                            </Button>
                            {status === "saved" ? (
                                <span className="text-xs text-primary" role="status">
                                    Profile saved
                                </span>
                            ) : null}
                            {status === "error" ? (
                                <span className="text-xs text-ink" role="alert">
                                    Profile could not be saved
                                </span>
                            ) : null}
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
