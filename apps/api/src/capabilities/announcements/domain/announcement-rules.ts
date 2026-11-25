import type { OrganizationRole, UpdateAnnouncementRequest } from "@nethack/contracts";
import { ValidationError } from "../../../core/errors.js";

const DRAFT_VISIBLE_ROLES: ReadonlySet<OrganizationRole> = new Set(["owner", "organizer"]);

export function canViewDrafts(role: OrganizationRole): boolean {
    return DRAFT_VISIBLE_ROLES.has(role);
}

export function assertHasChanges(input: UpdateAnnouncementRequest): void {
    if (
        input.title === undefined &&
        input.bodyMarkdown === undefined &&
        input.visibility === undefined
    ) {
        throw new ValidationError("Provide at least one field to update.");
    }
}
