import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SubmissionDetail } from "@nethack/contracts";
import { Alert, Button, Checkbox, Form, FormField, Input, Textarea } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
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
});

type VersionValues = z.infer<typeof versionSchema>;

export function CreateVersionForm({
    submission,
}: {
    readonly submission: SubmissionDetail;
}): ReactNode {
    const createVersion = useCreateSubmissionVersion(submission.id);
    const form = useForm<VersionValues>({
        resolver: zodResolver(versionSchema),
        defaultValues: {
            title: submission.projectTitle,
            summary: "",
            descriptionMarkdown: "",
            repositoryUrl: "",
            demoUrl: "",
            submit: false,
        },
    });

    const submit = form.handleSubmit(async (values) => {
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
            });
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
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
            {createVersion.error === null ? null : (
                <Alert tone="critical" title="The version could not be saved">
                    {errorMessage(createVersion.error)}
                </Alert>
            )}
            {createVersion.data === undefined ? null : (
                <output className="block text-xs text-primary">Version saved.</output>
            )}
            <div>
                <Button type="submit" loading={createVersion.isPending}>
                    Save version
                </Button>
            </div>
        </Form>
    );
}
