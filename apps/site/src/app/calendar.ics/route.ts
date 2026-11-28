import { getCompetition, getCompetitions } from "../../lib/public-api";

export const dynamic = "force-dynamic";

interface CalendarEvent {
    readonly uid: string;
    readonly summary: string;
    readonly description: string;
    readonly startsAt: string;
}

function escapeText(value: string): string {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll(";", "\\;")
        .replaceAll(",", "\\,")
        .replaceAll("\n", "\\n");
}

function stamp(value: string): string {
    return new Date(value).toISOString().replaceAll("-", "").replaceAll(":", "").slice(0, 15) + "Z";
}

function eventsFor(
    competition: Awaited<ReturnType<typeof getCompetition>>,
): readonly CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const push = (suffix: string, summary: string, startsAt: string | null): void => {
        if (startsAt === null) {
            return;
        }
        events.push({
            uid: `${competition.editionId}-${suffix}@nethack`,
            summary: `${competition.name}: ${summary}`,
            description: competition.description,
            startsAt,
        });
    };
    push("registration-closes", "Registration closes", competition.registrationClosesAt);
    push("starts", "Competition starts", competition.startsAt);
    push("ends", "Competition ends", competition.endsAt);
    for (const milestone of competition.milestones) {
        push(`milestone-${milestone.id}`, milestone.title, milestone.occursAt);
    }
    return events;
}

export async function GET(): Promise<Response> {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//nethack//competition calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ];
    try {
        const competitions = await getCompetitions();
        for (const competition of competitions.items) {
            const detail = await getCompetition(competition.slug);
            for (const event of eventsFor(detail)) {
                lines.push(
                    "BEGIN:VEVENT",
                    `UID:${event.uid}`,
                    `DTSTAMP:${stamp(new Date().toISOString())}`,
                    `DTSTART:${stamp(event.startsAt)}`,
                    `SUMMARY:${escapeText(event.summary)}`,
                    `DESCRIPTION:${escapeText(event.description)}`,
                    "END:VEVENT",
                );
            }
        }
    } catch {
        lines.length = 5;
    }
    lines.push("END:VCALENDAR");
    return new Response(`${lines.join("\r\n")}\r\n`, {
        headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": 'attachment; filename="nethack-calendar.ics"',
        },
    });
}
