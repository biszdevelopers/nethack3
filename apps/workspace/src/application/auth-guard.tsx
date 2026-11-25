import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingBlock } from "@nethack/ui";
import { useSession } from "./session.js";

export function RequireAuth(): ReactNode {
    const session = useSession();
    const location = useLocation();

    if (session.isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-6">
                <div className="w-full max-w-sm">
                    <LoadingBlock label="Checking your session" />
                </div>
            </div>
        );
    }

    if (session.isError || session.data === undefined || session.data === null) {
        return (
            <Navigate
                to="/sign-in"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return <Outlet />;
}
