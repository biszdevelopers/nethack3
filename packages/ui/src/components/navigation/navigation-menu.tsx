import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface NavigationMenuLinkItem {
    readonly id: string;
    readonly label: string;
    readonly href: string;
    readonly description?: string;
    readonly active?: boolean;
}

export type NavigationMenuEntry =
    | {
          readonly id: string;
          readonly label: string;
          readonly href: string;
          readonly active?: boolean;
      }
    | {
          readonly id: string;
          readonly label: string;
          readonly items: readonly NavigationMenuLinkItem[];
          readonly active?: boolean;
      };

export interface NavigationMenuProps extends ComponentPropsWithoutRef<
    typeof NavigationMenuPrimitive.Root
> {
    readonly items: readonly NavigationMenuEntry[];
    readonly label?: string;
}

const LINK_CLASS =
    "flex min-h-9 flex-col justify-center gap-0.5 rounded-sm px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function NavigationMenu({
    items,
    label = "Main",
    className,
    ...rest
}: NavigationMenuProps): ReactNode {
    return (
        <NavigationMenuPrimitive.Root
            data-slot="navigation-menu"
            aria-label={label}
            className={cn("relative", className)}
            {...rest}
        >
            <NavigationMenuPrimitive.List className="flex flex-wrap items-center gap-1">
                {items.map((entry) => (
                    <NavigationMenuPrimitive.Item key={entry.id}>
                        {"items" in entry ? (
                            <>
                                <NavigationMenuPrimitive.Trigger
                                    className={cn(
                                        "group inline-flex h-9 items-center gap-1 rounded-sm px-3 text-sm transition-colors",
                                        "text-ink-muted hover:bg-raised hover:text-ink",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        "data-[state=open]:bg-raised data-[state=open]:text-ink",
                                    )}
                                >
                                    {entry.label}
                                    <ChevronDown
                                        className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
                                        aria-hidden="true"
                                    />
                                </NavigationMenuPrimitive.Trigger>
                                <NavigationMenuPrimitive.Content className="w-[min(90vw,42rem)] p-2">
                                    <ul className="grid gap-1 sm:grid-cols-2">
                                        {entry.items.map((link) => (
                                            <li key={link.id}>
                                                <NavigationMenuPrimitive.Link asChild>
                                                    <a
                                                        href={link.href}
                                                        aria-current={
                                                            link.active === true
                                                                ? "page"
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            LINK_CLASS,
                                                            link.active === true
                                                                ? "bg-raised text-ink"
                                                                : "text-ink-muted hover:bg-raised hover:text-ink",
                                                        )}
                                                    >
                                                        <span className="font-medium">
                                                            {link.label}
                                                        </span>
                                                        {link.description === undefined ? null : (
                                                            <span className="text-xs text-ink-subtle">
                                                                {link.description}
                                                            </span>
                                                        )}
                                                    </a>
                                                </NavigationMenuPrimitive.Link>
                                            </li>
                                        ))}
                                    </ul>
                                </NavigationMenuPrimitive.Content>
                            </>
                        ) : (
                            <NavigationMenuPrimitive.Link asChild>
                                <a
                                    href={entry.href}
                                    aria-current={entry.active === true ? "page" : undefined}
                                    className={cn(
                                        "inline-flex h-9 items-center rounded-sm px-3 text-sm transition-colors",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        entry.active === true
                                            ? "bg-raised font-medium text-ink"
                                            : "text-ink-muted hover:bg-raised hover:text-ink",
                                    )}
                                >
                                    {entry.label}
                                </a>
                            </NavigationMenuPrimitive.Link>
                        )}
                    </NavigationMenuPrimitive.Item>
                ))}
            </NavigationMenuPrimitive.List>
            <div className="absolute left-0 top-full flex w-full justify-center">
                <NavigationMenuPrimitive.Viewport className="mt-2 overflow-hidden rounded-md border border-line bg-panel" />
            </div>
        </NavigationMenuPrimitive.Root>
    );
}
