export interface NotificationEmailMessage {
    readonly subject: string;
    readonly text: string;
}

export function buildNotificationEmail(input: {
    readonly title: string;
    readonly body: string;
    readonly linkUrl: string | null;
}): NotificationEmailMessage {
    const sections = [input.body.trim()].filter((section) => section.length > 0);
    if (input.linkUrl !== null) {
        sections.push(`Open nethack: ${input.linkUrl}`);
    }
    return {
        subject: input.title,
        text: sections.join("\n\n"),
    };
}
