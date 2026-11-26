import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Reveal, Separator } from "@nethack/ui";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { api } from "../application/api.js";

export function SignInPage(): ReactNode {
    const location = useLocation();
    const state = location.state as { from?: string } | null;
    const returnTo = state?.from ?? "/";
    return (
        <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden p-6">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-32 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]"
            />
            <Reveal className="flex w-full max-w-md flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
                        <span className="text-primary glow">nethack</span>
                        <span
                            aria-hidden="true"
                            className="inline-block h-4 w-1.5 animate-pulse rounded-[2px] bg-primary/80"
                        />
                    </span>
                    <h1 className="text-3xl font-extrabold tracking-tight glow">Sign in</h1>
                    <p className="text-sm text-ink-muted">
                        Authentication is handled by Basis Auth and your organization account.
                    </p>
                </div>
                <Card className="bg-panel/80">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                            Continue with your account
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button asChild block size="lg">
                            <a href={api.auth.loginUrl(returnTo)}>
                                Continue to sign in
                                <ArrowUpRight className="size-4" aria-hidden="true" />
                            </a>
                        </Button>
                        <Separator />
                        <p className="text-xs leading-6 text-ink-subtle">
                            Your browser receives only an application session cookie. Access and
                            refresh tokens remain on the server.
                        </p>
                    </CardContent>
                </Card>
                <Link
                    to="/"
                    className="text-xs text-ink-muted underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                    Return to nethack
                </Link>
            </Reveal>
        </div>
    );
}
