import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../core/errors.js";
import {
    assertJudgeCommentReady,
    commentContainsJudgeIdentity,
    hasUnfilledCommentTemplate,
    JUDGE_COMMENT_IDENTITY_ERROR,
    JUDGE_COMMENT_TEMPLATE_ERROR,
    JUDGE_COMMENT_TOO_SHORT,
    judgeCommentIssue,
    MIN_JUDGE_COMMENT_LENGTH,
} from "../domain/judge-comments.js";

const identity = {
    displayName: "Fixture Judge",
    email: "judge@fixture.invalid",
} as const;

describe("judge comment rules", () => {
    it("requires at least 20 characters after trimming", () => {
        expect(MIN_JUDGE_COMMENT_LENGTH).toBe(20);
        expect(judgeCommentIssue("   Too short.   ", identity)).toBe(JUDGE_COMMENT_TOO_SHORT);
        expect(judgeCommentIssue("   A specific and actionable comment.   ", identity)).toBeNull();
    });

    it("rejects unfilled double-braced template placeholders", () => {
        expect(hasUnfilledCommentTemplate("Strength: {{describe a moment}}")).toBe(true);
        expect(
            judgeCommentIssue(
                "Strength: {{describe a specific moment}}\nNext step: {{suggest one action}}",
                identity,
            ),
        ).toBe(JUDGE_COMMENT_TEMPLATE_ERROR);
        expect(judgeCommentIssue("Strength: clear navigation and tests.", identity)).toBeNull();
    });

    it("rejects the judge's own display name in any casing", () => {
        expect(judgeCommentIssue("Reviewed by Fixture Judge after the demo.", identity)).toBe(
            JUDGE_COMMENT_IDENTITY_ERROR,
        );
        expect(judgeCommentIssue("Reviewed by fixture judge after the demo.", identity)).toBe(
            JUDGE_COMMENT_IDENTITY_ERROR,
        );
        expect(commentContainsJudgeIdentity("FIXTURE   JUDGE reviewed it.", identity)).toBe(true);
    });

    it("rejects the judge's own email address", () => {
        expect(
            judgeCommentIssue("Contact me at judge@fixture.invalid for details.", identity),
        ).toBe(JUDGE_COMMENT_IDENTITY_ERROR);
        expect(
            judgeCommentIssue("Contact me at JUDGE@FIXTURE.INVALID for details.", identity),
        ).toBe(JUDGE_COMMENT_IDENTITY_ERROR);
    });

    it("allows names and emails that are only substrings of other words", () => {
        expect(
            judgeCommentIssue("The prefix judge@fixture.invalidity is not an email.", identity),
        ).toBeNull();
        expect(judgeCommentIssue("A Fixture Judgeley fan page is unrelated.", identity)).toBeNull();
    });

    it("throws a field-scoped validation error on save", () => {
        try {
            assertJudgeCommentReady("Too short.", identity);
            expect.unreachable("Expected the comment to be rejected.");
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).details).toEqual({
                overallComment: [JUDGE_COMMENT_TOO_SHORT],
            });
        }
    });
});
