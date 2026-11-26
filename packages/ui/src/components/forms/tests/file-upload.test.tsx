import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { FileUpload } from "../file-upload.js";

describe("FileUpload", () => {
    test("links the label, lists selected files, and removes them", async () => {
        const user = userEvent.setup();
        const onFiles = vi.fn();
        render(<FileUpload label="Project assets" accept=".txt" onFiles={onFiles} />);

        const input = screen.getByLabelText("Project assets");
        expect(input).toHaveAttribute("tabindex", "-1");
        expect(screen.getByRole("button", { name: "Browse files" })).toBeInTheDocument();

        const file = new File(["hello"], "notes.txt", { type: "text/plain" });
        await user.upload(input, file);

        expect(await screen.findByText("notes.txt")).toBeInTheDocument();
        expect(onFiles).toHaveBeenCalledWith([file]);
        expect(screen.getByRole("list", { name: "Selected files" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Remove notes.txt" }));
        await waitFor(() => expect(screen.queryByText("notes.txt")).not.toBeInTheDocument());
        expect(onFiles).toHaveBeenLastCalledWith([]);
    });

    test("announces rejected files in an alert", async () => {
        const user = userEvent.setup();
        render(<FileUpload label="Small files" maxBytes={4} />);
        const input = screen.getByLabelText("Small files");
        const file = new File(["too many bytes"], "large.txt", { type: "text/plain" });
        await user.upload(input, file);

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("large.txt: larger than 4 B.");
        expect(screen.queryByRole("list", { name: "Selected files" })).not.toBeInTheDocument();
    });
});
