import { useState, type ReactNode } from "react";
import { Alert, AlertDialog, Button } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { usePublishProject } from "../hooks/use-projects.js";

export function PublishProjectButton({ projectId }: { readonly projectId: string }): ReactNode {
    const [open, setOpen] = useState(false);
    const publish = usePublishProject(projectId);

    return (
        <div className="flex flex-col items-start gap-2">
            <Button onClick={() => setOpen(true)}>Publish project</Button>
            {publish.error === null ? null : (
                <Alert tone="critical" title="Project could not be published">
                    {errorMessage(publish.error)}
                </Alert>
            )}
            <AlertDialog
                open={open}
                onOpenChange={(next) => {
                    if (!next) {
                        publish.reset();
                    }
                    setOpen(next);
                }}
                title="Publish project"
                description="A published project appears in the public showcase while the edition is public."
                confirmLabel="Publish"
                loading={publish.isPending}
                onConfirm={async () => {
                    try {
                        await publish.mutateAsync();
                        setOpen(false);
                    } catch {
                        // The mutation error is rendered above.
                    }
                }}
            />
        </div>
    );
}
