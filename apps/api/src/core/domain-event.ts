export interface DomainEvent {
    readonly type: string;
    readonly organizationId: string | null;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly payload: Record<string, unknown>;
    readonly dedupeKey?: string;
}

export const domainEvents = {
    organizationCreated: "organizations.organization.created",
    membershipGranted: "organizations.membership.granted",
    membershipRevoked: "organizations.membership.revoked",
    competitionPublished: "competitions.edition.published",
    registrationRequested: "participants.registration.requested",
    registrationDecided: "participants.registration.decided",
    teamCreated: "teams.team.created",
    teamInvitationCreated: "teams.invitation.created",
    teamInvitationAccepted: "teams.invitation.accepted",
    teamMemberRemoved: "teams.member.removed",
    projectPublished: "projects.project.published",
    submissionSubmitted: "submissions.submission.submitted",
    submissionReviewed: "submissions.submission.reviewed",
    judgeAssigned: "judging.assignment.created",
    evaluationSubmitted: "judging.evaluation.submitted",
    votingOpened: "voting.round.opened",
    votingClosed: "voting.round.closed",
    votingPublished: "voting.round.published",
    announcementPublished: "announcements.announcement.published",
} as const;
