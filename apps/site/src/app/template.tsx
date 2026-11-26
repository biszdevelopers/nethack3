import type { ReactNode } from "react";
import { PageReveal } from "../components/page-reveal";

export default function Template({ children }: { readonly children: ReactNode }): ReactNode {
    return <PageReveal>{children}</PageReveal>;
}
