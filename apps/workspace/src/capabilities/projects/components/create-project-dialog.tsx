import { useEffect, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { MyParticipation, Team } from "@nethack/contracts";
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
    FormField,
    Input,
    TagInput,
    Textarea,
} from "@nethack/ui";
import { FormSelect } from "../../../components/form-select.js";
import { errorMessage } from "../../../lib/errors.js";
import { useCreateProject } from "../hooks/use-projects.js";

const optionalUrl = z
    .string()
    .trim()
    .refine(
        (value) => value.length === 0 || /^https?:\/\/\S+$/i.test(value),
        "Use an http or https URL.",
    );

const projectSchema = z.object({
    editionId: z.string().min(1, "Select an edition."),
    teamId: z.string(),
    title: z.string().trim().min(2, "Use at least 2 characters.").max(160),
    summary: z.string().trim().min(2, "Use at least 2 characters.").max(500),
    descriptionMarkdown: z.string().max(100_000),
    repositoryUrl: optionalUrl,
    demoUrl: optionalUrl,
    tags: z.array(z.string().trim().min(1).max(32)).max(10, "Use at most 10 tags."),
});

type ProjectValues = z.infer<typeof projectSchema>;

export function CreateProjectDialog({
    participations,
    teams,
    defaultEditionId,
    open,
    onOpenChange,
    onCreated,
}: {
    readonly participations: readonly MyParticipation[];
    readonly teams: readonly Team[];
    readonly defaultEditionId: string | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onCreated?: (projectId: string) => void;
}): ReactNode {
    const approved = participations.filter((participation) => participation.status === "approved");
    const form = useForm<ProjectValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            editionId: defaultEditionId ?? approved[0]?.editionId ?? "",
            teamId: "none",
            title: "",
            summary: "",
            descriptionMarkdown: "",
            repositoryUrl: "",
            demoUrl: "",
            tags: [],
        },
    });
    const editionId = useWatch({ control: form.control, name: "editionId" }) ?? "";
    const availableTeams = teams.filter((team) => team.editionId === editionId);
    const createProject = useCreateProject();

    useEffect(() => {
        if (!open) {
            return;
        }
        form.reset({
            editionId: defaultEditionId ?? approved[0]?.editionId ?? "",
            teamId: "none",
            title: "",
            summary: "",
            descriptionMarkdown: "",
            repositoryUrl: "",
            demoUrl: "",
            tags: [],
        });
    }, [open, defaultEditionId, form]);

    useEffect(() => {
        form.setValue("teamId", "none");
    }, [editionId, form]);

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            createProject.reset();
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        try {
            const project = await createProject.mutateAsync({
                editionId: values.editionId,
                teamId: values.teamId === "none" ? null : values.teamId,
                title: values.title,
                summary: values.summary,
                descriptionMarkdown: values.descriptionMarkdown,
                repositoryUrl: values.repositoryUrl.length === 0 ? null : values.repositoryUrl,
                demoUrl: values.demoUrl.length === 0 ? null : values.demoUrl,
                tags: values.tags,
            });
            close(false);
            onCreated?.(project.id);
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create a project</DialogTitle>
                    <DialogDescription>
                        A project belongs to an edition and optionally to one of your teams.
                    </DialogDescription>
                </DialogHeader>
                {approved.length === 0 ? (
                    <Alert tone="neutral" title="No approved registrations">
                        An approved participant registration is required before creating a project.
                    </Alert>
                ) : (
                    <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormSelect
                                name="editionId"
                                label="Edition"
                                options={approved.map((participation) => ({
                                    value: participation.editionId,
                                    label: participation.editionName,
                                }))}
                            />
                            <FormSelect
                                name="teamId"
                                label="Team"
                                options={[
                                    { value: "none", label: "No team" },
                                    ...availableTeams.map((team) => ({
                                        value: team.id,
                                        label: team.name,
                                    })),
                                ]}
                                optionalLabel="optional"
                            />
                        </div>
                        <FormField name="title" label="Title" required>
                            {(field) => <Input {...field} autoComplete="off" />}
                        </FormField>
                        <FormField
                            name="summary"
                            label="Summary"
                            description="One or two sentences shown in project listings."
                            required
                        >
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
                            <FormField
                                name="repositoryUrl"
                                label="Repository URL"
                                optionalLabel="optional"
                            >
                                {(field) => <Input {...field} inputMode="url" />}
                            </FormField>
                            <FormField name="demoUrl" label="Demo URL" optionalLabel="optional">
                                {(field) => <Input {...field} inputMode="url" />}
                            </FormField>
                        </div>
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
                        {createProject.error === null ? null : (
                            <Alert tone="critical" title="Project could not be created">
                                {errorMessage(createProject.error)}
                            </Alert>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => close(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={createProject.isPending}>
                                Create project
                            </Button>
                        </DialogFooter>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
