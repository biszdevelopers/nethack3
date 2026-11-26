import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router";
import type { Ballot, OrganizationRole, VoteResult, VotingRound } from "@nethack/contracts";
import {
    Alert,
    AlertDialog,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    CheckboxGroup,
    EmptyState,
    Form,
    FormField,
    Input,
    LoadingBlock,
    NumberInput,
    PageHeader,
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
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { formatDateTime, localInputToIso } from "../capabilities/shared/datetime.js";
import { describeError } from "../capabilities/shared/errors.js";
import { humanizeToken } from "../capabilities/shared/format.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import { roundSchema, type RoundForm } from "../capabilities/voting/forms.js";
import {
    useOrganizerEditions,
    usePublicEditionOptions,
} from "../capabilities/competitions/hooks.js";
import {
    useBallot,
    useCastBallot,
    useCreateRound,
    useEditionResults,
    useVotableSubmissions,
    useRoundTransition,
    useVotingRounds,
} from "../capabilities/voting/hooks.js";

const ROLE_OPTIONS = [
    { value: "participant", label: "Participants" },
    { value: "judge", label: "Judges" },
    { value: "organizer", label: "Organizers" },
] as const;

function effectiveVotingRole(role: OrganizationRole): "participant" | "judge" | "organizer" {
    if (role === "owner" || role === "organizer") {
        return "organizer";
    }
    return role;
}

function roundStatusTone(status: VotingRound["status"]): "neutral" | "primary" | "outline" {
    switch (status) {
        case "open":
            return "primary";
        case "published":
            return "outline";
        default:
            return "neutral";
    }
}

export function VotingPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();

    const organizationId = membership?.organizationId ?? null;
    const organizationSlug = membership?.organizationSlug ?? null;
    const role = membership?.role ?? null;
    const isOrganizer = role === "owner" || role === "organizer";
    const votingRole = role === null ? null : effectiveVotingRole(role);

    const organizerEditions = useOrganizerEditions(organizationId, isOrganizer);
    const publicEditions = usePublicEditionOptions(
        isOrganizer ? null : organizationSlug,
        !isOrganizer,
    );
    const editions = isOrganizer ? organizerEditions.editions : publicEditions.editions;
    const editionsQuery = isOrganizer ? organizerEditions.query : publicEditions.query;

    const editionId = searchParams.get("edition");
    const rounds = useVotingRounds(organizationId, editionId);
    const editionResults = useEditionResults(organizationId, editionId);
    const createRound = useCreateRound(organizationId, editionId);
    const openRound = useRoundTransition(organizationId, editionId, "open");
    const closeRound = useRoundTransition(organizationId, editionId, "close");
    const publishRound = useRoundTransition(organizationId, editionId, "publish");

    const [pendingPublish, setPendingPublish] = useState<VotingRound | null>(null);

    const roundForm = useForm<RoundForm>({
        resolver: zodResolver(roundSchema),
        defaultValues: {
            name: "",
            description: "",
            eligibleRoles: ["participant"],
            maxSelections: 1,
            opensAt: "",
            closesAt: "",
        },
    });

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading voting" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null || votingRole === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Voting"
                    description="Eligible rounds, ballots, and published results."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization membership to view voting rounds."
                />
            </div>
        );
    }

    const roundItems = rounds.data?.items ?? [];
    const openEligible = roundItems.filter(
        (round) => round.status === "open" && round.eligibleRoles.includes(votingRole),
    );
    const selectedEdition = editions.find((edition) => edition.id === editionId) ?? null;

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
        roundForm.reset({
            name: "",
            description: "",
            eligibleRoles: ["participant"],
            maxSelections: 1,
            opensAt: "",
            closesAt: "",
        });
    };

    const onCreateRound = roundForm.handleSubmit(async (values) => {
        const opensAt = values.opensAt.trim().length === 0 ? null : localInputToIso(values.opensAt);
        const closesAt =
            values.closesAt.trim().length === 0 ? null : localInputToIso(values.closesAt);
        try {
            await createRound.mutateAsync({
                name: values.name.trim(),
                description: values.description,
                eligibleRoles: values.eligibleRoles,
                maxSelections: values.maxSelections,
                opensAt,
                closesAt,
            });
            roundForm.reset({
                name: "",
                description: "",
                eligibleRoles: ["participant"],
                maxSelections: 1,
                opensAt: "",
                closesAt: "",
            });
            toast({ title: "Voting round created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the voting round",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onTransition = (action: "open" | "close", round: VotingRound): void => {
        const mutation = action === "open" ? openRound : closeRound;
        mutation.mutate(round.id, {
            onSuccess: () =>
                toast({
                    title: action === "open" ? "Round opened" : "Round closed",
                    tone: "success",
                }),
            onError: (error) =>
                toast({
                    title: "Could not change the round status",
                    description: describeError(error),
                    tone: "critical",
                }),
        });
    };

    const onConfirmPublish = async (): Promise<void> => {
        if (pendingPublish === null) {
            return;
        }
        try {
            await publishRound.mutateAsync(pendingPublish.id);
            toast({ title: "Results published", tone: "success" });
            setPendingPublish(null);
        } catch (error) {
            toast({
                title: "Could not publish the round",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Voting"
                description="Cast an eligible ballot, manage rounds, and read published results."
            />

            <div className="max-w-md">
                {editionsQuery.isPending ? (
                    <LoadingBlock rows={2} label="Loading editions" />
                ) : editionsQuery.isError ? (
                    <RequestError
                        error={editionsQuery.error}
                        onRetry={() => void editionsQuery.refetch()}
                    />
                ) : editions.length === 0 ? (
                    <EmptyState
                        title="No competition editions"
                        description={
                            isOrganizer
                                ? "Create a competition edition before creating voting rounds."
                                : "Published competition editions appear here when they are available to this organization."
                        }
                    />
                ) : (
                    <EditionSelect
                        editions={editions}
                        value={editionId ?? ""}
                        onValueChange={setEdition}
                    />
                )}
            </div>

            {editionId === null ? null : (
                <>
                    {selectedEdition === null ? null : (
                        <p className="text-sm text-ink-muted">Viewing {selectedEdition.name}.</p>
                    )}

                    <section className="flex flex-col gap-4" aria-labelledby="open-rounds-heading">
                        <div className="flex flex-col gap-1">
                            <h2 id="open-rounds-heading" className="text-lg font-bold tracking-tight">
                                Open rounds for you
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Rounds that are open and include your organization role.
                            </p>
                        </div>
                        {rounds.isPending ? (
                            <LoadingBlock rows={3} label="Loading rounds" />
                        ) : rounds.isError ? (
                            <RequestError
                                error={rounds.error}
                                onRetry={() => void rounds.refetch()}
                            />
                        ) : openEligible.length === 0 ? (
                            <EmptyState
                                title="No open voting round"
                                description="Voting rounds appear here while they are open and you are eligible."
                            />
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-2">
                                {openEligible.map((round) => (
                                    <BallotCard
                                        key={round.id}
                                        round={round}
                                        organizationId={organizationId}
                                        editionId={editionId}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {isOrganizer ? (
                        <section
                            className="flex flex-col gap-4 border-t border-line pt-6"
                            aria-labelledby="round-management-heading"
                        >
                            <div className="flex flex-col gap-1">
                                <h2 id="round-management-heading" className="text-lg font-bold tracking-tight">
                                    Round management
                                </h2>
                                <p className="text-sm text-ink-muted">
                                    Create rounds, open and close voting, then publish results.
                                </p>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Create a voting round</CardTitle>
                                    <CardDescription>
                                        Eligible roles and the selection limit are fixed when the
                                        round is created.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Form form={roundForm} onSubmit={onCreateRound}>
                                        <div className="flex flex-col gap-4">
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <FormField name="name" label="Name" required>
                                                    {(field) => (
                                                        <Input
                                                            {...field}
                                                            value={field.value}
                                                            placeholder="Community choice"
                                                        />
                                                    )}
                                                </FormField>
                                                <Controller
                                                    control={roundForm.control}
                                                    name="maxSelections"
                                                    render={({ field, fieldState }) => (
                                                        <NumberInput
                                                            label="Maximum selections"
                                                            min={1}
                                                            max={50}
                                                            value={field.value}
                                                            onValueChange={(value) =>
                                                                field.onChange(value ?? 1)
                                                            }
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
                                                name="description"
                                                label="Description"
                                                optionalLabel="optional"
                                            >
                                                {(field) => (
                                                    <Textarea
                                                        {...field}
                                                        value={field.value}
                                                        placeholder="What this round decides."
                                                    />
                                                )}
                                            </FormField>
                                            <Controller
                                                control={roundForm.control}
                                                name="eligibleRoles"
                                                render={({ field, fieldState }) => (
                                                    <CheckboxGroup
                                                        label="Eligible roles"
                                                        options={ROLE_OPTIONS}
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        orientation="horizontal"
                                                        {...(fieldState.error?.message === undefined
                                                            ? {}
                                                            : {
                                                                  error: fieldState.error.message,
                                                              })}
                                                    />
                                                )}
                                            />
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <FormField
                                                    name="opensAt"
                                                    label="Opens at"
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
                                                    name="closesAt"
                                                    label="Closes at"
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
                                            <Button type="submit" loading={createRound.isPending}>
                                                Create round
                                            </Button>
                                        </div>
                                    </Form>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Rounds in this edition</CardTitle>
                                    <CardDescription>
                                        Round status transitions are controlled by the voting
                                        service.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {rounds.isPending ? (
                                        <LoadingBlock rows={4} label="Loading rounds" />
                                    ) : rounds.isError ? (
                                        <RequestError
                                            error={rounds.error}
                                            onRetry={() => void rounds.refetch()}
                                        />
                                    ) : roundItems.length === 0 ? (
                                        <EmptyState
                                            title="No voting rounds"
                                            description="Create the first round using the form above."
                                        />
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Round</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Eligible roles</TableHead>
                                                    <TableHead>Selections</TableHead>
                                                    <TableHead>Window</TableHead>
                                                    <TableHead className="text-right">
                                                        Actions
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {roundItems.map((round) => (
                                                    <TableRow key={round.id}>
                                                        <TableCell>{round.name}</TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                tone={roundStatusTone(round.status)}
                                                            >
                                                                {humanizeToken(round.status)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {round.eligibleRoles
                                                                .map((eligibleRole) =>
                                                                    humanizeToken(eligibleRole),
                                                                )
                                                                .join(", ")}
                                                        </TableCell>
                                                        <TableCell className="tabular-nums">
                                                            {String(round.maxSelections)}
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {formatDateTime(round.opensAt)} to{" "}
                                                            {formatDateTime(round.closesAt)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                {round.status === "draft" ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={
                                                                            openRound.isPending
                                                                        }
                                                                        onClick={() =>
                                                                            onTransition(
                                                                                "open",
                                                                                round,
                                                                            )
                                                                        }
                                                                    >
                                                                        Open
                                                                    </Button>
                                                                ) : null}
                                                                {round.status === "open" ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={
                                                                            closeRound.isPending
                                                                        }
                                                                        onClick={() =>
                                                                            onTransition(
                                                                                "close",
                                                                                round,
                                                                            )
                                                                        }
                                                                    >
                                                                        Close
                                                                    </Button>
                                                                ) : null}
                                                                {round.status === "closed" ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={
                                                                            publishRound.isPending
                                                                        }
                                                                        onClick={() =>
                                                                            setPendingPublish(round)
                                                                        }
                                                                    >
                                                                        Publish
                                                                    </Button>
                                                                ) : null}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </section>
                    ) : null}

                    <section
                        className="flex flex-col gap-4 border-t border-line pt-6"
                        aria-labelledby="results-heading"
                    >
                        <div className="flex flex-col gap-1">
                            <h2 id="results-heading" className="text-lg font-bold tracking-tight">
                                Results
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Published round results are visible to eligible members. Organizers
                                also see counts for unpublished rounds.
                            </p>
                        </div>
                        {editionResults.isPending ? (
                            <LoadingBlock rows={3} label="Loading results" />
                        ) : editionResults.isError ? (
                            <RequestError
                                error={editionResults.error}
                                onRetry={() => void editionResults.refetch()}
                            />
                        ) : (editionResults.data?.items.length ?? 0) === 0 ? (
                            <EmptyState
                                title="No voting results"
                                description="Results appear here when a round records votes or is published."
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {editionResults.data?.items.map((result) => (
                                    <Card key={result.roundId}>
                                        <CardHeader>
                                            <CardTitle>{result.roundName}</CardTitle>
                                            <CardDescription>
                                                {String(result.totalBallots)} ballots
                                                {result.publishedAt === null
                                                    ? ", not published"
                                                    : `, published ${formatDateTime(result.publishedAt)}`}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResultTable result={result} />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

            <AlertDialog
                open={pendingPublish !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingPublish(null);
                    }
                }}
                title="Publish results"
                description={`Publish the results of ${pendingPublish?.name ?? "this round"}? Results become visible to every member who can read them.`}
                confirmLabel="Publish results"
                loading={publishRound.isPending}
                onConfirm={onConfirmPublish}
            />
        </div>
    );
}

function ResultTable({ result }: { readonly result: VoteResult }): ReactNode {
    if (result.entries.length === 0) {
        return (
            <EmptyState
                title="No votes recorded"
                description="This round has no votes to display."
            />
        );
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Votes</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {result.entries.map((entry) => (
                    <TableRow key={entry.submissionId}>
                        <TableCell>{entry.projectTitle}</TableCell>
                        <TableCell className="text-ink-muted">
                            {entry.teamName ?? "No team"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {String(entry.votes)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function BallotCard({
    round,
    organizationId,
    editionId,
}: {
    readonly round: VotingRound;
    readonly organizationId: string;
    readonly editionId: string;
}): ReactNode {
    const { toast } = useToast();
    const ballot = useBallot(organizationId, round.id, true);
    const submissions = useVotableSubmissions(organizationId, editionId);
    const castBallot = useCastBallot(organizationId, editionId);
    const [selected, setSelected] = useState<readonly string[]>([]);

    const submitted = ballot.data !== null && ballot.data !== undefined;
    const submissionItems = submissions.data?.items ?? [];
    const atLimit = selected.length >= round.maxSelections;

    const toggle = (submissionId: string, checked: boolean): void => {
        setSelected((current) => {
            if (!checked) {
                return current.filter((id) => id !== submissionId);
            }
            if (current.includes(submissionId) || current.length >= round.maxSelections) {
                return current;
            }
            return [...current, submissionId];
        });
    };

    const onCast = async (): Promise<void> => {
        try {
            await castBallot.mutateAsync({
                roundId: round.id,
                body: { submissionIds: [...selected] },
            });
            toast({ title: "Ballot submitted", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not submit the ballot",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{round.name}</CardTitle>
                        <CardDescription>
                            {round.description.length === 0
                                ? "No round description."
                                : round.description}
                        </CardDescription>
                    </div>
                    <Badge tone={roundStatusTone(round.status)}>
                        {humanizeToken(round.status)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <dl className="grid grid-cols-2 gap-3 text-xs text-ink-muted">
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-ink-subtle">Selections allowed</dt>
                            <dd className="tabular-nums text-ink">{String(round.maxSelections)}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-ink-subtle">Closes</dt>
                            <dd className="text-ink">{formatDateTime(round.closesAt)}</dd>
                        </div>
                    </dl>

                    {ballot.isPending ? (
                        <LoadingBlock rows={2} label="Loading ballot" />
                    ) : ballot.isError ? (
                        <RequestError error={ballot.error} onRetry={() => void ballot.refetch()} />
                    ) : ballot.data !== null && ballot.data !== undefined ? (
                        <BallotSummary ballot={ballot.data} />
                    ) : (
                        submissions.isPending ? (
                            <LoadingBlock rows={3} label="Loading submissions" />
                        ) : submissions.isError ? (
                            <RequestError
                                error={submissions.error}
                                onRetry={() => void submissions.refetch()}
                            />
                        ) : submissionItems.length === 0 ? (
                            <EmptyState
                                title="No submissions"
                                description="A ballot can be cast after submissions exist in this edition."
                            />
                        ) : (
                            <fieldset className="flex flex-col gap-2">
                                <legend className="text-sm font-medium text-ink">
                                    Select up to {String(round.maxSelections)}
                                </legend>
                                {submissionItems.map((submission) => {
                                    const checked = selected.includes(submission.id);
                                    return (
                                        <Checkbox
                                            key={submission.id}
                                            checked={checked}
                                            onCheckedChange={(value) =>
                                                toggle(submission.id, value === true)
                                            }
                                            disabled={!checked && atLimit}
                                            label={submission.teamName === null ? submission.projectTitle : `${submission.projectTitle} · ${submission.teamName}`}
                                        />
                                    );
                                })}
                            </fieldset>
                        )
                    )}

                    {submitted ? null : submissionItems.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                            <Button
                                type="button"
                                loading={castBallot.isPending}
                                disabled={selected.length === 0}
                                onClick={() => void onCast()}
                            >
                                Cast ballot
                            </Button>
                            <span className="text-xs text-ink-muted">
                                {String(selected.length)} of {String(round.maxSelections)} selected
                            </span>
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function BallotSummary({ ballot }: { readonly ballot: Ballot }): ReactNode {
    if (ballot.submissionIds.length === 0) {
        return (
            <EmptyState
                title="Empty ballot"
                description="This ballot does not contain any selections."
            />
        );
    }
    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">Submitted {formatDateTime(ballot.submittedAt)}</p>
            <ul className="flex flex-col gap-1">
                {ballot.submissionIds.map((submissionId) => (
                    <li key={submissionId} className="text-xs text-ink-muted">
                        {submissionId}
                    </li>
                ))}
            </ul>
        </div>
    );
}
