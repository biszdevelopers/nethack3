import { useState, type ReactNode } from "react";
import { uploadConstraints } from "@nethack/contracts";
import { Alert, AlertDialog, Button, FileList, FileUpload } from "@nethack/ui";
import type { FileListItem, StatusTone } from "@nethack/ui";
import { resources } from "../../../application/resources.js";
import { errorMessage } from "../../../lib/errors.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import {
    useDeleteProjectFile,
    useProjectFiles,
    useUploadProjectFile,
} from "../hooks/use-projects.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";

function fileStatusTone(status: string): StatusTone {
    const tone = statusBadgeTone(status);
    if (tone === "primary") {
        return "success";
    }
    if (tone === "critical") {
        return "attention";
    }
    return "pending";
}

export function ProjectFiles({
    projectId,
    canEdit,
}: {
    readonly projectId: string;
    readonly canEdit: boolean;
}): ReactNode {
    const files = useProjectFiles(projectId);
    const upload = useUploadProjectFile(projectId);
    const remove = useDeleteProjectFile(projectId);
    const [uploadKey, setUploadKey] = useState(0);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

    if (files.isPending) {
        return <QueryLoading label="Loading files" />;
    }
    if (files.error !== null) {
        return <QueryErrorState error={files.error} />;
    }

    const items: FileListItem[] = files.data.items.map((file) => ({
        id: file.id,
        name: file.fileName,
        size: file.byteSize,
        type: file.contentType,
        status: {
            label: humanizeStatus(file.status),
            tone: fileStatusTone(file.status),
        },
        actions: (
            <>
                {file.status === "approved" ? (
                    <Button asChild variant="ghost" size="sm">
                        <a
                            href={resources.files.downloadUrl(file.id)}
                            download={file.fileName}
                            aria-label={`Download ${file.fileName}`}
                        >
                            Download
                        </a>
                    </Button>
                ) : null}
                {canEdit ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete({ id: file.id, name: file.fileName })}
                    >
                        Delete
                    </Button>
                ) : null}
            </>
        ),
    }));

    return (
        <div className="flex flex-col gap-4">
            {upload.error === null ? null : (
                <Alert tone="critical" title="The file could not be uploaded">
                    {errorMessage(upload.error)}
                </Alert>
            )}
            {remove.error === null ? null : (
                <Alert tone="critical" title="The file could not be deleted">
                    {errorMessage(remove.error)}
                </Alert>
            )}
            {canEdit ? (
                <FileUpload
                    key={uploadKey}
                    label="Upload a file"
                    accept={uploadConstraints.allowedContentTypes.join(",")}
                    maxBytes={uploadConstraints.maxBytes}
                    multiple={false}
                    disabled={upload.isPending}
                    description="Files are scanned before they appear to other participants."
                    onFiles={(selected) => {
                        const file = selected[0];
                        if (file === undefined) {
                            return;
                        }
                        upload.mutate(file, {
                            onSuccess: () => {
                                setUploadKey((value) => value + 1);
                            },
                        });
                    }}
                />
            ) : null}
            <FileList
                items={items}
                label="Project files"
                emptyTitle="No files"
                emptyDescription="Approved project files are listed here."
            />
            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        remove.reset();
                        setPendingDelete(null);
                    }
                }}
                title="Delete file"
                description={
                    pendingDelete === null
                        ? "The file is removed from the project."
                        : `${pendingDelete.name} is removed from the project.`
                }
                confirmLabel="Delete"
                tone="destructive"
                loading={remove.isPending}
                onConfirm={async () => {
                    if (pendingDelete === null) {
                        return;
                    }
                    try {
                        await remove.mutateAsync(pendingDelete.id);
                        setPendingDelete(null);
                    } catch {
                        // The mutation error is rendered above.
                    }
                }}
            />
        </div>
    );
}
