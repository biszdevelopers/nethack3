import type { MetadataRoute } from "next";
import { getAllProjects, getCompetitions } from "../lib/public-api";

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes = [
        "",
        "/competitions",
        "/projects",
        "/results",
        "/announcements",
        "/showcase",
        "/showcase/signal",
        "/showcase/beneath-the-surface",
        "/about",
        "/faq",
        "/contact",
        "/contributing",
    ].map((path) => ({
        url: `${SITE_ORIGIN}${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? ("weekly" as const) : ("daily" as const),
        priority: path === "" ? 1 : 0.7,
    }));

    try {
        const [competitions, projects] = await Promise.all([getCompetitions(), getAllProjects()]);
        return [
            ...staticRoutes,
            ...competitions.items.flatMap((competition) => [
                {
                    url: `${SITE_ORIGIN}/competitions/${competition.slug}`,
                    lastModified: new Date(),
                    changeFrequency: "daily" as const,
                    priority: 0.8,
                },
                {
                    url: `${SITE_ORIGIN}/seasons/${competition.slug}`,
                    lastModified: new Date(),
                    changeFrequency: "weekly" as const,
                    priority: 0.5,
                },
                {
                    url: `${SITE_ORIGIN}/showcase/seasons/${competition.slug}`,
                    lastModified: new Date(),
                    changeFrequency: "weekly" as const,
                    priority: 0.5,
                },
            ]),
            ...projects.map((project) => ({
                url: `${SITE_ORIGIN}/projects/${project.slug}`,
                lastModified:
                    project.publishedAt === null ? new Date() : new Date(project.publishedAt),
                changeFrequency: "weekly" as const,
                priority: 0.6,
            })),
        ];
    } catch {
        return staticRoutes;
    }
}
