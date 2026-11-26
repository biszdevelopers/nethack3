import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Division } from "@nethack/contracts";
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
    Textarea,
} from "@nethack/ui";
import { FormSelect } from "../../../components/form-select.js";
import { errorMessage } from "../../../lib/errors.js";
import { useRegisterForCompetition } from "../hooks/use-competitions.js";

const registerSchema = z.object({
    divisionId: z.string(),
    note: z.string().max(2000),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForCompetitionButton({
    editionId,
    divisions,
}: {
    readonly editionId: string;
    readonly divisions: readonly Division[];
}): ReactNode {
    const [open, setOpen] = useState(false);
    const register = useRegisterForCompetition(editionId);
    const form = useForm<RegisterValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: { divisionId: "none", note: "" },
    });

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            register.reset();
        }
        setOpen(next);
    };

    const submit = form.handleSubmit(async (values) => {
        try {
            await register.mutateAsync({
                divisionId: values.divisionId === "none" ? null : values.divisionId,
                note: values.note,
            });
            close(false);
        } catch {
            // The mutation error is rendered below.
        }
    });

    const options = [
        { value: "none", label: "No division" },
        ...divisions.map((division) => ({ value: division.id, label: division.name })),
    ];

    return (
        <>
            <Button onClick={() => setOpen(true)}>Register</Button>
            <Dialog open={open} onOpenChange={close}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Register for this competition</DialogTitle>
                        <DialogDescription>
                            Your registration is reviewed by the organizers. Choose a division if
                            the competition offers one.
                        </DialogDescription>
                    </DialogHeader>
                    <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                        <FormSelect
                            name="divisionId"
                            label="Division"
                            options={options}
                            optionalLabel="optional"
                        />
                        <FormField name="note" label="Note to organizers" optionalLabel="optional">
                            {(field) => <Textarea {...field} rows={3} />}
                        </FormField>
                        {register.error === null ? null : (
                            <Alert tone="critical" title="Registration failed">
                                {errorMessage(register.error)}
                            </Alert>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => close(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={register.isPending}>
                                Submit registration
                            </Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}
