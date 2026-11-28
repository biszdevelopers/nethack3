import type { ReactNode } from "react";
import { Link } from "react-router";
import { Bell } from "lucide-react";
import { Button } from "@nethack/ui";
import { useNotificationUnreadCount } from "../hooks/use-notifications.js";

export function NotificationBell(): ReactNode {
    const unread = useNotificationUnreadCount();
    const count = unread.data ?? 0;
    const label = count > 0 ? `Notifications, ${String(count)} unread` : "Notifications, no unread";
    return (
        <Button asChild variant="ghost" size="icon">
            <Link to="/notifications" aria-label={label} className="relative">
                <Bell className="size-4" aria-hidden="true" />
                {count === 0 ? null : (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-ink"
                    >
                        {count > 9 ? "9+" : String(count)}
                    </span>
                )}
            </Link>
        </Button>
    );
}
