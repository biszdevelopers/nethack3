import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Form, FormField, Input } from "@nethack/ui";
import { errorMessage } from "../../../lib/errors.js";
import { useInviteTeamMember } from "../hooks/use-teams.js";

const inviteSchema = z.object({
    email: z.email("Use a valid email address.").max(254),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function InviteMemberForm({ teamId }: { readonly teamId: string }): ReactNode {
    const invite = useInviteTeamMember(teamId);
    const form = useForm<InviteValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { email: "" },
    });

    const submit = form.handleSubmit(async (values) => {
        try {
            await invite.mutateAsync({ email: values.email });
            form.reset();
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <FormField name="email" label="Invite by email" required>
                        {(field) => <Input {...field} type="email" autoComplete="off" />}
                    </FormField>
                </div>
                <Button type="submit" loading={invite.isPending}>
                    Send invitation
                </Button>
            </div>
            {invite.error === null ? null : (
                <Alert tone="critical" title="The invitation could not be sent">
                    {errorMessage(invite.error)}
                </Alert>
            )}
            {invite.data === undefined ? null : (
                <output className="block text-xs text-ink-muted">
                    Invitation sent to {invite.data.email}. It expires{" "}
                    {new Date(invite.data.expiresAt).toLocaleDateString()}.
                </output>
            )}
        </Form>
    );
}
