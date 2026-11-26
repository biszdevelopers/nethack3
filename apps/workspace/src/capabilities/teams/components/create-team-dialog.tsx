import { useEffect, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { MyParticipation } from "@nethack/contracts";
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
    Textarea,
} from "@nethack/ui";
import { FormSelect } from "../../../components/form-select.js";
import { errorMessage } from "../../../lib/errors.js";
import { useEdition } from "../../competitions/hooks/use-competitions.js";
import { useCreateTeam } from "../hooks/use-teams.js";

const createTeamSchema = z.object({
    editionId: z.string().min(1, "Select an edition."),
    divisionId: z.string(),
    name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
    description: z.string().max(2000),
});

type CreateTeamValues = z.infer<typeof createTeamSchema>;

export function CreateTeamDialog({
    participations,
    defaultEditionId,
    open,
    onOpenChange,
    onCreated,
}: {
    readonly participations: readonly MyParticipation[];
    readonly defaultEditionId: string | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onCreated?: (teamId: string) => void;
}): ReactNode {
    const approved = participations.filter((participation) => participation.status === "approved");
    const form = useForm<CreateTeamValues>({
        resolver: zodResolver(createTeamSchema),
        defaultValues: {
            editionId: defaultEditionId ?? approved[0]?.editionId ?? "",
            divisionId: "none",
            name: "",
            description: "",
        },
    });
    const editionId = useWatch({ control: form.control, name: "editionId" }) ?? "";
    const edition = useEdition(editionId.length === 0 ? null : editionId);
    const createTeam = useCreateTeam(editionId);

    useEffect(() => {
        if (!open) {
            return;
        }
        form.reset({
            editionId: defaultEditionId ?? approved[0]?.editionId ?? "",
            divisionId: "none",
            name: "",
            description: "",
        });
    }, [open, defaultEditionId, form]);

    useEffect(() => {
        form.setValue("divisionId", "none");
    }, [editionId, form]);

    const divisionOptions = [
        { value: "none", label: "No division" },
        ...(edition.data?.divisions ?? []).map((division) => ({
            value: division.id,
            label: division.name,
        })),
    ];

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            createTeam.reset();
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        try {
            const team = await createTeam.mutateAsync({
                editionId: values.editionId,
                divisionId: values.divisionId === "none" ? null : values.divisionId,
                name: values.name,
                description: values.description,
            });
            close(false);
            onCreated?.(team.id);
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a team</DialogTitle>
                    <DialogDescription>
                        Team creation requires an approved registration for the chosen edition.
                    </DialogDescription>
                </DialogHeader>
                {approved.length === 0 ? (
                    <Alert tone="neutral" title="No approved registrations">
                        Register for a competition and wait for organizer approval before creating a
                        team.
                    </Alert>
                ) : (
                    <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                        <FormSelect
                            name="editionId"
                            label="Edition"
                            options={approved.map((participation) => ({
                                value: participation.editionId,
                                label: participation.editionName,
                            }))}
                        />
                        <FormSelect
                            name="divisionId"
                            label="Division"
                            options={divisionOptions}
                            optionalLabel="optional"
                        />
                        <FormField name="name" label="Team name" required>
                            {(field) => <Input {...field} autoComplete="off" />}
                        </FormField>
                        <FormField
                            name="description"
                            label="Description"
                            description="What the team is building and who it is looking for."
                            optionalLabel="optional"
                        >
                            {(field) => <Textarea {...field} rows={3} />}
                        </FormField>
                        {createTeam.error === null ? null : (
                            <Alert tone="critical" title="Team could not be created">
                                {errorMessage(createTeam.error)}
                            </Alert>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => close(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={createTeam.isPending}>
                                Create team
                            </Button>
                        </DialogFooter>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
