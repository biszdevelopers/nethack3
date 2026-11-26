import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Reveal } from "@nethack/ui";

const REASONS: Record<string, { title: string; detail: string }> = {
    login_cancelled: {
        title: "Sign-in was cancelled",
        detail: "No account changes were made. You can start again whenever you are ready.",
    },
    login_expired: {
        title: "The sign-in attempt expired",
        detail: "Sign-in must be completed within ten minutes. Start a new attempt.",
    },
    login_failed: {
        title: "Sign-in could not be completed",
        detail: "The identity provider did not complete the request. Try again, and contact your organizer if it continues.",
    },
    account_disabled: {
        title: "This account is disabled",
        detail: "Contact your organization administrator to restore access.",
    },
    account_link_required: {
        title: "This email is linked to another identity",
        detail: "For safety, nethack does not link accounts automatically by email. Contact support to resolve the identity conflict.",
    },
};

const DEFAULT_REASON = {
    title: "Sign-in could not be completed",
    detail: "The identity provider did not complete the request. Try again, and contact your organizer if it continues.",
};

export function AuthErrorPage(): ReactNode {
    const [params] = useSearchParams();
    const reason = params.get("reason") ?? "login_failed";
    const copy = REASONS[reason] ?? DEFAULT_REASON;
    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
            />
            <Reveal className="w-full max-w-md">
                <Card className="bg-panel/80">
                    <CardHeader>
                        <span className="text-xs text-primary">nethack</span>
                        <CardTitle className="text-xl">{copy.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Alert variant="soft" tone="critical">
                            {copy.detail}
                        </Alert>
                        <p className="text-xs leading-6 text-ink-subtle">
                            Technical details are available in the browser developer console. Do not
                            share tokens, codes, or cookies.
                        </p>
                        <Button asChild>
                            <Link to="/sign-in">Try signing in again</Link>
                        </Button>
                    </CardContent>
                </Card>
            </Reveal>
        </div>
    );
}
