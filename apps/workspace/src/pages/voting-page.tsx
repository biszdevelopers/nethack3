import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router";
import {
    BALLOT_MAX_STARS_PER_SUBMISSION,
    BALLOT_REASONING_MAX_LENGTH,
    BALLOT_TOTAL_STARS,
    type Ballot,
    type BallotScore,
    type OrganizationRole,
    type VoteResult,
    type VotableSubmission,
    type VotingRound,
} from "@nethack/contracts";
import {
    AlertDialog,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
import { safeExternalUrl } from "../capabilities/voting/media.js";
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
            maxSelections: 10,
            maxVotesPerUser: 0,
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
            maxSelections: 10,
            maxVotesPerUser: 0,
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
                maxVotesPerUser: values.maxVotesPerUser,
                opensAt,
                closesAt,
            });
            roundForm.reset({
                name: "",
                description: "",
                eligibleRoles: ["participant"],
                maxSelections: 10,
                maxVotesPerUser: 0,
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
                            <h2
                                id="open-rounds-heading"
                                className="text-lg font-bold tracking-tight"
                            >
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
                                <h2
                                    id="round-management-heading"
                                    className="text-lg font-bold tracking-tight"
                                >
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
                                        Eligible roles and how many projects may be scored are fixed
                                        when the round is created. Every ballot must distribute 10
                                        stars with at most 5 per project. An optional per-voter cap
                                        can lower the number of projects a voter may score.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Form form={roundForm} onSubmit={onCreateRound}>
                                        <div className="flex flex-col gap-4">
                                            <div className="grid gap-4 sm:grid-cols-3">
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
                                                            label="Maximum scored projects"
                                                            min={2}
                                                            max={50}
                                                            value={field.value}
                                                            onValueChange={(value) =>
                                                                field.onChange(value ?? 10)
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
                                                <Controller
                                                    control={roundForm.control}
                                                    name="maxVotesPerUser"
                                                    render={({ field, fieldState }) => (
                                                        <NumberInput
                                                            label="Per-voter cap"
                                                            description="0 means only the scored-project limit applies."
                                                            min={0}
                                                            max={50}
                                                            value={field.value}
                                                            onValueChange={(value) =>
                                                                field.onChange(value ?? 0)
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
                                                    <TableHead>Scored projects</TableHead>
                                                    <TableHead>Per-voter cap</TableHead>
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
                                                        <TableCell className="tabular-nums">
                                                            {round.maxVotesPerUser === 0
                                                                ? "No extra cap"
                                                                : String(round.maxVotesPerUser)}
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
    const audit = result.audit ?? [];
    const titles = new Map(result.entries.map((entry) => [entry.submissionId, entry.projectTitle]));
    if (result.entries.length === 0 && audit.length === 0) {
        return (
            <EmptyState
                title="No votes recorded"
                description="This round has no votes to display."
            />
        );
    }
    return (
        <div className="flex flex-col gap-6">
            {result.entries.length === 0 ? (
                <EmptyState
                    title="No votes recorded"
                    description="This round has no votes to display."
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Ballots</TableHead>
                            <TableHead className="text-right">Total stars</TableHead>
                            <TableHead className="text-right">Average stars</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {result.entries.map((entry) => (
                            <TableRow key={entry.submissionId}>
                                <TableCell className="tabular-nums">{String(entry.rank)}</TableCell>
                                <TableCell>
                                    <span className="flex flex-wrap items-center gap-2">
                                        {entry.projectTitle}
                                        {entry.rank === 1 ? (
                                            <Badge tone="primary">{"People's choice"}</Badge>
                                        ) : null}
                                    </span>
                                </TableCell>
                                <TableCell className="text-ink-muted">
                                    {entry.teamName ?? "No team"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {String(entry.votes)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {String(entry.totalStars)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {entry.averageStars.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {audit.length === 0 ? null : (
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold tracking-tight">Organizer ballot audit</h3>
                    <p className="text-xs text-ink-muted">
                        Ballot reasoning and scores are visible only to owners and organizers.
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Voter</TableHead>
                                <TableHead>Submitted</TableHead>
                                <TableHead>Reasoning</TableHead>
                                <TableHead>Scores</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {audit.map((entry) => (
                                <TableRow key={`${entry.userId}-${entry.submittedAt ?? "draft"}`}>
                                    <TableCell className="font-mono text-xs">
                                        {entry.userId}
                                    </TableCell>
                                    <TableCell className="text-ink-muted">
                                        {formatDateTime(entry.submittedAt)}
                                    </TableCell>
                                    <TableCell className="text-ink-muted">
                                        {entry.reasoning.length === 0 ? "—" : entry.reasoning}
                                    </TableCell>
                                    <TableCell className="text-ink-muted">
                                        {entry.scores
                                            .map(
                                                (score) =>
                                                    `${titles.get(score.submissionId) ?? score.submissionId}: ${String(score.stars)}`,
                                            )
                                            .join(", ")}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
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

    const submittedBallot = ballot.data ?? null;
    const submitted = submittedBallot !== null;
    const submissionItems = submissions.data?.items ?? [];

    const onCast = async (scores: readonly BallotScore[], reasoning: string): Promise<void> => {
        try {
            await castBallot.mutateAsync({
                roundId: round.id,
                body: { scores: [...scores], reasoning },
            });
            toast({ title: submitted ? "Ballot updated" : "Ballot submitted", tone: "success" });
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
                {ballot.isPending ? (
                    <LoadingBlock rows={2} label="Loading ballot" />
                ) : ballot.isError ? (
                    <RequestError error={ballot.error} onRetry={() => void ballot.refetch()} />
                ) : submissions.isPending ? (
                    <LoadingBlock rows={3} label="Loading submissions" />
                ) : submissions.isError ? (
                    <RequestError
                        error={submissions.error}
                        onRetry={() => void submissions.refetch()}
                    />
                ) : submissionItems.length === 0 ? (
                    <EmptyState
                        title="No eligible projects"
                        description="Your ballot lists submitted projects from your division, excluding your own team. It stays empty while no other team has a votable submission."
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-ink-muted">
                            Your ballot lists submitted projects from your own division, excluding
                            your own team. Distribute exactly 10 stars with at most 5 stars per
                            project.
                        </p>
                        <StarEditor
                            key={submittedBallot?.submittedAt ?? "new"}
                            round={round}
                            submissions={submissionItems}
                            initialScores={scoresFromBallot(ballot.data)}
                            initialReasoning={ballot.data?.reasoning ?? ""}
                            submittedAt={submittedBallot?.submittedAt ?? null}
                            isSubmitting={castBallot.isPending}
                            onCast={onCast}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StarEditor({
    round,
    submissions,
    initialScores,
    initialReasoning,
    submittedAt,
    isSubmitting,
    onCast,
}: {
    readonly round: VotingRound;
    readonly submissions: readonly VotableSubmission[];
    readonly initialScores: Record<string, number>;
    readonly initialReasoning: string;
    readonly submittedAt: string | null;
    readonly isSubmitting: boolean;
    readonly onCast: (scores: readonly BallotScore[], reasoning: string) => Promise<void>;
}): ReactNode {
    const [scores, setScores] = useState<Record<string, number>>(() => {
        const visible: Record<string, number> = {};
        for (const submission of submissions) {
            const stars = initialScores[submission.id];
            if (stars !== undefined) {
                visible[submission.id] = stars;
            }
        }
        return visible;
    });
    const [reasoning, setReasoning] = useState(initialReasoning);

    const projectCap =
        round.maxVotesPerUser > 0
            ? Math.min(round.maxSelections, round.maxVotesPerUser)
            : round.maxSelections;
    const totalStars = Object.values(scores).reduce((sum, stars) => sum + stars, 0);
    const remainingStars = BALLOT_TOTAL_STARS - totalStars;
    const scoredCount = Object.values(scores).filter((stars) => stars > 0).length;
    const atScoredLimit = scoredCount >= projectCap;
    const capBlocksFullBallot = projectCap * BALLOT_MAX_STARS_PER_SUBMISSION < BALLOT_TOTAL_STARS;
    const canSubmit = totalStars === BALLOT_TOTAL_STARS && !capBlocksFullBallot && !isSubmitting;

    const changeStars = (submissionId: string, delta: number): void => {
        setScores((current) => {
            const stars = current[submissionId] ?? 0;
            const next = stars + delta;
            if (next < 0 || next > BALLOT_MAX_STARS_PER_SUBMISSION) {
                return current;
            }
            const currentTotal = Object.values(current).reduce((sum, value) => sum + value, 0);
            if (delta > 0 && currentTotal >= BALLOT_TOTAL_STARS) {
                return current;
            }
            const currentScored = Object.values(current).filter((value) => value > 0).length;
            if (delta > 0 && stars === 0 && currentScored >= projectCap) {
                return current;
            }
            return { ...current, [submissionId]: next };
        });
    };

    const submit = async (): Promise<void> => {
        const payload = submissions
            .map((submission) => ({
                submissionId: submission.id,
                stars: scores[submission.id] ?? 0,
            }))
            .filter((score) => score.stars > 0);
        await onCast(payload, reasoning.trim());
    };

    return (
        <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-xs text-ink-muted sm:grid-cols-4">
                <div className="flex flex-col gap-0.5">
                    <dt className="text-ink-subtle">Stars to distribute</dt>
                    <dd className="tabular-nums text-ink">{String(BALLOT_TOTAL_STARS)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-ink-subtle">Remaining</dt>
                    <dd className="tabular-nums text-ink">{String(remainingStars)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-ink-subtle">Max stars per project</dt>
                    <dd className="tabular-nums text-ink">
                        {String(BALLOT_MAX_STARS_PER_SUBMISSION)}
                    </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-ink-subtle">Projects you may score</dt>
                    <dd className="tabular-nums text-ink">{String(projectCap)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                    <dt className="text-ink-subtle">Closes</dt>
                    <dd className="text-ink">{formatDateTime(round.closesAt)}</dd>
                </div>
            </dl>

            {capBlocksFullBallot ? (
                <p className="text-sm text-ink-muted">
                    This round allows scoring {String(projectCap)}{" "}
                    {projectCap === 1 ? "project" : "projects"}, which cannot reach{" "}
                    {String(BALLOT_TOTAL_STARS)} stars. Ask an organizer to raise the limit.
                </p>
            ) : null}

            {submittedAt === null ? null : (
                <p className="text-sm text-ink">
                    You submitted a ballot {formatDateTime(submittedAt)}. You can update it until
                    the round closes.
                </p>
            )}

            <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium text-ink">
                    Assign stars to each project
                </legend>
                <ul className="flex flex-col gap-3">
                    {submissions.map((submission) => {
                        const stars = scores[submission.id] ?? 0;
                        const videoUrl = safeExternalUrl(submission.videoUrl);
                        const repositoryUrl = safeExternalUrl(submission.repositoryUrl);
                        const demoUrl = safeExternalUrl(submission.demoUrl);
                        const canAdd =
                            !isSubmitting &&
                            !capBlocksFullBallot &&
                            stars < BALLOT_MAX_STARS_PER_SUBMISSION &&
                            remainingStars > 0 &&
                            (stars > 0 || !atScoredLimit);
                        return (
                            <li
                                key={submission.id}
                                className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0"
                            >
                                <div className="flex min-w-0 flex-col gap-2">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm text-ink">
                                            {submission.projectTitle}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                            <span>{submission.teamName ?? "No team"}</span>
                                            {submission.divisionName === null ? null : (
                                                <Badge tone="outline">
                                                    {submission.divisionName}
                                                </Badge>
                                            )}
                                        </div>
                                        {submission.summary.length === 0 ? null : (
                                            <p className="mt-1 max-w-prose text-xs text-ink-muted">
                                                {submission.summary}
                                            </p>
                                        )}
                                    </div>
                                    {repositoryUrl === null && demoUrl === null ? null : (
                                        <div className="flex flex-wrap gap-3 text-xs">
                                            {repositoryUrl === null ? null : (
                                                <a
                                                    href={repositoryUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary underline-offset-4 hover:underline"
                                                >
                                                    Repository
                                                </a>
                                            )}
                                            {demoUrl === null ? null : (
                                                <a
                                                    href={demoUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary underline-offset-4 hover:underline"
                                                >
                                                    Live demo
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {videoUrl === null ? null : (
                                        <a
                                            href={videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary underline-offset-4 hover:underline"
                                        >
                                            Watch demonstration video
                                        </a>
                                    )}
                                    <div className="flex max-w-prose flex-col gap-0.5">
                                        <span className="text-xs font-medium text-ink">
                                            AI-use disclosure
                                        </span>
                                        <p className="whitespace-pre-wrap text-xs text-ink-muted">
                                            {submission.aiDisclosure.trim().length === 0
                                                ? "No AI-use disclosure was recorded."
                                                : submission.aiDisclosure}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label={`Remove a star from ${submission.projectTitle}`}
                                        disabled={isSubmitting || stars === 0}
                                        onClick={() => changeStars(submission.id, -1)}
                                    >
                                        -
                                    </Button>
                                    <span className="min-w-20 text-center text-sm tabular-nums text-ink">
                                        {String(stars)} of {String(BALLOT_MAX_STARS_PER_SUBMISSION)}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label={`Add a star to ${submission.projectTitle}`}
                                        disabled={!canAdd}
                                        onClick={() => changeStars(submission.id, 1)}
                                    >
                                        +
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </fieldset>

            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor={`ballot-reasoning-${round.id}`}
                    className="text-sm font-medium text-ink"
                >
                    Reasoning
                </label>
                <Textarea
                    id={`ballot-reasoning-${round.id}`}
                    value={reasoning}
                    maxLength={BALLOT_REASONING_MAX_LENGTH}
                    placeholder="Explain how you ranked these projects. Visible to organizers only."
                    onChange={(event) => setReasoning(event.target.value)}
                    disabled={isSubmitting}
                />
                <span className="text-xs text-ink-muted">
                    {`Optional, up to ${String(BALLOT_REASONING_MAX_LENGTH)} characters. Organizers see it with your scores during results review.`}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <Button
                    type="button"
                    loading={isSubmitting}
                    disabled={!canSubmit}
                    onClick={() => void submit()}
                >
                    {submittedAt === null ? "Cast ballot" : "Update ballot"}
                </Button>
                <span className="text-xs text-ink-muted">
                    {String(totalStars)} of {String(BALLOT_TOTAL_STARS)} stars assigned across{" "}
                    {String(scoredCount)} of {String(projectCap)} projects
                </span>
            </div>
            {remainingStars > 0 ? (
                <p className="text-xs text-ink-muted">
                    Assign {String(remainingStars)} more {remainingStars === 1 ? "star" : "stars"}{" "}
                    to submit this ballot.
                </p>
            ) : null}
        </div>
    );
}

function scoresFromBallot(ballot: Ballot | null | undefined): Record<string, number> {
    if (ballot === null || ballot === undefined) {
        return {};
    }
    const scores: Record<string, number> = {};
    for (const score of ballot.scores) {
        scores[score.submissionId] = score.stars;
    }
    return scores;
}
