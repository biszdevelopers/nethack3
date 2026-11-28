import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router";
import type { Award, Team } from "@nethack/contracts";
import {
    AlertDialog,
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
    LoadingBlock,
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
import { useActiveMembership } from "../application/session.js";
import { useEditionTeams } from "../capabilities/teams/hooks/use-teams.js";
import { useOrganizerEditions } from "../capabilities/competitions/hooks.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { describeError } from "../capabilities/shared/errors.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import {
    awardAssignmentSchema,
    awardEditSchema,
    awardFormSchema,
    type AwardAssignmentForm,
    type AwardEditForm,
    type AwardForm,
} from "../capabilities/recognition/forms.js";
import {
    useAssignAward,
    useAwardCatalog,
    useCreateAward,
    useDeleteAward,
    usePublishResults,
    useResultsStatus,
    useUnassignAward,
    useUnpublishResults,
    useUpdateAward,
} from "../capabilities/recognition/hooks.js";

const DEFAULT_AWARD_FORM: AwardForm = {
    namespace: "",
    name: "",
    description: "",
    icon: "award",
    color: "gold",
};

const DEFAULT_ASSIGNMENT_FORM: AwardAssignmentForm = {
    awardId: "",
    teamId: "",
    note: "",
};

export function AwardsPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();

    const organizationId = membership?.organizationId ?? null;
    const role = membership?.role ?? null;
    const isOrganizer = role === "owner" || role === "organizer";

    const organizerEditions = useOrganizerEditions(organizationId, isOrganizer);
    const editionId = searchParams.get("edition");

    const catalog = useAwardCatalog(organizationId, editionId);
    const teams = useEditionTeams(editionId);
    const status = useResultsStatus(organizationId, editionId);
    const createAward = useCreateAward(organizationId, editionId);
    const updateAward = useUpdateAward(organizationId, editionId);
    const deleteAward = useDeleteAward(organizationId, editionId);
    const assignAward = useAssignAward(organizationId, editionId);
    const unassignAward = useUnassignAward(organizationId, editionId);
    const publishResults = usePublishResults(organizationId, editionId);
    const unpublishResults = useUnpublishResults(organizationId, editionId);

    const [editing, setEditing] = useState<Award | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Award | null>(null);
    const [confirmPublish, setConfirmPublish] = useState(false);
    const [confirmUnpublish, setConfirmUnpublish] = useState(false);

    const awardForm = useForm<AwardForm>({
        resolver: zodResolver(awardFormSchema),
        defaultValues: DEFAULT_AWARD_FORM,
    });
    const assignmentForm = useForm<AwardAssignmentForm>({
        resolver: zodResolver(awardAssignmentSchema),
        defaultValues: DEFAULT_ASSIGNMENT_FORM,
    });

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading awards" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Awards"
                    description="Manage the award catalog and assign awards to teams."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization membership to manage awards."
                />
            </div>
        );
    }
    if (!isOrganizer) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Awards"
                    description="Manage the award catalog and assign awards to teams."
                />
                <EmptyState
                    title="Organizer access required"
                    description="Owners and organizers can manage awards and publish results."
                />
            </div>
        );
    }

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
        setEditing(null);
        awardForm.reset(DEFAULT_AWARD_FORM);
        assignmentForm.reset(DEFAULT_ASSIGNMENT_FORM);
    };

    const awardItems = catalog.data?.awards ?? [];
    const teamAwardItems = catalog.data?.teamAwards ?? [];
    const teamItems: readonly Team[] = teams.data?.items ?? [];
    const awardOptions = awardItems.map((award) => ({
        value: award.id,
        label: award.name,
    }));
    const teamOptions = teamItems.map((team) => ({ value: team.id, label: team.name }));

    const onCreateAward = awardForm.handleSubmit(async (values) => {
        try {
            await createAward.mutateAsync({
                namespace: values.namespace.trim(),
                name: values.name.trim(),
                description: values.description.trim(),
                icon: values.icon.trim().length === 0 ? "award" : values.icon.trim(),
                color: values.color.trim().length === 0 ? "gold" : values.color.trim(),
            });
            awardForm.reset(DEFAULT_AWARD_FORM);
            toast({ title: "Award created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the award",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onAssignAward = assignmentForm.handleSubmit(async (values) => {
        try {
            await assignAward.mutateAsync({
                teamId: values.teamId,
                awardId: values.awardId,
                note: values.note.trim(),
            });
            assignmentForm.reset(DEFAULT_ASSIGNMENT_FORM);
            toast({ title: "Award assigned", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not assign the award",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onConfirmDelete = async (): Promise<void> => {
        if (pendingDelete === null) {
            return;
        }
        try {
            await deleteAward.mutateAsync(pendingDelete.id);
            toast({ title: "Award deleted", tone: "success" });
            setPendingDelete(null);
        } catch (error) {
            toast({
                title: "Could not delete the award",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onConfirmPublish = async (): Promise<void> => {
        try {
            await publishResults.mutateAsync();
            toast({ title: "Results published", tone: "success" });
            setConfirmPublish(false);
        } catch (error) {
            toast({
                title: "Could not publish results",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onConfirmUnpublish = async (): Promise<void> => {
        try {
            await unpublishResults.mutateAsync();
            toast({ title: "Results unpublished", tone: "success" });
            setConfirmUnpublish(false);
        } catch (error) {
            toast({
                title: "Could not unpublish results",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Awards"
                description="Define the award catalog, assign awards to teams, and publish final results."
            />

            <div className="max-w-md">
                {organizerEditions.query.isPending ? (
                    <LoadingBlock rows={2} label="Loading editions" />
                ) : organizerEditions.query.isError ? (
                    <RequestError
                        error={organizerEditions.query.error}
                        onRetry={() => void organizerEditions.query.refetch()}
                    />
                ) : organizerEditions.editions.length === 0 ? (
                    <EmptyState
                        title="No competition editions"
                        description="Create a competition edition before managing awards."
                    />
                ) : (
                    <EditionSelect
                        editions={organizerEditions.editions}
                        value={editionId ?? ""}
                        onValueChange={setEdition}
                    />
                )}
            </div>

            {editionId === null ? null : (
                <>
                    <section
                        className="flex flex-col gap-4"
                        aria-labelledby="award-catalog-heading"
                    >
                        <div className="flex flex-col gap-1">
                            <h2
                                id="award-catalog-heading"
                                className="text-lg font-bold tracking-tight"
                            >
                                Award catalog
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Award keys are stable identifiers unique within the edition.
                            </p>
                        </div>

                        {catalog.isPending ? (
                            <LoadingBlock rows={4} label="Loading awards" />
                        ) : catalog.isError ? (
                            <RequestError
                                error={catalog.error}
                                onRetry={() => void catalog.refetch()}
                            />
                        ) : awardItems.length === 0 ? (
                            <EmptyState
                                title="No awards"
                                description="Create the first award with the form below."
                            />
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Key</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {awardItems.map((award) => (
                                            <TableRow key={award.id}>
                                                <TableCell className="text-ink-muted">
                                                    {award.namespace}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {award.name}
                                                </TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {award.description.length === 0
                                                        ? "—"
                                                        : award.description}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setEditing(award)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setPendingDelete(award)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )}

                        {editing === null ? null : (
                            <AwardEditForm
                                award={editing}
                                saving={updateAward.isPending}
                                onCancel={() => setEditing(null)}
                                onSave={async (values) => {
                                    try {
                                        await updateAward.mutateAsync({
                                            awardId: editing.id,
                                            body: values,
                                        });
                                        toast({ title: "Award updated", tone: "success" });
                                        setEditing(null);
                                    } catch (error) {
                                        toast({
                                            title: "Could not update the award",
                                            description: describeError(error),
                                            tone: "critical",
                                        });
                                    }
                                }}
                            />
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Create an award</CardTitle>
                                <CardDescription>
                                    The key cannot change after the award is created.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form form={awardForm} onSubmit={onCreateAward}>
                                    <div className="flex flex-col gap-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <FormField name="namespace" label="Award key" required>
                                                {(field) => (
                                                    <Input
                                                        {...field}
                                                        value={field.value}
                                                        placeholder="best-design"
                                                    />
                                                )}
                                            </FormField>
                                            <FormField name="name" label="Award name" required>
                                                {(field) => (
                                                    <Input
                                                        {...field}
                                                        value={field.value}
                                                        placeholder="Best design"
                                                    />
                                                )}
                                            </FormField>
                                        </div>
                                        <FormField
                                            name="description"
                                            label="Description"
                                            optionalLabel="optional"
                                        >
                                            {(field) => (
                                                <Textarea
                                                    {...field}
                                                    value={field.value}
                                                    placeholder="Why this award exists."
                                                />
                                            )}
                                        </FormField>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <FormField
                                                name="icon"
                                                label="Icon"
                                                optionalLabel="optional"
                                            >
                                                {(field) => (
                                                    <Input {...field} value={field.value} />
                                                )}
                                            </FormField>
                                            <FormField
                                                name="color"
                                                label="Color"
                                                optionalLabel="optional"
                                            >
                                                {(field) => (
                                                    <Input {...field} value={field.value} />
                                                )}
                                            </FormField>
                                        </div>
                                        <Button type="submit" loading={createAward.isPending}>
                                            Create award
                                        </Button>
                                    </div>
                                </Form>
                            </CardContent>
                        </Card>
                    </section>

                    <section
                        className="flex flex-col gap-4 border-t border-line pt-6"
                        aria-labelledby="team-awards-heading"
                    >
                        <div className="flex flex-col gap-1">
                            <h2
                                id="team-awards-heading"
                                className="text-lg font-bold tracking-tight"
                            >
                                Team awards
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Assign catalog awards to teams in this edition.
                            </p>
                        </div>

                        {catalog.isPending ? (
                            <LoadingBlock rows={3} label="Loading team awards" />
                        ) : catalog.isError ? (
                            <RequestError
                                error={catalog.error}
                                onRetry={() => void catalog.refetch()}
                            />
                        ) : teamAwardItems.length === 0 ? (
                            <EmptyState
                                title="No team awards"
                                description="Assign the first award with the form below."
                            />
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Team</TableHead>
                                            <TableHead>Award</TableHead>
                                            <TableHead>Note</TableHead>
                                            <TableHead>Assigned</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {teamAwardItems.map((assignment) => (
                                            <TableRow key={assignment.id}>
                                                <TableCell className="font-medium">
                                                    {assignment.teamName}
                                                </TableCell>
                                                <TableCell>{assignment.award.name}</TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {assignment.note.length === 0
                                                        ? "—"
                                                        : assignment.note}
                                                </TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {formatDateTime(assignment.assignedAt)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={unassignAward.isPending}
                                                        onClick={() => {
                                                            unassignAward.mutate(
                                                                {
                                                                    teamId: assignment.teamId,
                                                                    awardId: assignment.awardId,
                                                                },
                                                                {
                                                                    onSuccess: () =>
                                                                        toast({
                                                                            title: "Award removed",
                                                                            tone: "success",
                                                                        }),
                                                                    onError: (error) =>
                                                                        toast({
                                                                            title: "Could not remove the award",
                                                                            description:
                                                                                describeError(
                                                                                    error,
                                                                                ),
                                                                            tone: "critical",
                                                                        }),
                                                                },
                                                            );
                                                        }}
                                                    >
                                                        Remove
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Assign an award</CardTitle>
                                <CardDescription>
                                    A team can receive the same award only once.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {teams.isPending ? (
                                    <LoadingBlock rows={2} label="Loading teams" />
                                ) : teams.isError ? (
                                    <RequestError
                                        error={teams.error}
                                        onRetry={() => void teams.refetch()}
                                    />
                                ) : teamItems.length === 0 ? (
                                    <EmptyState
                                        title="No teams"
                                        description="Award assignment requires at least one team in this edition."
                                    />
                                ) : (
                                    <Form form={assignmentForm} onSubmit={onAssignAward}>
                                        <div className="flex flex-col gap-4">
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <Controller
                                                    control={assignmentForm.control}
                                                    name="awardId"
                                                    render={({ field, fieldState }) => (
                                                        <Select
                                                            label="Award"
                                                            options={awardOptions}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select an award"
                                                            {...(fieldState.error?.message ===
                                                            undefined
                                                                ? {}
                                                                : {
                                                                      error: fieldState.error
                                                                          .message,
                                                                  })}
                                                        />
                                                    )}
                                                />
                                                <Controller
                                                    control={assignmentForm.control}
                                                    name="teamId"
                                                    render={({ field, fieldState }) => (
                                                        <Select
                                                            label="Team"
                                                            options={teamOptions}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select a team"
                                                            {...(fieldState.error?.message ===
                                                            undefined
                                                                ? {}
                                                                : {
                                                                      error: fieldState.error
                                                                          .message,
                                                                  })}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                name="note"
                                                label="Note"
                                                optionalLabel="optional"
                                            >
                                                {(field) => (
                                                    <Input
                                                        {...field}
                                                        value={field.value}
                                                        placeholder="Why this team received the award."
                                                    />
                                                )}
                                            </FormField>
                                            <Button type="submit" loading={assignAward.isPending}>
                                                Assign award
                                            </Button>
                                        </div>
                                    </Form>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section
                        className="flex flex-col gap-4 border-t border-line pt-6"
                        aria-labelledby="results-publication-heading"
                    >
                        <div className="flex flex-col gap-1">
                            <h2
                                id="results-publication-heading"
                                className="text-lg font-bold tracking-tight"
                            >
                                Results publication
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Publishing stores an immutable snapshot of the current rankings,
                                awards, and peer voting.
                            </p>
                        </div>

                        {status.isPending ? (
                            <LoadingBlock rows={3} label="Loading publication status" />
                        ) : status.isError ? (
                            <RequestError
                                error={status.error}
                                onRetry={() => void status.refetch()}
                            />
                        ) : (
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <CardTitle>Publication status</CardTitle>
                                        <Badge tone={status.data.published ? "primary" : "neutral"}>
                                            {status.data.published ? "Published" : "Not published"}
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        {status.data.published
                                            ? `Published ${formatDateTime(status.data.publishedAt)}.`
                                            : "Participants and the public cannot see results before publication."}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                                        <div className="flex flex-col gap-0.5">
                                            <dt className="text-xs text-ink-subtle">
                                                Judging entries
                                            </dt>
                                            <dd className="tabular-nums">
                                                {String(status.data.judgingEntryCount)}
                                            </dd>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <dt className="text-xs text-ink-subtle">
                                                Award assignments
                                            </dt>
                                            <dd className="tabular-nums">
                                                {String(status.data.awardAssignmentCount)}
                                            </dd>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <dt className="text-xs text-ink-subtle">
                                                Voting rounds
                                            </dt>
                                            <dd className="tabular-nums">
                                                {String(status.data.votingRoundCount)}
                                            </dd>
                                        </div>
                                    </dl>
                                    <div className="flex flex-wrap gap-2">
                                        {status.data.published ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setConfirmUnpublish(true)}
                                            >
                                                Unpublish results
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                onClick={() => setConfirmPublish(true)}
                                            >
                                                Publish results
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                </>
            )}

            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
                title="Delete award"
                description={
                    pendingDelete === null
                        ? "Delete this award?"
                        : `Delete the "${pendingDelete.name}" award? Remove it from every team first.`
                }
                confirmLabel="Delete award"
                tone="destructive"
                loading={deleteAward.isPending}
                onConfirm={onConfirmDelete}
            />

            <AlertDialog
                open={confirmPublish}
                onOpenChange={setConfirmPublish}
                title="Publish results"
                description="Publish the current rankings, awards, and peer voting? The snapshot cannot change without unpublishing."
                confirmLabel="Publish results"
                loading={publishResults.isPending}
                onConfirm={onConfirmPublish}
            />

            <AlertDialog
                open={confirmUnpublish}
                onOpenChange={setConfirmUnpublish}
                title="Unpublish results"
                description="Remove the published snapshot? Public results and certificates become unavailable immediately."
                confirmLabel="Unpublish results"
                tone="destructive"
                loading={unpublishResults.isPending}
                onConfirm={onConfirmUnpublish}
            />
        </div>
    );
}

function AwardEditForm({
    award,
    saving,
    onCancel,
    onSave,
}: {
    readonly award: Award;
    readonly saving: boolean;
    readonly onCancel: () => void;
    readonly onSave: (values: AwardEditForm) => Promise<void>;
}): ReactNode {
    const form = useForm<AwardEditForm>({
        resolver: zodResolver(awardEditSchema),
        defaultValues: {
            name: award.name,
            description: award.description,
            icon: award.icon,
            color: award.color,
        },
    });

    const onSubmit = form.handleSubmit(async (values) => {
        await onSave(values);
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Edit {award.namespace}</CardTitle>
                <CardDescription>{award.name}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form form={form} onSubmit={onSubmit}>
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField name="name" label="Award name" required>
                                {(field) => <Input {...field} value={field.value} />}
                            </FormField>
                            <FormField name="icon" label="Icon" optionalLabel="optional">
                                {(field) => <Input {...field} value={field.value} />}
                            </FormField>
                        </div>
                        <FormField name="description" label="Description" optionalLabel="optional">
                            {(field) => <Textarea {...field} value={field.value} />}
                        </FormField>
                        <FormField name="color" label="Color" optionalLabel="optional">
                            {(field) => <Input {...field} value={field.value} />}
                        </FormField>
                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" loading={saving}>
                                Save award
                            </Button>
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Form>
            </CardContent>
        </Card>
    );
}
