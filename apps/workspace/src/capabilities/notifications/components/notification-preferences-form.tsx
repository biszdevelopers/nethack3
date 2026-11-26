import { useEffect, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Form } from "@nethack/ui";
import { FormSwitch } from "../../../components/form-switch.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";
import { errorMessage } from "../../../lib/errors.js";
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
} from "../hooks/use-notifications.js";

const preferencesSchema = z.object({
    emailEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
});

type PreferencesValues = z.infer<typeof preferencesSchema>;

export function NotificationPreferencesForm(): ReactNode {
    const preferences = useNotificationPreferences();
    const update = useUpdateNotificationPreferences();
    const form = useForm<PreferencesValues>({
        resolver: zodResolver(preferencesSchema),
        defaultValues: { emailEnabled: true, inAppEnabled: true },
    });

    useEffect(() => {
        if (preferences.data === undefined) {
            return;
        }
        form.reset({
            emailEnabled: preferences.data.emailEnabled,
            inAppEnabled: preferences.data.inAppEnabled,
        });
    }, [form, preferences.data]);

    if (preferences.isPending) {
        return <QueryLoading label="Loading notification preferences" />;
    }
    if (preferences.error !== null) {
        return <QueryErrorState error={preferences.error} />;
    }

    const submit = form.handleSubmit(async (values) => {
        try {
            await update.mutateAsync(values);
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
            <FormSwitch
                name="inAppEnabled"
                label="In-app notifications"
                description="Show decisions, invitations, and announcements in this workspace."
            />
            <FormSwitch
                name="emailEnabled"
                label="Email notifications"
                description="Send notification email to the address on your account."
            />
            {update.error === null ? null : (
                <Alert tone="critical" title="Preferences could not be saved">
                    {errorMessage(update.error)}
                </Alert>
            )}
            {update.isSuccess ? (
                <output className="block text-xs text-primary">Preferences saved</output>
            ) : null}
            <div>
                <Button type="submit" loading={update.isPending}>
                    Save preferences
                </Button>
            </div>
        </Form>
    );
}
