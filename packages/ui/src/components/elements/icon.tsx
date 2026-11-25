import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn.js";

export type IconComponent = LucideIcon;

export type IconSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<IconSize, string> = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-5",
};

export interface IconProps {
    readonly icon: IconComponent;
    readonly size?: IconSize;
    readonly label?: string;
    readonly className?: string;
}

export function Icon({ icon: Glyph, size = "md", label, className }: IconProps): ReactNode {
    const classes = cn(SIZE_CLASS[size], "shrink-0", className);
    if (label === undefined) {
        return <Glyph className={classes} aria-hidden="true" focusable="false" />;
    }
    return <Glyph className={classes} role="img" aria-label={label} focusable="false" />;
}
