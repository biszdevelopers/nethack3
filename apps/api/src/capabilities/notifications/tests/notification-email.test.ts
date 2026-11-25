import { describe, expect, it } from "vitest";
import { buildNotificationEmail } from "../domain/notification-email.js";

describe("buildNotificationEmail", () => {
    it("builds a plain-text message with the workspace link", () => {
        const message = buildNotificationEmail({
            title: "Invitation to join Rockets",
            body: "You have been invited to join Rockets.",
            linkUrl: "https://workspace.example/invitations?token=abc",
        });

        expect(message.subject).toBe("Invitation to join Rockets");
        expect(message.text).toContain("You have been invited to join Rockets.");
        expect(message.text).toContain("https://workspace.example/invitations?token=abc");
        expect(message.text).not.toContain("<a");
        expect(message.text).not.toContain("<p");
    });

    it("omits the link section when no link exists", () => {
        const message = buildNotificationEmail({
            title: "Voting is open",
            body: "Voting is now open.",
            linkUrl: null,
        });

        expect(message.text).toBe("Voting is now open.");
    });
});
