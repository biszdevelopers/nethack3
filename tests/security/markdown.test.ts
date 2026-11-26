import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Markdown } from "../../packages/ui/src/components/markdown.js";

function render(source: string): string {
    return renderToStaticMarkup(createElement(Markdown, { source }));
}

describe("markdown rendering", () => {
    it("escapes raw HTML instead of interpreting it", () => {
        const html = render('<script>alert("xss")</script>\n\n<img src=x onerror=alert(1)>');
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("<img");
        expect(html).toContain("&lt;script&gt;");
    });

    it("rejects dangerous link schemes", () => {
        const html = render("[click](javascript:alert(1)) [data](data:text/html;base64,abc)");
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("data:text/html");
        expect(html).toContain("click");
    });

    it("renders allowlisted links with safe rel attributes", () => {
        const html = render("[nethack](https://example.com/path)");
        expect(html).toContain('href="https://example.com/path"');
        expect(html).toContain('rel="noopener noreferrer nofollow"');
    });

    it("does not treat inline HTML tags as markup", () => {
        const html = render("Use <b>bold</b> and <iframe src=//evil.test></iframe>");
        expect(html).not.toContain("<b>");
        expect(html).not.toContain("<iframe");
    });

    it("renders headings, lists, code, and emphasis", () => {
        const html = render("## Heading\n\n- one\n- two\n\n`code` and **strong** and *em*");
        expect(html).toContain("<h3");
        expect(html).toContain("<ul");
        expect(html).toContain("<code");
        expect(html).toContain("<strong>strong</strong>");
        expect(html).toContain("<em>em</em>");
    });

    it("keeps fenced code literal", () => {
        const html = render("```\n<script>alert(1)</script>\n```");
        expect(html).toContain("<pre");
        expect(html).toContain("&lt;script&gt;");
        expect(html).not.toContain("<script>");
    });
});
