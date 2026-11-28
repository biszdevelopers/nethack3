import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, type ReactNode } from "react";
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
    Select,
    Textarea,
} from "@nethack/ui";
import type { CompetitionSeries } from "@nethack/contracts";
import { errorMessage } from "../../../lib/errors.js";
import { toIsoOrNull } from "../../../lib/format.js";
import { useCreateEdition, useOrganizationEditions } from "../hooks/use-competitions.js";

const integerText = (min: number, max: number) =>
    z
        .string()
        .trim()
        .refine((value) => {
            const parsed = Number(value);
            return Number.isInteger(parsed) && parsed >= min && parsed <= max;
        }, `Use a whole number between ${min} and ${max}.`);

const newEditionSchema = z
    .object({
        name: z.string().trim().min(2, "Use at least 2 characters.").max(160),
        slug: z
            .string()
            .trim()
            .min(2, "Use at least 2 characters.")
            .max(80)
            .regex(
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                "Use lowercase letters, numbers, and single hyphens.",
            ),
        timezone: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .refine((value) => {
                try {
                    new Intl.DateTimeFormat("en-US", { timeZone: value });
                    return true;
                } catch {
                    return false;
                }
            }, "Unknown time zone."),
        description: z.string().max(5000),
        teamMinSize: integerText(1, 50),
        teamMaxSize: integerText(1, 50),
        registrationOpensAt: z.string(),
        registrationClosesAt: z.string(),
        startsAt: z.string(),
        endsAt: z.string(),
        rulesMarkdown: z.string().max(100_000),
    })
    .refine((values) => Number(values.teamMinSize) <= Number(values.teamMaxSize), {
        path: ["teamMaxSize"],
        message: "Maximum team size cannot be smaller than the minimum.",
    })
    .refine(
        (values) =>
            values.registrationOpensAt.length === 0 ||
            values.registrationClosesAt.length === 0 ||
            new Date(values.registrationOpensAt).getTime() <=
                new Date(values.registrationClosesAt).getTime(),
        { path: ["registrationClosesAt"], message: "Registration must close after it opens." },
    )
    .refine(
        (values) =>
            values.startsAt.length === 0 ||
            values.endsAt.length === 0 ||
            new Date(values.startsAt).getTime() <= new Date(values.endsAt).getTime(),
        { path: ["endsAt"], message: "The end must not precede the start." },
    );

type NewEditionValues = z.infer<typeof newEditionSchema>;

function detectTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return "UTC";
    }
}

export function NewEditionDialog({
    organizationId,
    series,
    open,
    onOpenChange,
    onCreated,
}: {
    readonly organizationId: string;
    readonly series: CompetitionSeries | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onCreated?: (editionId: string) => void;
}): ReactNode {
    const createEdition = useCreateEdition(organizationId);
    const [startMode, setStartMode] = useState<"new" | "blank" | "copy">("new");
    const [copyFromEditionId, setCopyFromEditionId] = useState("");
    const existingEditions = useOrganizationEditions(
        organizationId,
        series?.id ?? null,
        open && series !== null,
    );
    const form = useForm<NewEditionValues>({
        resolver: zodResolver(newEditionSchema),
        defaultValues: {
            name: "",
            slug: "",
            timezone: detectTimeZone(),
            description: "",
            teamMinSize: "1",
            teamMaxSize: "4",
            registrationOpensAt: "",
            registrationClosesAt: "",
            startsAt: "",
            endsAt: "",
            rulesMarkdown: "",
        },
    });

    const close = (next: boolean): void => {
        if (!next) {
            form.reset();
            createEdition.reset();
            setStartMode("new");
            setCopyFromEditionId("");
        }
        onOpenChange(next);
    };

    const submit = form.handleSubmit(async (values) => {
        if (series === null) {
            return;
        }
        try {
            const edition = await createEdition.mutateAsync({
                seriesId: series.id,
                request: {
                    name: values.name,
                    slug: values.slug,
                    description: values.description,
                    themeName: null,
                    themeDescription: null,
                    contactEmail: null,
                    contactUrl: null,
                    showScores: false,
                    showRanking: false,
                    requiresBoardApproval: startMode === "blank",
                    timezone: values.timezone,
                    registrationOpensAt: toIsoOrNull(values.registrationOpensAt),
                    registrationClosesAt: toIsoOrNull(values.registrationClosesAt),
                    startsAt: toIsoOrNull(values.startsAt),
                    endsAt: toIsoOrNull(values.endsAt),
                    teamMinSize: Number(values.teamMinSize),
                    teamMaxSize: Number(values.teamMaxSize),
                    maxParticipants: null,
                    rulesMarkdown: values.rulesMarkdown,
                    resultsOpenAt: null,
                    copyFromEditionId: startMode === "copy" ? copyFromEditionId : null,
                    isBlankStart: startMode === "blank",
                },
            });
            close(false);
            onCreated?.(edition.id);
        } catch {
            // The mutation error is rendered below.
        }
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New edition</DialogTitle>
                    <DialogDescription>
                        {series === null
                            ? "Select a series first."
                            : `Add an edition to ${series.name}.`}
                    </DialogDescription>
                </DialogHeader>
                <Form form={form} onSubmit={submit} className="flex flex-col gap-4">
                    <Select
                        label="Start from"
                        options={[
                            { value: "new", label: "New edition" },
                            { value: "blank", label: "Blank shell" },
                            { value: "copy", label: "Copy an existing edition" },
                        ]}
                        value={startMode}
                        onValueChange={(value) => {
                            setStartMode(value === "blank" || value === "copy" ? value : "new");
                            setCopyFromEditionId("");
                        }}
                        description="A blank shell requires board approval before publishing. A copy inherits theme, schedule, rules, divisions, and milestones."
                    />
                    {startMode !== "copy" ? null : (
                        <Select
                            label="Copy from"
                            options={(existingEditions.data?.items ?? []).map((item) => ({
                                value: item.id,
                                label: item.name,
                            }))}
                            value={copyFromEditionId}
                            onValueChange={setCopyFromEditionId}
                            placeholder={
                                existingEditions.isPending
                                    ? "Loading editions"
                                    : "Select an edition"
                            }
                            disabled={existingEditions.isPending}
                        />
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField name="name" label="Name" required>
                            {(field) => <Input {...field} autoComplete="off" />}
                        </FormField>
                        <FormField name="slug" label="Slug" required>
                            {(field) => <Input {...field} autoComplete="off" />}
                        </FormField>
                    </div>
                    <FormField
                        name="timezone"
                        label="Time zone"
                        description="IANA time zone name, such as Europe/Berlin."
                        required
                    >
                        {(field) => <Input {...field} autoComplete="off" />}
                    </FormField>
                    <FormField name="description" label="Description" optionalLabel="optional">
                        {(field) => <Textarea {...field} rows={2} />}
                    </FormField>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField name="teamMinSize" label="Minimum team size" required>
                            {(field) => <Input {...field} inputMode="numeric" />}
                        </FormField>
                        <FormField name="teamMaxSize" label="Maximum team size" required>
                            {(field) => <Input {...field} inputMode="numeric" />}
                        </FormField>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            name="registrationOpensAt"
                            label="Registration opens"
                            optionalLabel="optional"
                        >
                            {(field) => <Input {...field} type="datetime-local" />}
                        </FormField>
                        <FormField
                            name="registrationClosesAt"
                            label="Registration closes"
                            optionalLabel="optional"
                        >
                            {(field) => <Input {...field} type="datetime-local" />}
                        </FormField>
                        <FormField name="startsAt" label="Starts" optionalLabel="optional">
                            {(field) => <Input {...field} type="datetime-local" />}
                        </FormField>
                        <FormField name="endsAt" label="Ends" optionalLabel="optional">
                            {(field) => <Input {...field} type="datetime-local" />}
                        </FormField>
                    </div>
                    <FormField
                        name="rulesMarkdown"
                        label="Rules"
                        description="Markdown. Rules appear on the competition page."
                        optionalLabel="optional"
                    >
                        {(field) => <Textarea {...field} rows={5} />}
                    </FormField>
                    {createEdition.error === null ? null : (
                        <Alert tone="critical" title="Edition could not be created">
                            {errorMessage(createEdition.error)}
                        </Alert>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => close(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={createEdition.isPending}
                            disabled={
                                series === null ||
                                (startMode === "copy" && copyFromEditionId.length === 0)
                            }
                        >
                            Create edition
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
