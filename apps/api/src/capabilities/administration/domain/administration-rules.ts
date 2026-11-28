import { ConflictError } from "../../../core/errors.js";

export class AdministrationRules {
    static assertCanRevoke(administratorCount: number): void {
        if (administratorCount <= 1) {
            throw new ConflictError("The platform must retain at least one global administrator.");
        }
    }

    static assertNoSubmittedEvaluations(submittedEvaluationCount: number): void {
        if (submittedEvaluationCount > 0) {
            throw new ConflictError("A submission with a submitted evaluation cannot be reopened.");
        }
    }
}
