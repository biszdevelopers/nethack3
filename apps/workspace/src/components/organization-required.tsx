import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button, EmptyState } from "@nethack/ui";

export function OrganizationRequired(): ReactNode {
    return (
        <EmptyState
            title="No active organization"
            description="Select an organization in the sidebar, or open the organization page to review your memberships."
            action={
                <Button asChild variant="outline">
                    <Link to="/organization">Open organization</Link>
                </Button>
            }
        />
    );
}
