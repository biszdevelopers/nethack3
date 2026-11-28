import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { missingProjectEvidence, type Project } from "@nethack/contracts";
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Form,
} from "@nethack/ui";
import { FormSelect } from "../../../components/form-select.js";
import { errorMessage } from "../../../lib/errors.js";
import { ProjectEvidenceChecklist } from "../../projects/components/project-evidence-checklist.js";
import { useCreateSubmission } from "../hooks/use-submissions.js";

const createSubmissionSchema = z.object({
    projectId: z.string().min(1, "Select a project."),
});

type CreateSubmissionValues = z.infer<typeof createSubmissionSchema>;

export function CreateSubmissionDialog({
    projects,
    open,
    onOpenChange,
    onCreated,
}: {
    readonly projects: readonly Project[];
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onCreated?: (submissionId: string) => void;
}): ReactNode {
    const createSubmission = useCreateSubmission();
    const form = useForm<CreateSubmissionValues>({
        resolver: zodResolver(createSubmissionSchema),
        defaultValues: { projectId: projects[0]?.id ?? "" },
    });
    const selectedProjectId = useWatch({ control: form.control, name: "projectId" }) ?? "";
    const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
    const missingEvidence = selectedProject === null ? [] : missingProjectEvidence(selectedProject);

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            createSubmission.reset();
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        if (selectedProject === null || missingEvidence.length > 0) {
            return;
        }
        try {
            const submission = await createSubmission.mutateAsync({
                projectId: values.projectId,
            });
            close(false);
            onCreated?.(submission.id);
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start a submission</DialogTitle>
                    <DialogDescription>
                        A project can have one submission. Versions keep the full history.
                    </DialogDescription>
                </DialogHeader>
                {projects.length === 0 ? (
                    <Alert tone="neutral" title="No project available">
                        Create a project first. Projects you can see in this organization are
                        available here.
                    </Alert>
                ) : (
                    <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                        <FormSelect
                            name="projectId"
                            label="Project"
                            options={projects.map((project) => ({
                                value: project.id,
                                label: project.title,
                            }))}
                        />
                        {selectedProject === null ? null : (
                            <ProjectEvidenceChecklist
                                project={selectedProject}
                                projectId={selectedProject.id}
                            />
                        )}
                        {missingEvidence.length === 0 ? null : (
                            <Alert tone="warning" title="Project requirements incomplete">
                                Add the missing project fields before starting a submission.
                            </Alert>
                        )}
                        {createSubmission.error === null ? null : (
                            <Alert tone="critical" title="Submission could not be created">
                                {errorMessage(createSubmission.error)}
                            </Alert>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => close(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                loading={createSubmission.isPending}
                                disabled={missingEvidence.length > 0}
                            >
                                Start submission
                            </Button>
                        </DialogFooter>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
