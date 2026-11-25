"use client";

import type { ReactNode } from "react";
import { NethackProvider } from "@nethack/ui";

export function SiteProviders({ children }: { readonly children: ReactNode }): ReactNode {
    return <NethackProvider>{children}</NethackProvider>;
}
