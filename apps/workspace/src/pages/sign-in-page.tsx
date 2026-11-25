import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Separator } from "@nethack/ui";
import { api } from "../application/api.js";

export function SignInPage(): ReactNode {
    const location = useLocation();
    const state = location.state as { from?: string } | null;
    const returnTo = state?.from ?? "/";
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">nethack</p>
                    <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
                    <p className="text-sm text-ink-muted">
                        Authentication is handled by Basis Auth and your organization account.
                    </p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Continue with your account</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button asChild block>
                            <a href={api.auth.loginUrl(returnTo)}>Continue to sign in</a>
                        </Button>
                        <Separator />
                        <p className="text-xs text-ink-subtle">
                            Your browser receives only an application session cookie. Access and
                            refresh tokens remain on the server.
                        </p>
                    </CardContent>
                </Card>
                <Link to="/" className="text-xs text-ink-muted underline-offset-4 hover:underline">
                    Return to nethack
                </Link>
            </div>
        </div>
    );
}
