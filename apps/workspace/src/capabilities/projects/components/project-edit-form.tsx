import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ProjectDetail } from "@nethack/contracts";
import { Alert, Button, Form, FormField, Input, TagInput, Textarea } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useUpdateProject } from "../hooks/use-projects.js";
import { AiDisclosureField, AI_DISCLOSURE_MAX_LENGTH } from "./ai-disclosure-field.js";

const AUTOSAVE_INTERVAL_MS = 10_000;

const requiredUrl = z
    .string()
    .trim()
    .refine((value) => value.length > 0, "Required before submission.")
    .refine((value) => /^https?:\/\/\S+$/i.test(value), "Use an http or https URL.");

const editProjectSchema = z.object({
    title: z.string().trim().min(2, "Use at least 2 characters.").max(160),
    summary: z.string().trim().min(2, "Use at least 2 characters.").max(500),
    descriptionMarkdown: z.string().max(100_000),
    repositoryUrl: requiredUrl,
    demoUrl: requiredUrl,
    videoUrl: requiredUrl,
    aiDisclosure: z
        .string()
        .trim()
        .min(1, "Describe your AI use or confirm that none was used.")
        .max(AI_DISCLOSURE_MAX_LENGTH, "Use at most 2,000 characters."),
    tags: z.array(z.string().trim().min(1).max(32)).max(10, "Use at most 10 tags."),
});

type EditProjectValues = z.infer<typeof editProjectSchema>;

interface ProjectDraft {
    readonly values: EditProjectValues;
    readonly serverUpdatedAt: string;
    readonly savedAt: string;
}

function draftKey(projectId: string): string {
    return `nethack:project-draft:${projectId}`;
}

function readDraft(projectId: string): ProjectDraft | null {
    try {
        const raw = window.localStorage.getItem(draftKey(projectId));
        if (raw === null) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<ProjectDraft>;
        if (
            typeof parsed.serverUpdatedAt !== "string" ||
            typeof parsed.savedAt !== "string" ||
            typeof parsed.values !== "object" ||
            parsed.values === null
        ) {
            return null;
        }
        return {
            values: parsed.values as EditProjectValues,
            serverUpdatedAt: parsed.serverUpdatedAt,
            savedAt: parsed.savedAt,
        };
    } catch {
        return null;
    }
}

function clearDraft(projectId: string): void {
    try {
        window.localStorage.removeItem(draftKey(projectId));
    } catch {
        // Storage can be unavailable; a leftover draft is harmless.
    }
}

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
    const [draft, setDraft] = useState<ProjectDraft | null>(() => readDraft(project.id));
    const aiDisclosure = useWatch({ control: form.control, name: "aiDisclosure" }) ?? "";

    useEffect(() => {
        const stored = readDraft(project.id);
        if (stored !== null && stored.serverUpdatedAt === project.updatedAt) {
            form.reset(stored.values);
            return;
        }
        form.reset(toValues(project));
    }, [form, project.id, project.updatedAt]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!form.formState.isDirty) {
                return;
            }
            const stored: ProjectDraft = {
                values: form.getValues(),
                serverUpdatedAt: project.updatedAt,
                savedAt: new Date().toISOString(),
            };
            try {
                window.localStorage.setItem(draftKey(project.id), JSON.stringify(stored));
            } catch {
                // Autosave is a convenience; saving the form still works.
            }
        }, AUTOSAVE_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [form, project.id, project.updatedAt]);

    const discardDraft = (): void => {
        clearDraft(project.id);
        setDraft(null);
        form.reset(toValues(project));
    };

    const submit = form.handleSubmit(async (values) => {
        try {
            await update.mutateAsync({
                title: values.title,
                summary: values.summary,
                descriptionMarkdown: values.descriptionMarkdown,
                repositoryUrl: values.repositoryUrl,
                demoUrl: values.demoUrl,
                videoUrl: values.videoUrl,
                aiDisclosure: values.aiDisclosure,
                tags: values.tags,
            });
            clearDraft(project.id);
            setDraft(null);
        } catch {
            // The mutation error is rendered below.
        }
    });

    const draftIsStale = draft !== null && draft.serverUpdatedAt !== project.updatedAt;

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
            {draft === null ? null : draftIsStale ? (
                <Alert tone="warning" title="Unsaved draft is older than the project">
                    <p>
                        This project changed on the server after your draft was autosaved. Restore
                        the draft only if you want to replace the newer server data.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                form.reset(draft.values);
                                setDraft({ ...draft, serverUpdatedAt: project.updatedAt });
                            }}
                        >
                            Restore draft
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
                            Discard draft
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Alert tone="neutral" title="Restored unsaved changes">
                    <p>
                        Autosaved {new Date(draft.savedAt).toLocaleTimeString()}. Review the values,
                        then save the project.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={discardDraft}
                    >
                        Discard draft
                    </Button>
                </Alert>
            )}
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
                <FormField
                    name="repositoryUrl"
                    label="Repository URL"
                    description="Required before submission. Use a public repository with a README."
                    required
                >
                    {(field) => <Input {...field} inputMode="url" />}
                </FormField>
                <FormField
                    name="demoUrl"
                    label="Demo URL"
                    description="Required before submission. Anyone should be able to try the project."
                    required
                >
                    {(field) => <Input {...field} inputMode="url" />}
                </FormField>
            </div>
            <FormField
                name="videoUrl"
                label="Demonstration video URL"
                description="Required before submission. Link a public 2–3 minute recording that shows the project working."
                required
            >
                {(field) => <Input {...field} inputMode="url" placeholder="https://youtu.be/…" />}
            </FormField>
            <AiDisclosureField
                required
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
