import type { ReactNode } from "react";
import Link from "next/link";
import {
    ArrowRight,
    ArrowUpRight,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    Compass,
    Gavel,
    LayoutDashboard,
    ShieldCheck,
    Sparkles,
    Trophy,
    Users,
    Vote,
} from "lucide-react";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui/static";
import {
    AnimatedDisclosure,
    Magnetic,
    Parallax,
    Reveal,
    SplitTextReveal,
    StaggerReveal,
    Tilt,
} from "@nethack/ui/motion";
import { getCompetitions, getProjects } from "../lib/public-api";

const FEATURES = [
    {
        icon: ClipboardCheck,
        title: "Registration with decisions",
        body: "Open and close registration, review each request, and keep participant records tied to the right division.",
    },
    {
        icon: Users,
        title: "Teams that stay coherent",
        body: "Invitations, captain roles, capacity limits, and competition-wide eligibility are enforced by the API.",
    },
    {
        icon: Gavel,
        title: "Rubric-based judging",
        body: "Assign judges to specific projects, collect weighted scores and written feedback, and record conflicts of interest.",
    },
    {
        icon: Vote,
        title: "Voting with integrity",
        body: "One ballot per participant per round, with duplicate selections rejected transactionally.",
    },
    {
        icon: ShieldCheck,
        title: "Organization isolation",
        body: "Every request is scoped to an organization membership and backed by row-level security.",
    },
    {
        icon: LayoutDashboard,
        title: "One workspace",
        body: "Participants, judges, and organizers work from the same application with scoped permissions.",
    },
] as const;

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusLabel(status: string): string {
    return status.replaceAll("_", " ");
}

export default async function HomePage(): Promise<ReactNode> {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    let competitions: Awaited<ReturnType<typeof getCompetitions>> = {
        items: [],
        nextCursor: null,
    };
    let projects: Awaited<ReturnType<typeof getProjects>> = { items: [], nextCursor: null };
    let unavailable = false;
    try {
        [competitions, projects] = await Promise.all([getCompetitions(), getProjects()]);
    } catch {
        unavailable = true;
    }

    const openCompetition = competitions.items.find(
        (competition) =>
            competition.status === "registration_open" || competition.status === "published",
    );

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-20 overflow-x-clip px-4 py-10 sm:px-6 md:py-16 lg:px-8">
            <section className="relative flex max-w-4xl flex-col gap-6">
                <Parallax strength={28} className="pointer-events-none absolute -top-24 left-1/4">
                    <div
                        aria-hidden="true"
                        className="size-[28rem] rounded-full bg-primary/10 blur-[120px]"
                    />
                </Parallax>
                <Reveal y={-10} duration={0.6}>
                    <Badge variant="soft" color="primary" dot>
                        hackathon platform
                    </Badge>
                </Reveal>
                <SplitTextReveal
                    as="h1"
                    label="Welcome to nethack"
                    className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl"
                >
                    <span>Welcome to </span>
                    <span className="text-primary glow">nethack</span>
                    <span className="text-primary">.</span>
                </SplitTextReveal>
                <Reveal delay={0.1}>
                    <p className="max-w-3xl text-pretty text-base leading-8 text-ink-muted sm:text-lg">
                        nethack is the competition platform for organizations that run hackathons,
                        design sprints, and project programs. Register, form a team, submit work,
                        and follow every decision from one workspace.
                    </p>
                </Reveal>
                <Reveal delay={0.18} className="flex flex-wrap gap-3">
                    <Magnetic>
                        <Button asChild size="lg">
                            <Link href="/competitions">
                                Browse competitions
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                        </Button>
                    </Magnetic>
                    <Button asChild size="lg" variant="outline" color="neutral">
                        <a href={`${workspaceOrigin}/sign-in`}>
                            Open workspace
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                        </a>
                    </Button>
                </Reveal>

                {unavailable ? (
                    <Alert
                        variant="soft"
                        tone="warning"
                        title="Directory unavailable"
                        icon={<Compass className="size-4" />}
                    >
                        The public directory could not be reached. Competition and project data will
                        appear when the API is available.
                    </Alert>
                ) : openCompetition !== undefined ? (
                    <Reveal delay={0.24}>
                        <Link
                            href={`/competitions/${openCompetition.slug}`}
                            className="group flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/[0.07] p-4 transition-colors hover:border-primary/50 hover:bg-primary/10"
                        >
                            <CheckCircle2
                                className="mt-0.5 size-5 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-primary">
                                    {openCompetition.status === "registration_open"
                                        ? "Registration is open"
                                        : "A competition is published"}
                                </span>
                                <span className="text-sm text-ink-muted">
                                    {openCompetition.name} · {openCompetition.organizationName} ·{" "}
                                    {formatDate(
                                        openCompetition.registrationClosesAt ??
                                            openCompetition.startsAt,
                                    )}
                                </span>
                            </span>
                            <ArrowUpRight
                                className="ml-auto mt-0.5 size-4 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                aria-hidden="true"
                            />
                        </Link>
                    </Reveal>
                ) : (
                    <Alert
                        variant="soft"
                        tone="neutral"
                        title="No competitions published yet"
                        icon={<Trophy className="size-4" />}
                    >
                        When an organizer publishes an edition, it appears here with its schedule,
                        rules, and registration window.
                    </Alert>
                )}
            </section>

            <section className="flex flex-col gap-5" aria-labelledby="competitions-heading">
                <Reveal className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h2
                            id="competitions-heading"
                            className="text-2xl font-bold tracking-tight glow-sm sm:text-3xl"
                        >
                            Competitions
                        </h2>
                        <p className="text-sm text-ink-muted">
                            Published editions with real dates, rules, and project showcases.
                        </p>
                    </div>
                    <Link
                        href="/competitions"
                        className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                    >
                        View all
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </Reveal>

                {competitions.items.length === 0 ? (
                    <EmptyState
                        title="No competitions published yet"
                        description="Organizers publish competitions here when registration opens."
                    />
                ) : (
                    <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {competitions.items.slice(0, 6).map((competition) => (
                            <Tilt key={competition.editionId}>
                                <Card hoverable className="h-full bg-panel/80">
                                    <CardHeader>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-xs text-ink-subtle">
                                                {competition.organizationName}
                                            </span>
                                            <Badge variant="soft" color="primary" size="sm">
                                                {statusLabel(competition.status)}
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-lg">
                                            {competition.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-4">
                                        <p className="line-clamp-3 text-sm text-ink-muted">
                                            {competition.description}
                                        </p>
                                        <dl className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-ink-subtle">Team size</dt>
                                                <dd className="text-ink">
                                                    {competition.teamMinSize}–
                                                    {competition.teamMaxSize}
                                                </dd>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-ink-subtle">Starts</dt>
                                                <dd className="text-ink">
                                                    {formatDate(competition.startsAt)}
                                                </dd>
                                            </div>
                                        </dl>
                                        <Link
                                            href={`/competitions/${competition.slug}`}
                                            className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                                        >
                                            View competition
                                            <ArrowRight className="size-3.5" aria-hidden="true" />
                                        </Link>
                                    </CardContent>
                                </Card>
                            </Tilt>
                        ))}
                    </StaggerReveal>
                )}
            </section>

            <Reveal>
                <AnimatedDisclosure
                    title="How nethack runs a competition"
                    icon={<CalendarClock className="size-4 text-primary" aria-hidden="true" />}
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-primary">01 / register</span>
                            <h3 className="text-sm font-medium">Join an edition</h3>
                            <p className="text-sm text-ink-muted">
                                Sign in with Basis Auth, choose an open competition, and let an
                                organizer review your registration.
                            </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-primary">02 / build</span>
                            <h3 className="text-sm font-medium">Form a team and submit</h3>
                            <p className="text-sm text-ink-muted">
                                Invite approved participants, attach files, and submit a versioned
                                project before the deadline.
                            </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-primary">03 / decide</span>
                            <h3 className="text-sm font-medium">Review and publish results</h3>
                            <p className="text-sm text-ink-muted">
                                Judges score against a rubric, optional voting rounds run on real
                                ballots, and organizers publish outcomes.
                            </p>
                        </div>
                    </div>
                </AnimatedDisclosure>
            </Reveal>

            <section className="flex flex-col gap-5" aria-labelledby="features-heading">
                <Reveal className="flex flex-col gap-1">
                    <h2
                        id="features-heading"
                        className="text-2xl font-bold tracking-tight glow-sm sm:text-3xl"
                    >
                        Built for the whole competition
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Every stage has explicit rules, permissions, and an audit trail.
                    </p>
                </Reveal>
                <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <Card key={feature.title} variant="soft" className="h-full">
                                <CardContent className="flex flex-col gap-3 pt-5">
                                    <span className="inline-flex size-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                                        <Icon className="size-4" aria-hidden="true" />
                                    </span>
                                    <h3 className="text-sm font-medium">{feature.title}</h3>
                                    <p className="text-sm text-ink-muted">{feature.body}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </StaggerReveal>
            </section>

            <section className="flex flex-col gap-5" aria-labelledby="projects-heading">
                <Reveal className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h2
                            id="projects-heading"
                            className="text-2xl font-bold tracking-tight glow-sm sm:text-3xl"
                        >
                            Project showcase
                        </h2>
                        <p className="text-sm text-ink-muted">
                            Work that teams published after organizer review.
                        </p>
                    </div>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                    >
                        Browse all
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </Reveal>
                {projects.items.length === 0 ? (
                    <EmptyState
                        title="No published projects yet"
                        description="Published projects appear here after an organizer approves the public showcase."
                    />
                ) : (
                    <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {projects.items.slice(0, 6).map((project) => (
                            <Tilt key={project.id}>
                                <Card hoverable className="h-full bg-panel/80">
                                    <CardHeader>
                                        <span className="truncate text-xs text-ink-subtle">
                                            {project.competitionName}
                                        </span>
                                        <CardTitle className="text-lg">{project.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-3">
                                        <p className="line-clamp-3 text-sm text-ink-muted">
                                            {project.summary}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {project.tags.slice(0, 4).map((tag) => (
                                                <Badge key={tag} variant="outline" size="sm">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                        <Link
                                            href={`/projects/${project.slug}`}
                                            className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                                        >
                                            Open project
                                            <ArrowRight className="size-3.5" aria-hidden="true" />
                                        </Link>
                                    </CardContent>
                                </Card>
                            </Tilt>
                        ))}
                    </StaggerReveal>
                )}
            </section>

            <Reveal className="grid gap-4 rounded-xl border border-line bg-panel/60 p-6 md:grid-cols-[1.5fr_1fr] md:p-8">
                <div className="flex flex-col gap-3">
                    <span className="inline-flex items-center gap-2 text-xs text-primary">
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        start here
                    </span>
                    <h2 className="text-2xl font-bold tracking-tight">
                        Ready to compete or organize?
                    </h2>
                    <p className="max-w-xl text-sm text-ink-muted">
                        Participants join through the workspace. Organizers receive an organization
                        membership before creating a series or edition.
                    </p>
                </div>
                <div className="flex flex-col justify-center gap-2 md:items-end">
                    <Button asChild>
                        <a href={`${workspaceOrigin}/sign-in`}>
                            Open the workspace
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                        </a>
                    </Button>
                    <Button asChild variant="subtle" color="neutral">
                        <Link href="/about">Learn how review works</Link>
                    </Button>
                </div>
            </Reveal>
        </div>
    );
}
