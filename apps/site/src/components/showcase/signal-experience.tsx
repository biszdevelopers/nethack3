"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronDown, GitBranch, Play, Video } from "lucide-react";
import { gsap, ScrollTrigger, prefersReducedMotion, useIsoLayoutEffect } from "@nethack/ui/motion";
import { BackToTop } from "./back-to-top";
import { SignalProjectMarquee } from "./signal-project-marquee";
import {
    SIGNAL_FEATURED,
    rankLabel,
    safeExternalUrl,
    type ShowcaseLink,
    type ShowcaseProject,
    type SignalFeatured,
} from "./showcase-data";
import styles from "./signal.module.css";

function linkIcon(kind: ShowcaseLink["kind"]): ReactNode {
    if (kind === "repository") {
        return <GitBranch className="size-4" aria-hidden="true" />;
    }
    if (kind === "video") {
        return <Video className="size-4" aria-hidden="true" />;
    }
    return <Play className="size-4" aria-hidden="true" />;
}

function FeaturedLinks({
    links,
    tone = "dark",
}: {
    readonly links: readonly ShowcaseLink[];
    readonly tone?: "dark" | "light";
}): ReactNode {
    const palette =
        tone === "light"
            ? "border-line-strong text-app hover:border-app hover:text-app focus-visible:ring-app/30"
            : "border-white/25 text-white hover:border-primary hover:text-primary focus-visible:ring-primary/40";
    return (
        <div className="mt-6 flex flex-wrap gap-3">
            {links.map((link) => {
                const href = safeExternalUrl(link.href);
                if (href === null) {
                    return null;
                }
                return (
                    <a
                        key={link.href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex min-h-10 items-center gap-2 border px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] ${palette}`}
                    >
                        {linkIcon(link.kind)}
                        {link.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                );
            })}
        </div>
    );
}

function Rank({
    rank,
    inverted = false,
}: {
    readonly rank: 1 | 2 | 3;
    readonly inverted?: boolean;
}): ReactNode {
    const rankClass =
        rank === 1 ? styles.rankFirst : rank === 2 ? styles.rankSecond : styles.rankThird;
    return (
        <p
            className={`text-5xl font-extrabold leading-none ${inverted ? "text-app" : "text-white"}`}
        >
            <span className="sr-only">{rankLabel(rank)}</span>
            <span aria-hidden="true" className={rankClass}>
                #{rank}
            </span>
        </p>
    );
}

function FeatureVideo({
    featured,
    className,
}: {
    readonly featured: SignalFeatured;
    readonly className?: string;
}): ReactNode {
    return (
        // The reference demonstration clips ship without caption tracks.
        // oxlint-disable-next-line jsx-a11y/media-has-caption
        <video
            src={featured.video}
            poster={featured.poster}
            controls
            preload="metadata"
            playsInline
            aria-label={`${featured.title} demonstration video`}
            className={`h-auto w-full border border-line-strong bg-app ${className ?? ""}`}
        />
    );
}

export function SignalExperience({
    projects,
    unavailable,
}: {
    readonly projects: readonly ShowcaseProject[];
    readonly unavailable: boolean;
}): ReactNode {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const titleRef = useRef<HTMLDivElement | null>(null);
    const team1Ref = useRef<HTMLElement | null>(null);
    const team1CopyRef = useRef<HTMLDivElement | null>(null);
    const numberRef = useRef<HTMLDivElement | null>(null);
    const auraRef = useRef<HTMLDivElement | null>(null);
    const team2Ref = useRef<HTMLElement | null>(null);
    const team3Ref = useRef<HTMLElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [showHint, setShowHint] = useState(true);

    const syl = SIGNAL_FEATURED.find((featured) => featured.key === "syl");
    const robotic = SIGNAL_FEATURED.find((featured) => featured.key === "robotic-head");
    const dysarthria = SIGNAL_FEATURED.find((featured) => featured.key === "dysarthria");
    const teamCount = new Set(
        projects.flatMap((project) => (project.teamName === null ? [] : [project.teamName])),
    ).size;

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReducedMotion(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    useEffect(() => {
        const onScroll = () => setShowHint(window.scrollY < window.innerHeight * 0.25);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useIsoLayoutEffect(() => {
        const root = rootRef.current;
        if (root === null || prefersReducedMotion()) {
            return;
        }

        let cancelled = false;
        const context = gsap.context(() => {
            if (titleRef.current !== null) {
                gsap.from(titleRef.current.children, {
                    autoAlpha: 0,
                    y: 26,
                    stagger: 0.12,
                    duration: 0.8,
                    delay: 0.1,
                });
            }

            if (team1Ref.current !== null && team1CopyRef.current !== null) {
                gsap.from(team1CopyRef.current, {
                    autoAlpha: 0,
                    x: -36,
                    duration: 0.9,
                    scrollTrigger: { trigger: team1Ref.current, start: "top 72%", once: true },
                });
            }

            const words = team2Ref.current?.querySelectorAll<HTMLElement>("[data-word]");
            if (team2Ref.current !== null && words !== undefined) {
                gsap.from(words, {
                    autoAlpha: 0,
                    y: 18,
                    x: () => gsap.utils.random(-14, 14),
                    stagger: 0.07,
                    duration: 0.55,
                    scrollTrigger: { trigger: team2Ref.current, start: "top 68%", once: true },
                });
            }

            if (team3Ref.current !== null) {
                gsap.from(team3Ref.current.querySelectorAll("[data-team3-reveal]"), {
                    autoAlpha: 0,
                    x: 32,
                    stagger: 0.1,
                    duration: 0.8,
                    scrollTrigger: { trigger: team3Ref.current, start: "top 70%", once: true },
                });
            }

            if (videoRef.current !== null && team1Ref.current !== null) {
                const video = videoRef.current;
                ScrollTrigger.create({
                    trigger: team1Ref.current,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                    onUpdate: (self) => {
                        const duration = video.duration;
                        if (Number.isFinite(duration) && duration > 0.1) {
                            video.currentTime = Math.min(duration - 0.05, self.progress * duration);
                        }
                    },
                });
            }
        }, root);

        void document.fonts.ready.then(() => {
            if (!cancelled) {
                ScrollTrigger.refresh();
            }
        });

        return () => {
            cancelled = true;
            context.revert();
        };
    }, []);

    useIsoLayoutEffect(() => {
        const wrapper = team1CopyRef.current;
        const aura = auraRef.current;
        const number = numberRef.current;
        if (
            wrapper === null ||
            aura === null ||
            number === null ||
            prefersReducedMotion() ||
            !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        ) {
            return;
        }

        const moveX = gsap.quickTo(aura, "x", { duration: 0.45, ease: "power3.out" });
        const moveY = gsap.quickTo(aura, "y", { duration: 0.45, ease: "power3.out" });

        const onMove = (event: PointerEvent) => {
            const rect = wrapper.getBoundingClientRect();
            moveX(event.clientX - rect.left - 76);
            moveY(event.clientY - rect.top - 76);
            gsap.to(aura, { opacity: 1, duration: 0.2, overwrite: "auto" });

            const numberRect = number.getBoundingClientRect();
            const dx = event.clientX - (numberRect.left + numberRect.width / 2);
            const dy = event.clientY - (numberRect.top + numberRect.height / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const intensity = Math.max(0, 1 - Math.min(distance, 280) / 280);
            number.style.opacity = String(0.14 + intensity * 0.18);
        };

        const onLeave = () => {
            gsap.to(aura, { opacity: 0, duration: 0.3, overwrite: "auto" });
            number.style.opacity = "";
        };

        wrapper.addEventListener("pointermove", onMove);
        wrapper.addEventListener("pointerleave", onLeave);
        return () => {
            wrapper.removeEventListener("pointermove", onMove);
            wrapper.removeEventListener("pointerleave", onLeave);
            gsap.set(aura, { clearProps: "transform,opacity" });
        };
    }, []);

    if (syl === undefined || robotic === undefined || dysarthria === undefined) {
        return null;
    }

    const roboticWords = robotic.title.split(" ");
    const roboticLeft = robotic.images?.[0] ?? null;
    const roboticRight = robotic.images?.[1] ?? null;

    return (
        <div ref={rootRef} className="overflow-x-clip bg-black text-white">
            <BackToTop />

            <div
                className={`${styles.scrollHint} fixed bottom-5 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-2 text-center sm:flex ${
                    showHint ? "" : styles.scrollHintHidden
                }`}
                aria-hidden={showHint ? undefined : "true"}
            >
                <span className="text-sm text-white/70">Scroll for more</span>
                <ChevronDown className="size-5 text-white/70" aria-hidden="true" />
            </div>

            <section
                className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 py-24 sm:px-6 lg:px-8"
                aria-labelledby="signal-title"
            >
                <Image
                    src="/showcase/signal/title.webp"
                    alt=""
                    fill
                    loading="eager"
                    fetchPriority="high"
                    sizes="100vw"
                    className="object-cover"
                />
                <div className={styles.titleScrim} aria-hidden="true" />
                <div className="relative z-10 mx-auto w-full max-w-[1280px]">
                    <div ref={titleRef} className="max-w-3xl lg:ml-auto lg:pr-10">
                        <p className="text-sm text-white/70">February 2026</p>
                        <h1
                            id="signal-title"
                            className="mt-4 text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl"
                        >
                            When there is <span className={styles.signalWord}>Signal</span>
                        </h1>
                        <p className="mt-6 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
                            A scroll-driven showcase of the previous season&apos;s winners and the
                            projects that surfaced around them.
                        </p>
                    </div>
                </div>
            </section>

            <section
                ref={team1Ref}
                id="syl"
                className="relative isolate overflow-hidden border-t border-white/10 bg-black px-4 py-24 sm:px-6 lg:px-8"
                aria-labelledby="syl-title"
            >
                <div className="mx-auto grid w-full max-w-[1280px] items-center gap-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div ref={team1CopyRef} className="relative z-10">
                        <div ref={auraRef} className={styles.aura} aria-hidden="true" />
                        <div
                            ref={numberRef}
                            className={`${styles.giantNumber} ${styles.giantNumberFirst} hidden lg:block`}
                            aria-hidden="true"
                        >
                            #1
                        </div>
                        <div className="relative z-10">
                            <div className="flex flex-wrap items-center gap-4">
                                <Rank rank={1} />
                                <p className="text-sm text-white/60">Featuring {syl.team}</p>
                            </div>
                            <h2
                                id="syl-title"
                                className="mt-6 text-5xl font-extrabold tracking-tight text-white sm:text-6xl"
                            >
                                {syl.title}
                            </h2>
                            <div className="mt-8 flex max-w-xl flex-col gap-4">
                                {syl.paragraphs.map((paragraph, index) => (
                                    <p
                                        key={paragraph}
                                        className={
                                            index === syl.paragraphs.length - 1
                                                ? "text-sm leading-7 text-white sm:text-base"
                                                : "text-sm leading-7 text-white/60 sm:text-base"
                                        }
                                    >
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                            <FeaturedLinks links={syl.links} />
                        </div>
                    </div>

                    <div className="relative">
                        <video
                            ref={videoRef}
                            src={syl.video}
                            poster={syl.poster}
                            muted
                            playsInline
                            preload="metadata"
                            controls={reducedMotion}
                            aria-label="Syl demonstration video"
                            className="h-auto w-full border border-line-strong bg-app"
                        />
                        <a
                            href={syl.video}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-primary"
                        >
                            Open the demonstration video
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    </div>
                </div>
            </section>

            <section
                ref={team2Ref}
                id="robotic-head"
                className="relative isolate overflow-hidden border-t border-line bg-ink px-4 py-24 text-app sm:px-6 lg:px-8"
                aria-labelledby="robotic-head-title"
            >
                <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-10 xl:flex-row xl:justify-between">
                    <div className="order-2 w-full max-w-sm shrink-0 xl:order-1 xl:w-[18%]">
                        {roboticLeft === null ? null : (
                            <Image
                                src={roboticLeft.src}
                                alt=""
                                width={roboticLeft.width}
                                height={roboticLeft.height}
                                className="mx-auto h-56 w-auto object-contain xl:h-auto xl:w-full"
                            />
                        )}
                    </div>

                    <div className="relative order-1 w-full max-w-2xl text-center xl:order-2">
                        <div
                            className={`${styles.giantNumber} ${styles.giantNumberSecond} hidden sm:block`}
                            aria-hidden="true"
                        >
                            #2
                        </div>
                        <div className="relative z-10 flex flex-col items-center">
                            <Rank rank={2} inverted />
                            <p className="mt-5 text-sm text-app/70">{robotic.team} presents</p>
                            <h2
                                id="robotic-head-title"
                                aria-label={robotic.title}
                                className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl"
                            >
                                {roboticWords.map((word, index) => (
                                    <span
                                        key={`${word}-${String(index)}`}
                                        data-word=""
                                        aria-hidden="true"
                                        className={styles.word}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </h2>
                            {robotic.paragraphs.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    className="mt-5 max-w-xl text-sm leading-7 text-app/70 sm:text-base"
                                >
                                    {paragraph}
                                </p>
                            ))}
                            <div className="mt-6 flex w-full max-w-md flex-col items-stretch">
                                <FeatureVideo featured={robotic} />
                            </div>
                            <FeaturedLinks links={robotic.links} tone="light" />
                        </div>
                    </div>

                    <div className="order-3 w-full max-w-sm shrink-0 xl:w-[18%]">
                        {roboticRight === null ? null : (
                            <Image
                                src={roboticRight.src}
                                alt=""
                                width={roboticRight.width}
                                height={roboticRight.height}
                                className="mx-auto h-56 w-auto -scale-y-100 object-contain xl:h-auto xl:w-full"
                            />
                        )}
                    </div>
                </div>
            </section>

            <section
                ref={team3Ref}
                id="dysarthria"
                className="relative isolate overflow-hidden border-y border-line bg-black px-4 py-24 text-white sm:px-6 lg:px-8"
                aria-labelledby="dysarthria-title"
            >
                <div
                    className={`${styles.giantNumber} ${styles.giantNumberThird} right-2 top-0 text-right`}
                    aria-hidden="true"
                >
                    #3
                </div>
                <div className="relative z-10 mx-auto grid w-full max-w-[1280px] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                    <div data-team3-reveal="">
                        <div className="flex flex-wrap items-center gap-4">
                            <Rank rank={3} />
                        </div>
                        <h2
                            id="dysarthria-title"
                            className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl"
                        >
                            {dysarthria.title}
                        </h2>
                        <div className="mt-6 flex max-w-xl flex-col gap-5">
                            {dysarthria.paragraphs.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    className="text-sm leading-7 text-white/70 sm:text-base"
                                >
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                        <FeaturedLinks links={dysarthria.links} />
                    </div>

                    <div data-team3-reveal="" className="relative">
                        <div className="border border-line bg-app p-2">
                            <div className="flex items-center gap-1.5 px-1 pb-2" aria-hidden="true">
                                <span className="size-2.5 rounded-full bg-line-strong" />
                                <span className="size-2.5 rounded-full bg-ink-subtle" />
                                <span className="size-2.5 rounded-full bg-primary" />
                            </div>
                            {dysarthria.windowImage === undefined ? null : (
                                <Image
                                    src={dysarthria.windowImage}
                                    alt="The Dysarthria Speech Classifier interface"
                                    width={1600}
                                    height={829}
                                    className={styles.windowShot}
                                />
                            )}
                        </div>
                        <div className="mt-4">
                            <FeatureVideo featured={dysarthria} />
                        </div>
                    </div>
                </div>
            </section>

            <section
                className="border-t border-white/10 bg-black px-4 py-24 sm:px-6 lg:px-8"
                aria-labelledby="all-projects-title"
            >
                <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">
                    <div className="max-w-2xl">
                        <p className="text-xs text-primary">The complete archive</p>
                        <h2
                            id="all-projects-title"
                            className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl"
                        >
                            All projects
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-white/65 sm:text-base">
                            {unavailable
                                ? "The live project archive is temporarily unavailable. The featured projects above remain available."
                                : projects.length === 0
                                  ? "No published projects are available in the archive yet."
                                  : teamCount > 0
                                    ? `Submitted by ${String(teamCount)} ${
                                          teamCount === 1 ? "team" : "teams"
                                      } from the previous season.`
                                    : `${String(projects.length)} published ${
                                          projects.length === 1 ? "project" : "projects"
                                      } from the previous season.`}
                        </p>
                    </div>

                    {unavailable || projects.length === 0 ? null : (
                        <div className="flex flex-col gap-3">
                            <SignalProjectMarquee projects={projects} label="All projects" />
                            <SignalProjectMarquee
                                projects={[...projects].reverse()}
                                label="All projects, reverse order"
                                reverse
                            />
                        </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/showcase"
                            className="inline-flex min-h-10 items-center gap-2 border border-white/25 px-4 py-2 text-sm text-white transition-colors hover:border-primary hover:text-primary"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            All showcases
                        </Link>
                        <Link
                            href="/showcase/beneath-the-surface"
                            className="inline-flex min-h-10 items-center gap-2 border border-white/25 px-4 py-2 text-sm text-white transition-colors hover:border-primary hover:text-primary"
                        >
                            Beneath the Surface
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
