"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageTransition } from "@nethack/ui/motion";

export function PageReveal({ children }: { readonly children: ReactNode }): ReactNode {
    const pathname = usePathname();
    return <PageTransition routeKey={pathname}>{children}</PageTransition>;
}
