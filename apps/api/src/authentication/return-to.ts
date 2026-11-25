export function normalizeReturnTo(returnTo: string | null, workspaceOrigin: string): string {
    if (returnTo === null || returnTo.trim() === "") {
        return "/";
    }
    const value = returnTo.trim();
    if (value.startsWith("/") && !value.startsWith("//")) {
        let decoded = value;
        try {
            decoded = decodeURIComponent(value);
        } catch {
            return "/";
        }
        if (decoded.includes("\\") || decoded.startsWith("//")) {
            return "/";
        }
        return value.slice(0, 2048);
    }
    try {
        const url = new URL(value);
        if (url.origin === workspaceOrigin) {
            return `${url.pathname}${url.search}${url.hash}`.slice(0, 2048) || "/";
        }
    } catch {
        // Fall through to the safe default.
    }
    return "/";
}

