import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BookOpen, Database, Download, FileSearch, MessagesSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AuditLog, GlobalAdministrator } from "@nethack/contracts";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Form,
    FormField,
    Input,
    KeyValue,
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
import { useSession, useActiveMembership } from "../application/session.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { describeError } from "../capabilities/shared/errors.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import {
    downloadDatabaseExport,
    useAdministrationAudit,
    useGlobalAdministrators,
    useGrantAdministrator,
    useRevokeAdministrator,
} from "../capabilities/administration/hooks.js";
import {
    auditSchema,
    describeAuditMetadata,
    grantSchema,
    revokeSchema,
    type AuditForm,
    type GrantForm,
    type RevokeForm,
} from "../capabilities/administration/index.js";

export function AdminPage(): ReactNode {
    const session = useSession();
    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading administration" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    return <AdminContent globalAdministrator={session.data.globalAdministrator} />;
}

function AdminContent({
    globalAdministrator,
}: {
    readonly globalAdministrator: boolean;
}): ReactNode {
    const { toast } = useToast();
    const { membership } = useActiveMembership();
    const canManageOrganization = membership?.role === "owner" || membership?.role === "organizer";
    const administrators = useGlobalAdministrators(globalAdministrator);
    const grantAdministrator = useGrantAdministrator();
    const revokeAdministrator = useRevokeAdministrator();

    const [pendingRevoke, setPendingRevoke] = useState<GlobalAdministrator | null>(null);
    const [appliedAudit, setAppliedAudit] = useState<{
        organizationId: string;
        action: string;
        entityType: string;
        actorUserId: string;
    } | null>(null);
    const [cursorStack, setCursorStack] = useState<readonly string[]>([]);
    const currentCursor = cursorStack[cursorStack.length - 1];

    const audit = useAdministrationAudit(
        appliedAudit?.organizationId ?? null,
        {
            limit: 20,
            ...(appliedAudit === null || appliedAudit.action.length === 0
                ? {}
                : { action: appliedAudit.action }),
            ...(appliedAudit === null || appliedAudit.entityType.length === 0
                ? {}
                : { entityType: appliedAudit.entityType }),
            ...(appliedAudit === null || appliedAudit.actorUserId.length === 0
                ? {}
                : { actorUserId: appliedAudit.actorUserId }),
            ...(currentCursor === undefined ? {} : { cursor: currentCursor }),
        },
        globalAdministrator,
    );

    const grantForm = useForm<GrantForm>({
        resolver: zodResolver(grantSchema),
        defaultValues: { email: "", reason: "" },
    });
    const revokeForm = useForm<RevokeForm>({
        resolver: zodResolver(revokeSchema),
        defaultValues: { reason: "" },
    });
    const auditForm = useForm<AuditForm>({
        resolver: zodResolver(auditSchema),
        defaultValues: { organizationId: "", action: "", entityType: "", actorUserId: "" },
    });

    if (!globalAdministrator) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Administration"
                    description="Organization administration and platform-wide controls."
                />
                {canManageOrganization ? (
                    <AdministrationHub />
                ) : (
                    <Alert tone="warning" title="Administration access required">
                        Organization administration requires an owner or organizer role. Platform
                        administration requires a global administrator grant.
                    </Alert>
                )}
                <Alert tone="neutral" title="Platform controls">
                    Global administrator grants and cross-organization audit history are limited to
                    global administrators.
                </Alert>
            </div>
        );
    }

    const administratorItems = administrators.data?.items ?? [];
    const auditItems = audit.data?.items ?? [];
    const auditReady = appliedAudit !== null;

    const onGrant = grantForm.handleSubmit(async (values) => {
        try {
            await grantAdministrator.mutateAsync({
                email: values.email,
                reason: values.reason,
            });
            grantForm.reset({ email: "", reason: "" });
            toast({ title: "Global administrator granted", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not grant administrator access",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onRevoke = revokeForm.handleSubmit(async (values) => {
        if (pendingRevoke === null) {
            return;
        }
        try {
            await revokeAdministrator.mutateAsync({
                userId: pendingRevoke.userId,
                body: { reason: values.reason },
            });
            setPendingRevoke(null);
            revokeForm.reset({ reason: "" });
            toast({ title: "Global administrator revoked", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not revoke administrator access",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onApplyAudit = auditForm.handleSubmit((values) => {
        setCursorStack([]);
        setAppliedAudit({
            organizationId: values.organizationId,
            action: values.action.trim(),
            entityType: values.entityType.trim(),
            actorUserId: values.actorUserId.trim(),
        });
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Administration"
                description="Global administrators, organization operations, and cross-organization audit history."
                actions={<Badge tone="outline">Global administrator</Badge>}
            />

            {canManageOrganization ? <AdministrationHub /> : null}

            <section className="flex flex-col gap-4" aria-labelledby="administrators-heading">
                <div className="flex flex-col gap-1">
                    <h2 id="administrators-heading" className="text-lg font-bold tracking-tight">
                        Global administrators
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Global administrators can read audit history across organizations and manage
                        this list.
                    </p>
                </div>

                {administrators.isPending ? (
                    <LoadingBlock rows={4} label="Loading global administrators" />
                ) : administrators.isError ? (
                    <RequestError
                        error={administrators.error}
                        onRetry={() => void administrators.refetch()}
                    />
                ) : administratorItems.length === 0 ? (
                    <EmptyState
                        title="No global administrators"
                        description="Grant access to an existing account using the form below."
                    />
                ) : (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Granted</TableHead>
                                    <TableHead>Granted by</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {administratorItems.map((administrator) => (
                                    <TableRow key={administrator.userId}>
                                        <TableCell>
                                            <span className="font-medium">
                                                {administrator.displayName}
                                            </span>
                                            <span className="block text-xs text-ink-subtle">
                                                {administrator.email ?? "No email address"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-ink-muted">
                                            {formatDateTime(administrator.grantedAt)}
                                        </TableCell>
                                        <TableCell className="text-ink-muted">
                                            {administrator.grantedByUserId ?? "System"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setPendingRevoke(administrator)}
                                            >
                                                Revoke
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle>Grant global administrator</CardTitle>
                        <CardDescription>
                            The account must already exist. A reason is stored in the audit log.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form form={grantForm} onSubmit={onGrant}>
                            <div className="flex flex-col gap-4">
                                <FormField name="email" label="Email address" required>
                                    {(field) => (
                                        <Input
                                            {...field}
                                            type="email"
                                            value={field.value}
                                            autoComplete="email"
                                            placeholder="person@example.com"
                                        />
                                    )}
                                </FormField>
                                <FormField name="reason" label="Reason" required>
                                    {(field) => (
                                        <Textarea
                                            {...field}
                                            value={field.value}
                                            placeholder="Why this account needs global access."
                                        />
                                    )}
                                </FormField>
                                <Button type="submit" loading={grantAdministrator.isPending}>
                                    Grant access
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </Card>
            </section>

            <section
                className="flex flex-col gap-4 border-t border-line pt-6"
                aria-labelledby="audit-heading"
            >
                <div className="flex flex-col gap-1">
                    <h2 id="audit-heading" className="text-lg font-bold tracking-tight">
                        Cross-organization audit
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Enter an organization identifier to read its audit history as a global
                        administrator.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Audit filters</CardTitle>
                        <CardDescription>
                            The organization identifier is required. Filters are optional.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form form={auditForm} onSubmit={onApplyAudit}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    name="organizationId"
                                    label="Organization identifier"
                                    required
                                >
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={field.value}
                                            placeholder="00000000-0000-4000-8000-000000000000"
                                        />
                                    )}
                                </FormField>
                                <FormField
                                    name="actorUserId"
                                    label="Actor user identifier"
                                    optionalLabel="optional"
                                >
                                    {(field) => <Input {...field} value={field.value} />}
                                </FormField>
                                <FormField name="action" label="Action" optionalLabel="optional">
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={field.value}
                                            placeholder="member.added"
                                        />
                                    )}
                                </FormField>
                                <FormField
                                    name="entityType"
                                    label="Entity type"
                                    optionalLabel="optional"
                                >
                                    {(field) => (
                                        <Input
                                            {...field}
                                            value={field.value}
                                            placeholder="organization_membership"
                                        />
                                    )}
                                </FormField>
                            </div>
                            <div className="mt-4">
                                <Button type="submit" variant="outline">
                                    Apply filters
                                </Button>
                            </div>
                        </Form>
                    </CardContent>
                </Card>

                {!auditReady ? (
                    <EmptyState
                        title="No organization selected"
                        description="Enter an organization identifier and apply filters to read audit history."
                    />
                ) : audit.isPending ? (
                    <LoadingBlock rows={5} label="Loading audit history" />
                ) : audit.isError ? (
                    <RequestError error={audit.error} onRetry={() => void audit.refetch()} />
                ) : auditItems.length === 0 ? (
                    <EmptyState
                        title="No audit events"
                        description="This organization has no audit events matching the filters."
                    />
                ) : (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Organization</TableHead>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {auditItems.map((entry: AuditLog) => (
                                    <Fragment key={entry.id}>
                                        <TableRow>
                                            <TableCell className="whitespace-nowrap text-ink-muted">
                                                {formatDateTime(entry.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-ink-muted">
                                                {entry.organizationId ?? "Global"}
                                            </TableCell>
                                            <TableCell>
                                                {entry.actorDisplayName ?? "System"}
                                            </TableCell>
                                            <TableCell>{entry.action}</TableCell>
                                            <TableCell className="text-ink-muted">
                                                {entry.entityType}
                                                {entry.entityId === null ? null : (
                                                    <span className="block text-xs text-ink-subtle">
                                                        {entry.entityId}
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={5} className="bg-raised/40">
                                                <AuditMetadataDetail metadata={entry.metadata} />
                                            </TableCell>
                                        </TableRow>
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="flex items-center justify-between gap-3 border-t border-line p-4">
                            <PaginationControls
                                canPrevious={cursorStack.length > 0}
                                canNext={audit.data?.nextCursor !== null}
                                onPrevious={() => setCursorStack(cursorStack.slice(0, -1))}
                                onNext={() => {
                                    const next = audit.data?.nextCursor;
                                    if (next !== null && next !== undefined) {
                                        setCursorStack([...cursorStack, next]);
                                    }
                                }}
                            />
                        </div>
                    </Card>
                )}
            </section>

            <OperatorTools />

            <Dialog
                open={pendingRevoke !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingRevoke(null);
                        revokeForm.reset({ reason: "" });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke global administrator</DialogTitle>
                        <DialogDescription>
                            Remove global administrator access from{" "}
                            {pendingRevoke?.displayName ?? "this account"}? A reason is stored in
                            the audit log.
                        </DialogDescription>
                    </DialogHeader>
                    <Form form={revokeForm} onSubmit={onRevoke}>
                        <div className="flex flex-col gap-4">
                            <FormField name="reason" label="Reason" required>
                                {(field) => (
                                    <Textarea
                                        {...field}
                                        value={field.value}
                                        placeholder="Why this access is removed."
                                    />
                                )}
                            </FormField>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPendingRevoke(null)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" loading={revokeAdministrator.isPending}>
                                    Revoke access
                                </Button>
                            </DialogFooter>
                        </div>
                    </Form>
                </DialogContent>
            </Dialog>

            {pendingRevoke === null ? null : (
                <p className="sr-only" aria-live="polite">
                    Revocation dialog open for {pendingRevoke.displayName}.
                </p>
            )}

            {auditReady ? (
                <Card className="max-w-xl">
                    <CardHeader>
                        <CardTitle>Applied audit scope</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <KeyValue
                            columns={1}
                            items={[
                                {
                                    label: "Organization",
                                    value: appliedAudit?.organizationId ?? "",
                                },
                                {
                                    label: "Action",
                                    value:
                                        appliedAudit?.action === undefined ||
                                        appliedAudit.action.length === 0
                                            ? "Any"
                                            : appliedAudit.action,
                                },
                                {
                                    label: "Entity type",
                                    value:
                                        appliedAudit?.entityType === undefined ||
                                        appliedAudit.entityType.length === 0
                                            ? "Any"
                                            : appliedAudit.entityType,
                                },
                                {
                                    label: "Actor",
                                    value:
                                        appliedAudit?.actorUserId === undefined ||
                                        appliedAudit.actorUserId.length === 0
                                            ? "Any"
                                            : appliedAudit.actorUserId,
                                },
                            ]}
                        />
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}

const EXPORT_OMISSIONS = [
    "Judge identities and per-judge evaluation records; only per-submission judging aggregates are exported.",
    "Invitation tokens, session token hashes, CSRF hashes, and encrypted OAuth tokens.",
    "Stored file contents and storage keys.",
    "Notification recipients, bodies, and deduplication keys.",
] as const;

function AuditMetadataDetail({
    metadata,
}: {
    readonly metadata: Record<string, unknown>;
}): ReactNode {
    const detail = describeAuditMetadata(metadata);
    const empty =
        detail.reason === null && detail.changes.length === 0 && detail.fields.length === 0;
    return (
        <div className="flex flex-col gap-2 text-xs">
            {detail.reason === null ? null : (
                <p className="text-ink">
                    <span className="font-medium">Reason:</span> {detail.reason}
                </p>
            )}
            {detail.changes.length === 0 ? null : (
                <ul className="flex flex-col gap-1">
                    {detail.changes.map((change) => (
                        <li
                            key={change.field}
                            className="grid gap-1 sm:grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)]"
                        >
                            <span className="font-medium text-ink-muted">{change.field}</span>
                            <span className="break-words text-ink">
                                <span className="text-ink-subtle line-through">
                                    {change.before}
                                </span>
                                <span className="mx-2 text-ink-subtle" aria-hidden="true">
                                    to
                                </span>
                                <span>{change.after}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {detail.fields.length === 0 ? null : (
                <dl className="grid gap-1 sm:grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)]">
                    {detail.fields.map((field) => (
                        <Fragment key={field.label}>
                            <dt className="font-medium text-ink-muted">{field.label}</dt>
                            <dd className="break-words text-ink">{field.value}</dd>
                        </Fragment>
                    ))}
                </dl>
            )}
            {empty ? <p className="text-ink-subtle">No metadata recorded.</p> : null}
            <details className="text-ink-muted">
                <summary className="cursor-pointer select-none">Raw metadata</summary>
                <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-app p-2 text-[11px] leading-relaxed">
                    {detail.raw}
                </pre>
            </details>
        </div>
    );
}

function OperatorTools(): ReactNode {
    const { toast } = useToast();
    const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

    const onExport = async (format: "json" | "csv"): Promise<void> => {
        if (exporting !== null) {
            return;
        }
        setExporting(format);
        try {
            await downloadDatabaseExport(format);
            toast({
                title: format === "csv" ? "CSV export downloaded" : "Database export downloaded",
                tone: "success",
            });
        } catch (error) {
            toast({
                title: "Could not download the database export",
                description: describeError(error),
                tone: "critical",
            });
        } finally {
            setExporting(null);
        }
    };

    return (
        <section
            className="flex flex-col gap-4 border-t border-line pt-6"
            aria-labelledby="operator-tools-heading"
        >
            <div className="flex flex-col gap-1">
                <h2 id="operator-tools-heading" className="text-lg font-bold tracking-tight">
                    Operator tools
                </h2>
                <p className="text-sm text-ink-muted">
                    Global administrator downloads and read-only developer tools.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="size-4 text-primary" aria-hidden="true" />
                            Database export
                        </CardTitle>
                        <CardDescription>
                            A repeatable-read archive of platform records, streamed as a JSON or CSV
                            attachment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <ul className="flex flex-col gap-1.5 text-xs text-ink-muted">
                            {EXPORT_OMISSIONS.map((item) => (
                                <li key={item} className="flex gap-2">
                                    <span aria-hidden="true" className="text-primary">
                                        -
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        <Button
                            type="button"
                            variant="outline"
                            loading={exporting === "json"}
                            disabled={exporting !== null && exporting !== "json"}
                            onClick={() => void onExport("json")}
                            className="self-start"
                        >
                            <Download className="size-4" aria-hidden="true" />
                            Download database export
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            loading={exporting === "csv"}
                            disabled={exporting !== null && exporting !== "csv"}
                            onClick={() => void onExport("csv")}
                            className="self-start"
                        >
                            <Download className="size-4" aria-hidden="true" />
                            Download CSV export
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Developer tools</CardTitle>
                        <CardDescription>
                            Inspect stored file metadata, review active references, and use the
                            operator AI assistant when it is configured.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="flex flex-col gap-2">
                            <li>
                                <Link
                                    to="/developers/debug"
                                    className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                >
                                    <FileSearch
                                        className="size-4 text-primary"
                                        aria-hidden="true"
                                    />
                                    Files and references
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/developers/docs"
                                    className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                >
                                    <BookOpen className="size-4 text-primary" aria-hidden="true" />
                                    Engineering documentation
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/developers/debug#ai-assistant"
                                    className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                >
                                    <MessagesSquare
                                        className="size-4 text-primary"
                                        aria-hidden="true"
                                    />
                                    Operator AI assistant
                                </Link>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}

const ADMINISTRATION_LINKS = [
    {
        to: "/admin/users",
        title: "Users",
        description: "Member roles, judge flags, and global administrator grants.",
    },
    {
        to: "/admin/teams",
        title: "Teams",
        description: "Team status, membership, deletion, and submission reopening.",
    },
    {
        to: "/admin/standings",
        title: "Standings",
        description: "Preflight counts and the standings CSV export.",
    },
    {
        to: "/awards",
        title: "Awards",
        description: "Award catalog, team assignments, and results publication.",
    },
] as const;

function AdministrationHub(): ReactNode {
    return (
        <section className="flex flex-col gap-3" aria-labelledby="administration-hub-heading">
            <div className="flex flex-col gap-1">
                <h2 id="administration-hub-heading" className="text-lg font-bold tracking-tight">
                    Organization operations
                </h2>
                <p className="text-sm text-ink-muted">
                    Organizer tools for the active organization.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {ADMINISTRATION_LINKS.map((link) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className="rounded-lg border border-line bg-panel p-4 transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    >
                        <span className="block text-sm font-semibold text-ink">{link.title}</span>
                        <span className="mt-1 block text-xs text-ink-muted">
                            {link.description}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
