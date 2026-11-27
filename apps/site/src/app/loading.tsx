import type { ReactNode } from "react";
import { Skeleton } from "@nethack/ui/static";

export default function Loading(): ReactNode {
    return (
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[1280px] flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
            <Skeleton className="h-10 w-2/3 max-w-xl" />
            <Skeleton className="h-5 w-1/2 max-w-md" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
            </div>
        </div>
    );
}
