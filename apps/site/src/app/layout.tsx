import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteProviders } from "../components/site-providers";

export const metadata: Metadata = {
    title: {
        default: "nethack",
        template: "%s · nethack",
    },
    description:
        "nethack is a hackathon platform for discovering competitions, forming teams, submitting projects, and reviewing results.",
    applicationName: "nethack",
    robots: { index: true, follow: true },
    openGraph: {
        title: "nethack",
        description:
            "Discover hackathon competitions, build a team, submit your project, and follow results.",
        siteName: "nethack",
        type: "website",
    },
};

export const viewport: Viewport = {
    themeColor: "#090909",
    colorScheme: "dark light",
};

// CSP nonces are generated per request, so HTML must be rendered per request.
export const dynamic = "force-dynamic";

export default async function RootLayout({
    children,
}: {
    readonly children: ReactNode;
}): Promise<ReactNode> {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    const nonce = (await headers()).get("x-nonce") ?? undefined;
    return (
        <html lang="en" data-theme="dark">
            <head>
                <script src="/theme-init.js" nonce={nonce} />
            </head>
            <body className="flex min-h-dvh flex-col overflow-x-clip">
                <SiteProviders>
                    <SiteHeader workspaceOrigin={workspaceOrigin} />
                    <main id="main" className="flex-1">
                        {children}
                    </main>
                    <SiteFooter />
                </SiteProviders>
            </body>
        </html>
    );
}
