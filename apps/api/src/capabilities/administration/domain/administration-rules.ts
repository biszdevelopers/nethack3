import { ConflictError } from "../../../core/errors.js";

export class AdministrationRules {
    static assertCanRevoke(administratorCount: number): void {
        if (administratorCount <= 1) {
            throw new ConflictError("The platform must retain at least one global administrator.");
        }
    }
}
