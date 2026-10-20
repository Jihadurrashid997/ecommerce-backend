import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
    FaChevronLeft,
    FaChevronRight,
    FaHeart,
    FaRegComment,
    FaRegHeart,
    FaTimes
} from "react-icons/fa";
import "../styles/MediaViewer.css";

const MediaViewer = ({
    items,
    index,
    onChange,
    onClose,
    author,
    myId,
    createdAt,
    caption,
    liked,
    likeCount,
    commentCount,
    onLike,
    onToggleComments,
    commentsOpen,
    comments
}) => {
    const item = items[index];
    const authorId = String(author?._id || "");
    const authorPath = authorId && authorId === myId
        ? "/profile"
        : `/user/${authorId}`;

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
            aria-label={`Post photo ${index + 1} of ${items.length}`}
            onClick={onClose}
        >
            <header className="media-viewer-header" onClick={event => event.stopPropagation()}>
                <Link to={authorPath} className="media-viewer-author" onClick={onClose}>
                    {author?.profileImage || author?.avatar
                        ? <img src={author.profileImage || author.avatar} alt="" />
                        : <span>{(author?.name || "U").charAt(0).toUpperCase()}</span>}
                    <span className="media-viewer-author-copy">
                        <strong>{author?.name || "User"}</strong>
                        {createdAt && (
                            <time dateTime={createdAt}>
                                {new Date(createdAt).toLocaleString()}
                            </time>
                        )}
                    </span>
                </Link>
                <button
                    type="button"
                    className="media-viewer-close"
                    aria-label="Close photo"
                    onClick={onClose}
                >
                    <FaTimes />
                </button>
            </header>

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

            <footer className="media-viewer-post-footer" onClick={event => event.stopPropagation()}>
                {caption && <p className="media-viewer-caption">{caption}</p>}
                <div className="media-viewer-actions">
                    <button
                        type="button"
                        className={liked ? "liked" : ""}
                        onClick={onLike}
                        aria-label={liked ? "Unlike post" : "Like post"}
                        aria-pressed={liked ? "true" : "false"}
                    >
                        {liked ? <FaHeart /> : <FaRegHeart />}
                        <span>{likeCount}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onToggleComments}
                        aria-label={`Comments, ${commentCount}`}
                        aria-expanded={commentsOpen}
                    >
                        <FaRegComment />
                        <span>{commentCount}</span>
                    </button>
                    <span className="media-viewer-count">
                        {index + 1} / {items.length}
                    </span>
                </div>
            </footer>

            {commentsOpen && (
                <section className="media-viewer-comments" onClick={event => event.stopPropagation()}>
                    {comments}
                </section>
            )}
        </div>
    );
};

export default MediaViewer;
