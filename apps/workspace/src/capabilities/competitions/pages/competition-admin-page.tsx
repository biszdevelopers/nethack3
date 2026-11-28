import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
    CompetitionEditionDetail,
    CompetitionEditionStatus,
    Division,
    Milestone,
} from "@nethack/contracts";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Form,
    FormField,
    Input,
    KeyValue,
    LoadingBlock,
    NumberInput,
    PageHeader,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../../../application/session.js";
import { FormSwitch } from "../../../components/form-switch.js";
import { EditionSelect } from "../../shared/edition-select.js";
import {
    formatDate,
    formatDateTime,
    isoToLocalInput,
    localInputToIso,
} from "../../shared/datetime.js";
import { describeError } from "../../shared/errors.js";
import { humanizeToken } from "../../shared/format.js";
import { RequestError } from "../../shared/states.jsx";
import {
    divisionSchema,
    editionSchema,
    milestoneSchema,
    seriesSchema,
    type DivisionForm,
    type EditionForm,
    type MilestoneForm,
    type SeriesForm,
} from "../forms.js";
import {
    useCreateDivision,
    useCreateEdition,
    useCreateMilestone,
    useCreateSeries,
    useDivisions,
    useEdition,
    useMilestones,
    useOrganizerEditions,
    usePublishEdition,
    useSeries,
    useUpdateEdition,
} from "../hooks.js";

const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "registration_open", label: "Registration open" },
    { value: "registration_closed", label: "Registration closed" },
    { value: "active", label: "Active" },
    { value: "judging", label: "Judging" },
    { value: "voting", label: "Voting" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
] as const;

const MILESTONE_KIND_OPTIONS = [
    { value: "registration", label: "Registration" },
    { value: "submission", label: "Submission" },
    { value: "judging", label: "Judging" },
    { value: "voting", label: "Voting" },
    { value: "ceremony", label: "Ceremony" },
    { value: "other", label: "Other" },
] as const;

function editionStatusTone(status: CompetitionEditionStatus): "neutral" | "primary" | "outline" {
    switch (status) {
        case "draft":
            return "neutral";
        case "published":
        case "registration_open":
        case "active":
            return "primary";
        default:
            return "outline";
    }
}

function statusLabel(status: CompetitionEditionStatus): string {
    switch (status) {
        case "draft":
            return "Draft";
        case "published":
            return "Published";
        case "registration_open":
            return "Registration open";
        case "registration_closed":
            return "Registration closed";
        case "active":
            return "Active";
        case "judging":
            return "Judging";
        case "voting":
            return "Voting";
        case "completed":
            return "Completed";
        case "archived":
            return "Archived";
    }
}

function toEditionForm(edition: CompetitionEditionDetail): EditionForm {
    return {
        name: edition.name,
        slug: edition.slug,
        description: edition.description,
        themeName: edition.themeName ?? "",
        themeDescription: edition.themeDescription ?? "",
        showScores: edition.showScores,
        showRanking: edition.showRanking,
        timezone: edition.timezone,
        status: edition.status,
        registrationOpensAt: isoToLocalInput(edition.registrationOpensAt),
        registrationClosesAt: isoToLocalInput(edition.registrationClosesAt),
        startsAt: isoToLocalInput(edition.startsAt),
        endsAt: isoToLocalInput(edition.endsAt),
        teamMinSize: edition.teamMinSize,
        teamMaxSize: edition.teamMaxSize,
        maxParticipants: edition.maxParticipants,
        rulesMarkdown: edition.rulesMarkdown,
        resultsOpenAt: isoToLocalInput(edition.resultsOpenAt),
    };
}

function timezoneDefault(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return "UTC";
    }
}

export function CompetitionAdminPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const organizationId = membership?.organizationId ?? null;
    const isOrganizer = membership?.role === "owner" || membership?.role === "organizer";
    const { toast } = useToast();

    const series = useSeries(organizationId);
    const organizerEditions = useOrganizerEditions(organizationId, isOrganizer);
    const editionId = searchParams.get("edition");
    const [editionSeriesId, setEditionSeriesId] = useState<string | null>(null);
    const edition = useEdition(organizationId, editionId);
    const divisions = useDivisions(organizationId, editionId);
    const milestones = useMilestones(organizationId, editionId);

    const createSeries = useCreateSeries(organizationId);
    const createEdition = useCreateEdition(organizationId);
    const updateEdition = useUpdateEdition(organizationId);
    const publishEdition = usePublishEdition(organizationId);
    const createDivision = useCreateDivision(organizationId);
    const createMilestone = useCreateMilestone(organizationId);

    const seriesForm = useForm<SeriesForm>({
        resolver: zodResolver(seriesSchema),
        defaultValues: { name: "", slug: "", description: "" },
    });
    const createEditionForm = useForm<EditionForm>({
        resolver: zodResolver(editionSchema),
        defaultValues: {
            name: "",
            slug: "",
            description: "",
            themeName: "",
            themeDescription: "",
            showScores: false,
            showRanking: false,
            timezone: timezoneDefault(),
            status: "draft",
            registrationOpensAt: "",
            registrationClosesAt: "",
            startsAt: "",
            endsAt: "",
            teamMinSize: 1,
            teamMaxSize: 4,
            maxParticipants: null,
            rulesMarkdown: "",
            resultsOpenAt: "",
        },
    });
    const editEditionForm = useForm<EditionForm>({
        resolver: zodResolver(editionSchema),
        defaultValues: {
            name: "",
            slug: "",
            description: "",
            themeName: "",
            themeDescription: "",
            showScores: false,
            showRanking: false,
            timezone: timezoneDefault(),
            status: "draft",
            registrationOpensAt: "",
            registrationClosesAt: "",
            startsAt: "",
            endsAt: "",
            teamMinSize: 1,
            teamMaxSize: 4,
            maxParticipants: null,
            rulesMarkdown: "",
            resultsOpenAt: "",
        },
    });
    const divisionForm = useForm<DivisionForm>({
        resolver: zodResolver(divisionSchema),
        defaultValues: {
            name: "",
            slug: "",
            description: "",
            minTeamSize: null,
            maxTeamSize: null,
        },
    });
    const milestoneForm = useForm<MilestoneForm>({
        resolver: zodResolver(milestoneSchema),
        defaultValues: {
            title: "",
            description: "",
            kind: "submission",
            occursAt: "",
        },
    });

    useEffect(() => {
        const current = edition.data;
        if (current === null || current === undefined) {
            return;
        }
        editEditionForm.reset(toEditionForm(current));
    }, [edition.data, editEditionForm]);

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading competitions" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <EmptyState
                title="No active organization"
                description="Select an organization membership to manage competitions."
            />
        );
    }
    if (!isOrganizer) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Competition management"
                    description="Series, editions, divisions, milestones, and publication."
                />
                <Alert tone="warning" title="You do not have management access">
                    Competition management requires the owner or organizer role. Your role is{" "}
                    {membership.role}.
                </Alert>
            </div>
        );
    }

    const seriesItems = series.data?.items ?? [];
    const editionData = edition.data ?? null;
    const divisionItems = divisions.data?.items ?? [];
    const milestoneItems = milestones.data?.items ?? [];

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
    };

    const onCreateSeries = seriesForm.handleSubmit(async (values) => {
        try {
            await createSeries.mutateAsync({
                name: values.name.trim(),
                slug: values.slug,
                description: values.description,
            });
            seriesForm.reset({ name: "", slug: "", description: "" });
            toast({ title: "Competition series created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the series",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onCreateEdition = createEditionForm.handleSubmit(async (values) => {
        if (editionSeriesId === null) {
            toast({
                title: "Select a series",
                description: "An edition belongs to a competition series.",
                tone: "critical",
            });
            return;
        }
        try {
            const created = await createEdition.mutateAsync({
                seriesId: editionSeriesId,
                body: {
                    name: values.name.trim(),
                    slug: values.slug,
                    description: values.description,
                    themeName: values.themeName.length === 0 ? null : values.themeName,
                    themeDescription:
                        values.themeDescription.length === 0 ? null : values.themeDescription,
                    showScores: values.showScores,
                    showRanking: values.showRanking,
                    timezone: values.timezone,
                    registrationOpensAt: localInputToIso(values.registrationOpensAt),
                    registrationClosesAt: localInputToIso(values.registrationClosesAt),
                    startsAt: localInputToIso(values.startsAt),
                    endsAt: localInputToIso(values.endsAt),
                    teamMinSize: values.teamMinSize,
                    teamMaxSize: values.teamMaxSize,
                    maxParticipants: values.maxParticipants,
                    rulesMarkdown: values.rulesMarkdown,
                    resultsOpenAt: localInputToIso(values.resultsOpenAt),
                },
            });
            setEdition(created.id);
            createEditionForm.reset({
                name: "",
                slug: "",
                description: "",
                themeName: "",
                themeDescription: "",
                showScores: false,
                showRanking: false,
                timezone: timezoneDefault(),
                status: "draft",
                registrationOpensAt: "",
                registrationClosesAt: "",
                startsAt: "",
                endsAt: "",
                teamMinSize: 1,
                teamMaxSize: 4,
                maxParticipants: null,
                rulesMarkdown: "",
                resultsOpenAt: "",
            });
            toast({ title: "Edition created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the edition",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onCreateDivision = divisionForm.handleSubmit(async (values) => {
        if (editionId === null) {
            return;
        }
        try {
            await createDivision.mutateAsync({
                editionId,
                body: {
                    name: values.name.trim(),
                    slug: values.slug,
                    description: values.description,
                    minTeamSize: values.minTeamSize,
                    maxTeamSize: values.maxTeamSize,
                },
            });
            divisionForm.reset({
                name: "",
                slug: "",
                description: "",
                minTeamSize: null,
                maxTeamSize: null,
            });
            toast({ title: "Division created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the division",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onCreateMilestone = milestoneForm.handleSubmit(async (values) => {
        if (editionId === null) {
            return;
        }
        const occursAt = localInputToIso(values.occursAt);
        if (occursAt === null) {
            milestoneForm.setError("occursAt", { message: "Enter a date and time." });
            return;
        }
        try {
            await createMilestone.mutateAsync({
                editionId,
                body: {
                    title: values.title.trim(),
                    description: values.description,
                    kind: values.kind,
                    occursAt,
                },
            });
            milestoneForm.reset({
                title: "",
                description: "",
                kind: "submission",
                occursAt: "",
            });
            toast({ title: "Milestone created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the milestone",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onSaveEdition = editEditionForm.handleSubmit(async (values) => {
        if (editionId === null) {
            return;
        }
        try {
            await updateEdition.mutateAsync({
                editionId,
                body: {
                    name: values.name.trim(),
                    description: values.description,
                    themeName: values.themeName.length === 0 ? null : values.themeName,
                    themeDescription:
                        values.themeDescription.length === 0 ? null : values.themeDescription,
                    showScores: values.showScores,
                    showRanking: values.showRanking,
                    timezone: values.timezone,
                    ...(editionData !== null && values.status !== editionData.status
                        ? { status: values.status }
                        : {}),
                    registrationOpensAt: localInputToIso(values.registrationOpensAt),
                    registrationClosesAt: localInputToIso(values.registrationClosesAt),
                    startsAt: localInputToIso(values.startsAt),
                    endsAt: localInputToIso(values.endsAt),
                    teamMinSize: values.teamMinSize,
                    teamMaxSize: values.teamMaxSize,
                    maxParticipants: values.maxParticipants,
                    rulesMarkdown: values.rulesMarkdown,
                    resultsOpenAt: localInputToIso(values.resultsOpenAt),
                },
            });
            toast({ title: "Edition saved", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not save the edition",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Competition management"
                description="Series, editions, divisions, milestones, publication, and scheduling."
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Competition series</CardTitle>
                        <CardDescription>
                            A series groups competition editions over time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {series.isPending ? (
                            <LoadingBlock rows={3} label="Loading series" />
                        ) : series.isError ? (
                            <RequestError
                                error={series.error}
                                onRetry={() => void series.refetch()}
                            />
                        ) : seriesItems.length === 0 ? (
                            <EmptyState
                                title="No competition series"
                                description="Create the first series using the form below."
                            />
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {seriesItems.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex flex-col gap-1 rounded-md border border-line p-3"
                                    >
                                        <span className="text-sm font-medium">{item.name}</span>
                                        <span className="text-xs text-ink-subtle">{item.slug}</span>
                                        {item.description.length === 0 ? null : (
                                            <span className="text-sm text-ink-muted">
                                                {item.description}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Create a series</CardTitle>
                        <CardDescription>
                            The slug is used in public competition addresses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form form={seriesForm} onSubmit={onCreateSeries}>
                            <div className="flex flex-col gap-4">
                                <FormField name="name" label="Name" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={field.value}
                                            placeholder="Regional open"
                                        />
                                    )}
                                </FormField>
                                <FormField
                                    name="slug"
                                    label="Slug"
                                    required
                                    description="Lowercase letters, numbers, and single hyphens."
                                >
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={field.value}
                                            placeholder="regional-open"
                                        />
                                    )}
                                </FormField>
                                <FormField
                                    name="description"
                                    label="Description"
                                    optionalLabel="optional"
                                >
                                    {(field) => <Textarea {...field} value={field.value} />}
                                </FormField>
                                <Button type="submit" loading={createSeries.isPending}>
                                    Create series
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </Card>
            </div>

            <section className="flex flex-col gap-4 border-t border-line pt-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold tracking-tight">Editions</h2>
                    <p className="text-sm text-ink-muted">
                        Select an existing edition to edit it, or create one under a series.
                    </p>
                </div>

                {organizerEditions.query.isPending ? (
                    <LoadingBlock rows={2} label="Loading editions" />
                ) : organizerEditions.query.isError ? (
                    <RequestError
                        error={organizerEditions.query.error}
                        onRetry={() => void organizerEditions.query.refetch()}
                    />
                ) : organizerEditions.editions.length === 0 ? (
                    <EmptyState
                        title="No editions"
                        description="Create an edition under a series with the form below."
                    />
                ) : (
                    <div className="max-w-md">
                        <EditionSelect
                            editions={organizerEditions.editions}
                            value={editionId ?? ""}
                            onValueChange={setEdition}
                        />
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create an edition</CardTitle>
                            <CardDescription>
                                Choose the series the edition belongs to.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form form={createEditionForm} onSubmit={onCreateEdition}>
                                <div className="flex flex-col gap-4">
                                    <Select
                                        label="Series"
                                        options={seriesItems.map((item) => ({
                                            value: item.id,
                                            label: item.name,
                                        }))}
                                        value={editionSeriesId ?? ""}
                                        onValueChange={setEditionSeriesId}
                                        placeholder="Select a series"
                                        disabled={seriesItems.length === 0}
                                    />
                                    <FormField name="name" label="Edition name" required>
                                        {(field) => (
                                            <Input
                                                {...field}
                                                value={field.value}
                                                placeholder="Regional open 2026"
                                            />
                                        )}
                                    </FormField>
                                    <FormField name="slug" label="Slug" required>
                                        {(field) => (
                                            <Input
                                                {...field}
                                                value={field.value}
                                                placeholder="regional-open-2026"
                                            />
                                        )}
                                    </FormField>
                                    <FormField
                                        name="description"
                                        label="Description"
                                        optionalLabel="optional"
                                    >
                                        {(field) => <Textarea {...field} value={field.value} />}
                                    </FormField>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField
                                            name="themeName"
                                            label="Theme name"
                                            optionalLabel="optional"
                                            description="Public label. Leave empty until the theme is revealed."
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    value={field.value}
                                                    placeholder="Beneath the surface"
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="themeDescription"
                                            label="Theme description"
                                            optionalLabel="optional"
                                            description="Short public description of the theme."
                                        >
                                            {(field) => (
                                                <Textarea {...field} value={field.value} rows={2} />
                                            )}
                                        </FormField>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <FormSwitch<EditionForm>
                                            name="showScores"
                                            label="Show scores publicly"
                                            description="Publish judge scores on the public results page."
                                        />
                                        <FormSwitch<EditionForm>
                                            name="showRanking"
                                            label="Show rankings publicly"
                                            description="Publish rank order on the public results page."
                                        />
                                    </div>
                                    <FormField
                                        name="resultsOpenAt"
                                        label="Results release"
                                        optionalLabel="optional"
                                        description="Scheduled public release shown while results are unpublished."
                                    >
                                        {(field) => (
                                            <Input
                                                {...field}
                                                type="datetime-local"
                                                value={field.value}
                                            />
                                        )}
                                    </FormField>
                                    <FormField name="timezone" label="Time zone" required>
                                        {(field) => <Input {...field} value={field.value} />}
                                    </FormField>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField
                                            name="registrationOpensAt"
                                            label="Registration opens"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="registrationClosesAt"
                                            label="Registration closes"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="startsAt"
                                            label="Starts"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="endsAt"
                                            label="Ends"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <Controller
                                            control={createEditionForm.control}
                                            name="teamMinSize"
                                            render={({ field, fieldState }) => (
                                                <NumberInput
                                                    label="Minimum team size"
                                                    min={1}
                                                    max={50}
                                                    value={field.value}
                                                    onValueChange={(value) =>
                                                        field.onChange(value ?? 1)
                                                    }
                                                    {...(fieldState.error?.message === undefined
                                                        ? {}
                                                        : { error: fieldState.error.message })}
                                                />
                                            )}
                                        />
                                        <Controller
                                            control={createEditionForm.control}
                                            name="teamMaxSize"
                                            render={({ field, fieldState }) => (
                                                <NumberInput
                                                    label="Maximum team size"
                                                    min={1}
                                                    max={50}
                                                    value={field.value}
                                                    onValueChange={(value) =>
                                                        field.onChange(value ?? 1)
                                                    }
                                                    {...(fieldState.error?.message === undefined
                                                        ? {}
                                                        : { error: fieldState.error.message })}
                                                />
                                            )}
                                        />
                                        <Controller
                                            control={createEditionForm.control}
                                            name="maxParticipants"
                                            render={({ field }) => (
                                                <NumberInput
                                                    label="Maximum participants"
                                                    min={1}
                                                    max={100000}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    description="Leave empty for no limit."
                                                />
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        name="rulesMarkdown"
                                        label="Rules"
                                        optionalLabel="optional"
                                    >
                                        {(field) => (
                                            <Textarea
                                                {...field}
                                                value={field.value}
                                                className="min-h-32"
                                                placeholder="Markdown rules for participants."
                                            />
                                        )}
                                    </FormField>
                                    <Button type="submit" loading={createEdition.isPending}>
                                        Create edition
                                    </Button>
                                </div>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {editionId === null ? null : edition.isPending ? (
                <LoadingBlock rows={5} label="Loading edition" />
            ) : edition.isError ? (
                <RequestError error={edition.error} onRetry={() => void edition.refetch()} />
            ) : editionData === null ? (
                <EmptyState
                    title="Edition not found"
                    description="This edition does not exist in the active organization."
                />
            ) : (
                <section className="flex flex-col gap-6 border-t border-line pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold tracking-tight">{editionData.name}</h2>
                            <p className="text-sm text-ink-muted">
                                {editionData.seriesName} · {editionData.organizationName}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={editionStatusTone(editionData.status)}>
                                {statusLabel(editionData.status)}
                            </Badge>
                            {editionData.status === "draft" ? (
                                <Button
                                    type="button"
                                    loading={publishEdition.isPending}
                                    onClick={() => {
                                        publishEdition.mutate(editionData.id, {
                                            onSuccess: () =>
                                                toast({
                                                    title: "Edition published",
                                                    tone: "success",
                                                }),
                                            onError: (error) =>
                                                toast({
                                                    title: "Could not publish the edition",
                                                    description: describeError(error),
                                                    tone: "critical",
                                                }),
                                        });
                                    }}
                                >
                                    Publish edition
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <KeyValue
                        columns={2}
                        items={[
                            { label: "Slug", value: editionData.slug },
                            { label: "Time zone", value: editionData.timezone },
                            {
                                label: "Registration",
                                value: `${formatDateTime(editionData.registrationOpensAt)} to ${formatDateTime(editionData.registrationClosesAt)}`,
                            },
                            {
                                label: "Event",
                                value: `${formatDate(editionData.startsAt)} to ${formatDate(editionData.endsAt)}`,
                            },
                            {
                                label: "Results release",
                                value: formatDateTime(editionData.resultsOpenAt),
                            },
                            {
                                label: "Team size",
                                value: `${String(editionData.teamMinSize)} to ${String(editionData.teamMaxSize)}`,
                            },
                            {
                                label: "Registrations",
                                value: `${String(editionData.registrationCount)} registrations, ${String(editionData.teamCount)} teams, ${String(editionData.submissionCount)} submissions`,
                            },
                        ]}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>Edit edition</CardTitle>
                            <CardDescription>
                                Status changes must follow the edition lifecycle; the service
                                rejects invalid transitions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form form={editEditionForm} onSubmit={onSaveEdition}>
                                <div className="flex flex-col gap-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField name="name" label="Name" required>
                                            {(field) => <Input {...field} value={field.value} />}
                                        </FormField>
                                        <Controller
                                            control={editEditionForm.control}
                                            name="status"
                                            render={({ field, fieldState }) => (
                                                <Select
                                                    label="Status"
                                                    options={STATUS_OPTIONS}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    description="Only valid transitions are accepted."
                                                    {...(fieldState.error?.message === undefined
                                                        ? {}
                                                        : { error: fieldState.error.message })}
                                                />
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        name="description"
                                        label="Description"
                                        optionalLabel="optional"
                                    >
                                        {(field) => <Textarea {...field} value={field.value} />}
                                    </FormField>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField
                                            name="themeName"
                                            label="Theme name"
                                            optionalLabel="optional"
                                            description="Public label. Leave empty until the theme is revealed."
                                        >
                                            {(field) => <Input {...field} value={field.value} />}
                                        </FormField>
                                        <FormField
                                            name="themeDescription"
                                            label="Theme description"
                                            optionalLabel="optional"
                                            description="Short public description of the theme."
                                        >
                                            {(field) => (
                                                <Textarea {...field} value={field.value} rows={2} />
                                            )}
                                        </FormField>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <FormSwitch<EditionForm>
                                            name="showScores"
                                            label="Show scores publicly"
                                            description="Publish judge scores on the public results page."
                                        />
                                        <FormSwitch<EditionForm>
                                            name="showRanking"
                                            label="Show rankings publicly"
                                            description="Publish rank order on the public results page."
                                        />
                                    </div>
                                    <FormField
                                        name="resultsOpenAt"
                                        label="Results release"
                                        optionalLabel="optional"
                                        description="Scheduled public release shown while results are unpublished."
                                    >
                                        {(field) => (
                                            <Input
                                                {...field}
                                                type="datetime-local"
                                                value={field.value}
                                            />
                                        )}
                                    </FormField>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField
                                            name="registrationOpensAt"
                                            label="Registration opens"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="registrationClosesAt"
                                            label="Registration closes"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="startsAt"
                                            label="Starts"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="endsAt"
                                            label="Ends"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <Controller
                                            control={editEditionForm.control}
                                            name="teamMinSize"
                                            render={({ field }) => (
                                                <NumberInput
                                                    label="Minimum team size"
                                                    min={1}
                                                    max={50}
                                                    value={field.value}
                                                    onValueChange={(value) =>
                                                        field.onChange(value ?? 1)
                                                    }
                                                />
                                            )}
                                        />
                                        <Controller
                                            control={editEditionForm.control}
                                            name="teamMaxSize"
                                            render={({ field }) => (
                                                <NumberInput
                                                    label="Maximum team size"
                                                    min={1}
                                                    max={50}
                                                    value={field.value}
                                                    onValueChange={(value) =>
                                                        field.onChange(value ?? 1)
                                                    }
                                                />
                                            )}
                                        />
                                        <Controller
                                            control={editEditionForm.control}
                                            name="maxParticipants"
                                            render={({ field }) => (
                                                <NumberInput
                                                    label="Maximum participants"
                                                    min={1}
                                                    max={100000}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    description="Leave empty for no limit."
                                                />
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        name="rulesMarkdown"
                                        label="Rules"
                                        optionalLabel="optional"
                                    >
                                        {(field) => (
                                            <Textarea
                                                {...field}
                                                value={field.value}
                                                className="min-h-32"
                                            />
                                        )}
                                    </FormField>
                                    <FormField name="timezone" label="Time zone" required>
                                        {(field) => <Input {...field} value={field.value} />}
                                    </FormField>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="submit" loading={updateEdition.isPending}>
                                            Save edition
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                editEditionForm.reset(toEditionForm(editionData))
                                            }
                                        >
                                            Reset changes
                                        </Button>
                                    </div>
                                </div>
                            </Form>
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Divisions</CardTitle>
                                <CardDescription>
                                    Divisions can restrict team size within the edition.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {divisions.isPending ? (
                                    <LoadingBlock rows={3} label="Loading divisions" />
                                ) : divisions.isError ? (
                                    <RequestError
                                        error={divisions.error}
                                        onRetry={() => void divisions.refetch()}
                                    />
                                ) : divisionItems.length === 0 ? (
                                    <EmptyState
                                        title="No divisions"
                                        description="Create a division with the form below."
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Slug</TableHead>
                                                <TableHead>Team size</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {divisionItems.map((division: Division) => (
                                                <TableRow key={division.id}>
                                                    <TableCell>{division.name}</TableCell>
                                                    <TableCell className="text-ink-muted">
                                                        {division.slug}
                                                    </TableCell>
                                                    <TableCell className="text-ink-muted">
                                                        {division.minTeamSize === null
                                                            ? "Any"
                                                            : String(division.minTeamSize)}{" "}
                                                        to{" "}
                                                        {division.maxTeamSize === null
                                                            ? "any"
                                                            : String(division.maxTeamSize)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Create a division</CardTitle>
                                <CardDescription>Team size bounds are optional.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form form={divisionForm} onSubmit={onCreateDivision}>
                                    <div className="flex flex-col gap-4">
                                        <FormField name="name" label="Name" required>
                                            {(field) => <Input {...field} value={field.value} />}
                                        </FormField>
                                        <FormField name="slug" label="Slug" required>
                                            {(field) => <Input {...field} value={field.value} />}
                                        </FormField>
                                        <FormField
                                            name="description"
                                            label="Description"
                                            optionalLabel="optional"
                                        >
                                            {(field) => <Textarea {...field} value={field.value} />}
                                        </FormField>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Controller
                                                control={divisionForm.control}
                                                name="minTeamSize"
                                                render={({ field }) => (
                                                    <NumberInput
                                                        label="Minimum team size"
                                                        min={1}
                                                        max={50}
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                control={divisionForm.control}
                                                name="maxTeamSize"
                                                render={({ field }) => (
                                                    <NumberInput
                                                        label="Maximum team size"
                                                        min={1}
                                                        max={50}
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                    />
                                                )}
                                            />
                                        </div>
                                        <Button type="submit" loading={createDivision.isPending}>
                                            Create division
                                        </Button>
                                    </div>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Milestones</CardTitle>
                                <CardDescription>
                                    Schedule markers for participants and organizers.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {milestones.isPending ? (
                                    <LoadingBlock rows={3} label="Loading milestones" />
                                ) : milestones.isError ? (
                                    <RequestError
                                        error={milestones.error}
                                        onRetry={() => void milestones.refetch()}
                                    />
                                ) : milestoneItems.length === 0 ? (
                                    <EmptyState
                                        title="No milestones"
                                        description="Create a milestone with the form below."
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Kind</TableHead>
                                                <TableHead>Occurs</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {milestoneItems.map((milestone: Milestone) => (
                                                <TableRow key={milestone.id}>
                                                    <TableCell>{milestone.title}</TableCell>
                                                    <TableCell className="text-ink-muted">
                                                        {humanizeToken(milestone.kind)}
                                                    </TableCell>
                                                    <TableCell className="text-ink-muted">
                                                        {formatDateTime(milestone.occursAt)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Create a milestone</CardTitle>
                                <CardDescription>
                                    Dates use the browser time zone and are stored with an offset.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form form={milestoneForm} onSubmit={onCreateMilestone}>
                                    <div className="flex flex-col gap-4">
                                        <FormField name="title" label="Title" required>
                                            {(field) => <Input {...field} value={field.value} />}
                                        </FormField>
                                        <Controller
                                            control={milestoneForm.control}
                                            name="kind"
                                            render={({ field }) => (
                                                <Select
                                                    label="Kind"
                                                    options={MILESTONE_KIND_OPTIONS}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                />
                                            )}
                                        />
                                        <FormField name="occursAt" label="Occurs at" required>
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="datetime-local"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <FormField
                                            name="description"
                                            label="Description"
                                            optionalLabel="optional"
                                        >
                                            {(field) => <Textarea {...field} value={field.value} />}
                                        </FormField>
                                        <Button type="submit" loading={createMilestone.isPending}>
                                            Create milestone
                                        </Button>
                                    </div>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            )}
        </div>
    );
}
