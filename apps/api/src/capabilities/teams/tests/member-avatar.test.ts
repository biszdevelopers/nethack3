import { describe, expect, it } from "vitest";
import { projectDetailSchema, projectMemberSchema, teamDetailSchema } from "@nethack/contracts";

const teamMemberSchema = teamDetailSchema.shape.members.element;
const projectDetailMemberSchema = projectDetailSchema.shape.members.element;

const teamMember = {
    userId: "f1000000-0000-4000-8000-000000000011",
    displayName: "Fixture Participant",
    avatarUrl: "https://example.com/avatar.png",
    role: "captain",
    joinedAt: "2026-01-01T00:00:00.000Z",
} as const;

const projectMember = {
    userId: "f1000000-0000-4000-8000-000000000011",
    displayName: "Fixture Participant",
    avatarUrl: null,
    role: "owner",
} as const;

describe("member avatar parity", () => {
    it("accepts the provider avatar URL on team and project members", () => {
        expect(teamMemberSchema.parse(teamMember).avatarUrl).toBe("https://example.com/avatar.png");
        expect(projectDetailMemberSchema.parse(projectMember).avatarUrl).toBeNull();
        expect(projectMemberSchema.parse(projectMember).avatarUrl).toBeNull();
    });

    it("requires the avatar URL field so members without a picture stay explicit", () => {
        expect(
            teamMemberSchema.safeParse({
                userId: teamMember.userId,
                displayName: teamMember.displayName,
                role: teamMember.role,
                joinedAt: teamMember.joinedAt,
            }).success,
        ).toBe(false);
        expect(
            projectDetailMemberSchema.safeParse({
                userId: projectMember.userId,
                displayName: projectMember.displayName,
                role: projectMember.role,
            }).success,
        ).toBe(false);
    });
});
