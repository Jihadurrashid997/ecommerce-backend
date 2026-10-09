import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaHeart, FaRegHeart, FaRegComment, FaTrash } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import CommentsPanel from "./CommentsPanel";

const timeAgo = value => {

    const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

    return new Date(value).toLocaleDateString();

};

const PostCard = ({ post, onDeleted }) => {

    const { user } = useApp();

    const myId = String(user?._id || user?.id || "");

    const [liked, setLiked] = useState(post.likedByMe);
    const [likeCount, setLikeCount] = useState(post.likeCount);
    const [commentCount, setCommentCount] = useState(post.commentCount);
    const [showComments, setShowComments] = useState(false);
    const [slide, setSlide] = useState(0);

    const author = post.author || {};

    const canDelete =
        String(author._id) === myId || user?.role === "admin";

    const toggleLike = async () => {

        const next = !liked;

        setLiked(next);
        setLikeCount(c => c + (next ? 1 : -1));

        try {
            await api.post(`/posts/${post._id}/like`);
        } catch (e) {
            setLiked(!next);
            setLikeCount(c => c + (next ? -1 : 1));
        }

    };

    const remove = async () => {

        if (!window.confirm("Delete this post?")) return;

        try {
            await api.delete(`/posts/${post._id}`);
            if (onDeleted) onDeleted(post._id);
        } catch (e) {
            alert(e.response?.data?.message || "Could not delete.");
        }

    };

    return (
        <article className="post-card">

            <header className="post-head">

                <Link to={String(author._id) === myId ? "/profile" : `/user/${author._id}`} className="post-author">
                    <div className="avatar-sm">
                        {author.profileImage || author.avatar
                            ? <img src={getUploadUrl(author.profileImage || author.avatar)} alt="" />
                            : (author.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <b>{author.name || "User"}</b>
                        <small>{timeAgo(post.createdAt)}</small>
                    </div>
                </Link>

                {canDelete && (
                    <button type="button" className="icon-btn" onClick={remove} title="Delete">
                        <FaTrash />
                    </button>
                )}

            </header>

            {post.caption && <p className="post-caption">{post.caption}</p>}

            <div className="post-media">

                <img src={getUploadUrl(post.media[slide]?.url)} alt="" loading="lazy" />

                {post.media.length > 1 && (
                    <div className="post-dots">
                        {post.media.map((m, i) => (
                            <button
                                key={i}
                                type="button"
                                className={i === slide ? "on" : ""}
                                onClick={() => setSlide(i)}
                                aria-label={`Photo ${i + 1}`}
                            />
                        ))}
                    </div>
                )}

            </div>

            <div className="post-actions">

                <button type="button" onClick={toggleLike} className={liked ? "liked" : ""}>
                    {liked ? <FaHeart /> : <FaRegHeart />} {likeCount}
                </button>

                <button type="button" onClick={() => setShowComments(v => !v)}>
                    <FaRegComment /> {commentCount}
                </button>

            </div>

            {showComments && (
                <CommentsPanel
                    postId={post._id}
                    onCount={setCommentCount}
                    onClose={() => setShowComments(false)}
                />
            )}

        </article>
    );

};

export default PostCard;
