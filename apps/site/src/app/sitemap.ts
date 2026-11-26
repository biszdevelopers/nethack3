import type { MetadataRoute } from "next";
import { getCompetitions, getProjects } from "../lib/public-api";

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes = ["", "/competitions", "/projects", "/announcements", "/about", "/faq"].map(
        (path) => ({
            url: `${SITE_ORIGIN}${path}`,
            lastModified: new Date(),
            changeFrequency: path === "" ? ("weekly" as const) : ("daily" as const),
            priority: path === "" ? 1 : 0.7,
        }),
    );

    try {
        const [competitions, projects] = await Promise.all([getCompetitions(), getProjects()]);
        return [
            ...staticRoutes,
            ...competitions.items.map((competition) => ({
                url: `${SITE_ORIGIN}/competitions/${competition.slug}`,
                lastModified: new Date(),
                changeFrequency: "daily" as const,
                priority: 0.8,
            })),
            ...projects.items.map((project) => ({
                url: `${SITE_ORIGIN}/projects/${project.slug}`,
                lastModified: project.publishedAt === null ? new Date() : new Date(project.publishedAt),
                changeFrequency: "weekly" as const,
                priority: 0.6,
            })),
        ];
    } catch {
        return staticRoutes;
    }
}
