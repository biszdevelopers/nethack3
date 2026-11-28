import { judgeCommentIssue, type JudgeCommentIdentity } from "@nethack/contracts";
import { ValidationError } from "../../../core/errors.js";

export {
    commentContainsJudgeIdentity,
    hasUnfilledCommentTemplate,
    JUDGE_COMMENT_IDENTITY_ERROR,
    JUDGE_COMMENT_TEMPLATE_ERROR,
    JUDGE_COMMENT_TOO_SHORT,
    judgeCommentIssue,
    MIN_JUDGE_COMMENT_LENGTH,
} from "@nethack/contracts";
export type { JudgeCommentIdentity } from "@nethack/contracts";

export function assertJudgeCommentReady(comment: string, identity: JudgeCommentIdentity): void {
    const issue = judgeCommentIssue(comment, identity);
    if (issue !== null) {
        throw new ValidationError(issue, { overallComment: [issue] });
    }
}
