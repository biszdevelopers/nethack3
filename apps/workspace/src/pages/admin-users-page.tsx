import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    organizationRoleSchema,
    type AdministrationUser,
    type OrganizationRole,
} from "@nethack/contracts";
import {
    Alert,
    Badge,
    Button,
    Card,
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
    LoadingBlock,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    UserDisplay,
    inputVariants,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import {
    useAdministrationUsers,
    useGrantAdministrator,
    useRevokeAdministrator,
    useUpdateAdministrationUserRole,
} from "../capabilities/administration/hooks.js";
import {
    grantSchema,
    revokeSchema,
    type GrantForm,
    type RevokeForm,
} from "../capabilities/administration/forms.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { describeError } from "../capabilities/shared/errors.js";
import { RequestError } from "../capabilities/shared/states.jsx";

const ROLE_OPTIONS = [
    { value: "owner", label: "Owner" },
    { value: "organizer", label: "Organizer" },
    { value: "judge", label: "Judge" },
    { value: "participant", label: "Participant" },
] as const;

export function AdminUsersPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const organizationId = membership?.organizationId ?? null;
    const canManage = membership?.role === "owner" || membership?.role === "organizer";
    const globalAdministrator = session.data?.globalAdministrator ?? false;
    const { toast } = useToast();

    const users = useAdministrationUsers(organizationId, canManage);
    const updateRole = useUpdateAdministrationUserRole(organizationId);
    const grantAdministrator = useGrantAdministrator();
    const revokeAdministrator = useRevokeAdministrator();

    const [grantTarget, setGrantTarget] = useState<AdministrationUser | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<AdministrationUser | null>(null);

    const grantForm = useForm<GrantForm>({
        resolver: zodResolver(grantSchema),
        defaultValues: { email: "", reason: "" },
    });
    const revokeForm = useForm<RevokeForm>({
        resolver: zodResolver(revokeSchema),
        defaultValues: { reason: "" },
    });

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading users" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Users"
                    description="Organization members, roles, and platform access."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization to administer its members."
                />
            </div>
        );
    }
    if (!canManage) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Users"
                    description="Organization members, roles, and platform access."
                />
                <Alert tone="warning" title="Organizer access required">
                    Only an owner or organizer of{" "}
                    {membership?.organizationName ?? "this organization"} can manage organization
                    members.
                </Alert>
            </div>
        );
    }

    const openGrant = (user: AdministrationUser): void => {
        setGrantTarget(user);
        grantForm.reset({ email: user.email ?? "", reason: "" });
    };

    const openRevoke = (user: AdministrationUser): void => {
        setRevokeTarget(user);
        revokeForm.reset({ reason: "" });
    };

    const onGrant = grantForm.handleSubmit(async (values) => {
        if (grantTarget === null) {
            return;
        }
        try {
            await grantAdministrator.mutateAsync({
                email: values.email,
                reason: values.reason,
            });
            setGrantTarget(null);
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
        if (revokeTarget === null) {
            return;
        }
        try {
            await revokeAdministrator.mutateAsync({
                userId: revokeTarget.userId,
                body: { reason: values.reason },
            });
            setRevokeTarget(null);
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

    const changeRole = (member: AdministrationUser, value: string): void => {
        const parsed = organizationRoleSchema.safeParse(value);
        if (!parsed.success) {
            return;
        }
        updateRole.mutate(
            { userId: member.userId, role: parsed.data },
            {
                onSuccess: () =>
                    toast({
                        title: "Member role updated",
                        description: `${member.displayName} is now ${roleLabel(parsed.data)}.`,
                        tone: "success",
                    }),
                onError: (error) =>
                    toast({
                        title: "Could not update the role",
                        description: describeError(error),
                        tone: "critical",
                    }),
            },
        );
    };

    const items = users.data?.items ?? [];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Users"
                description={`Members of ${membership.organizationName} with organization roles and platform access.`}
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link to="/admin">Back to administration</Link>
                    </Button>
                }
            />

            {users.isPending ? (
                <LoadingBlock rows={5} label="Loading organization members" />
            ) : users.isError ? (
                <RequestError error={users.error} onRetry={() => void users.refetch()} />
            ) : items.length === 0 ? (
                <EmptyState
                    title="No members"
                    description="Organization members appear here after they join or are invited."
                />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member</TableHead>
                                <TableHead>Organization role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Judge</TableHead>
                                <TableHead>Platform access</TableHead>
                                <TableHead>Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((member) => (
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
                                            disabled={updateRole.isPending}
                                            onChange={(event) =>
                                                changeRole(member, event.target.value)
                                            }
                                        >
                                            {ROLE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            tone={
                                                member.status === "active" ? "primary" : "neutral"
                                            }
                                        >
                                            {member.status === "active" ? "Active" : "Suspended"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {member.isJudge ? (
                                            <Badge tone="outline">Judge</Badge>
                                        ) : (
                                            <span className="text-ink-subtle">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex flex-wrap items-center gap-2">
                                            {member.isGlobalAdministrator ? (
                                                <Badge tone="primary">Global administrator</Badge>
                                            ) : (
                                                <span className="text-ink-subtle">Member</span>
                                            )}
                                            {!globalAdministrator ? null : member.isGlobalAdministrator ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label={`Revoke global administrator for ${member.displayName}`}
                                                    onClick={() => openRevoke(member)}
                                                >
                                                    Revoke
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    aria-label={`Grant global administrator for ${member.displayName}`}
                                                    disabled={member.email === null}
                                                    onClick={() => openGrant(member)}
                                                >
                                                    Grant
                                                </Button>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-ink-muted">
                                        {formatDateTime(member.joinedAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {globalAdministrator ? null : (
                <Alert tone="neutral" title="Platform access">
                    Granting and revoking global administrator access requires an existing global
                    administrator account.
                </Alert>
            )}

            <Dialog
                open={grantTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setGrantTarget(null);
                        grantForm.reset({ email: "", reason: "" });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Grant global administrator</DialogTitle>
                        <DialogDescription>
                            {grantTarget?.displayName ?? "This account"} gains platform-wide
                            administration access. A reason is stored in the audit log.
                        </DialogDescription>
                    </DialogHeader>
                    <Form form={grantForm} onSubmit={onGrant}>
                        <div className="flex flex-col gap-4">
                            <FormField name="email" label="Email address" required>
                                {(field) => (
                                    <Input
                                        {...field}
                                        value={field.value}
                                        type="email"
                                        readOnly
                                        autoComplete="email"
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
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setGrantTarget(null)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" loading={grantAdministrator.isPending}>
                                    Grant access
                                </Button>
                            </DialogFooter>
                        </div>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={revokeTarget !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setRevokeTarget(null);
                        revokeForm.reset({ reason: "" });
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke global administrator</DialogTitle>
                        <DialogDescription>
                            Remove platform-wide administration access from{" "}
                            {revokeTarget?.displayName ?? "this account"}? A reason is stored in the
                            audit log.
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
                                    onClick={() => setRevokeTarget(null)}
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
