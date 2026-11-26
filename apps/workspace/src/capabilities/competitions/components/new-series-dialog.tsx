import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { z } from "zod";
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
import { errorMessage } from "../../../lib/errors.js";
import { useCreateSeries } from "../hooks/use-competitions.js";

const newSeriesSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
    slug: z
        .string()
        .trim()
        .min(2, "Use at least 2 characters.")
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
    description: z.string().max(2000),
});

type NewSeriesValues = z.infer<typeof newSeriesSchema>;

export function NewSeriesDialog({
    organizationId,
    open,
    onOpenChange,
}: {
    readonly organizationId: string;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}): ReactNode {
    const createSeries = useCreateSeries(organizationId);
    const form = useForm<NewSeriesValues>({
        resolver: zodResolver(newSeriesSchema),
        defaultValues: { name: "", slug: "", description: "" },
    });

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            createSeries.reset();
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        try {
            await createSeries.mutateAsync({
                name: values.name,
                slug: values.slug,
                description: values.description,
            });
            close(false);
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New competition series</DialogTitle>
                    <DialogDescription>
                        A series groups editions of the same competition over time.
                    </DialogDescription>
                </DialogHeader>
                <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                    <FormField name="name" label="Name" required>
                        {(field) => <Input {...field} autoComplete="off" />}
                    </FormField>
                    <FormField
                        name="slug"
                        label="Slug"
                        description="Used in public links. Lowercase letters, numbers, and hyphens."
                        required
                    >
                        {(field) => <Input {...field} autoComplete="off" />}
                    </FormField>
                    <FormField name="description" label="Description" optionalLabel="optional">
                        {(field) => <Textarea {...field} rows={3} />}
                    </FormField>
                    {createSeries.error === null ? null : (
                        <Alert tone="critical" title="Series could not be created">
                            {errorMessage(createSeries.error)}
                        </Alert>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => close(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={createSeries.isPending}>
                            Create series
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
