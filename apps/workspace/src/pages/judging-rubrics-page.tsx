import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import type {
    JudgingRubric,
    RubricCommentGuidance,
    RubricTemplate,
    RubricTemplateTrack,
    ScoreCurvePoint,
} from "@nethack/contracts";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Input,
    LoadingBlock,
    PageHeader,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { useOrganizerEditions, useDivisions } from "../capabilities/competitions/hooks.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { describeError } from "../capabilities/shared/errors.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import {
    useApplyRubricTemplate,
    useArchiveRubric,
    useCreateRubric,
    useCreateRubricTemplate,
    useDeleteRubricTemplate,
    useEditionRubrics,
    useEditionScoreCurve,
    usePublishRubric,
    useRubricTemplateLibrary,
    useUpdateRubric,
    useUpdateRubricTemplate,
    useUpdateScoreCurve,
} from "../capabilities/judging/hooks.js";
import { curveScore, scoreCurveIssues } from "../capabilities/judging/scoring.js";

interface CriterionDraft {
    readonly key: number;
    name: string;
    description: string;
    minScore: string;
    maxScore: string;
    weight: string;
}

interface TemplateDraft {
    readonly key: number;
    label: string;
    body: string;
}

interface GuidanceDraft {
    introduction: string;
    guidelines: string;
    templates: readonly TemplateDraft[];
}

interface EditorState {
    readonly rubricId: string | null;
    name: string;
    description: string;
    divisionId: string;
    criteria: readonly CriterionDraft[];
    guidance: GuidanceDraft;
}

interface CurvePointDraft {
    readonly key: number;
    rawScore: string;
    displayScore: string;
}

let nextKey = 1;

function newCriterion(weight: string): CriterionDraft {
    return {
        key: nextKey++,
        name: "",
        description: "",
        minScore: "0",
        maxScore: "10",
        weight,
    };
}

function blankEditor(): EditorState {
    return {
        rubricId: null,
        name: "",
        description: "",
        divisionId: "",
        criteria: [newCriterion("100")],
        guidance: {
            introduction: "",
            guidelines: "",
            templates: [],
        },
    };
}

function editorFromRubric(rubric: JudgingRubric): EditorState {
    return {
        rubricId: rubric.id,
        name: rubric.name,
        description: rubric.description,
        divisionId: rubric.divisionId ?? "",
        criteria: rubric.criteria.map((criterion) => ({
            key: nextKey++,
            name: criterion.name,
            description: criterion.description,
            minScore: String(criterion.minScore),
            maxScore: String(criterion.maxScore),
            weight: String(criterion.weight),
        })),
        guidance: {
            introduction: rubric.commentGuidance.introduction,
            guidelines: rubric.commentGuidance.guidelines.join("\n"),
            templates: rubric.commentGuidance.templates.map((template) => ({
                key: nextKey++,
                label: template.label,
                body: template.body,
            })),
        },
    };
}

function editorFromTemplate(template: RubricTemplate, track: RubricTemplateTrack): EditorState {
    return {
        rubricId: null,
        name: `${template.name} — ${track.name}`,
        description: template.description,
        divisionId: "",
        criteria: track.criteria.map((criterion) => ({
            key: nextKey++,
            name: criterion.name,
            description: criterion.description,
            minScore: String(criterion.minScore),
            maxScore: String(criterion.maxScore),
            weight: String(criterion.weight),
        })),
        guidance: {
            introduction: template.definition.commentGuidance.introduction,
            guidelines: template.definition.commentGuidance.guidelines.join("\n"),
            templates: template.definition.commentGuidance.templates.map((entry) => ({
                key: nextKey++,
                label: entry.label,
                body: entry.body,
            })),
        },
    };
}

function parseGuidance(draft: GuidanceDraft): RubricCommentGuidance {
    return {
        introduction: draft.introduction.trim(),
        guidelines: draft.guidelines
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
        templates: draft.templates.map((template) => ({
            label: template.label.trim(),
            body: template.body.trim(),
        })),
    };
}

function validateEditor(editor: EditorState): readonly string[] {
    const issues: string[] = [];
    if (editor.name.trim().length < 2) {
        issues.push("Give the rubric a name of at least two characters.");
    }
    if (editor.criteria.length === 0) {
        issues.push("Add at least one criterion.");
    }
    let total = 0;
    for (const [index, criterion] of editor.criteria.entries()) {
        const label = criterion.name.trim() || `Criterion ${String(index + 1)}`;
        if (criterion.name.trim().length === 0) {
            issues.push(`${label} needs a name.`);
        }
        const min = Number.parseInt(criterion.minScore, 10);
        const max = Number.parseInt(criterion.maxScore, 10);
        const weight = Number.parseFloat(criterion.weight);
        if (
            !Number.isInteger(min) ||
            !Number.isInteger(max) ||
            min < 0 ||
            min > 99 ||
            max < 1 ||
            max > 100 ||
            max <= min
        ) {
            issues.push(`${label} needs an integer range with the maximum above the minimum.`);
        }
        if (!Number.isFinite(weight) || weight <= 0) {
            issues.push(`${label} needs a positive weight.`);
        }
        total += Number.isFinite(weight) ? weight : 0;
    }
    if (Math.abs(total - 100) > 0.001) {
        issues.push(`Criterion weights total ${String(Math.round(total * 100) / 100)}; use 100.`);
    }
    for (const template of editor.guidance.templates) {
        if (
            template.label.trim().length === 0 ||
            template.body.trim().length === 0 ||
            template.label.length > 120 ||
            template.body.length > 2000
        ) {
            issues.push("Every comment template needs a label and a body.");
        }
    }
    return [...new Set(issues)];
}

function criteriaPayload(editor: EditorState): {
    name: string;
    description: string;
    minScore: number;
    maxScore: number;
    weight: number;
}[] {
    return editor.criteria.map((criterion) => ({
        name: criterion.name.trim(),
        description: criterion.description.trim(),
        minScore: Number.parseInt(criterion.minScore, 10),
        maxScore: Number.parseInt(criterion.maxScore, 10),
        weight: Number.parseFloat(criterion.weight),
    }));
}

function weightTotal(editor: EditorState): number {
    return (
        Math.round(
            editor.criteria.reduce(
                (sum, criterion) => sum + (Number.parseFloat(criterion.weight) || 0),
                0,
            ) * 100,
        ) / 100
    );
}

function trackKey(editor: EditorState, divisions: readonly { id: string; slug: string }[]): string {
    const division = divisions.find((candidate) => candidate.id === editor.divisionId);
    return division?.slug ?? "edition";
}

function trackName(
    editor: EditorState,
    divisions: readonly { id: string; name: string }[],
): string {
    const division = divisions.find((candidate) => candidate.id === editor.divisionId);
    return division?.name ?? "Edition-wide";
}

export function JudgingRubricsPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const organizationId = membership?.organizationId ?? null;
    const isOrganizer = membership?.role === "owner" || membership?.role === "organizer";
    const editionId = searchParams.get("edition");
    const { toast } = useToast();

    const organizerEditions = useOrganizerEditions(organizationId, isOrganizer);
    const divisions = useDivisions(organizationId, editionId);
    const rubrics = useEditionRubrics(organizationId, isOrganizer ? editionId : null, true);
    const templates = useRubricTemplateLibrary(organizationId, isOrganizer);
    const scoreCurve = useEditionScoreCurve(organizationId, editionId);

    const createRubric = useCreateRubric(organizationId, editionId);
    const updateRubric = useUpdateRubric(organizationId, editionId);
    const publishRubric = usePublishRubric(organizationId, editionId);
    const archiveRubric = useArchiveRubric(organizationId, editionId);
    const applyTemplate = useApplyRubricTemplate(organizationId, editionId);
    const createTemplate = useCreateRubricTemplate(organizationId);
    const updateTemplate = useUpdateRubricTemplate(organizationId);
    const deleteTemplate = useDeleteRubricTemplate(organizationId);
    const updateCurve = useUpdateScoreCurve(organizationId, editionId);

    const [editorState, setEditor] = useState<EditorState | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [templateName, setTemplateName] = useState("");
    const [templateDescription, setTemplateDescription] = useState("");
    const [curveDraft, setCurveDraft] = useState<readonly CurvePointDraft[] | null>(null);

    const rubricItems = rubrics.data?.items ?? [];
    const templateItems = templates.data?.items ?? [];
    const divisionItems = divisions.data?.items ?? [];
    const preferredRubric =
        rubricItems.find((rubric) => rubric.active && rubric.divisionId === null) ??
        rubricItems.find((rubric) => rubric.active) ??
        rubricItems[0];
    const derivedEditor = useMemo(
        () => (preferredRubric === undefined ? blankEditor() : editorFromRubric(preferredRubric)),
        [preferredRubric],
    );
    const editor = editorState ?? derivedEditor;
    const serverCurvePoints = useMemo(
        () =>
            (scoreCurve.data?.curve.points ?? []).map((point) => ({
                key: nextKey++,
                rawScore: String(point.rawScore),
                displayScore: String(point.displayScore),
            })),
        [scoreCurve.data],
    );
    const curvePoints = curveDraft ?? serverCurvePoints;
    const editorIssues = validateEditor(editor);
    const curveIssues = scoreCurveIssues(
        curvePoints.map((point) => ({
            rawScore: Number.parseInt(point.rawScore, 10),
            displayScore: Number.parseInt(point.displayScore, 10),
        })),
    );

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading rubric manager" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <EmptyState
                title="No active organization"
                description="Select an organization membership to manage judging rubrics."
            />
        );
    }
    if (!isOrganizer) {
        return (
            <EmptyState
                title="Organizers only"
                description="Your organization role does not permit rubric management."
            />
        );
    }

    const selectEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
        setEditor(null);
        setCurveDraft(null);
    };

    const selectRubric = (rubric: JudgingRubric): void => {
        setEditor(editorFromRubric(rubric));
        setSelectedTemplateId(null);
        setTemplateName("");
        setTemplateDescription("");
    };

    const startNewRubric = (): void => {
        setEditor({
            ...blankEditor(),
            divisionId: editor.divisionId,
        });
        setSelectedTemplateId(null);
    };

    const patchEditor = (patch: Partial<EditorState>): void => {
        setEditor({ ...editor, ...patch });
    };

    const patchCriterion = (key: number, patch: Partial<CriterionDraft>): void => {
        setEditor({
            ...editor,
            criteria: editor.criteria.map((criterion) =>
                criterion.key === key ? { ...criterion, ...patch } : criterion,
            ),
        });
    };

    const patchGuidance = (patch: Partial<GuidanceDraft>): void => {
        setEditor({ ...editor, guidance: { ...editor.guidance, ...patch } });
    };

    const patchGuidanceTemplate = (key: number, patch: Partial<TemplateDraft>): void => {
        patchGuidance({
            templates: editor.guidance.templates.map((template) =>
                template.key === key ? { ...template, ...patch } : template,
            ),
        });
    };

    const saveRubric = async (): Promise<void> => {
        if (editorIssues.length > 0) {
            return;
        }
        const values = {
            name: editor.name.trim(),
            description: editor.description.trim(),
            divisionId: editor.divisionId.length === 0 ? null : editor.divisionId,
            commentGuidance: parseGuidance(editor.guidance),
            criteria: criteriaPayload(editor),
        };
        try {
            const saved =
                editor.rubricId === null
                    ? await createRubric.mutateAsync(values)
                    : await updateRubric.mutateAsync({
                          rubricId: editor.rubricId,
                          values,
                      });
            selectRubric(saved);
            toast({
                title:
                    editor.rubricId === null
                        ? "Rubric created"
                        : `Rubric version ${String(saved.version)} is active`,
                tone: "success",
            });
        } catch (error) {
            toast({
                title: "Could not save the rubric",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const changeActive = async (rubric: JudgingRubric, action: "publish" | "archive") => {
        try {
            const saved =
                action === "publish"
                    ? await publishRubric.mutateAsync(rubric.id)
                    : await archiveRubric.mutateAsync(rubric.id);
            selectRubric(saved);
            toast({
                title:
                    action === "publish" ? "Rubric version published" : "Rubric version archived",
                tone: "success",
            });
        } catch (error) {
            toast({
                title: "Could not change the rubric version",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const applyTemplateTrack = async (
        template: RubricTemplate,
        track: RubricTemplateTrack,
    ): Promise<void> => {
        try {
            const saved = await applyTemplate.mutateAsync({
                templateId: template.id,
                values: {
                    divisionId: editor.divisionId.length === 0 ? null : editor.divisionId,
                    trackKey: track.key,
                    name: `${template.name} — ${track.name}`,
                },
            });
            selectRubric(saved);
            toast({ title: "Template applied as a new rubric version", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not apply the template",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const saveTemplate = async (updateExisting: boolean): Promise<void> => {
        if (editorIssues.length > 0 || templateName.trim().length < 2) {
            toast({
                title:
                    templateName.trim().length < 2
                        ? "Enter a template name of at least two characters."
                        : "Fix the rubric issues before saving a template.",
                tone: "neutral",
            });
            return;
        }
        const key = trackKey(editor, divisionItems);
        const definition = {
            tracks: [
                {
                    key,
                    name: trackName(editor, divisionItems),
                    criteria: criteriaPayload(editor).map((criterion, index) => ({
                        ...criterion,
                        position: index,
                    })),
                },
            ],
            commentGuidance: parseGuidance(editor.guidance),
        };
        try {
            if (updateExisting && selectedTemplateId !== null) {
                await updateTemplate.mutateAsync({
                    templateId: selectedTemplateId,
                    values: {
                        name: templateName.trim(),
                        description: templateDescription.trim(),
                        definition,
                    },
                });
                toast({ title: "Template updated", tone: "success" });
            } else {
                const created = await createTemplate.mutateAsync({
                    name: templateName.trim(),
                    description: templateDescription.trim(),
                    definition,
                });
                setSelectedTemplateId(created.id);
                toast({ title: "Template saved", tone: "success" });
            }
        } catch (error) {
            toast({
                title: "Could not save the template",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const removeTemplate = async (template: RubricTemplate): Promise<void> => {
        try {
            await deleteTemplate.mutateAsync(template.id);
            if (selectedTemplateId === template.id) {
                setSelectedTemplateId(null);
            }
            toast({ title: "Template deleted", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not delete the template",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const loadTemplate = (template: RubricTemplate, track: RubricTemplateTrack): void => {
        setEditor({ ...editorFromTemplate(template, track), divisionId: editor.divisionId });
        setSelectedTemplateId(template.id);
        setTemplateName(template.name);
        setTemplateDescription(template.description);
    };

    const addCurvePoint = (): void => {
        const point = { key: nextKey++, rawScore: "50", displayScore: "50" };
        const next =
            curvePoints.length <= 1
                ? [...curvePoints, point]
                : [...curvePoints.slice(0, -1), point, ...curvePoints.slice(-1)];
        setCurveDraft(next);
    };

    const applyCurvePreset = (exponent: number): void => {
        setCurveDraft(
            [0, 25, 50, 75, 100].map((rawScore) => ({
                key: nextKey++,
                rawScore: String(rawScore),
                displayScore: String(Math.round(100 * Math.pow(rawScore / 100, exponent))),
            })),
        );
    };

    const patchCurvePoint = (key: number, patch: Partial<CurvePointDraft>): void => {
        setCurveDraft(
            curvePoints.map((point) => (point.key === key ? { ...point, ...patch } : point)),
        );
    };

    const removeCurvePoint = (key: number): void => {
        setCurveDraft(curvePoints.filter((point) => point.key !== key));
    };

    const saveCurve = async (): Promise<void> => {
        const points: ScoreCurvePoint[] = curvePoints.map((point) => ({
            rawScore: Number.parseInt(point.rawScore, 10),
            displayScore: Number.parseInt(point.displayScore, 10),
        }));
        try {
            await updateCurve.mutateAsync({ points });
            setCurveDraft(null);
            toast({ title: "Score curve saved", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not save the score curve",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const activeVersion = rubricItems.find((rubric) => rubric.active) ?? null;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Judging rubrics"
                description="Build division-scoped rubric versions, reuse templates, and tune the display score curve."
                actions={
                    activeVersion === null ? null : (
                        <Badge tone="primary">Active v{activeVersion.version}</Badge>
                    )
                }
            />

            {organizerEditions.query.isPending ? (
                <LoadingBlock rows={2} label="Loading editions" />
            ) : organizerEditions.query.isError ? (
                <RequestError
                    error={organizerEditions.query.error}
                    onRetry={() => void organizerEditions.query.refetch()}
                />
            ) : organizerEditions.editions.length === 0 ? (
                <EmptyState
                    title="No competition editions"
                    description="Create a competition edition before managing judging rubrics."
                />
            ) : (
                <div className="max-w-md">
                    <EditionSelect
                        editions={organizerEditions.editions}
                        value={editionId ?? ""}
                        onValueChange={selectEdition}
                    />
                </div>
            )}

            {editionId === null ? null : rubrics.isPending ? (
                <LoadingBlock rows={4} label="Loading rubrics" />
            ) : rubrics.isError ? (
                <RequestError error={rubrics.error} onRetry={() => void rubrics.refetch()} />
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <CardTitle>
                                        {editor.rubricId === null
                                            ? "New rubric version"
                                            : "Edit rubric version"}
                                    </CardTitle>
                                    <CardDescription>
                                        Saving creates a new immutable version. Existing assignments
                                        keep the version judges were given.
                                    </CardDescription>
                                </div>
                                <Button type="button" variant="outline" onClick={startNewRubric}>
                                    New rubric
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="rubric-name" className="text-sm font-medium">
                                        Name
                                    </label>
                                    <Input
                                        id="rubric-name"
                                        value={editor.name}
                                        maxLength={120}
                                        onChange={(event) =>
                                            patchEditor({ name: event.currentTarget.value })
                                        }
                                        placeholder="Overall judging rubric"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="rubric-description"
                                        className="text-sm font-medium"
                                    >
                                        Description
                                    </label>
                                    <Input
                                        id="rubric-description"
                                        value={editor.description}
                                        maxLength={2000}
                                        onChange={(event) =>
                                            patchEditor({
                                                description: event.currentTarget.value,
                                            })
                                        }
                                        placeholder="What this rubric measures"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Select
                                        label="Division"
                                        options={[
                                            { value: "", label: "Edition-wide" },
                                            ...divisionItems.map((division) => ({
                                                value: division.id,
                                                label: division.name,
                                            })),
                                        ]}
                                        value={editor.divisionId}
                                        onValueChange={(value) =>
                                            patchEditor({ divisionId: value })
                                        }
                                    />
                                    <span className="text-xs text-ink-subtle">
                                        Division-scoped rubrics apply only to that division.
                                    </span>
                                </div>
                                <div className="flex items-end justify-end" aria-live="polite">
                                    <Badge
                                        tone={weightTotal(editor) === 100 ? "primary" : "neutral"}
                                    >
                                        Weight total {weightTotal(editor)} / 100
                                    </Badge>
                                </div>
                            </div>

                            <section
                                aria-labelledby="criteria-heading"
                                className="flex flex-col gap-3"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h2
                                            id="criteria-heading"
                                            className="text-base font-semibold"
                                        >
                                            Criteria
                                        </h2>
                                        <p className="text-sm text-ink-muted">
                                            Judges score each criterion within its integer range.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            patchEditor({
                                                criteria: [...editor.criteria, newCriterion("0")],
                                            })
                                        }
                                    >
                                        Add criterion
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {editor.criteria.map((criterion, index) => (
                                        <div
                                            key={criterion.key}
                                            className="grid gap-3 rounded-md border border-line bg-raised/30 p-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_5rem_5rem_6rem_auto] md:items-end"
                                        >
                                            <div className="flex flex-col gap-1.5">
                                                <label
                                                    htmlFor={`criterion-name-${criterion.key}`}
                                                    className="text-xs text-ink-subtle"
                                                >
                                                    Criterion {index + 1} name
                                                </label>
                                                <Input
                                                    id={`criterion-name-${criterion.key}`}
                                                    value={criterion.name}
                                                    maxLength={120}
                                                    onChange={(event) =>
                                                        patchCriterion(criterion.key, {
                                                            name: event.currentTarget.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label
                                                    htmlFor={`criterion-description-${criterion.key}`}
                                                    className="text-xs text-ink-subtle"
                                                >
                                                    Description
                                                </label>
                                                <Input
                                                    id={`criterion-description-${criterion.key}`}
                                                    value={criterion.description}
                                                    maxLength={1000}
                                                    onChange={(event) =>
                                                        patchCriterion(criterion.key, {
                                                            description: event.currentTarget.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label
                                                    htmlFor={`criterion-min-${criterion.key}`}
                                                    className="text-xs text-ink-subtle"
                                                >
                                                    Minimum
                                                </label>
                                                <Input
                                                    id={`criterion-min-${criterion.key}`}
                                                    type="number"
                                                    min={0}
                                                    max={99}
                                                    value={criterion.minScore}
                                                    onChange={(event) =>
                                                        patchCriterion(criterion.key, {
                                                            minScore: event.currentTarget.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label
                                                    htmlFor={`criterion-max-${criterion.key}`}
                                                    className="text-xs text-ink-subtle"
                                                >
                                                    Maximum
                                                </label>
                                                <Input
                                                    id={`criterion-max-${criterion.key}`}
                                                    type="number"
                                                    min={1}
                                                    max={100}
                                                    value={criterion.maxScore}
                                                    onChange={(event) =>
                                                        patchCriterion(criterion.key, {
                                                            maxScore: event.currentTarget.value,
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
                                                    min={0.01}
                                                    max={100}
                                                    step={0.01}
                                                    value={criterion.weight}
                                                    onChange={(event) =>
                                                        patchCriterion(criterion.key, {
                                                            weight: event.currentTarget.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label={`Remove criterion ${String(index + 1)}`}
                                                    disabled={editor.criteria.length === 1}
                                                    onClick={() =>
                                                        patchEditor({
                                                            criteria: editor.criteria.filter(
                                                                (entry) =>
                                                                    entry.key !== criterion.key,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section
                                aria-labelledby="guidance-heading"
                                className="flex flex-col gap-3"
                            >
                                <div>
                                    <h2 id="guidance-heading" className="text-base font-semibold">
                                        Comment guidance
                                    </h2>
                                    <p className="text-sm text-ink-muted">
                                        Guidance and starter templates are stored on this rubric
                                        version.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="guidance-introduction"
                                        className="text-sm font-medium"
                                    >
                                        Introduction
                                    </label>
                                    <Textarea
                                        id="guidance-introduction"
                                        value={editor.guidance.introduction}
                                        maxLength={1000}
                                        onChange={(event) =>
                                            patchGuidance({
                                                introduction: event.currentTarget.value,
                                            })
                                        }
                                        placeholder="How judges should approach written feedback."
                                        className="min-h-20"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="guidance-guidelines"
                                        className="text-sm font-medium"
                                    >
                                        Guidelines (one per line)
                                    </label>
                                    <Textarea
                                        id="guidance-guidelines"
                                        value={editor.guidance.guidelines}
                                        onChange={(event) =>
                                            patchGuidance({
                                                guidelines: event.currentTarget.value,
                                            })
                                        }
                                        placeholder="Describe a strength and one next step."
                                        className="min-h-24"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium">
                                            Comment templates
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                patchGuidance({
                                                    templates: [
                                                        ...editor.guidance.templates,
                                                        { key: nextKey++, label: "", body: "" },
                                                    ],
                                                })
                                            }
                                        >
                                            Add template
                                        </Button>
                                    </div>
                                    {editor.guidance.templates.length === 0 ? (
                                        <p className="text-sm text-ink-muted">
                                            No templates. Judges can still write their own comment.
                                        </p>
                                    ) : (
                                        editor.guidance.templates.map((template) => (
                                            <div
                                                key={template.key}
                                                className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)_auto] md:items-end"
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        htmlFor={`template-label-${template.key}`}
                                                        className="text-xs text-ink-subtle"
                                                    >
                                                        Template label
                                                    </label>
                                                    <Input
                                                        id={`template-label-${template.key}`}
                                                        value={template.label}
                                                        maxLength={120}
                                                        onChange={(event) =>
                                                            patchGuidanceTemplate(template.key, {
                                                                label: event.currentTarget.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        htmlFor={`template-body-${template.key}`}
                                                        className="text-xs text-ink-subtle"
                                                    >
                                                        Template body
                                                    </label>
                                                    <Textarea
                                                        id={`template-body-${template.key}`}
                                                        value={template.body}
                                                        maxLength={2000}
                                                        onChange={(event) =>
                                                            patchGuidanceTemplate(template.key, {
                                                                body: event.currentTarget.value,
                                                            })
                                                        }
                                                        className="min-h-16"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label={`Remove template ${template.label || "entry"}`}
                                                    onClick={() =>
                                                        patchGuidance({
                                                            templates:
                                                                editor.guidance.templates.filter(
                                                                    (entry) =>
                                                                        entry.key !== template.key,
                                                                ),
                                                        })
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            {editorIssues.length === 0 ? null : (
                                <Alert tone="warning" title="Fix these details before saving">
                                    <ul className="list-disc space-y-1 ps-5">
                                        {editorIssues.slice(0, 8).map((issue) => (
                                            <li key={issue}>{issue}</li>
                                        ))}
                                    </ul>
                                </Alert>
                            )}

                            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                                <Button
                                    type="button"
                                    loading={
                                        editor.rubricId === null
                                            ? createRubric.isPending
                                            : updateRubric.isPending
                                    }
                                    disabled={editorIssues.length > 0}
                                    onClick={() => void saveRubric()}
                                >
                                    {editor.rubricId === null
                                        ? "Create rubric"
                                        : "Save new version"}
                                </Button>
                                {editor.rubricId === null ? null : (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            loading={publishRubric.isPending}
                                            onClick={() => {
                                                const rubric = rubricItems.find(
                                                    (candidate) => candidate.id === editor.rubricId,
                                                );
                                                if (rubric !== undefined) {
                                                    void changeActive(rubric, "publish");
                                                }
                                            }}
                                        >
                                            Publish this version
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            loading={archiveRubric.isPending}
                                            onClick={() => {
                                                const rubric = rubricItems.find(
                                                    (candidate) => candidate.id === editor.rubricId,
                                                );
                                                if (rubric !== undefined) {
                                                    void changeActive(rubric, "archive");
                                                }
                                            }}
                                        >
                                            Archive this version
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Template library</CardTitle>
                            <CardDescription>
                                Templates are organization-wide starting points. Applying one
                                creates a new rubric version without changing existing versions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="template-name" className="text-sm font-medium">
                                        Template name
                                    </label>
                                    <Input
                                        id="template-name"
                                        value={templateName}
                                        maxLength={120}
                                        onChange={(event) =>
                                            setTemplateName(event.currentTarget.value)
                                        }
                                        placeholder="Standard project rubric"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="template-description"
                                        className="text-sm font-medium"
                                    >
                                        Template description
                                    </label>
                                    <Input
                                        id="template-description"
                                        value={templateDescription}
                                        maxLength={1000}
                                        onChange={(event) =>
                                            setTemplateDescription(event.currentTarget.value)
                                        }
                                        placeholder="When to reuse this template"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    loading={createTemplate.isPending}
                                    onClick={() => void saveTemplate(false)}
                                >
                                    Save as new template
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={selectedTemplateId === null}
                                    loading={updateTemplate.isPending}
                                    onClick={() => void saveTemplate(true)}
                                >
                                    Update selected template
                                </Button>
                            </div>

                            {templates.isPending ? (
                                <LoadingBlock rows={2} label="Loading templates" />
                            ) : templates.isError ? (
                                <RequestError
                                    error={templates.error}
                                    onRetry={() => void templates.refetch()}
                                />
                            ) : templateItems.length === 0 ? (
                                <p className="text-sm text-ink-muted">No reusable templates yet.</p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {templateItems.map((template) => (
                                        <li
                                            key={template.id}
                                            className="flex flex-col gap-2 rounded-md border border-line p-3"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {template.name}
                                                    </p>
                                                    {template.description.length === 0 ? null : (
                                                        <p className="text-xs text-ink-muted">
                                                            {template.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    loading={deleteTemplate.isPending}
                                                    onClick={() => void removeTemplate(template)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {template.definition.tracks.map((track) => (
                                                    <span
                                                        key={track.key}
                                                        className="flex flex-wrap items-center gap-2"
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                loadTemplate(template, track)
                                                            }
                                                        >
                                                            Load {track.name}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            loading={applyTemplate.isPending}
                                                            onClick={() =>
                                                                void applyTemplateTrack(
                                                                    template,
                                                                    track,
                                                                )
                                                            }
                                                        >
                                                            Apply {track.name} to edition
                                                        </Button>
                                                    </span>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Score curve</CardTitle>
                            <CardDescription>
                                The curve changes only the displayed score. Raw weighted scores and
                                ranks stay unchanged.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {scoreCurve.isPending ? (
                                <LoadingBlock rows={2} label="Loading score curve" />
                            ) : scoreCurve.isError ? (
                                <RequestError
                                    error={scoreCurve.error}
                                    onRetry={() => void scoreCurve.refetch()}
                                />
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { label: "Original score", exponent: 1 },
                                            { label: "Gentle uplift", exponent: 0.9 },
                                            { label: "Moderate uplift", exponent: 0.8 },
                                            { label: "Strong uplift", exponent: 0.65 },
                                        ].map((preset) => (
                                            <Button
                                                key={preset.label}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => applyCurvePreset(preset.exponent)}
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {curvePoints.map((point, index) => (
                                            <div
                                                key={point.key}
                                                className="grid gap-3 rounded-md border border-line p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        htmlFor={`curve-raw-${point.key}`}
                                                        className="text-xs text-ink-subtle"
                                                    >
                                                        Raw score {index + 1}
                                                    </label>
                                                    <Input
                                                        id={`curve-raw-${point.key}`}
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={point.rawScore}
                                                        onChange={(event) =>
                                                            patchCurvePoint(point.key, {
                                                                rawScore: event.currentTarget.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        htmlFor={`curve-display-${point.key}`}
                                                        className="text-xs text-ink-subtle"
                                                    >
                                                        Display score {index + 1}
                                                    </label>
                                                    <Input
                                                        id={`curve-display-${point.key}`}
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={point.displayScore}
                                                        onChange={(event) =>
                                                            patchCurvePoint(point.key, {
                                                                displayScore:
                                                                    event.currentTarget.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label={`Remove curve point ${String(index + 1)}`}
                                                    disabled={curvePoints.length <= 2}
                                                    onClick={() => removeCurvePoint(point.key)}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    {curveIssues.length === 0 ? null : (
                                        <Alert tone="warning" title="Curve needs attention">
                                            <ul className="list-disc space-y-1 ps-5">
                                                {curveIssues.slice(0, 6).map((issue) => (
                                                    <li key={issue}>{issue}</li>
                                                ))}
                                            </ul>
                                        </Alert>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={addCurvePoint}
                                        >
                                            Add point
                                        </Button>
                                        <Button
                                            type="button"
                                            loading={updateCurve.isPending}
                                            disabled={curveIssues.length > 0}
                                            onClick={() => void saveCurve()}
                                        >
                                            Save curve
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setCurveDraft([
                                                    {
                                                        key: nextKey++,
                                                        rawScore: "0",
                                                        displayScore: "0",
                                                    },
                                                    {
                                                        key: nextKey++,
                                                        rawScore: "100",
                                                        displayScore: "100",
                                                    },
                                                ]);
                                            }}
                                        >
                                            Reset to original
                                        </Button>
                                    </div>
                                    <div className="rounded-md border border-line bg-raised/30 p-3">
                                        <p className="text-xs text-ink-subtle">Preview</p>
                                        <div className="mt-2 flex flex-wrap gap-3 text-sm">
                                            {[0, 25, 50, 75, 100].map((raw) => (
                                                <span key={raw} className="tabular-nums">
                                                    {raw} →{" "}
                                                    <span className="font-medium">
                                                        {curveScore(
                                                            raw,
                                                            curvePoints.map((point) => ({
                                                                rawScore: Number.parseInt(
                                                                    point.rawScore,
                                                                    10,
                                                                ),
                                                                displayScore: Number.parseInt(
                                                                    point.displayScore,
                                                                    10,
                                                                ),
                                                            })),
                                                        )}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Version history</CardTitle>
                            <CardDescription>
                                Assignments pin the version they were created with.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {rubricItems.length === 0 ? (
                                <EmptyState
                                    title="No rubric versions"
                                    description="Create the first rubric version above."
                                />
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Division</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rubricItems.map((rubric) => (
                                            <TableRow key={rubric.id}>
                                                <TableCell className="font-medium">
                                                    {rubric.name}
                                                </TableCell>
                                                <TableCell className="tabular-nums">
                                                    v{rubric.version}
                                                </TableCell>
                                                <TableCell>
                                                    {rubric.divisionId === null
                                                        ? "Edition-wide"
                                                        : (divisionItems.find(
                                                              (division) =>
                                                                  division.id === rubric.divisionId,
                                                          )?.name ?? "Division")}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        tone={rubric.active ? "primary" : "neutral"}
                                                    >
                                                        {rubric.active ? "Active" : "Archived"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="flex flex-wrap justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => selectRubric(rubric)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        {rubric.active ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                loading={archiveRubric.isPending}
                                                                onClick={() =>
                                                                    void changeActive(
                                                                        rubric,
                                                                        "archive",
                                                                    )
                                                                }
                                                            >
                                                                Archive
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                loading={publishRubric.isPending}
                                                                onClick={() =>
                                                                    void changeActive(
                                                                        rubric,
                                                                        "publish",
                                                                    )
                                                                }
                                                            >
                                                                Publish
                                                            </Button>
                                                        )}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
