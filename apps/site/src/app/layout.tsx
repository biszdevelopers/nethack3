import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SiteProviders } from "../components/site-providers";

// CSP nonces are generated per request, so HTML must be rendered per request.
export const dynamic = "force-dynamic";

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

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
    return (
        <html lang="en" data-theme="dark">
            <body className="flex min-h-dvh flex-col">
                <SiteProviders>
                    <SiteHeader />
                    <main id="main" className="flex-1">
                        {children}
                    </main>
                    <SiteFooter />
                </SiteProviders>
            </body>
        </html>
    );
}
