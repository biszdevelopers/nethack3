import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ProjectDetail } from "@nethack/contracts";
import { Alert, Button, Form, FormField, Input, TagInput, Textarea } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useUpdateProject } from "../hooks/use-projects.js";
import { AiDisclosureField, AI_DISCLOSURE_MAX_LENGTH } from "./ai-disclosure-field.js";

const optionalUrl = z
    .string()
    .trim()
    .refine(
        (value) => value.length === 0 || /^https?:\/\/\S+$/i.test(value),
        "Use an http or https URL.",
    );

const editProjectSchema = z.object({
    title: z.string().trim().min(2, "Use at least 2 characters.").max(160),
    summary: z.string().trim().min(2, "Use at least 2 characters.").max(500),
    descriptionMarkdown: z.string().max(100_000),
    repositoryUrl: optionalUrl,
    demoUrl: optionalUrl,
    videoUrl: optionalUrl,
    aiDisclosure: z.string().trim().max(AI_DISCLOSURE_MAX_LENGTH, "Use at most 2,000 characters."),
    tags: z.array(z.string().trim().min(1).max(32)).max(10, "Use at most 10 tags."),
});

type EditProjectValues = z.infer<typeof editProjectSchema>;

function toValues(project: ProjectDetail): EditProjectValues {
    return {
        title: project.title,
        summary: project.summary,
        descriptionMarkdown: project.descriptionMarkdown,
        repositoryUrl: project.repositoryUrl ?? "",
        demoUrl: project.demoUrl ?? "",
        videoUrl: project.videoUrl ?? "",
        aiDisclosure: project.aiDisclosure,
        tags: project.tags,
    };
}

export function ProjectEditForm({ project }: { readonly project: ProjectDetail }): ReactNode {
    const update = useUpdateProject(project.id);
    const form = useForm<EditProjectValues>({
        resolver: zodResolver(editProjectSchema),
        defaultValues: toValues(project),
    });
    const aiDisclosure = useWatch({ control: form.control, name: "aiDisclosure" }) ?? "";

    useEffect(() => {
        form.reset(toValues(project));
    }, [form, project.id, project.updatedAt]);

    const submit = form.handleSubmit(async (values) => {
        try {
            await update.mutateAsync({
                title: values.title,
                summary: values.summary,
                descriptionMarkdown: values.descriptionMarkdown,
                repositoryUrl: values.repositoryUrl.length === 0 ? null : values.repositoryUrl,
                demoUrl: values.demoUrl.length === 0 ? null : values.demoUrl,
                videoUrl: values.videoUrl.length === 0 ? null : values.videoUrl,
                aiDisclosure: values.aiDisclosure,
                tags: values.tags,
            });
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
            <FormField name="title" label="Title" required>
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
                {(field) => <Textarea {...field} rows={6} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="repositoryUrl" label="Repository URL" optionalLabel="optional">
                    {(field) => <Input {...field} inputMode="url" />}
                </FormField>
                <FormField name="demoUrl" label="Demo URL" optionalLabel="optional">
                    {(field) => <Input {...field} inputMode="url" />}
                </FormField>
            </div>
            <FormField
                name="videoUrl"
                label="Demonstration video URL"
                description="Link a public recording that shows the project working."
                optionalLabel="optional"
            >
                {(field) => <Input {...field} inputMode="url" placeholder="https://youtu.be/…" />}
            </FormField>
            <AiDisclosureField
                value={aiDisclosure}
                onChange={(value) => {
                    form.setValue("aiDisclosure", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                    });
                }}
            />
            <Controller
                control={form.control}
                name="tags"
                render={({ field, fieldState }) => (
                    <TagInput
                        label="Tags"
                        value={field.value}
                        onValueChange={field.onChange}
                        maxTags={10}
                        optionalLabel="optional"
                        {...(fieldState.error?.message === undefined
                            ? {}
                            : { error: fieldState.error.message })}
                    />
                )}
            />
            {update.error === null ? null : (
                <Alert tone="critical" title="Project could not be saved">
                    {errorMessage(update.error)}
                </Alert>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
                    Save project
                </Button>
                {update.isSuccess ? (
                    <output className="text-xs text-primary">Project saved</output>
                ) : null}
            </div>
        </Form>
    );
}
