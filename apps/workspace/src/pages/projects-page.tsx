import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@nethack/ui";
import { useActiveMembership, useSession } from "../application/session.js";
import { OrganizationRequired } from "../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../components/query-state.js";
import { formatDateTime } from "../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../lib/status.js";
import { useMyParticipations } from "../capabilities/competitions/hooks/use-competitions.js";
import { CreateProjectDialog } from "../capabilities/projects/components/create-project-dialog.js";
import { useProjects } from "../capabilities/projects/hooks/use-projects.js";
import { useMyTeams } from "../capabilities/teams/hooks/use-teams.js";

export function ProjectsPage(): ReactNode {
    const { membership } = useActiveMembership();
    const session = useSession();
    const navigate = useNavigate();
    const [createOpen, setCreateOpen] = useState(false);
    const projects = useProjects({});
    const participations = useMyParticipations();
    const myTeams = useMyTeams();

    if (membership === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeading />
                <OrganizationRequired />
            </div>
        );
    }

    const organizationParticipations = (participations.data?.items ?? []).filter(
        (participation) => participation.organizationId === membership.organizationId,
    );
    const approved = organizationParticipations.filter(
        (participation) => participation.status === "approved",
    );
    const teams = myTeams.data?.items ?? [];
    const teamIds = new Set(teams.map((team) => team.id));
    const userId = session.data?.user.id ?? null;
    const visibleProjects = (projects.data?.items ?? []).filter(
        (project) =>
            project.ownerUserId === userId ||
            (project.teamId !== null && teamIds.has(project.teamId)),
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <PageHeading />
                <Button
                    onClick={() => setCreateOpen(true)}
                    disabled={approved.length === 0}
                    aria-describedby={
                        approved.length === 0 ? "create-project-requirement" : undefined
                    }
                >
                    New project
                </Button>
            </div>
            {approved.length === 0 ? (
                <p id="create-project-requirement" className="text-xs text-ink-muted">
                    An approved registration is required before creating a project.
                </p>
            ) : null}

            {projects.isPending || participations.isPending || myTeams.isPending ? (
                <QueryLoading label="Loading projects" />
            ) : projects.error !== null ? (
                <QueryErrorState error={projects.error} />
            ) : visibleProjects.length === 0 ? (
                <EmptyState
                    title="No projects yet"
                    description="Create a project for an edition you are registered for, or join a team to work on its project."
                    action={
                        approved.length === 0 ? undefined : (
                            <Button variant="outline" onClick={() => setCreateOpen(true)}>
                                New project
                            </Button>
                        )
                    }
                />
            ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                    {visibleProjects.map((project) => (
                        <li key={project.id}>
                            <Card hoverable className="flex h-full flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <CardTitle>{project.title}</CardTitle>
                                        <Badge tone={statusBadgeTone(project.status)} size="sm">
                                            {humanizeStatus(project.status)}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-ink-subtle">
                                        Updated {formatDateTime(project.updatedAt)}
                                    </p>
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col gap-3">
                                    <p className="text-sm text-ink-muted">{project.summary}</p>
                                    {project.tags.length === 0 ? null : (
                                        <div className="flex flex-wrap gap-2">
                                            {project.tags.map((tag) => (
                                                <Badge key={tag} tone="neutral" size="sm">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    <div className="mt-auto flex flex-wrap items-center gap-2">
                                        <Button asChild variant="outline" size="sm">
                                            <Link to={`/projects/${project.id}`}>Open project</Link>
                                        </Button>
                                        {project.repositoryUrl === null ? null : (
                                            <Button asChild variant="ghost" size="sm">
                                                <a
                                                    href={project.repositoryUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Repository
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <CreateProjectDialog
                participations={organizationParticipations}
                teams={teams}
                defaultEditionId={approved[0]?.editionId ?? null}
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(projectId) => {
                    navigate(`/projects/${projectId}`);
                }}
            />
        </div>
    );
}

function PageHeading(): ReactNode {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight glow-sm">Projects</h1>
            <p className="text-sm text-ink-muted">
                Describe your work, attach files, and publish a showcase entry.
            </p>
        </div>
    );
}
