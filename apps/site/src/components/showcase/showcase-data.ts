export interface ShowcaseLink {
    readonly label: string;
    readonly href: string;
    readonly kind: "repository" | "demo" | "video";
}

export interface ShowcaseAward {
    readonly id: string;
    readonly name: string;
}

export interface ShowcaseProject {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly summary: string;
    readonly descriptionMarkdown: string;
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly videoUrl: string | null;
    readonly aiDisclosure: string;
    readonly tags: readonly string[];
    readonly teamId: string | null;
    readonly teamName: string | null;
    readonly teamStatus: string | null;
    readonly divisionName: string | null;
    readonly competitionName: string;
    readonly rank: number | null;
    readonly awards: readonly ShowcaseAward[];
    readonly certificateUrl: string | null;
    readonly showRanking: boolean;
}

export const AI_DISCLOSURE_EMPTY = "This team did not provide an AI-use disclosure.";

export interface SignalFeatured {
    readonly key: "syl" | "robotic-head" | "dysarthria";
    readonly rank: 1 | 2 | 3;
    readonly team: string;
    readonly title: string;
    readonly paragraphs: readonly string[];
    readonly links: readonly ShowcaseLink[];
    readonly video: string;
    readonly poster: string;
    readonly images?: readonly {
        readonly src: string;
        readonly alt: string;
        readonly width: number;
        readonly height: number;
    }[];
    readonly windowImage?: string;
}

export type BeneathTheme = "rainbow" | "land" | "forest" | "metadata" | "unseen" | "trace";

export interface BeneathWinner {
    readonly referenceId: number;
    readonly pathway: "junior" | "senior";
    readonly rank: 1 | 2 | 3;
    readonly theme: BeneathTheme;
    readonly projectName: string;
    readonly teamName: string;
    readonly chapter: string;
    readonly lede: string;
}

export const SIGNAL_FEATURED: readonly SignalFeatured[] = [
    {
        key: "syl",
        rank: 1,
        team: "白鹿青崖间",
        title: "Syl",
        paragraphs: [
            "... by 6 scenes, the player can experience the story of a fallen civilization and a blade of grass in a fading world seeking self-redemption.",
            "In this chaotic time, Syl tries to give herself purpose by delivering the mail \u201cfeather\u201d, imitating a predecessor.",
            "If the player pays more attention to the surroundings while playing, they may discover and reveal a hidden truth of that world.",
        ],
        links: [
            {
                label: "View source code on GitHub",
                href: "https://github.com/Rua-You/Syl",
                kind: "repository",
            },
            { label: "Play the demo", href: "https://rua-you.itch.io/syl", kind: "demo" },
        ],
        video: "/showcase/signal/syl.mp4",
        poster: "/showcase/signal/syl-poster.webp",
    },
    {
        key: "robotic-head",
        rank: 2,
        team: "=^^=",
        title: "Super Cool But Creepy Visual Recognition Robotic Head",
        paragraphs: [
            "A robotic head that looks cool and is able to recognize learned faces and colors, and provide personalized reactions.",
        ],
        links: [
            {
                label: "View source code on GitHub",
                href: "https://github.com/zhizhizhi00/visual-recognition-robotic-head",
                kind: "repository",
            },
        ],
        video: "/showcase/signal/robotic-head.mp4",
        poster: "/showcase/signal/robotic-head-poster.webp",
        images: [
            { src: "/showcase/signal/robotic-left.webp", alt: "", width: 534, height: 900 },
            { src: "/showcase/signal/robotic-right.webp", alt: "", width: 552, height: 900 },
        ],
    },
    {
        key: "dysarthria",
        rank: 3,
        team: "Dysarthria Speech Classifier",
        title: "Dysarthria Speech Classifier",
        paragraphs: [
            "Dysarthria is a motor speech disorder that affects the muscles we use for speaking, making speech difficult to understand, especially for traditional speech systems like Apple Siri.",
            "This project bridges the gap for speakers with dysarthria by using a fine-tuned HuBERT-large model to accurately classify essential voice commands.",
        ],
        links: [
            {
                label: "View source code on GitHub",
                href: "https://github.com/FYC23/dysarthric-voice-command-classifier",
                kind: "repository",
            },
            {
                label: "Open the live demo",
                href: "https://huggingface.co/spaces/DNE58293/dysarthric-voice-cmds",
                kind: "demo",
            },
        ],
        video: "/showcase/signal/dysarthria.mp4",
        poster: "/showcase/signal/dysarthria-poster.webp",
        windowImage: "/showcase/signal/dysarthria-window.webp",
    },
];

export const BENEATH_WINNERS: readonly BeneathWinner[] = [
    {
        referenceId: 50,
        pathway: "junior",
        rank: 1,
        theme: "rainbow",
        projectName: "Where the Rainbow Ends",
        teamName: "Where the Rainbow Ends",
        chapter: "Neon above. A tired city below.",
        lede: "A cyberpunk visual novel that splits what people say from what they really think, revealing two lives trapped on opposite sides of the same immaculate city.",
    },
    {
        referenceId: 12,
        pathway: "junior",
        rank: 2,
        theme: "land",
        projectName: "Beneath the Land",
        teamName: "NaN",
        chapter: "When the water rises, the only way is down.",
        lede: "A flooded top-down world becomes a puzzle-filled descent, where each crate pushed into place opens another layer beneath the land.",
    },
    {
        referenceId: 49,
        pathway: "junior",
        rank: 3,
        theme: "forest",
        projectName: "Horror Forest",
        teamName: "Team ZLZH",
        chapter: "The forest remembers every tree.",
        lede: "Gather resources by day, then survive the creatures that surface after dark\u2014a warning about what answers when we take too much.",
    },
    {
        referenceId: 9,
        pathway: "senior",
        rank: 1,
        theme: "metadata",
        projectName: "metadata manipulation tool",
        teamName: "/usr/335",
        chapter: "Every file tells more than it shows.",
        lede: "A privacy utility for inspecting, editing, and removing hidden metadata\u2014including the coordinates and device details quietly carried inside ordinary files.",
    },
    {
        referenceId: 47,
        pathway: "senior",
        rank: 2,
        theme: "unseen",
        projectName: "Unseen Layers",
        teamName: "CSL",
        chapter: "Eighteen hours to remember who you are.",
        lede: "A fog-bound RPG about a protective personality piecing together fractured memories and the silent inner world of a comatose patient.",
    },
    {
        referenceId: 25,
        pathway: "senior",
        rank: 3,
        theme: "trace",
        projectName: "TraceShadow",
        teamName: "67Team",
        chapter: "A website is never just one website.",
        lede: "A web scanner that maps the third-party domains loaded behind a URL, turning invisible requests into a network anyone can inspect.",
    },
];

export function safeExternalUrl(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value.length === 0) {
        return null;
    }
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : null;
    } catch {
        return null;
    }
}

export function rankLabel(rank: 1 | 2 | 3): string {
    return rank === 1 ? "First place" : rank === 2 ? "Second place" : "Third place";
}

export function pathwayLabel(pathway: BeneathWinner["pathway"]): string {
    return pathway === "junior" ? "Junior pathway" : "Senior pathway";
}
