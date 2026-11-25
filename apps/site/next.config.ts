import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    poweredByHeader: false,
    compress: true,
    productionBrowserSourceMaps: false,
    images: {
        dangerouslyAllowSVG: false,
        remotePatterns: [],
    },
    cacheComponents: false,
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "x-content-type-options", value: "nosniff" },
                    { key: "x-frame-options", value: "DENY" },
                    { key: "referrer-policy", value: "no-referrer" },
                    {
                        key: "permissions-policy",
                        value: "camera=(), microphone=(), geolocation=(), payment=()",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
