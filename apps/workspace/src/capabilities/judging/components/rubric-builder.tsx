import type { ReactNode } from "react";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Textarea,
    useToast,
} from "@nethack/ui";
import { useCreateRubric } from "../hooks.js";
import { describeError } from "../../shared/errors.js";

interface CriterionDraft {
    readonly key: number;
    name: string;
    description: string;
    maxScore: string;
    weight: string;
}

let nextKey = 1;

function emptyCriterion(): CriterionDraft {
    return { key: nextKey++, name: "", description: "", maxScore: "10", weight: "1" };
}

export function RubricBuilder({
    organizationId,
    editionId,
    onCreated,
}: {
    readonly organizationId: string;
    readonly editionId: string;
    readonly onCreated?: () => void;
}): ReactNode {
    const createRubric = useCreateRubric(organizationId, editionId);
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [criteria, setCriteria] = useState<readonly CriterionDraft[]>([emptyCriterion()]);
    const [error, setError] = useState<string | null>(null);

    const updateCriterion = (key: number, patch: Partial<CriterionDraft>): void => {
        setCriteria((current) =>
            current.map((criterion) =>
                criterion.key === key ? { ...criterion, ...patch } : criterion,
            ),
        );
    };

    const onSubmit = async (): Promise<void> => {
        setError(null);
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            setError("Give the rubric a name of at least two characters.");
            return;
        }
        const parsed = criteria.map((criterion) => ({
            name: criterion.name.trim(),
            description: criterion.description.trim(),
            maxScore: Number.parseInt(criterion.maxScore, 10),
            weight: Number.parseFloat(criterion.weight),
        }));
        if (parsed.some((criterion) => criterion.name.length === 0)) {
            setError("Every criterion needs a name.");
            return;
        }
        if (
            parsed.some(
                (criterion) =>
                    !Number.isFinite(criterion.maxScore) ||
                    criterion.maxScore < 1 ||
                    criterion.maxScore > 100 ||
                    !Number.isFinite(criterion.weight) ||
                    criterion.weight < 0.1 ||
                    criterion.weight > 10,
            )
        ) {
            setError("Scores must be 1–100 and weights must be 0.1–10.");
            return;
        }
        try {
            await createRubric.mutateAsync({
                name: trimmedName,
                description: description.trim(),
                criteria: parsed,
            });
            setName("");
            setDescription("");
            setCriteria([emptyCriterion()]);
            toast({ title: "Rubric created", tone: "success" });
            onCreated?.();
        } catch (caught) {
            setError(describeError(caught));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create a rubric</CardTitle>
                <CardDescription>
                    Judges score against every criterion. Weights determine the weighted total.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="rubric-name" className="text-sm font-medium">
                            Rubric name
                        </label>
                        <Input
                            id="rubric-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Overall evaluation"
                            maxLength={120}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="rubric-description" className="text-sm font-medium">
                            Description
                        </label>
                        <Input
                            id="rubric-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="What this rubric measures"
                            maxLength={2000}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Criteria</span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            iconLeft={<Plus className="size-3.5" aria-hidden="true" />}
                            onClick={() =>
                                setCriteria((current) => [...current, emptyCriterion()])
                            }
                        >
                            Add criterion
                        </Button>
                    </div>
                    {criteria.map((criterion, index) => (
                        <div
                            key={criterion.key}
                            className="grid gap-3 rounded-md border border-line bg-raised/30 p-3 md:grid-cols-[1.4fr_0.6fr_0.5fr_auto]"
                        >
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor={`criterion-name-${criterion.key}`}
                                    className="text-xs text-ink-subtle"
                                >
                                    Criterion {index + 1}
                                </label>
                                <Input
                                    id={`criterion-name-${criterion.key}`}
                                    value={criterion.name}
                                    onChange={(event) =>
                                        updateCriterion(criterion.key, {
                                            name: event.target.value,
                                        })
                                    }
                                    placeholder="Technical depth"
                                    maxLength={120}
                                />
                                <Textarea
                                    variant="subtle"
                                    size="sm"
                                    value={criterion.description}
                                    onChange={(event) =>
                                        updateCriterion(criterion.key, {
                                            description: event.target.value,
                                        })
                                    }
                                    placeholder="What a strong result looks like"
                                    maxLength={1000}
                                    className="min-h-16"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor={`criterion-max-${criterion.key}`}
                                    className="text-xs text-ink-subtle"
                                >
                                    Max score
                                </label>
                                <Input
                                    id={`criterion-max-${criterion.key}`}
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={criterion.maxScore}
                                    onChange={(event) =>
                                        updateCriterion(criterion.key, {
                                            maxScore: event.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor={`criterion-weight-${criterion.key}`}
                                    className="text-xs text-ink-subtle"
                                >
                                    Weight
                                </label>
                                <Input
                                    id={`criterion-weight-${criterion.key}`}
                                    type="number"
                                    min={0.1}
                                    max={10}
                                    step={0.1}
                                    value={criterion.weight}
                                    onChange={(event) =>
                                        updateCriterion(criterion.key, {
                                            weight: event.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Remove criterion ${index + 1}`}
                                    disabled={criteria.length === 1}
                                    onClick={() =>
                                        setCriteria((current) =>
                                            current.filter(
                                                (entry) => entry.key !== criterion.key,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {error === null ? null : (
                    <p className="text-xs text-ink" role="alert">
                        {error}
                    </p>
                )}
                <div className="flex justify-end">
                    <Button
                        type="button"
                        loading={createRubric.isPending}
                        onClick={() => void onSubmit()}
                    >
                        Create rubric
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
