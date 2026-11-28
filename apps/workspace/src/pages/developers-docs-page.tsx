import type { ReactNode } from "react";
import {
    Badge,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    PageHeader,
} from "@nethack/ui";
import { ExternalLink } from "lucide-react";

const REPOSITORY_DOCS = "https://github.com/biszdevelopers/nethack/blob/main/docs";

interface DocumentEntry {
    readonly path: string;
    readonly title: string;
    readonly description: string;
}

interface DocumentGroup {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly documents: readonly DocumentEntry[];
}

const DOCUMENT_GROUPS: readonly DocumentGroup[] = [
    {
        id: "architecture",
        title: "Architecture",
        description: "System boundaries, capabilities, data ownership, and recorded decisions.",
        documents: [
            {
                path: "architecture/overview.md",
                title: "Overview",
                description: "Applications, boundaries, and runtime topology.",
            },
            {
                path: "architecture/capability-architecture.md",
                title: "Capability architecture",
                description: "Capabilities, contracts, events, and extraction.",
            },
            {
                path: "architecture/core.md",
                title: "Core",
                description: "Registration, lifecycle, configuration, and error handling.",
            },
            {
                path: "architecture/data-ownership.md",
                title: "Data ownership",
                description: "Which capability owns which tables and reads.",
            },
            {
                path: "architecture/dependency-rules.md",
                title: "Dependency rules",
                description: "Allowed imports and contract boundaries.",
            },
            {
                path: "architecture/runtime-boundaries.md",
                title: "Runtime boundaries",
                description: "Node, Bun, site, workspace, and API separation.",
            },
            {
                path: "architecture/decisions/ADR-001-capability-architecture.md",
                title: "ADR-001: Capability architecture",
                description: "Static capability composition and public contracts.",
            },
            {
                path: "architecture/decisions/ADR-002-site-workspace-separation.md",
                title: "ADR-002: Site and workspace separation",
                description: "Public rendering and authenticated application boundaries.",
            },
            {
                path: "architecture/decisions/ADR-003-basis-auth.md",
                title: "ADR-003: Basis Auth",
                description: "Identity delegation and downstream authentication.",
            },
            {
                path: "architecture/decisions/ADR-004-node-bun-compatibility.md",
                title: "ADR-004: Node and Bun compatibility",
                description: "One implementation with two supported production runtimes.",
            },
            {
                path: "architecture/decisions/ADR-005-organization-aware-database.md",
                title: "ADR-005: Organization-aware database",
                description: "Tenant context and row-level security.",
            },
            {
                path: "architecture/decisions/ADR-006-session-token-storage.md",
                title: "ADR-006: Session token storage",
                description: "Server-side encrypted identity-provider tokens.",
            },
            {
                path: "architecture/decisions/ADR-007-nethack-ui.md",
                title: "ADR-007: Nethack UI",
                description: "Source-owned components and design tokens.",
            },
            {
                path: "architecture/decisions/ADR-008-tenant-cache-isolation.md",
                title: "ADR-008: Tenant cache isolation",
                description: "Query-key isolation across organizations.",
            },
            {
                path: "architecture/decisions/ADR-009-visual-parity-and-gsap.md",
                title: "ADR-009: Visual parity and GSAP",
                description: "Motion, accessibility, and reduced-motion rules.",
            },
        ],
    },
    {
        id: "engineering",
        title: "Engineering",
        description: "Language, framework, UI, testing, and build standards.",
        documents: [
            {
                path: "engineering/constitution.md",
                title: "Engineering constitution",
                description: "The condensed engineering law for the repository.",
            },
            {
                path: "engineering/coding-standards.md",
                title: "Coding standards",
                description: "TypeScript, naming, formatting, and repository conventions.",
            },
            {
                path: "engineering/typescript.md",
                title: "TypeScript",
                description: "Strict typing, validation, and exhaustive state handling.",
            },
            {
                path: "engineering/react.md",
                title: "React",
                description: "Component, state, and data-fetching conventions.",
            },
            {
                path: "engineering/ui-system.md",
                title: "Nethack UI",
                description: "Tokens, component coverage, accessibility, and motion.",
            },
            {
                path: "engineering/testing.md",
                title: "Testing",
                description: "Unit, integration, security, architecture, visual, and E2E tests.",
            },
            {
                path: "engineering/performance.md",
                title: "Performance",
                description: "Measured performance expectations and profiling.",
            },
            {
                path: "engineering/build-system.md",
                title: "Build system",
                description: "Workspace commands, outputs, and runtime verification.",
            },
        ],
    },
    {
        id: "security",
        title: "Security",
        description: "Threat model, authentication, authorization, isolation, and response.",
        documents: [
            {
                path: "security/threat-model.md",
                title: "Threat model",
                description: "Assets, trust boundaries, and mitigations.",
            },
            {
                path: "security/security-requirements.md",
                title: "Security requirements",
                description: "Mandatory controls for changes to the platform.",
            },
            {
                path: "security/authentication.md",
                title: "Authentication",
                description: "Basis Auth flow and application session lifecycle.",
            },
            {
                path: "security/authorization.md",
                title: "Authorization",
                description: "Organization roles and global administrator grants.",
            },
            {
                path: "security/tenant-isolation.md",
                title: "Tenant isolation",
                description: "Organization scope, row-level security, and contract boundaries.",
            },
            {
                path: "security/file-security.md",
                title: "File security",
                description: "Upload inspection, storage, and download rules.",
            },
            {
                path: "security/incident-response.md",
                title: "Incident response",
                description: "Detection, containment, and disclosure.",
            },
        ],
    },
    {
        id: "operations",
        title: "Operations",
        description: "Local development, deployment, backups, monitoring, and troubleshooting.",
        documents: [
            {
                path: "operations/development.md",
                title: "Development",
                description: "Local setup, database, runtime, and commands.",
            },
            {
                path: "operations/deployment.md",
                title: "Deployment",
                description: "Node and Bun container targets and production checks.",
            },
            {
                path: "operations/backups.md",
                title: "Backups",
                description: "Database backup, retention, and restore procedure.",
            },
            {
                path: "operations/monitoring.md",
                title: "Monitoring",
                description: "Health checks, logs, traces, and alerts.",
            },
            {
                path: "operations/troubleshooting.md",
                title: "Troubleshooting",
                description: "Common failures and their verified causes.",
            },
        ],
    },
    {
        id: "integrations",
        title: "Integrations",
        description: "External contracts the platform depends on.",
        documents: [
            {
                path: "integrations/basis-auth.md",
                title: "Basis Auth",
                description: "The downstream identity-provider contract.",
            },
        ],
    },
    {
        id: "implementation",
        title: "Implementation records",
        description: "Requirement coverage and platform audit records.",
        documents: [
            {
                path: "implementation/REQUIREMENT_TRACKER.md",
                title: "Requirement tracker",
                description: "Every specification requirement and its verification.",
            },
            {
                path: "implementation/platform-audit.md",
                title: "Platform audit",
                description: "Coverage and boundary audit of the implemented platform.",
            },
            {
                path: "implementation/migration-spec.md",
                title: "Migration specification",
                description: "Reference migration rules and fixture contract.",
            },
        ],
    },
] as const;

export function DevelopersDocsPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Documentation"
                description="The repository engineering handbook. These links open the source documents; no deployment-specific credentials are included."
                actions={<Badge tone="outline">Repository documents</Badge>}
            />

            <Card variant="soft">
                <CardHeader>
                    <CardTitle>Start here</CardTitle>
                    <CardDescription>
                        The handbook index, then the constitution and architecture overview. A
                        public documentation site is not published for this deployment, so each
                        entry links to the repository source.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <a
                        href={`${REPOSITORY_DOCS}/README.md`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                    >
                        docs/README.md - handbook index
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                {DOCUMENT_GROUPS.map((group) => (
                    <section key={group.id} aria-labelledby={`docs-${group.id}-heading`}>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle id={`docs-${group.id}-heading`}>{group.title}</CardTitle>
                                <CardDescription>{group.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="flex flex-col divide-y divide-line">
                                    {group.documents.map((document) => (
                                        <li key={document.path}>
                                            <a
                                                href={`${REPOSITORY_DOCS}/${document.path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex min-h-11 flex-col gap-0.5 py-3 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                                    {document.title}
                                                    <ExternalLink
                                                        className="size-3 text-ink-subtle"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="text-xs text-ink-muted">
                                                    {document.description}
                                                </span>
                                                <span className="text-[11px] text-ink-subtle">
                                                    docs/{document.path}
                                                </span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </section>
                ))}
            </div>
        </div>
    );
}

export const DeveloperDocsPage = DevelopersDocsPage;
