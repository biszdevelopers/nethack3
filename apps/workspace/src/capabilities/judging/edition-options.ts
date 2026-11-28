import type { JudgeAssignment } from "@nethack/contracts";
import type { EditionOption } from "../shared/query-keys.js";

export function buildJudgeEditionOptions(
    assignments: readonly JudgeAssignment[],
    known: readonly EditionOption[],
): readonly EditionOption[] {
    const names = new Map(known.map((edition) => [edition.id, edition.name] as const));
    const ids = new Set(assignments.map((assignment) => assignment.editionId));
    return [...ids]
        .map((id) => ({ id, name: names.get(id) ?? `Edition ${id.slice(0, 8)}` }))
        .toSorted((left, right) => left.name.localeCompare(right.name));
}
