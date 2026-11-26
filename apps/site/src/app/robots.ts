import type { MetadataRoute } from "next";

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/_next/"],
            },
        ],
        sitemap: `${SITE_ORIGIN}/sitemap.xml`,
        host: SITE_ORIGIN,
    };
}
