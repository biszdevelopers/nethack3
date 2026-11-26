import type { ReactNode } from "react";

const SAFE_LINK = /^(https?:\/\/|\/|#)/i;

function inline(text: string, keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        const token = match[0];
        const key = `${keyPrefix}-${index++}`;
        if (token.startsWith("**")) {
            nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith("`")) {
            nodes.push(
                <code key={key} className="rounded-sm bg-raised px-1 py-0.5 font-mono text-[0.9em]">
                    {token.slice(1, -1)}
                </code>,
            );
        } else if (token.startsWith("*")) {
            nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
        } else {
            const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
            if (linkMatch === null) {
                nodes.push(token);
            } else {
                const label = linkMatch[1] ?? "";
                const href = linkMatch[2] ?? "";
                nodes.push(
                    SAFE_LINK.test(href) ? (
                        <a
                            key={key}
                            href={href}
                            className="text-primary underline-offset-4 hover:underline"
                            rel="noopener noreferrer nofollow"
                            {...(href.startsWith("http") ? { target: "_blank" } : {})}
                        >
                            {label}
                        </a>
                    ) : (
                        label
                    ),
                );
            }
        }
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }
    return nodes;
}

/**
 * Renders the small markdown subset nethack accepts. Raw HTML is never
 * interpreted and link schemes are restricted to http(s), root-relative paths,
 * and fragments. Time O(n), space O(n) in input length.
 */
export function Markdown({ source }: { readonly source: string }): ReactNode {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const blocks: ReactNode[] = [];
    let paragraph: string[] = [];
    let list: string[] = [];
    let code: string[] | null = null;
    let key = 0;

    const flushParagraph = (): void => {
        if (paragraph.length === 0) {
            return;
        }
        blocks.push(
            <p key={`p-${key++}`} className="text-sm leading-6 text-ink-muted">
                {inline(paragraph.join(" "), `p-${key}`)}
            </p>,
        );
        paragraph = [];
    };
    const flushList = (): void => {
        if (list.length === 0) {
            return;
        }
        blocks.push(
            <ul
                key={`ul-${key++}`}
                className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted"
            >
                {list.map((item, index) => (
                    <li key={`li-${index}`}>{inline(item, `li-${index}`)}</li>
                ))}
            </ul>,
        );
        list = [];
    };
    const flushCode = (): void => {
        if (code === null) {
            return;
        }
        blocks.push(
            <pre
                key={`code-${key++}`}
                className="overflow-x-auto rounded-md border border-line bg-panel p-3 text-xs text-ink"
            >
                <code>{code.join("\n")}</code>
            </pre>,
        );
        code = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.startsWith("```")) {
            if (code === null) {
                flushParagraph();
                flushList();
                code = [];
            } else {
                flushCode();
            }
            continue;
        }
        if (code !== null) {
            code.push(rawLine);
            continue;
        }
        if (line.trim().length === 0) {
            flushParagraph();
            flushList();
            continue;
        }
        const heading = /^(#{1,4})\s+(.*)$/.exec(line);
        if (heading !== null) {
            flushParagraph();
            flushList();
            const level = heading[1]?.length ?? 1;
            const content = heading[2] ?? "";
            const className =
                level === 1
                    ? "text-xl font-semibold"
                    : level === 2
                      ? "text-lg font-semibold"
                      : "text-base font-semibold";
            blocks.push(
                level === 1 ? (
                    <h2 key={`h-${key++}`} className={className}>
                        {inline(content, `h-${key}`)}
                    </h2>
                ) : level === 2 ? (
                    <h3 key={`h-${key++}`} className={className}>
                        {inline(content, `h-${key}`)}
                    </h3>
                ) : (
                    <h4 key={`h-${key++}`} className={className}>
                        {inline(content, `h-${key}`)}
                    </h4>
                ),
            );
            continue;
        }
        const bullet = /^[-*]\s+(.*)$/.exec(line);
        if (bullet !== null) {
            flushParagraph();
            list.push(bullet[1] ?? "");
            continue;
        }
        flushList();
        paragraph.push(line.trim());
    }
    flushParagraph();
    flushList();
    flushCode();

    if (blocks.length === 0) {
        return <p className="text-sm text-ink-subtle">No content.</p>;
    }
    return <div className="flex flex-col gap-3">{blocks}</div>;
}

export function plainSummary(markdown: string, maxLength = 200): string {
    const text = markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/[#*_`>[\]()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
