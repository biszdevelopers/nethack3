import { ConflictError, ForbiddenError } from "../../../core/errors.js";

export interface UserDeletionBlockers {
    readonly captainedTeams: number;
    readonly ownedProjects: number;
    readonly authoredAnnouncements: number;
    readonly submissionVersions: number;
    readonly submissionFiles: number;
    readonly awards: number;
    readonly teamAwards: number;
    readonly editionResults: number;
    readonly judgeFlags: number;
    readonly flaggedAssignments: number;
    readonly submittedEvaluations: number;
    readonly soleOwnedOrganizations: number;
}

const BLOCKER_LABELS: readonly (readonly [keyof UserDeletionBlockers, string])[] = [
    ["captainedTeams", "captaining a team"],
    ["ownedProjects", "owning a project"],
    ["authoredAnnouncements", "authoring an announcement"],
    ["submissionVersions", "creating a submission version"],
    ["submissionFiles", "uploading a submission file"],
    ["awards", "creating an award"],
    ["teamAwards", "assigning a team award"],
    ["editionResults", "publishing edition results"],
    ["judgeFlags", "reporting a judge flag"],
    ["flaggedAssignments", "holding flagged judging assignments"],
    ["submittedEvaluations", "holding submitted evaluations"],
    ["soleOwnedOrganizations", "the last owner of an organization"],
];

export class AdministrationRules {
    static assertCanRevoke(administratorCount: number): void {
        if (administratorCount <= 1) {
            throw new ConflictError("The platform must retain at least one global administrator.");
        }
    }

    static assertNotSelfDeletion(actorUserId: string, targetUserId: string): void {
        if (actorUserId === targetUserId) {
            throw new ForbiddenError("You cannot delete your own account.");
        }
    }

    static assertCanDeleteAdministrator(
        isGlobalAdministrator: boolean,
        administratorCount: number,
    ): void {
        if (isGlobalAdministrator) {
            AdministrationRules.assertCanRevoke(administratorCount);
        }
    }

    static assertCanDeleteAccount(blockers: UserDeletionBlockers): void {
        const blocking = BLOCKER_LABELS.filter(([key]) => blockers[key] > 0).map(
            ([, label]) => label,
        );
        if (blocking.length > 0) {
            throw new ConflictError(
                `This account cannot be deleted while it is ${blocking.join(", ")}.`,
            );
        }
    }

    static assertNoSubmittedEvaluations(submittedEvaluationCount: number): void {
        if (submittedEvaluationCount > 0) {
            throw new ConflictError("A submission with a submitted evaluation cannot be reopened.");
        }
    }
}
