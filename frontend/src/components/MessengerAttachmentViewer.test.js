import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MessengerAttachmentViewer from "./MessengerAttachmentViewer";

const attachment = {
    fileName: "photo.png",
    fileType: "image/png",
    url: "blob:messenger-photo"
};

test("previews image attachments in Messenger without downloading", () => {
    const onDownload = jest.fn();
    render(
        <MessengerAttachmentViewer
            attachment={attachment}
            onClose={jest.fn()}
            onDownload={onDownload}
        />
    );

    expect(screen.getByRole("dialog", { name: "Preview photo.png" }))
        .toBeInTheDocument();
    expect(screen.getByRole("img", { name: "photo.png" })).toHaveAttribute(
        "src",
        "blob:messenger-photo"
    );
    expect(onDownload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownload).toHaveBeenCalledTimes(1);
});

test("shows an in-app fallback for unsupported files with an explicit download action", () => {
    render(
        <MessengerAttachmentViewer
            attachment={{
                fileName: "document.docx",
                fileType:
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                url: "https://files.example/document.docx"
            }}
            onClose={jest.fn()}
            onDownload={jest.fn()}
        />
    );

    expect(screen.getByText("Preview isn’t available")).toBeInTheDocument();
    expect(screen.getByText("Download this file to open it on your device."))
        .toBeInTheDocument();
});

test("renders PDF attachments inside the viewer", () => {
    render(
        <MessengerAttachmentViewer
            attachment={{
                fileName: "receipt.pdf",
                fileType: "application/pdf",
                url: "https://files.example/receipt.pdf"
            }}
            onClose={jest.fn()}
            onDownload={jest.fn()}
        />
    );

    expect(
        screen.getByTitle("PDF preview: receipt.pdf")
    ).toHaveAttribute("src", "https://files.example/receipt.pdf");
});

test("closes the preview when Escape is pressed", () => {
    const onClose = jest.fn();
    render(
        <MessengerAttachmentViewer
            attachment={attachment}
            onClose={onClose}
            onDownload={jest.fn()}
        />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
});
