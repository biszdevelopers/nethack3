import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    organizationRoleSchema,
    membershipStatusSchema,
    type OrganizationMembership,
    type OrganizationRole,
} from "@nethack/contracts";
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
    EmptyState,
    Form,
    FormField,
    Input,
    LoadingBlock,
    PageHeader,
    PaginationControls,
    Select,
    Statistics,
    Switch,
    TabPanel,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    UserDisplay,
    inputVariants,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { AnnouncementsPanel } from "../capabilities/announcements/components/announcements-panel.js";
import { useOrganizerEditions } from "../capabilities/competitions/hooks.js";
import {
    useAddMember,
    useOrganizationAudit,
    useOrganizationInvitations,
    useOrganizationMembers,
    useOrganizationReports,
    useOrganizationSettings,
    useRemoveMember,
    useUpdateMember,
    useUpdateSettings,
} from "../capabilities/organizations/hooks.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { describeError } from "../capabilities/shared/errors.js";
import { humanizeToken } from "../capabilities/shared/format.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import {
    addMemberSchema,
    auditFilterSchema,
    settingsSchema,
    type AddMemberForm,
    type AuditFilterForm,
    type SettingsForm,
} from "../capabilities/organizations/forms.js";

const TAB_VALUES = ["members", "invitations", "announcements", "settings", "audit", "reports"] as const;
type TabValue = (typeof TAB_VALUES)[number];
const OWNER_TABS = new Set<TabValue>(["members", "invitations", "settings"]);

const ROLE_OPTIONS = [
    { value: "owner", label: "Owner" },
    { value: "organizer", label: "Organizer" },
    { value: "judge", label: "Judge" },
    { value: "participant", label: "Participant" },
] as const;

function isTabValue(value: string | null): value is TabValue {
    return value !== null && TAB_VALUES.some((candidate) => candidate === value);
}

export function OrganizationPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get("tab");
    const organizationId = membership?.organizationId ?? null;
    const canManage = membership?.role === "owner" || membership?.role === "organizer";
    const isOwner = membership?.role === "owner";
    const activeTab: TabValue = isTabValue(requestedTab)
        ? !isOwner && OWNER_TABS.has(requestedTab)
            ? "audit"
            : requestedTab
        : isOwner
          ? "members"
          : "audit";
    const { toast } = useToast();

    const members = useOrganizationMembers(organizationId, isOwner);
    const invitations = useOrganizationInvitations(organizationId, isOwner);
    const settings = useOrganizationSettings(organizationId, isOwner);
    const reports = useOrganizationReports(organizationId, canManage);
    const organizerEditions = useOrganizerEditions(organizationId, canManage);

    const addMember = useAddMember(organizationId);
    const updateMember = useUpdateMember(organizationId);
    const removeMember = useRemoveMember(organizationId);
    const updateSettings = useUpdateSettings(organizationId);

    const [pendingRemoval, setPendingRemoval] = useState<OrganizationMembership | null>(null);
    const [cursorStack, setCursorStack] = useState<readonly string[]>([]);
    const [auditFilters, setAuditFilters] = useState<{ action: string; entityType: string }>({
        action: "",
        entityType: "",
    });
    const currentCursor = cursorStack[cursorStack.length - 1];
    const audit = useOrganizationAudit(
        organizationId,
        {
            action: auditFilters.action,
            entityType: auditFilters.entityType,
            ...(currentCursor === undefined ? {} : { cursor: currentCursor }),
        },
        canManage,
    );

    const addMemberForm = useForm<AddMemberForm>({
        resolver: zodResolver(addMemberSchema),
        defaultValues: { email: "", role: "participant" },
    });

    const settingsForm = useForm<SettingsForm>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            registrationRequiresApproval: false,
            allowParticipantTeamCreation: false,
            publicShowcaseEnabled: false,
        },
    });

    const auditForm = useForm<AuditFilterForm>({
        resolver: zodResolver(auditFilterSchema),
        defaultValues: { action: "", entityType: "" },
    });

    useEffect(() => {
        if (settings.data === null || settings.data === undefined) {
            return;
        }
        settingsForm.reset({
            registrationRequiresApproval: settings.data.registrationRequiresApproval,
            allowParticipantTeamCreation: settings.data.allowParticipantTeamCreation,
            publicShowcaseEnabled: settings.data.publicShowcaseEnabled,
        });
    }, [settings.data, settingsForm]);

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading organization" />;
    }

    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }

    if (membership === null || organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Organization"
                    description="Members, invitations, settings, audit history, and reports for the active organization."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an active organization membership in the workspace navigation to manage it."
                />
            </div>
        );
    }

    if (!canManage) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title={membership.organizationName}
                    description="Organization administration is limited to owners and organizers."
                />
                <Alert tone="warning" title="You do not have administration access">
                    Your role in this organization is {roleLabel(membership.role)}. Ask an owner or
                    organizer if you need access to member administration, settings, or audit
                    history.
                </Alert>
            </div>
        );
    }

    const onAddMember = addMemberForm.handleSubmit(async (values) => {
        try {
            const result = await addMember.mutateAsync(values);
            addMemberForm.reset({ email: "", role: values.role });
            toast({
                title: result.kind === "membership" ? "Member added" : "Invitation created",
                description:
                    result.kind === "membership"
                        ? `${result.membership?.displayName ?? values.email} now belongs to this organization.`
                        : `An invitation was sent to ${result.invitation?.email ?? values.email}.`,
                tone: "success",
            });
        } catch (error) {
            toast({
                title: "Could not add the member",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onSaveSettings = settingsForm.handleSubmit(async (values) => {
        try {
            await updateSettings.mutateAsync(values);
            toast({ title: "Settings saved", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not save settings",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onApplyAuditFilters = auditForm.handleSubmit((values) => {
        setCursorStack([]);
        setAuditFilters({ action: values.action.trim(), entityType: values.entityType.trim() });
    });

    const changeRole = (member: OrganizationMembership, value: string): void => {
        const parsed = organizationRoleSchema.safeParse(value);
        if (!parsed.success) {
            return;
        }
        updateMember.mutate(
            { userId: member.userId, body: { role: parsed.data } },
            {
                onSuccess: () => toast({ title: "Member role updated", tone: "success" }),
                onError: (error) =>
                    toast({
                        title: "Could not update the role",
                        description: describeError(error),
                        tone: "critical",
                    }),
            },
        );
    };

    const changeStatus = (member: OrganizationMembership, value: string): void => {
        const parsed = membershipStatusSchema.safeParse(value);
        if (!parsed.success) {
            return;
        }
        updateMember.mutate(
            { userId: member.userId, body: { status: parsed.data } },
            {
                onSuccess: () => toast({ title: "Membership status updated", tone: "success" }),
                onError: (error) =>
                    toast({
                        title: "Could not update the status",
                        description: describeError(error),
                        tone: "critical",
                    }),
            },
        );
    };

    const onConfirmRemoval = async (): Promise<void> => {
        if (pendingRemoval === null) {
            return;
        }
        try {
            await removeMember.mutateAsync(pendingRemoval.userId);
            toast({ title: "Member removed", tone: "success" });
            setPendingRemoval(null);
        } catch (error) {
            toast({
                title: "Could not remove the member",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const memberItems = members.data?.items ?? [];
    const invitationItems = invitations.data?.items ?? [];
    const auditItems = audit.data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={membership.organizationName}
                description="Members, invitations, registration settings, audit history, and edition reports."
                actions={<Badge tone="neutral">{roleLabel(membership.role)}</Badge>}
            />

            {isOwner ? null : (
                <Alert tone="neutral" title="Owner-managed sections">
                    Members, invitations, and organization settings are managed by the owner.
                    Organizers can read the audit log and edition reports.
                </Alert>
            )}

            <Tabs
                value={activeTab}
                onValueChange={(value) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("tab", value);
                    setSearchParams(next, { replace: true });
                }}
            >
                <TabsList className="max-w-full overflow-x-auto">
                    {isOwner ? (
                        <>
                            <TabsTrigger value="members">Members</TabsTrigger>
                            <TabsTrigger value="invitations">Invitations</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </>
                    ) : null}
                    <TabsTrigger value="audit">Audit log</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                    <TabsTrigger value="announcements">Announcements</TabsTrigger>
                </TabsList>

                <TabsContent value="members">
                    <TabPanel title="Members">
                        <Card>
                            <CardHeader>
                                <CardTitle>Add a member</CardTitle>
                                <CardDescription>
                                    Existing accounts join immediately. Unknown email addresses
                                    receive an invitation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form form={addMemberForm} onSubmit={onAddMember}>
                                    <div className="grid gap-4 sm:grid-cols-[1fr_13rem_auto] sm:items-end">
                                        <FormField name="email" label="Email address" required>
                                            {(field) => (
                                                <Input
                                                    {...field}
                                                    type="email"
                                                    autoComplete="email"
                                                    placeholder="person@example.com"
                                                    value={field.value}
                                                />
                                            )}
                                        </FormField>
                                        <Controller
                                            control={addMemberForm.control}
                                            name="role"
                                            render={({ field, fieldState }) => (
                                                <Select
                                                    label="Role"
                                                    options={ROLE_OPTIONS}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    {...(fieldState.error?.message === undefined
                                                        ? {}
                                                        : { error: fieldState.error.message })}
                                                />
                                            )}
                                        />
                                        <Button
                                            type="submit"
                                            loading={addMember.isPending}
                                            className="sm:mb-0"
                                        >
                                            Add member
                                        </Button>
                                    </div>
                                </Form>
                            </CardContent>
                        </Card>

                        {members.isPending ? (
                            <LoadingBlock rows={4} label="Loading members" />
                        ) : members.isError ? (
                            <RequestError
                                error={members.error}
                                onRetry={() => void members.refetch()}
                            />
                        ) : memberItems.length === 0 ? (
                            <EmptyState
                                title="No members yet"
                                description="Add the first member by email address to start organizing."
                            />
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Member</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {memberItems.map((member) => (
                                            <TableRow key={member.userId}>
                                                <TableCell>
                                                    <UserDisplay
                                                        name={member.displayName}
                                                        email={member.email}
                                                        size="sm"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <label
                                                        className="sr-only"
                                                        htmlFor={`role-${member.userId}`}
                                                    >
                                                        Role for {member.displayName}
                                                    </label>
                                                    <select
                                                        id={`role-${member.userId}`}
                                                        className={`${inputVariants({ size: "sm" })} w-36`}
                                                        value={member.role}
                                                        disabled={updateMember.isPending}
                                                        onChange={(event) =>
                                                            changeRole(member, event.target.value)
                                                        }
                                                    >
                                                        {ROLE_OPTIONS.map((option) => (
                                                            <option
                                                                key={option.value}
                                                                value={option.value}
                                                            >
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </TableCell>
                                                <TableCell>
                                                    <label
                                                        className="sr-only"
                                                        htmlFor={`status-${member.userId}`}
                                                    >
                                                        Status for {member.displayName}
                                                    </label>
                                                    <select
                                                        id={`status-${member.userId}`}
                                                        className={`${inputVariants({ size: "sm" })} w-32`}
                                                        value={member.status}
                                                        disabled={updateMember.isPending}
                                                        onChange={(event) =>
                                                            changeStatus(member, event.target.value)
                                                        }
                                                    >
                                                        <option value="active">Active</option>
                                                        <option value="suspended">Suspended</option>
                                                    </select>
                                                </TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {formatDateTime(member.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setPendingRemoval(member)}
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
                    </TabPanel>
                </TabsContent>

                <TabsContent value="invitations">
                    <TabPanel title="Invitations">
                        {invitations.isPending ? (
                            <LoadingBlock rows={3} label="Loading invitations" />
                        ) : invitations.isError ? (
                            <RequestError
                                error={invitations.error}
                                onRetry={() => void invitations.refetch()}
                            />
                        ) : invitationItems.length === 0 ? (
                            <EmptyState
                                title="No invitations"
                                description="Invitations appear here after a member is added with an email address that has no account in this organization."
                            />
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email address</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Expires</TableHead>
                                            <TableHead>Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invitationItems.map((invitation) => (
                                            <TableRow key={invitation.id}>
                                                <TableCell>{invitation.email}</TableCell>
                                                <TableCell>{roleLabel(invitation.role)}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        tone={
                                                            invitation.status === "pending"
                                                                ? "outline"
                                                                : "neutral"
                                                        }
                                                    >
                                                        {humanizeToken(invitation.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {formatDateTime(invitation.expiresAt)}
                                                </TableCell>
                                                <TableCell className="text-ink-muted">
                                                    {formatDateTime(invitation.createdAt)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )}
                    </TabPanel>
                </TabsContent>

                <TabsContent value="settings">
                    <TabPanel title="Settings">
                        {settings.isPending ? (
                            <LoadingBlock rows={3} label="Loading settings" />
                        ) : settings.isError ? (
                            <RequestError
                                error={settings.error}
                                onRetry={() => void settings.refetch()}
                            />
                        ) : (
                            <Card className="max-w-2xl">
                                <CardHeader>
                                    <CardTitle>Registration and visibility</CardTitle>
                                    <CardDescription>
                                        These settings apply to every competition edition in this
                                        organization.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Form form={settingsForm} onSubmit={onSaveSettings}>
                                        <div className="flex flex-col gap-5">
                                            <Controller
                                                control={settingsForm.control}
                                                name="registrationRequiresApproval"
                                                render={({ field }) => (
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        label="Registrations require approval"
                                                        description="Participants wait for an organizer decision before they are registered."
                                                    />
                                                )}
                                            />
                                            <Controller
                                                control={settingsForm.control}
                                                name="allowParticipantTeamCreation"
                                                render={({ field }) => (
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        label="Participants can create teams"
                                                        description="When disabled, only organizers create teams."
                                                    />
                                                )}
                                            />
                                            <Controller
                                                control={settingsForm.control}
                                                name="publicShowcaseEnabled"
                                                render={({ field }) => (
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        label="Public showcase"
                                                        description="Published projects become visible on the public site."
                                                    />
                                                )}
                                            />
                                            <div>
                                                <Button
                                                    type="submit"
                                                    loading={updateSettings.isPending}
                                                >
                                                    Save settings
                                                </Button>
                                            </div>
                                        </div>
                                    </Form>
                                </CardContent>
                            </Card>
                        )}
                    </TabPanel>
                </TabsContent>

                <TabsContent value="announcements">
                    <TabPanel title="Announcements">
                        <AnnouncementsPanel
                            organizationId={organizationId}
                            editions={organizerEditions.editions}
                        />
                    </TabPanel>
                </TabsContent>

                <TabsContent value="audit">
                    <TabPanel title="Audit log">
                        <Card>
                            <CardHeader>
                                <CardTitle>Filter audit events</CardTitle>
                                <CardDescription>
                                    Audit entries are ordered newest first and load in pages.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form form={auditForm} onSubmit={onApplyAuditFilters}>
                                    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                        <FormField
                                            name="action"
                                            label="Action"
                                            optionalLabel="optional"
                                        >
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
                                        <Button type="submit" variant="outline">
                                            Apply filters
                                        </Button>
                                    </div>
                                </Form>
                            </CardContent>
                        </Card>

                        {audit.isPending ? (
                            <LoadingBlock rows={5} label="Loading audit log" />
                        ) : audit.isError ? (
                            <RequestError
                                error={audit.error}
                                onRetry={() => void audit.refetch()}
                            />
                        ) : auditItems.length === 0 ? (
                            <EmptyState
                                title="No audit events"
                                description="Member, settings, competition, judging, and voting actions appear here when they are recorded."
                            />
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Actor</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Entity</TableHead>
                                            <TableHead>Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {auditItems.map((entry) => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="whitespace-nowrap text-ink-muted">
                                                    {formatDateTime(entry.createdAt)}
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
                                                <TableCell>
                                                    <code className="block max-w-xs break-all text-xs text-ink-muted">
                                                        {JSON.stringify(entry.metadata)}
                                                    </code>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="flex items-center justify-between gap-3 border-t border-line p-4">
                                    <PaginationControls
                                        canPrevious={cursorStack.length > 0}
                                        canNext={audit.data?.nextCursor !== null}
                                        onPrevious={() => {
                                            setCursorStack(cursorStack.slice(0, -1));
                                        }}
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
                    </TabPanel>
                </TabsContent>

                <TabsContent value="reports">
                    <TabPanel title="Reports">
                        {reports.isPending ? (
                            <LoadingBlock rows={4} label="Loading reports" />
                        ) : reports.isError ? (
                            <RequestError
                                error={reports.error}
                                onRetry={() => void reports.refetch()}
                            />
                        ) : (reports.data?.editions.length ?? 0) === 0 ? (
                            <EmptyState
                                title="No edition reports"
                                description="Reports appear after a competition edition exists in this organization."
                            />
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-2">
                                {reports.data?.editions.map((edition) => (
                                    <Card key={edition.editionId}>
                                        <CardHeader>
                                            <CardTitle>{edition.editionName}</CardTitle>
                                            <CardDescription>
                                                Aggregate counts for this edition.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Statistics
                                                columns={2}
                                                items={[
                                                    {
                                                        label: "Registrations",
                                                        value: edition.registrations,
                                                    },
                                                    {
                                                        label: "Approved registrations",
                                                        value: edition.approvedRegistrations,
                                                    },
                                                    { label: "Teams", value: edition.teams },
                                                    {
                                                        label: "Projects",
                                                        value: edition.projects,
                                                    },
                                                    {
                                                        label: "Submissions",
                                                        value: edition.submissions,
                                                    },
                                                    {
                                                        label: "Evaluations submitted",
                                                        value: edition.evaluationsSubmitted,
                                                    },
                                                ]}
                                            />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabPanel>
                </TabsContent>
            </Tabs>

            <AlertDialog
                open={pendingRemoval !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingRemoval(null);
                    }
                }}
                title="Remove member"
                description={`Remove ${pendingRemoval?.displayName ?? "this member"} from ${membership.organizationName}? Their account is not deleted.`}
                confirmLabel="Remove member"
                tone="destructive"
                loading={removeMember.isPending}
                onConfirm={onConfirmRemoval}
            />
        </div>
    );
}

function roleLabel(role: OrganizationRole): string {
    switch (role) {
        case "owner":
            return "Owner";
        case "organizer":
            return "Organizer";
        case "judge":
            return "Judge";
        case "participant":
            return "Participant";
    }
}
