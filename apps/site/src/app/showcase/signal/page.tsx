import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { PublicCompetition } from "@nethack/contracts";
import { getAllProjects, getCompetitions } from "@/lib/public-api";
import { getPublicResults } from "@/lib/recognition-api";
import { SignalExperience } from "@/components/showcase/signal-experience";
import { toShowcaseProject, toShowcaseStandings } from "@/components/showcase/showcase-server";
import type { ShowcaseProject } from "@/components/showcase/showcase-data";

export const metadata: Metadata = {
    title: "Signal showcase",
    description:
        "The Signal project showcase: the previous season's winners and the complete project archive.",
};

function previousEdition(competitions: readonly PublicCompetition[]): PublicCompetition | null {
    const withProjects = competitions.filter(
        (competition) => competition.publishedProjectCount > 0,
    );
    const completed = withProjects.filter(
        (competition) => competition.status === "completed" || competition.status === "archived",
    );
    const pool = completed.length > 0 ? completed : withProjects;
    return (
        [...pool].sort((left, right) => {
            const leftDate = left.endsAt ?? left.startsAt ?? "";
            const rightDate = right.endsAt ?? right.startsAt ?? "";
            return rightDate.localeCompare(leftDate);
        })[0] ?? null
    );
}

export default async function SignalShowcasePage(): Promise<ReactNode> {
    let projects: ShowcaseProject[] = [];
    let unavailable = false;
    try {
        const competitions = await getCompetitions();
        const edition = previousEdition(competitions.items);
        const [projectList, results] = await Promise.all([
            getAllProjects(edition?.slug),
            edition === null
                ? Promise.resolve(null)
                : getPublicResults(edition.slug).catch(() => null),
        ]);
        const standings = results === null ? undefined : toShowcaseStandings(results);
        projects = projectList.map((project) => toShowcaseProject(project, standings));
    } catch {
        unavailable = true;
    }

    return <SignalExperience projects={projects} unavailable={unavailable} />;
}
