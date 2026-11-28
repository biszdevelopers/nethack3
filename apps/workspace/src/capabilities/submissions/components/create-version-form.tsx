import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { missingProjectEvidence, type SubmissionDetail } from "@nethack/contracts";
import { Alert, Button, Checkbox, Form, FormField, Input, Textarea } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { ProjectEvidenceChecklist } from "../../projects/components/project-evidence-checklist.js";
import { useProject } from "../../projects/hooks/use-projects.js";
import { useCreateSubmissionVersion } from "../hooks/use-submissions.js";

const optionalUrl = z
    .string()
    .trim()
    .refine(
        (value) => value.length === 0 || /^https?:\/\/\S+$/i.test(value),
        "Use an http or https URL.",
    );

const versionSchema = z.object({
    title: z.string().trim().min(2, "Use at least 2 characters.").max(160),
    summary: z.string().trim().min(2, "Use at least 2 characters.").max(500),
    descriptionMarkdown: z.string().max(100_000),
    repositoryUrl: optionalUrl,
    demoUrl: optionalUrl,
    submit: z.boolean(),
    rulesAcknowledged: z
        .boolean()
        .refine((value) => value, "Acknowledge the submission rules to continue."),
});

type VersionValues = z.infer<typeof versionSchema>;

export function CreateVersionForm({
    submission,
}: {
    readonly submission: SubmissionDetail;
}): ReactNode {
    const createVersion = useCreateSubmissionVersion(submission.id);
    const project = useProject(submission.projectId);
    const form = useForm<VersionValues>({
        resolver: zodResolver(versionSchema),
        defaultValues: {
            title: submission.projectTitle,
            summary: "",
            descriptionMarkdown: "",
            repositoryUrl: "",
            demoUrl: "",
            submit: false,
            rulesAcknowledged: false,
        },
    });
    const missingEvidence =
        project.data === undefined || project.data === null
            ? []
            : missingProjectEvidence(project.data);

    const submit = form.handleSubmit(async (values) => {
        if (missingEvidence.length > 0) {
            return;
        }
        try {
            await createVersion.mutateAsync({
                title: values.title,
                summary: values.summary,
                descriptionMarkdown: values.descriptionMarkdown,
                repositoryUrl: values.repositoryUrl.length === 0 ? null : values.repositoryUrl,
                demoUrl: values.demoUrl.length === 0 ? null : values.demoUrl,
                submit: values.submit,
            });
            form.reset({
                title: values.title,
                summary: "",
                descriptionMarkdown: "",
                repositoryUrl: "",
                demoUrl: "",
                submit: false,
                rulesAcknowledged: false,
            });
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
            {project.data === undefined || project.data === null ? null : (
                <ProjectEvidenceChecklist project={project.data} projectId={submission.projectId} />
            )}
            {missingEvidence.length === 0 ? null : (
                <Alert tone="warning" title="Project requirements incomplete">
                    Add the missing project fields before creating a version.
                </Alert>
            )}
            <FormField name="title" label="Version title" required>
                {(field) => <Input {...field} />}
            </FormField>
            <FormField name="summary" label="Summary" required>
                {(field) => <Textarea {...field} rows={2} />}
            </FormField>
            <FormField
                name="descriptionMarkdown"
                label="Description"
                description="Markdown. HTML is not interpreted."
                optionalLabel="optional"
            >
                {(field) => <Textarea {...field} rows={5} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="repositoryUrl" label="Repository URL" optionalLabel="optional">
                    {(field) => <Input {...field} inputMode="url" />}
                </FormField>
                <FormField name="demoUrl" label="Demo URL" optionalLabel="optional">
                    {(field) => <Input {...field} inputMode="url" />}
                </FormField>
            </div>
            <Controller
                control={form.control}
                name="submit"
                render={({ field }) => (
                    <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        label="Submit this version for review"
                        description="A submitted version becomes visible to organizers and judges."
                    />
                )}
            />
            <Controller
                control={form.control}
                name="rulesAcknowledged"
                render={({ field, fieldState }) => (
                    <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        label="I acknowledge the submission rules"
                        description="The project must include a public repository, a working demo, a demonstration video, and an AI-use disclosure. Submitting locks the project from further edits."
                        {...(fieldState.error?.message === undefined
                            ? {}
                            : { error: fieldState.error.message })}
                    />
                )}
            />
            {createVersion.error === null ? null : (
                <Alert tone="critical" title="The version could not be saved">
                    {errorMessage(createVersion.error)}
                </Alert>
            )}
            {createVersion.data === undefined ? null : (
                <output className="block text-xs text-primary">Version saved.</output>
            )}
            <div>
                <Button
                    type="submit"
                    loading={createVersion.isPending}
                    disabled={missingEvidence.length > 0}
                >
                    Save version
                </Button>
            </div>
        </Form>
    );
}
