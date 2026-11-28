import { useEffect, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { TeamDetail } from "@nethack/contracts";
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
    useToast,
} from "@nethack/ui";
import { FormSelect } from "../../../components/form-select.js";
import { errorMessage } from "../../../lib/errors.js";
import { useEdition } from "../../competitions/hooks/use-competitions.js";
import { useUpdateTeam } from "../hooks/use-teams.js";

const editTeamSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
    description: z.string().max(2000),
    divisionId: z.string(),
});

type EditTeamValues = z.infer<typeof editTeamSchema>;

export function EditTeamDialog({
    team,
    open,
    onOpenChange,
}: {
    readonly team: TeamDetail;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}): ReactNode {
    const edition = useEdition(team.editionId);
    const update = useUpdateTeam(team.id);
    const { toast } = useToast();
    const form = useForm<EditTeamValues>({
        resolver: zodResolver(editTeamSchema),
        defaultValues: valuesFor(team),
    });

    useEffect(() => {
        if (open) {
            form.reset(valuesFor(team));
        }
    }, [open, team, form]);

    const close = (next: boolean): void => {
        if (!next) {
            update.reset();
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        const divisionId = values.divisionId === "none" ? null : values.divisionId;
        try {
            await update.mutateAsync({
                name: values.name,
                description: values.description,
                ...(divisionId === team.divisionId ? {} : { divisionId }),
            });
            toast({ title: "Team updated", tone: "success" });
            close(false);
        } catch {
            // The mutation error is rendered inside the dialog.
        }
    });

    const divisionOptions = [
        { value: "none", label: "No division" },
        ...(edition.data?.divisions ?? []).map((division) => ({
            value: division.id,
            label: division.name,
        })),
    ];

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit team</DialogTitle>
                    <DialogDescription>
                        The captain or an organizer can rename the team, change its description, and
                        move it between divisions.
                    </DialogDescription>
                </DialogHeader>
                <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
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
                    <FormSelect name="divisionId" label="Division" options={divisionOptions} />
                    {update.error === null ? null : (
                        <Alert tone="critical" title="The team could not be updated">
                            {errorMessage(update.error)}
                        </Alert>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => close(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={update.isPending}>
                            Save team
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function valuesFor(team: TeamDetail): EditTeamValues {
    return {
        name: team.name,
        description: team.description,
        divisionId: team.divisionId ?? "none",
    };
}
