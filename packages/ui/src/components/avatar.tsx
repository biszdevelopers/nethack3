import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../lib/cn.js";

export const Avatar = forwardRef<
    HTMLSpanElement,
    ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(function Avatar({ className, ...rest }, ref) {
    return (
        <AvatarPrimitive.Root
            ref={ref}
            className={cn(
                "relative flex size-9 shrink-0 overflow-hidden rounded-md border border-line",
                className,
            )}
            {...rest}
        />
    );
});

export const AvatarImage = forwardRef<
    HTMLImageElement,
    ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...rest }, ref) {
    return (
        <AvatarPrimitive.Image
            ref={ref}
            className={cn("aspect-square size-full object-cover", className)}
            {...rest}
        />
    );
});

export const AvatarFallback = forwardRef<
    HTMLSpanElement,
    ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...rest }, ref) {
    return (
        <AvatarPrimitive.Fallback
            ref={ref}
            className={cn(
                "flex size-full items-center justify-center bg-raised text-xs font-medium text-ink-muted",
                className,
            )}
            {...rest}
        />
    );
});

export interface UserDisplayProps {
    readonly name: string;
    readonly email?: string | null;
    readonly imageUrl?: string | null;
    readonly size?: "sm" | "md" | "lg";
    readonly className?: string;
    readonly trailing?: ReactNode;
}

export function UserDisplay({
    name,
    email,
    imageUrl,
    size = "md",
    className,
    trailing,
}: UserDisplayProps): ReactNode {
    const avatarSize = size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9";
    const initials = name
        .split(/\s+/)
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("");
    return (
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
            <Avatar className={avatarSize}>
                {imageUrl === null || imageUrl === undefined ? null : (
                    <AvatarImage src={imageUrl} alt="" loading="lazy" />
                )}
                <AvatarFallback aria-hidden="true">
                    {initials.length > 0 ? initials : "?"}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ink">{name}</span>
                {email === null || email === undefined ? null : (
                    <span className="truncate text-xs text-ink-subtle">{email}</span>
                )}
            </div>
            {trailing === undefined ? null : <div className="ml-auto">{trailing}</div>}
        </div>
    );
}
