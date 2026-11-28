import type { ReactNode } from "react";
import { Checkbox, FormField, Textarea } from "@nethack/ui";

export const NO_AI_DISCLOSURE = "No AI tools or models were used in this project.";
export const AI_DISCLOSURE_MAX_LENGTH = 2000;

export function AiDisclosureField({
    value,
    onChange,
    required = false,
}: {
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly required?: boolean;
}): ReactNode {
    const noAiUsed = value.trim() === NO_AI_DISCLOSURE;
    return (
        <FormField
            name="aiDisclosure"
            label="AI-use disclosure"
            description={
                required
                    ? "Required before submission. Name the AI tools or models you used and the parts they touched, or confirm that none were used."
                    : "Name the AI tools or models you used and the parts they touched. Required before submission; leave empty only until then."
            }
            {...(required ? { required: true } : { optionalLabel: "optional" })}
        >
            {(field) => (
                <div className="flex flex-col gap-2">
                    <Textarea
                        {...field}
                        rows={4}
                        maxLength={AI_DISCLOSURE_MAX_LENGTH}
                        disabled={noAiUsed}
                    />
                    <Checkbox
                        label="No AI tools or models were used in this project."
                        checked={noAiUsed}
                        onCheckedChange={(checked) =>
                            onChange(checked === true ? NO_AI_DISCLOSURE : "")
                        }
                    />
                </div>
            )}
        </FormField>
    );
}
