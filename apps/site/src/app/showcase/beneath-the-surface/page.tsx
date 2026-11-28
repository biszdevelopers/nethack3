import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getProjects } from "@/lib/public-api";
import {
    BeneathTheSurfaceExperience,
    type BeneathWinnerView,
} from "@/components/showcase/beneath-the-surface";
import { toShowcaseProject } from "@/components/showcase/showcase-server";
import { BENEATH_WINNERS, type ShowcaseProject } from "@/components/showcase/showcase-data";

export const metadata: Metadata = {
    title: "Beneath the Surface",
    description:
        "Descend through six award-winning projects from the Beneath the Surface season, with the top three discoveries from each pathway.",
};

export default async function BeneathTheSurfacePage(): Promise<ReactNode> {
    let winners: BeneathWinnerView[] = BENEATH_WINNERS.map((winner) => ({
        ...winner,
        project: null,
    }));
    let unavailable = false;

    try {
        const response = await getProjects();
        const byTitle = new Map<string, ShowcaseProject>(
            response.items.map((project) => [
                project.title.trim().toLowerCase(),
                toShowcaseProject(project),
            ]),
        );
        winners = BENEATH_WINNERS.map((winner) => ({
            ...winner,
            project: byTitle.get(winner.projectName.trim().toLowerCase()) ?? null,
        }));
    } catch {
        unavailable = true;
    }

    return <BeneathTheSurfaceExperience winners={winners} unavailable={unavailable} />;
}
