import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
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
    useToast,
} from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useCreateOrganization } from "../hooks.js";

const createOrganizationSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
    slug: z
        .string()
        .trim()
        .min(2, "Use at least 2 characters.")
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
    description: z.string().max(2000),
    websiteUrl: z.union([z.literal(""), z.url("Enter a valid URL.")]),
});

type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

export function CreateOrganizationDialog({
    open,
    onOpenChange,
}: {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}): ReactNode {
    const navigate = useNavigate();
    const { toast } = useToast();
    const createOrganization = useCreateOrganization();
    const form = useForm<CreateOrganizationValues>({
        resolver: zodResolver(createOrganizationSchema),
        defaultValues: {
            name: "",
            slug: "",
            description: "",
            websiteUrl: "",
        },
    });

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            createOrganization.reset();
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        try {
            await createOrganization.mutateAsync({
                name: values.name,
                slug: values.slug,
                description: values.description,
                websiteUrl: values.websiteUrl.trim() === "" ? null : values.websiteUrl.trim(),
            });
            close(false);
            toast({ title: "Organization created", tone: "success" });
            navigate("/");
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create an organization</DialogTitle>
                    <DialogDescription>
                        You become the owner. You can then create competition series, editions, and
                        invite organizers, judges, and participants.
                    </DialogDescription>
                </DialogHeader>
                <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                    <FormField name="name" label="Organization name" required>
                        {(field) => <Input {...field} autoComplete="organization" />}
                    </FormField>
                    <FormField
                        name="slug"
                        label="Slug"
                        description="Used in public URLs. Lowercase letters, numbers, and hyphens."
                        required
                    >
                        {(field) => <Input {...field} autoComplete="off" />}
                    </FormField>
                    <FormField name="description" label="Description" optionalLabel="optional">
                        {(field) => <Textarea {...field} rows={3} />}
                    </FormField>
                    <FormField name="websiteUrl" label="Website" optionalLabel="optional">
                        {(field) => (
                            <Input
                                {...field}
                                type="url"
                                placeholder="https://example.org"
                                autoComplete="url"
                            />
                        )}
                    </FormField>
                    {createOrganization.error === null ? null : (
                        <Alert tone="critical" title="Organization could not be created">
                            {errorMessage(createOrganization.error)}
                        </Alert>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => close(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={createOrganization.isPending}>
                            Create organization
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
