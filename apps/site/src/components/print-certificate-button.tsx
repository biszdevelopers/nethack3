"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@nethack/ui";

export function PrintCertificateButton(): ReactNode {
    return (
        <Button
            type="button"
            variant="outline"
            color="neutral"
            onClick={() => window.print()}
            iconLeft={<Printer className="size-4" aria-hidden="true" />}
        >
            Print certificate
        </Button>
    );
}
