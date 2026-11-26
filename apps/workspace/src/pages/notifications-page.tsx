import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Checkbox,
    EmptyState,
} from "@nethack/ui";
import { QueryErrorState, QueryLoading } from "../components/query-state.js";
import { formatDateTime, timeUntil } from "../lib/format.js";
import { humanizeStatus } from "../lib/status.js";
import { NotificationPreferencesForm } from "../capabilities/notifications/components/notification-preferences-form.js";
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotifications,
} from "../capabilities/notifications/hooks/use-notifications.js";

function notificationLink(linkUrl: string | null): ReactNode {
    if (linkUrl === null || linkUrl.length === 0) {
        return null;
    }
    if (linkUrl.startsWith("/")) {
        return (
            <Link to={linkUrl} className="text-sm text-primary underline-offset-4 hover:underline">
                Open
            </Link>
        );
    }
    return (
        <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
        >
            Open
        </a>
    );
}

export function NotificationsPage(): ReactNode {
    const [unreadOnly, setUnreadOnly] = useState(false);
    const notifications = useNotifications({ unread: unreadOnly });
    const allUnread = useNotifications({ unread: true });
    const markRead = useMarkNotificationRead();
    const markAll = useMarkAllNotificationsRead();

    const unreadCount = allUnread.data?.items.length ?? 0;
    const items = notifications.data?.items ?? [];
    const error = notifications.error ?? markRead.error ?? markAll.error;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-extrabold tracking-tight glow-sm">
                        Notifications
                    </h1>
                    <p className="text-sm text-ink-muted">
                        Decisions, invitations, assignments, and announcements.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => markAll.mutate()}
                    loading={markAll.isPending}
                    disabled={unreadCount === 0}
                >
                    Mark all read
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <Checkbox
                    checked={unreadOnly}
                    onCheckedChange={(checked) => setUnreadOnly(checked === true)}
                    label="Unread only"
                />
                {unreadCount === 0 ? null : (
                    <Badge tone="primary" size="sm">
                        {allUnread.data?.nextCursor === null
                            ? `${unreadCount} unread`
                            : `${unreadCount}+ unread`}
                    </Badge>
                )}
            </div>

            {error === null ? null : (
                <QueryErrorState error={error} title="Notification action failed" />
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-6">
                    {notifications.isPending ? (
                        <QueryLoading label="Loading notifications" />
                    ) : notifications.error !== null ? (
                        <QueryErrorState error={notifications.error} />
                    ) : items.length === 0 ? (
                        <EmptyState
                            title={unreadOnly ? "No unread notifications" : "No notifications"}
                            description={
                                unreadOnly
                                    ? "Everything in your inbox has been read."
                                    : "New activity relevant to you will appear here."
                            }
                        />
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {items.map((notification) => (
                                <li key={notification.id}>
                                    <Card>
                                        <CardContent className="flex flex-col gap-2">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="flex min-w-0 flex-col gap-1">
                                                    <span className="text-sm font-medium text-ink">
                                                        {notification.title}
                                                    </span>
                                                    <span className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                                                        <Badge tone="neutral" size="sm">
                                                            {humanizeStatus(notification.kind)}
                                                        </Badge>
                                                        <time
                                                            dateTime={notification.createdAt}
                                                            className="tabular-nums"
                                                        >
                                                            {formatDateTime(notification.createdAt)}
                                                        </time>
                                                        <span>
                                                            {timeUntil(notification.createdAt)}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                    {notificationLink(notification.linkUrl)}
                                                    {notification.readAt === null ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            loading={
                                                                markRead.isPending &&
                                                                markRead.variables ===
                                                                    notification.id
                                                            }
                                                            onClick={() =>
                                                                markRead.mutate(notification.id)
                                                            }
                                                            aria-label={`Mark ${notification.title} as read`}
                                                        >
                                                            Mark read
                                                        </Button>
                                                    ) : (
                                                        <Badge tone="outline" size="sm">
                                                            read
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-ink-muted">
                                                {notification.body}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </li>
                            ))}
                        </ul>
                    )}
                    {notifications.data?.nextCursor === null ||
                    notifications.data === undefined ? null : (
                        <p className="text-xs text-ink-subtle">
                            Showing the latest 100 notifications.
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Preferences</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <NotificationPreferencesForm />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
