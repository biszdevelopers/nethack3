import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { DebugAiSession, StoredFileMetadata } from "@nethack/contracts";
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
    LoadingBlock,
    PageHeader,
    PaginationControls,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    useToast,
} from "@nethack/ui";
import { BookOpen, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useSession } from "../application/session.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { describeError } from "../capabilities/shared/errors.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import {
    useAdministrationDebugFiles,
    useCreateDebugAiSession,
    useDebugAiSession,
    useDebugAiSessions,
    useDebugAiStatus,
    useDeleteDebugAiSession,
    useSendDebugAiMessage,
} from "../capabilities/administration/hooks.js";
import {
    createDebugAiSessionSchema,
    sendDebugAiMessageSchema,
    type CreateDebugAiSessionForm,
    type SendDebugAiMessageForm,
} from "../capabilities/administration/forms.js";

const PAGE_SIZE = 25;

export function DevelopersDebugPage(): ReactNode {
    const session = useSession();
    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading developer tools" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    const isGlobalAdministrator = session.data.globalAdministrator;
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Developer tools"
                description="Read-only file metadata, active references, and the operator AI assistant."
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link to="/developers/docs">
                            <BookOpen className="size-4" aria-hidden="true" />
                            Documentation
                        </Link>
                    </Button>
                }
            />
            {isGlobalAdministrator ? (
                <>
                    <FileBrowser
                        kind="files"
                        title="Stored files"
                        description="Metadata for uploaded files across organizations. Contents and storage locations are not exposed."
                    />
                    <FileBrowser
                        kind="references"
                        title="Active references"
                        description="Files currently linked to a submission or submission version."
                    />
                    <AiAssistant />
                </>
            ) : (
                <Alert tone="warning" title="Global administrator access required">
                    Developer tools are limited to global administrators.
                </Alert>
            )}
        </div>
    );
}

function FileBrowser({
    kind,
    title,
    description,
}: {
    readonly kind: "files" | "references";
    readonly title: string;
    readonly description: string;
}): ReactNode {
    const [offset, setOffset] = useState(0);
    const query = useAdministrationDebugFiles(kind, offset, true);
    const items = query.data?.items ?? [];
    const total = query.data?.total ?? 0;

    return (
        <section className="flex flex-col gap-4" aria-labelledby={`${kind}-heading`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 id={`${kind}-heading`} className="text-lg font-bold tracking-tight">
                        {title}
                    </h2>
                    <p className="text-sm text-ink-muted">{description}</p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void query.refetch()}
                    aria-label={`Refresh ${title.toLowerCase()}`}
                >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Refresh
                </Button>
            </div>

            {query.isPending ? (
                <LoadingBlock rows={4} label={`Loading ${title.toLowerCase()}`} />
            ) : query.isError ? (
                <RequestError error={query.error} onRetry={() => void query.refetch()} />
            ) : items.length === 0 ? (
                <EmptyState
                    title={`No ${title.toLowerCase()}`}
                    description={
                        kind === "references"
                            ? "No file is linked to a submission yet."
                            : "No stored file metadata is available."
                    }
                />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead>Organization</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Linkage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((file: StoredFileMetadata) => (
                                <TableRow key={file.id}>
                                    <TableCell>
                                        <span className="font-medium">{file.fileName}</span>
                                        <span className="block text-xs text-ink-subtle">
                                            {file.contentType}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-ink-muted">
                                        {file.organizationId}
                                    </TableCell>
                                    <TableCell className="tabular-nums text-ink-muted">
                                        {formatBytes(file.byteSize)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                file.status === "approved" ? "soft" : "outline"
                                            }
                                            color={
                                                file.status === "approved" ? "primary" : "neutral"
                                            }
                                        >
                                            {file.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-ink-muted">
                                        {file.submissionId === null
                                            ? "Project only"
                                            : `Submission ${file.submissionId.slice(0, 8)}`}
                                        {file.versionId === null ? null : (
                                            <span className="block text-ink-subtle">
                                                Version {file.versionId.slice(0, 8)}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
                        <span className="text-xs text-ink-subtle">
                            {String(items.length)} shown of {String(total)}
                        </span>
                        <PaginationControls
                            canPrevious={offset > 0}
                            canNext={offset + items.length < total}
                            onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                            onNext={() => setOffset(offset + PAGE_SIZE)}
                        />
                    </div>
                </Card>
            )}
        </section>
    );
}

function AiAssistant(): ReactNode {
    const { toast } = useToast();
    const status = useDebugAiStatus(true);
    const sessions = useDebugAiSessions(true);
    const createSession = useCreateDebugAiSession();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const detail = useDebugAiSession(selectedId);
    const deleteSession = useDeleteDebugAiSession();
    const sendMessage = useSendDebugAiMessage(selectedId);

    const createForm = useForm<CreateDebugAiSessionForm>({
        resolver: zodResolver(createDebugAiSessionSchema),
        defaultValues: { name: "" },
    });
    const messageForm = useForm<SendDebugAiMessageForm>({
        resolver: zodResolver(sendDebugAiMessageSchema),
        defaultValues: { content: "" },
    });

    const configured = status.data?.configured === true;
    const sessionItems = sessions.data?.items ?? [];

    const onCreate = createForm.handleSubmit(async (values) => {
        try {
            const created = await createSession.mutateAsync({ name: values.name });
            createForm.reset({ name: "" });
            setSelectedId(created.id);
            toast({ title: "AI session created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the AI session",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onDelete = async (session: DebugAiSession): Promise<void> => {
        try {
            await deleteSession.mutateAsync(session.id);
            if (selectedId === session.id) {
                setSelectedId(null);
            }
            toast({ title: "AI session deleted", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not delete the AI session",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onSend = messageForm.handleSubmit(async (values) => {
        if (selectedId === null) {
            return;
        }
        try {
            await sendMessage.mutateAsync(values.content);
            messageForm.reset({ content: "" });
        } catch (error) {
            toast({
                title: "The assistant did not answer",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    return (
        <section
            id="ai-assistant"
            className="flex flex-col gap-4 border-t border-line pt-6"
            aria-labelledby="ai-heading"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 id="ai-heading" className="text-lg font-bold tracking-tight">
                        Operator AI assistant
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Sessions are stored per operator. The assistant uses the server-managed
                        OpenAI-compatible endpoint; a request can never choose a URL.
                    </p>
                </div>
                {status.data?.configured === true ? (
                    <Badge variant="soft" color="primary">
                        Configured
                    </Badge>
                ) : status.data?.configured === false ? (
                    <Badge tone="outline">Not configured</Badge>
                ) : null}
            </div>

            {status.isPending ? (
                <LoadingBlock rows={2} label="Loading AI assistant status" />
            ) : status.isError ? (
                <RequestError error={status.error} onRetry={() => void status.refetch()} />
            ) : configured ? (
                <Alert tone="neutral" title="Assistant configured">
                    Model: {status.data?.model ?? "configured model"}. Replies are generated by the
                    configured provider and stored with this session.
                </Alert>
            ) : (
                <Alert tone="warning" title="AI assistant is not configured">
                    The API runtime has no OPENAI_API_KEY. Operator chat is disabled and will not
                    produce a fabricated reply. Set OPENAI_API_KEY, and optionally OPENAI_BASE_URL
                    and OPENAI_MODEL, on the API process to enable it.
                </Alert>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                <Card>
                    <CardHeader>
                        <CardTitle>New session</CardTitle>
                        <CardDescription>
                            Name a topic to keep operator notes separated.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form form={createForm} onSubmit={onCreate}>
                            <div className="flex flex-col gap-3">
                                <FormField name="name" label="Session name" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={field.value}
                                            placeholder="Release readiness"
                                            maxLength={100}
                                        />
                                    )}
                                </FormField>
                                <Button
                                    type="submit"
                                    loading={createSession.isPending}
                                    disabled={!configured}
                                >
                                    Create session
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sessions</CardTitle>
                        <CardDescription>Select a session to read or continue it.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {sessions.isPending ? (
                            <LoadingBlock rows={3} label="Loading AI sessions" />
                        ) : sessions.isError ? (
                            <RequestError
                                error={sessions.error}
                                onRetry={() => void sessions.refetch()}
                            />
                        ) : sessionItems.length === 0 ? (
                            <EmptyState
                                title="No AI sessions"
                                description="Create a session to start an operator conversation."
                            />
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {sessionItems.map((item: DebugAiSession) => (
                                    <li
                                        key={item.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3"
                                    >
                                        <button
                                            type="button"
                                            className="min-h-9 min-w-0 flex-1 text-left"
                                            onClick={() => setSelectedId(item.id)}
                                            aria-pressed={selectedId === item.id}
                                        >
                                            <span className="block truncate text-sm font-medium">
                                                {item.name}
                                            </span>
                                            <span className="block text-xs text-ink-subtle">
                                                {String(item.messageCount)} messages, updated{" "}
                                                {formatDateTime(item.updatedAt)}
                                            </span>
                                        </button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            aria-label={`Delete ${item.name}`}
                                            loading={
                                                deleteSession.isPending &&
                                                deleteSession.variables === item.id
                                            }
                                            onClick={() => void onDelete(item)}
                                        >
                                            <Trash2 className="size-4" aria-hidden="true" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            {selectedId === null ? null : detail.isPending ? (
                <LoadingBlock rows={4} label="Loading conversation" />
            ) : detail.isError ? (
                <RequestError error={detail.error} onRetry={() => void detail.refetch()} />
            ) : detail.data === undefined || detail.data === null ? null : (
                <Card>
                    <CardHeader>
                        <CardTitle>{detail.data.name}</CardTitle>
                        <CardDescription>
                            {String(detail.data.messages.length)} messages in this session.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {detail.data.messages.length === 0 ? (
                            <p className="text-sm text-ink-muted">
                                No messages yet. Ask about a release check, an incident, or a
                                configuration question.
                            </p>
                        ) : (
                            <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
                                {detail.data.messages.map((message) => (
                                    <li
                                        key={message.id}
                                        className="rounded-md border border-line p-3"
                                    >
                                        <p className="mb-1 text-xs text-ink-subtle">
                                            {message.role === "user" ? "Operator" : "Assistant"} -{" "}
                                            {formatDateTime(message.createdAt)}
                                        </p>
                                        <p className="whitespace-pre-wrap text-sm leading-6">
                                            {message.content}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <Form form={messageForm} onSubmit={onSend}>
                            <div className="flex flex-col gap-3">
                                <FormField name="content" label="Message" required>
                                    {(field) => (
                                        <Textarea
                                            {...field}
                                            value={field.value}
                                            placeholder="What should we verify before publishing results?"
                                            maxLength={4000}
                                        />
                                    )}
                                </FormField>
                                <Button
                                    type="submit"
                                    loading={sendMessage.isPending}
                                    disabled={!configured}
                                    className="self-start"
                                >
                                    Send message
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </Card>
            )}

            {configured ? null : (
                <p className="flex items-center gap-2 text-xs text-ink-subtle">
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                    Message sending is disabled until the API runtime is configured.
                </p>
            )}
        </section>
    );
}

function formatBytes(value: number): string {
    if (value < 1024) {
        return `${String(value)} B`;
    }
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export const DeveloperDebugPage = DevelopersDebugPage;
