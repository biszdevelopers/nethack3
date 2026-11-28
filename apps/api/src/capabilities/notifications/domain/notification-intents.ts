import { z } from "zod";
import type { NotificationKind } from "@nethack/contracts";
import { domainEvents } from "../../../core/domain-event.js";

const uuidSchema = z.uuid();
const emailSchema = z.email().max(254);

export interface NotificationIntent {
    readonly userId: string | null;
    readonly email: string | null;
    readonly organizationId: string | null;
    readonly kind: NotificationKind;
    readonly title: string;
    readonly body: string;
    readonly linkUrl: string | null;
    readonly dedupeKey: string;
}

export function buildNotificationIntents(
    eventType: string,
    payload: Record<string, unknown>,
    workspaceOrigin: string,
): readonly NotificationIntent[] {
    if (eventType === domainEvents.resultsPublished) {
        return resultsPublishedIntents(payload, workspaceOrigin);
    }
    const intent = buildNotificationIntent(eventType, payload, workspaceOrigin);
    return intent === null ? [] : [intent];
}

export function buildNotificationIntent(
    eventType: string,
    payload: Record<string, unknown>,
    workspaceOrigin: string,
): NotificationIntent | null {
    switch (eventType) {
        case domainEvents.membershipGranted:
            return membershipGranted(payload, workspaceOrigin);
        case domainEvents.registrationDecided:
            return registrationDecided(payload, workspaceOrigin);
        case domainEvents.teamCreated:
            return teamCreated(payload, workspaceOrigin);
        case domainEvents.teamInvitationCreated:
            return teamInvitationCreated(payload, workspaceOrigin);
        case domainEvents.teamInvitationAccepted:
            return teamInvitationAccepted(payload, workspaceOrigin);
        case domainEvents.submissionReviewed:
            return submissionReviewed(payload, workspaceOrigin);
        case domainEvents.judgeAssigned:
            return judgeAssigned(payload, workspaceOrigin);
        case domainEvents.votingOpened:
            return votingOpened(payload, workspaceOrigin);
        default:
            return null;
    }
}

function membershipGranted(
    payload: Record<string, unknown>,
    origin: string,
): NotificationIntent | null {
    const userId = readUuid(payload, "userId");
    const organizationId = readUuid(payload, "organizationId");
    if (userId === null || organizationId === null) {
        return null;
    }
    const organizationName = readString(payload, "organizationName");
    const role = readString(payload, "role");
    return {
        userId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "system",
        title: "Organization membership granted",
        body: `You are now a ${role ?? "member"} of ${organizationName ?? "an organization"}.`,
        linkUrl: workspaceLink(origin, "/"),
        dedupeKey: `membership.granted:${organizationId}:${userId}:${role ?? "member"}`,
    };
}

function registrationDecided(
    payload: Record<string, unknown>,
    origin: string,
): NotificationIntent | null {
    const userId = readUuid(payload, "userId");
    const organizationId = readUuid(payload, "organizationId");
    if (userId === null || organizationId === null) {
        return null;
    }
    const status = readString(payload, "status") ?? "updated";
    const organizationName = readString(payload, "organizationName");
    return {
        userId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "registration_decision",
        title: `Registration ${status}`,
        body: `Your registration for ${organizationName ?? "the competition"} is ${status}.`,
        linkUrl: workspaceLink(origin, "/competitions"),
        dedupeKey: `registration.decided:${organizationId}:${userId}:${status}`,
    };
}

function teamCreated(payload: Record<string, unknown>, origin: string): NotificationIntent | null {
    const captainUserId = readUuid(payload, "captainUserId");
    const organizationId = readUuid(payload, "organizationId");
    if (captainUserId === null || organizationId === null) {
        return null;
    }
    const actorUserId = readUuid(payload, "userId");
    if (actorUserId !== null && actorUserId === captainUserId) {
        return null;
    }
    const teamName = readString(payload, "teamName");
    return {
        userId: captainUserId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "system",
        title: "Team created",
        body: `You are the captain of ${teamName ?? "a team"}.`,
        linkUrl: workspaceLink(origin, "/teams"),
        dedupeKey: `team.created:${organizationId}:${captainUserId}:${teamName ?? "team"}`,
    };
}

function teamInvitationCreated(
    payload: Record<string, unknown>,
    origin: string,
): NotificationIntent | null {
    const email = readEmail(payload, "email");
    const organizationId = readUuid(payload, "organizationId");
    if (email === null || organizationId === null) {
        return null;
    }
    const teamName = readString(payload, "teamName");
    const organizationName = readString(payload, "organizationName");
    const invitationId = readUuid(payload, "invitationId");
    const token = readString(payload, "token");
    const query = token === null ? undefined : { token };
    return {
        userId: null,
        email,
        organizationId,
        kind: "team_invitation",
        title: `Invitation to join ${teamName ?? "a team"}`,
        body: `You have been invited to join ${teamName ?? "a team"}${
            organizationName === null ? "" : ` in ${organizationName}`
        }. Open the invitation link to accept it.`,
        linkUrl: workspaceLink(origin, "/invitations", query),
        dedupeKey: `team.invitation.created:${
            invitationId ?? `${organizationId}:${email}:${teamName ?? "team"}`
        }`,
    };
}

function teamInvitationAccepted(
    payload: Record<string, unknown>,
    origin: string,
): NotificationIntent | null {
    const captainUserId = readUuid(payload, "captainUserId");
    const organizationId = readUuid(payload, "organizationId");
    if (captainUserId === null || organizationId === null) {
        return null;
    }
    const teamName = readString(payload, "teamName");
    const invitationId = readUuid(payload, "invitationId");
    const acceptedBy = readUuid(payload, "userId") ?? readEmail(payload, "email");
    return {
        userId: captainUserId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "system",
        title: "Team invitation accepted",
        body: `${teamName ?? "Your team"} has a new member.`,
        linkUrl: workspaceLink(origin, "/teams"),
        dedupeKey: `team.invitation.accepted:${
            invitationId ?? `${organizationId}:${captainUserId}:${acceptedBy ?? "member"}`
        }`,
    };
}

function submissionReviewed(
    payload: Record<string, unknown>,
    origin: string,
): NotificationIntent | null {
    const userId = readUuid(payload, "userId");
    const organizationId = readUuid(payload, "organizationId");
    if (userId === null || organizationId === null) {
        return null;
    }
    const title = readString(payload, "title");
    const projectTitle = readString(payload, "projectTitle");
    const status = readString(payload, "status") ?? "reviewed";
    const subject = projectTitle ?? title ?? "your submission";
    return {
        userId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "submission_review",
        title: "Submission reviewed",
        body: `Your submission for ${subject} is ${status}.`,
        linkUrl: workspaceLink(origin, "/submissions"),
        dedupeKey: `submission.reviewed:${organizationId}:${userId}:${subject}:${status}`,
    };
}

function judgeAssigned(
    payload: Record<string, unknown>,
    origin: string,
): NotificationIntent | null {
    const judgeUserId = readUuid(payload, "judgeUserId");
    const organizationId = readUuid(payload, "organizationId");
    if (judgeUserId === null || organizationId === null) {
        return null;
    }
    const title = readString(payload, "title");
    const projectTitle = readString(payload, "projectTitle");
    const subject = projectTitle ?? title ?? "a submission";
    return {
        userId: judgeUserId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "judge_assignment",
        title: "New judging assignment",
        body: `You have been assigned to judge ${subject}.`,
        linkUrl: workspaceLink(origin, "/judging"),
        dedupeKey: `judge.assignment.created:${organizationId}:${judgeUserId}:${subject}`,
    };
}

function votingOpened(payload: Record<string, unknown>, origin: string): NotificationIntent | null {
    const userId = readUuid(payload, "userId");
    const organizationId = readUuid(payload, "organizationId");
    if (userId === null || organizationId === null) {
        return null;
    }
    const title = readString(payload, "title");
    const organizationName = readString(payload, "organizationName");
    return {
        userId,
        email: readEmail(payload, "email"),
        organizationId,
        kind: "voting_open",
        title: "Voting is open",
        body: `${title ?? organizationName ?? "Voting"} is now open for votes.`,
        linkUrl: workspaceLink(origin, "/voting"),
        dedupeKey: `voting.round.opened:${organizationId}:${userId}:${
            title ?? organizationName ?? "round"
        }`,
    };
}

function resultsPublishedIntents(
    payload: Record<string, unknown>,
    origin: string,
): readonly NotificationIntent[] {
    const organizationId = readUuid(payload, "organizationId");
    const editionId = readUuid(payload, "editionId");
    if (organizationId === null || editionId === null) {
        return [];
    }
    const editionName = readString(payload, "editionName");
    const publishedAt = readString(payload, "publishedAt") ?? "unknown";
    const linkUrl = workspaceLink(origin, "/results", { edition: editionId });
    return readUuidArray(payload, "participantUserIds").map((userId) => ({
        userId,
        email: null,
        organizationId,
        kind: "system",
        title: "Results published",
        body: `${editionName ?? "Competition"} results are published. View your results.`,
        linkUrl,
        dedupeKey: `recognition.results.published:${organizationId}:${editionId}:${publishedAt}:${userId}`,
    }));
}

function readUuidArray(payload: Record<string, unknown>, key: string): readonly string[] {
    const value = payload[key];
    if (!Array.isArray(value)) {
        return [];
    }
    const ids = new Set<string>();
    for (const item of value) {
        if (typeof item === "string" && uuidSchema.safeParse(item).success) {
            ids.add(item);
        }
    }
    return [...ids];
}

function readString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readUuid(payload: Record<string, unknown>, key: string): string | null {
    const value = readString(payload, key);
    return value !== null && uuidSchema.safeParse(value).success ? value : null;
}

function readEmail(payload: Record<string, unknown>, key: string): string | null {
    const value = readString(payload, key);
    return value !== null && emailSchema.safeParse(value).success ? value : null;
}

function workspaceLink(origin: string, pathname: string, query?: Record<string, string>): string {
    const url = new URL(pathname, origin);
    if (query !== undefined) {
        for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value);
        }
    }
    return url.toString();
}
