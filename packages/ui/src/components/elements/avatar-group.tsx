import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar.js";

export interface AvatarGroupMember {
    readonly name: string;
    readonly imageUrl?: string | null;
}

export interface AvatarGroupProps {
    readonly members: readonly AvatarGroupMember[];
    readonly max?: number;
    readonly size?: "sm" | "md" | "lg";
    readonly label?: string;
    readonly overflowLabel?: (count: number) => string;
    readonly className?: string;
}

const SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
    sm: "size-7 text-[11px]",
    md: "size-9",
    lg: "size-11 text-sm",
};

function initials(name: string): string {
    const value = name
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("");
    return value.length > 0 ? value : "?";
}

export function AvatarGroup({
    members,
    max,
    size = "md",
    label,
    overflowLabel = (count) => `${count} more`,
    className,
}: AvatarGroupProps): ReactNode {
    if (members.length === 0) {
        return null;
    }
    const visibleCount =
        max === undefined ? members.length : Math.max(0, Math.min(max, members.length));
    const visible = members.slice(0, visibleCount);
    const hiddenCount = members.length - visible.length;
    return (
        <div
            role="group"
            aria-label={label}
            className={cn("flex items-center", className)}
        >
            {visible.map((member, index) => (
                <Avatar
                    key={`${index}-${member.name}`}
                    role="img"
                    aria-label={member.name}
                    className={cn(SIZE_CLASS[size], index > 0 && "-ml-2")}
                >
                    {member.imageUrl === null || member.imageUrl === undefined ? null : (
                        <AvatarImage src={member.imageUrl} alt="" loading="lazy" />
                    )}
                    <AvatarFallback aria-hidden="true">{initials(member.name)}</AvatarFallback>
                </Avatar>
            ))}
            {hiddenCount > 0 ? (
                <Avatar
                    role="img"
                    aria-label={overflowLabel(hiddenCount)}
                    className={cn(SIZE_CLASS[size], visibleCount > 0 && "-ml-2")}
                >
                    <AvatarFallback aria-hidden="true">+{hiddenCount}</AvatarFallback>
                </Avatar>
            ) : null}
        </div>
    );
}
