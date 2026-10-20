import React, { useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import "../styles/MediaViewer.css";

const MediaViewer = ({ items, index, onChange, onClose }) => {
    const item = items[index];

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = event => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowLeft" && index > 0) onChange(index - 1);
            if (event.key === "ArrowRight" && index < items.length - 1) onChange(index + 1);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [index, items.length, onChange, onClose]);

    if (!item) return null;

    return (
        <div
            className="media-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${index + 1} of ${items.length}`}
            onClick={onClose}
        >
            <button
                type="button"
                className="media-viewer-close"
                aria-label="Close photo"
                onClick={onClose}
            >
                <FaTimes />
            </button>
            {index > 0 && (
                <button
                    type="button"
                    className="media-viewer-nav media-viewer-previous"
                    aria-label="Previous photo"
                    onClick={event => {
                        event.stopPropagation();
                        onChange(index - 1);
                    }}
                >
                    <FaChevronLeft />
                </button>
            )}
            <img src={item} alt={`Post media ${index + 1}`} onClick={event => event.stopPropagation()} />
            {index < items.length - 1 && (
                <button
                    type="button"
                    className="media-viewer-nav media-viewer-next"
                    aria-label="Next photo"
                    onClick={event => {
                        event.stopPropagation();
                        onChange(index + 1);
                    }}
                >
                    <FaChevronRight />
                </button>
            )}
        </div>
    );
};

export default MediaViewer;
