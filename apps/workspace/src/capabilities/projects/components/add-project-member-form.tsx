import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Form, FormField, Input } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useAddProjectMember } from "../hooks/use-projects.js";

const addMemberSchema = z.object({
    email: z.email("Use a valid email address.").max(254),
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

export function AddProjectMemberForm({ projectId }: { readonly projectId: string }): ReactNode {
    const addMember = useAddProjectMember(projectId);
    const form = useForm<AddMemberValues>({
        resolver: zodResolver(addMemberSchema),
        defaultValues: { email: "" },
    });

    const submit = form.handleSubmit(async (values) => {
        try {
            await addMember.mutateAsync({ email: values.email });
            form.reset();
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <FormField name="email" label="Add a project member" required>
                        {(field) => <Input {...field} type="email" autoComplete="off" />}
                    </FormField>
                </div>
                <Button type="submit" loading={addMember.isPending}>
                    Add member
                </Button>
            </div>
            {addMember.error === null ? null : (
                <Alert tone="critical" title="The member could not be added">
                    {errorMessage(addMember.error)}
                </Alert>
            )}
            {addMember.data === undefined ? null : (
                <output className="block text-xs text-primary">
                    {addMember.data.displayName} is now a project member.
                </output>
            )}
        </Form>
    );
}
