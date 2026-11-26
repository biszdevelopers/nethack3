import { useState, type ReactNode } from "react";
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
    Select,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    useToast,
} from "@nethack/ui";
import type { Announcement, AnnouncementVisibility } from "@nethack/contracts";
import { formatDateTime } from "../../shared/datetime.js";
import { describeError } from "../../shared/errors.js";
import { RequestError } from "../../shared/states.jsx";
import { useAnnouncements, useCreateAnnouncement, usePublishAnnouncement } from "../hooks.js";

const VISIBILITY_OPTIONS = [
    { value: "organization", label: "Organization members" },
    { value: "public", label: "Public site" },
] as const;

export interface AnnouncementEditionOption {
    readonly id: string;
    readonly name: string;
}

export function AnnouncementsPanel({
    organizationId,
    editions,
}: {
    readonly organizationId: string;
    readonly editions: readonly AnnouncementEditionOption[];
}): ReactNode {
    const { toast } = useToast();
    const announcements = useAnnouncements(organizationId);
    const createAnnouncement = useCreateAnnouncement(organizationId);
    const publishAnnouncement = usePublishAnnouncement();

    const [title, setTitle] = useState("");
    const [bodyMarkdown, setBodyMarkdown] = useState("");
    const [visibility, setVisibility] = useState<AnnouncementVisibility>("organization");
    const [editionId, setEditionId] = useState("none");
    const [publishNow, setPublishNow] = useState(false);

    const reset = (): void => {
        setTitle("");
        setBodyMarkdown("");
        setVisibility("organization");
        setEditionId("none");
        setPublishNow(false);
    };

    const onCreate = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (title.trim().length < 2) {
            toast({ title: "Give the announcement a title.", tone: "critical" });
            return;
        }
        try {
            await createAnnouncement.mutateAsync({
                title: title.trim(),
                bodyMarkdown,
                visibility,
                editionId: editionId === "none" ? null : editionId,
                publish: publishNow,
            });
            toast({
                title: publishNow ? "Announcement published" : "Announcement saved",
                tone: "success",
            });
            reset();
        } catch (error) {
            toast({
                title: "Could not save the announcement",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onPublish = async (announcement: Announcement): Promise<void> => {
        try {
            await publishAnnouncement.mutateAsync(announcement.id);
            toast({ title: "Announcement published", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not publish the announcement",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const editionOptions = [
        { value: "none", label: "All editions" },
        ...editions.map((edition) => ({ value: edition.id, label: edition.name })),
    ];
    const items = announcements.data?.items ?? [];
    const editionNames = new Map(editions.map((edition) => [edition.id, edition.name]));

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Publish an announcement</CardTitle>
                    <CardDescription>
                        Announcements reach the selected audience after they are published.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onCreate} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="announcement-title"
                                className="text-sm font-medium text-ink"
                            >
                                Title
                            </label>
                            <Input
                                id="announcement-title"
                                name="title"
                                value={title}
                                maxLength={160}
                                onChange={(event) => setTitle(event.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Select
                                    label="Competition edition"
                                    options={editionOptions}
                                    value={editionId}
                                    onValueChange={setEditionId}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Select
                                    label="Audience"
                                    options={VISIBILITY_OPTIONS}
                                    value={visibility}
                                    onValueChange={(value) =>
                                        setVisibility(value as AnnouncementVisibility)
                                    }
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="announcement-body"
                                className="text-sm font-medium text-ink"
                            >
                                Body <span className="text-ink-subtle">(optional)</span>
                            </label>
                            <Textarea
                                id="announcement-body"
                                name="bodyMarkdown"
                                rows={5}
                                value={bodyMarkdown}
                                onChange={(event) => setBodyMarkdown(event.target.value)}
                                placeholder="Markdown is supported."
                            />
                        </div>
                        <Switch
                            checked={publishNow}
                            onCheckedChange={setPublishNow}
                            label="Publish immediately"
                            description="Unpublished announcements stay as drafts for organizers."
                        />
                        {createAnnouncement.error === null ? null : (
                            <Alert tone="critical" title="The announcement could not be saved">
                                {describeError(createAnnouncement.error)}
                            </Alert>
                        )}
                        <div>
                            <Button type="submit" loading={createAnnouncement.isPending}>
                                Save announcement
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {announcements.isPending ? (
                <LoadingBlock rows={4} label="Loading announcements" />
            ) : announcements.isError ? (
                <RequestError
                    error={announcements.error}
                    onRetry={() => void announcements.refetch()}
                />
            ) : items.length === 0 ? (
                <EmptyState
                    title="No announcements yet"
                    description="Publish the first announcement to reach participants, judges, or the public site."
                />
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Announcement</TableHead>
                                <TableHead>Audience</TableHead>
                                <TableHead>Edition</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((announcement) => (
                                <TableRow key={announcement.id}>
                                    <TableCell>
                                        <span className="font-medium text-ink">
                                            {announcement.title}
                                        </span>
                                        <span className="block text-xs text-ink-muted">
                                            {announcement.authorDisplayName}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-ink-muted">
                                        {announcement.visibility === "public"
                                            ? "Public site"
                                            : "Organization"}
                                    </TableCell>
                                    <TableCell className="text-ink-muted">
                                        {announcement.editionId === null
                                            ? "All editions"
                                            : (editionNames.get(announcement.editionId) ??
                                              "Unknown edition")}
                                    </TableCell>
                                    <TableCell>
                                        {announcement.publishedAt === null ? (
                                            <Badge tone="neutral">Draft</Badge>
                                        ) : (
                                            <div className="flex flex-col gap-0.5">
                                                <Badge tone="primary">Published</Badge>
                                                <span className="text-xs text-ink-subtle">
                                                    {formatDateTime(announcement.publishedAt)}
                                                </span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {announcement.publishedAt === null ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                loading={publishAnnouncement.isPending}
                                                onClick={() => void onPublish(announcement)}
                                            >
                                                Publish
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
