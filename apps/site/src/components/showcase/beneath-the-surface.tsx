"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, GitBranch, Play, ArrowUpRight } from "lucide-react";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@nethack/ui";
import { Markdown } from "@nethack/ui/static";
import { gsap, ScrollTrigger, prefersReducedMotion, useIsoLayoutEffect } from "@nethack/ui/motion";
import { BackToTop } from "./back-to-top";
import {
    pathwayLabel,
    rankLabel,
    safeExternalUrl,
    type BeneathTheme,
    type BeneathWinner,
    type ShowcaseProject,
} from "./showcase-data";
import styles from "./beneath-the-surface.module.css";

export interface BeneathWinnerView extends BeneathWinner {
    readonly project: ShowcaseProject | null;
}

const THEME_CLASS: Readonly<Record<BeneathTheme, string>> = {
    rainbow: styles.themeRainbow ?? "",
    land: styles.themeLand ?? "",
    forest: styles.themeForest ?? "",
    metadata: styles.themeMetadata ?? "",
    unseen: styles.themeUnseen ?? "",
    trace: styles.themeTrace ?? "",
};

const MEDAL_CLASS: Readonly<Record<1 | 2 | 3, string>> = {
    1: styles.medalR1 ?? "",
    2: styles.medalR2 ?? "",
    3: styles.medalR3 ?? "",
};

function ProjectLinks({ project }: { readonly project: ShowcaseProject | null }): ReactNode {
    if (project === null) {
        return (
            <p className={styles.projectUnavailable}>
                Live links for this archived project are currently unavailable.
            </p>
        );
    }
    const repository = safeExternalUrl(project.repositoryUrl);
    const demo = safeExternalUrl(project.demoUrl);
    return (
        <div className={styles.modalLinks}>
            <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${project.slug}`}>
                    Open project page
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
            </Button>
            {repository === null ? null : (
                <Button asChild variant="subtle" color="neutral" size="sm">
                    <a href={repository} target="_blank" rel="noopener noreferrer">
                        <GitBranch className="size-4" aria-hidden="true" />
                        Repository
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </Button>
            )}
            {demo === null ? null : (
                <Button asChild variant="subtle" color="neutral" size="sm">
                    <a href={demo} target="_blank" rel="noopener noreferrer">
                        <Play className="size-4" aria-hidden="true" />
                        Live demo
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </Button>
            )}
        </div>
    );
}

function ProjectDialog({ winner }: { readonly winner: BeneathWinnerView }): ReactNode {
    const title = winner.project?.title ?? winner.projectName;
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" size="lg" aria-label={`Open project: ${title}`}>
                    Open project
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl border-line bg-panel">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {pathwayLabel(winner.pathway)} · {rankLabel(winner.rank)} · Built by{" "}
                        {winner.project?.teamName ?? winner.teamName}
                    </DialogDescription>
                </DialogHeader>
                <div className={styles.modalBody}>
                    <p className={styles.modalLede}>
                        <span className="text-ink">{winner.chapter}</span> {winner.lede}
                    </p>
                    {winner.project === null ? (
                        <p className="text-sm leading-6 text-ink-muted">
                            This archived showcase entry is preserved here. The live project record
                            is not currently available through the public API.
                        </p>
                    ) : (
                        <div className="prose-nethack break-words">
                            <Markdown source={winner.project.descriptionMarkdown} />
                        </div>
                    )}
                    {winner.project === null || winner.project.tags.length === 0 ? null : (
                        <p className="flex flex-wrap gap-2 text-xs text-ink-subtle">
                            {winner.project.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="border border-line px-1.5 py-0.5 text-ink-muted"
                                >
                                    {tag}
                                </span>
                            ))}
                        </p>
                    )}
                    <ProjectLinks project={winner.project} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ProjectVisual({ theme }: { readonly theme: BeneathTheme }): ReactNode {
    if (theme === "rainbow") {
        return (
            <>
                <div className={styles.tokyoSun} data-art="" />
                <div className={styles.rainField} data-art="">
                    {Array.from({ length: 16 }, (_, drop) => (
                        <i key={drop} />
                    ))}
                </div>
                <div className={styles.cityBlocks} data-art="">
                    {Array.from({ length: 8 }, (_, building) => (
                        <i key={building} />
                    ))}
                </div>
                <div
                    className={`${styles.dialogue} ${styles.surfaceDialogue}`}
                    data-art=""
                    data-drift=""
                >
                    <span>Surface / 23:48</span>
                    <strong>&ldquo;Everything is fine.&rdquo;</strong>
                </div>
                <div
                    className={`${styles.dialogue} ${styles.thoughtDialogue}`}
                    data-art=""
                    data-drift=""
                >
                    <span>Internal / unsent</span>
                    <strong>I cannot breathe here.</strong>
                </div>
            </>
        );
    }

    if (theme === "land") {
        return (
            <>
                <div className={styles.pixelSky} data-art="">
                    <span />
                    <span />
                    <span />
                </div>
                <div className={styles.floodLine} data-art="">
                    <span>Water level 87%</span>
                </div>
                <div className={styles.undergroundShaft} data-art="">
                    <div className={styles.pixelPlayer} data-drift="" />
                    <div className={`${styles.pixelCrate} ${styles.crateOne}`} />
                    <div className={`${styles.pixelCrate} ${styles.crateTwo}`} />
                    <div className={styles.detector}>
                        <i />
                    </div>
                    <div className={styles.shaftDoor}>Level −04</div>
                </div>
            </>
        );
    }

    if (theme === "forest") {
        return (
            <>
                <div className={styles.forestMoon} data-art="" />
                <div className={styles.forestHaze} data-art="" />
                <div className={`${styles.treeLine} ${styles.treeLineBack}`} data-art="">
                    {Array.from({ length: 9 }, (_, tree) => (
                        <i key={tree} />
                    ))}
                </div>
                <div className={`${styles.treeLine} ${styles.treeLineFront}`} data-art="">
                    {Array.from({ length: 7 }, (_, tree) => (
                        <i key={tree} />
                    ))}
                </div>
                <div className={styles.forestWarning} data-art="" data-drift="">
                    <span>Night 04</span>
                    <strong>The woods are awake</strong>
                    <i>Run → water</i>
                </div>
            </>
        );
    }

    if (theme === "metadata") {
        return (
            <>
                <div className={styles.fileInspector} data-art="">
                    <div className={styles.fileToolbar}>
                        <i />
                        <i />
                        <i />
                        <span>IMG_2048.JPG — EXIF</span>
                    </div>
                    <div className={styles.metadataRow}>
                        <span>GPS latitude</span>
                        <strong>22.3193° N</strong>
                    </div>
                    <div className={styles.metadataRow}>
                        <span>GPS longitude</span>
                        <strong>114.1694° E</strong>
                    </div>
                    <div className={styles.metadataRow}>
                        <span>Device</span>
                        <strong>Visible to anyone</strong>
                    </div>
                    <div className={`${styles.metadataRow} ${styles.metadataRemoved}`}>
                        <span>Owner</span>
                        <strong>Removed</strong>
                    </div>
                    <div className={styles.cleanCommand}>
                        $ metadata-tool --strip ./IMG_2048.JPG
                    </div>
                </div>
                <div className={styles.mapGrid} data-art="" data-drift="">
                    <i />
                </div>
            </>
        );
    }

    if (theme === "unseen") {
        return (
            <>
                <div className={styles.memoryRoom} data-art="">
                    <div className={styles.roomDoor}>
                        <span>?</span>
                    </div>
                    <div className={styles.roomClock}>18:00:00</div>
                    <div className={`${styles.memoryFragment} ${styles.fragmentOne}`} data-drift="">
                        Who
                    </div>
                    <div className={`${styles.memoryFragment} ${styles.fragmentTwo}`} data-drift="">
                        AM
                    </div>
                    <div
                        className={`${styles.memoryFragment} ${styles.fragmentThree}`}
                        data-drift=""
                    >
                        I
                    </div>
                    <div className={styles.roomFloor} />
                </div>
                <div className={styles.apartmentFog} data-art="" />
            </>
        );
    }

    return (
        <div className={styles.tracePanel} data-art="">
            <div className={styles.traceHeader}>
                <span>Trace / active</span>
                <i>12 external domains</i>
            </div>
            <svg viewBox="0 0 620 430" role="presentation">
                <g className={styles.traceLines}>
                    <path d="M310 215 115 92" />
                    <path d="M310 215 492 74" />
                    <path d="M310 215 544 242" />
                    <path d="M310 215 420 364" />
                    <path d="M310 215 150 350" />
                    <path d="M115 92 220 55" />
                    <path d="M544 242 560 345" />
                </g>
                <g className={styles.traceNodes}>
                    <circle className={styles.originNode} cx="310" cy="215" r="34" />
                    <circle cx="115" cy="92" r="15" />
                    <circle cx="492" cy="74" r="11" />
                    <circle cx="544" cy="242" r="18" />
                    <circle cx="420" cy="364" r="12" />
                    <circle cx="150" cy="350" r="14" />
                    <circle cx="220" cy="55" r="7" />
                    <circle cx="560" cy="345" r="8" />
                </g>
            </svg>
            <div className={styles.scanBeam} />
            <span className={`${styles.domainChip} ${styles.domainOne}`}>analytics</span>
            <span className={`${styles.domainChip} ${styles.domainTwo}`}>cdn</span>
            <span className={`${styles.domainChip} ${styles.domainThree}`}>tracker</span>
        </div>
    );
}

export function BeneathTheSurfaceExperience({
    winners,
    unavailable,
}: {
    readonly winners: readonly BeneathWinnerView[];
    readonly unavailable: boolean;
}): ReactNode {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const glowRef = useRef<HTMLDivElement | null>(null);

    useIsoLayoutEffect(() => {
        const root = rootRef.current;
        if (root === null || prefersReducedMotion()) {
            return;
        }

        let cancelled = false;
        const media = gsap.matchMedia();

        media.add(
            {
                isDesktop: "(min-width: 900px)",
            },
            (context) => {
                const conditions = context.conditions as { isDesktop?: boolean } | undefined;
                const isDesktop = conditions?.isDesktop === true;

                gsap.timeline({ defaults: { ease: "power3.out" } })
                    .from("[data-hero-kicker]", { autoAlpha: 0, y: 18, duration: 0.55 })
                    .from(
                        "[data-hero-title-line]",
                        { autoAlpha: 0, yPercent: 110, stagger: 0.11, duration: 0.9 },
                        "-=0.25",
                    )
                    .from(
                        "[data-hero-summary], [data-hero-chart]",
                        { autoAlpha: 0, y: 24, stagger: 0.12, duration: 0.65 },
                        "-=0.5",
                    );

                const sections = gsap.utils.toArray<HTMLElement>("[data-project-section]");
                sections.forEach((section) => {
                    const reveals = section.querySelectorAll("[data-reveal]");
                    const art = section.querySelectorAll("[data-art]");
                    const stage = section.querySelector<HTMLElement>("[data-project-stage]");

                    const timeline = gsap.timeline({
                        defaults: { ease: "power2.out" },
                        scrollTrigger:
                            isDesktop && stage !== null
                                ? {
                                      trigger: section,
                                      start: "top top",
                                      end: "+=70%",
                                      pin: stage,
                                      scrub: 0.7,
                                      invalidateOnRefresh: true,
                                  }
                                : {
                                      trigger: section,
                                      start: "top 76%",
                                      end: "bottom 45%",
                                      toggleActions: "play none none reverse",
                                  },
                    });

                    timeline
                        .from(reveals, {
                            autoAlpha: 0,
                            y: 42,
                            stagger: 0.09,
                            duration: isDesktop ? 0.55 : 0.7,
                        })
                        .from(
                            art,
                            {
                                autoAlpha: 0,
                                scale: 0.94,
                                y: 30,
                                stagger: 0.06,
                                duration: 0.7,
                            },
                            "<0.08",
                        );
                });

                gsap.utils.toArray<HTMLElement>("[data-drift]", root).forEach((element, index) => {
                    gsap.to(element, {
                        y: index % 2 === 0 ? -12 : 12,
                        x: index % 3 === 0 ? 8 : -6,
                        duration: 3.8 + (index % 4) * 0.65,
                        ease: "sine.inOut",
                        repeat: -1,
                        yoyo: true,
                    });
                });
            },
            root,
        );

        const glow = glowRef.current;
        const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        let removePointer: (() => void) | null = null;
        if (glow !== null && canHover) {
            const moveX = gsap.quickTo(glow, "x", { duration: 0.8, ease: "power3.out" });
            const moveY = gsap.quickTo(glow, "y", { duration: 0.8, ease: "power3.out" });
            const handlePointerMove = (event: PointerEvent) => {
                moveX((event.clientX / window.innerWidth - 0.5) * 70);
                moveY((event.clientY / window.innerHeight - 0.5) * 48);
            };
            window.addEventListener("pointermove", handlePointerMove, { passive: true });
            removePointer = () => window.removeEventListener("pointermove", handlePointerMove);
        }

        void document.fonts.ready.then(() => {
            if (!cancelled) {
                ScrollTrigger.refresh();
            }
        });

        return () => {
            cancelled = true;
            removePointer?.();
            media.revert();
        };
    }, []);

    return (
        <div ref={rootRef} className={styles.surfaceStory}>
            <div className={styles.storyGrain} aria-hidden="true" />
            <BackToTop />

            <section className={styles.surfaceHero} aria-labelledby="beneath-title">
                <div ref={glowRef} className={styles.heroGlow} aria-hidden="true" />
                <div className={styles.heroSonar} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </div>

                <div className={styles.heroContent}>
                    <p className={styles.heroKicker} data-hero-kicker="">
                        May 2026
                    </p>
                    <h1 id="beneath-title">
                        <span className={styles.titleMask}>
                            <span className={styles.heroTitleLine} data-hero-title-line="">
                                Beneath
                            </span>
                        </span>{" "}
                        <span className={`${styles.titleMask} ${styles.titleOffset}`}>
                            <span className={styles.heroTitleLine} data-hero-title-line="">
                                the Surface
                            </span>
                        </span>
                    </h1>
                    <p className={styles.heroSummary} data-hero-summary="">
                        Six projects looked past what was obvious. Descend through the top three
                        discoveries from each pathway.
                    </p>
                </div>

                <div className={styles.heroChart} data-hero-chart="" aria-hidden="true">
                    <div className={styles.chartHeading}>
                        <span>Expedition log</span>
                        <span>Surface / 00m</span>
                    </div>
                    <div className={styles.chartPaths}>
                        <div>
                            <span>Junior</span>
                            <i />
                            <i />
                            <i />
                        </div>
                        <div>
                            <span>Senior</span>
                            <i />
                            <i />
                            <i />
                        </div>
                    </div>
                    <p>Signal acquired</p>
                </div>

                {unavailable ? (
                    <p className={styles.heroError}>
                        Live project details are temporarily unavailable. The archived winner
                        profiles remain below.
                    </p>
                ) : null}
            </section>

            {winners.map((winner) => (
                <section
                    key={winner.referenceId}
                    id={`winner-${String(winner.referenceId)}`}
                    className={`${styles.projectSection} ${THEME_CLASS[winner.theme]}`}
                    aria-labelledby={`winner-${String(winner.referenceId)}-title`}
                    data-project-section=""
                >
                    <div className={styles.projectStage} data-project-stage="">
                        <div className={styles.sectionGrid} aria-hidden="true" />
                        <div className={styles.sectionNoise} aria-hidden="true" />

                        <article className={styles.projectCopy}>
                            <div className={styles.projectMeta} data-reveal="">
                                <span
                                    className={`${styles.rankMedal} ${MEDAL_CLASS[winner.rank]}`}
                                    role="img"
                                    aria-label={rankLabel(winner.rank)}
                                >
                                    #{winner.rank}
                                </span>
                                <span className={styles.pathwayChip}>
                                    <i className={styles.pathwaySonar} aria-hidden="true" />
                                    <span>{pathwayLabel(winner.pathway)}</span>
                                </span>
                            </div>
                            <p className={styles.projectChapter} data-reveal="">
                                {winner.chapter}
                            </p>
                            <h2 id={`winner-${String(winner.referenceId)}-title`} data-reveal="">
                                {winner.project?.title ?? winner.projectName}
                            </h2>
                            <p className={styles.projectTeam} data-reveal="">
                                Built by {winner.project?.teamName ?? winner.teamName}
                            </p>
                            <p className={styles.projectLede} data-reveal="">
                                {winner.lede}
                            </p>
                            <div className={styles.projectActions} data-reveal="">
                                <ProjectDialog winner={winner} />
                            </div>
                        </article>

                        <div className={styles.projectVisual} aria-hidden="true">
                            <ProjectVisual theme={winner.theme} />
                        </div>

                        <span
                            className={styles.sectionIndex}
                            data-index={String(winner.rank).padStart(2, "0")}
                            aria-hidden="true"
                        />
                    </div>
                </section>
            ))}

            <section className={styles.surfaceReturn} aria-labelledby="surface-return-title">
                <div className={styles.returnRings} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                </div>
                <h2 id="surface-return-title">
                    The surface looks different once you know what lies beneath.
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild variant="outline" color="neutral" size="xl">
                        <Link href="/showcase">
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Explore the full showcase
                        </Link>
                    </Button>
                    <Button asChild variant="subtle" color="neutral" size="xl">
                        <Link href="/showcase/signal">
                            <ExternalLink className="size-4" aria-hidden="true" />
                            Open Signal
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}
