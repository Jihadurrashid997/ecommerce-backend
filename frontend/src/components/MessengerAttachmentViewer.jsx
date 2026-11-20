import React, { useEffect } from "react";
import { FaDownload, FaPaperclip, FaTimes } from "react-icons/fa";

const MessengerAttachmentViewer = ({
    attachment,
    onClose,
    onDownload
}) => {
    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const fileName = attachment.fileName || "Attachment";
    const fileType = attachment.fileType || "";
    const { url } = attachment;
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const isAudio = fileType.startsWith("audio/");
    const isPdf =
        fileType === "application/pdf" || /\.pdf$/i.test(fileName);

    return (
        <div
            className="attachment-viewer-backdrop"
            onMouseDown={event => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                className="attachment-viewer"
                role="dialog"
                aria-modal="true"
                aria-label={`Preview ${fileName}`}
            >
                <header className="attachment-viewer-header">
                    <strong title={fileName}>{fileName}</strong>
                    <button
                        type="button"
                        aria-label="Close attachment preview"
                        onClick={onClose}
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </header>
                <div className="attachment-viewer-content">
                    {isImage ? (
                        <img src={url} alt={fileName} />
                    ) : isVideo ? (
                        <video src={url} controls playsInline />
                    ) : isAudio ? (
                        <audio src={url} controls />
                    ) : isPdf ? (
                        <iframe
                            src={url}
                            title={`PDF preview: ${fileName}`}
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="attachment-viewer-unavailable">
                            <FaPaperclip aria-hidden="true" />
                            <strong>Preview isn’t available</strong>
                            <span>
                                Download this file to open it on your device.
                            </span>
                        </div>
                    )}
                </div>
                <footer className="attachment-viewer-footer">
                    <button type="button" onClick={onDownload}>
                        <FaDownload aria-hidden="true" />
                        Download
                    </button>
                </footer>
            </section>
        </div>
    );
};

export default MessengerAttachmentViewer;
