import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaRegComment, FaShare, FaTrash,
    FaBookmark, FaRegBookmark, FaRetweet,
    FaEllipsisH, FaPen
} from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import CommentsPanel from "./CommentsPanel";
import MediaViewer from "./MediaViewer";
import ReactionPicker from "./ReactionPicker";

const timeAgo = value => {

    const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

    return new Date(value).toLocaleDateString();

};

const PostCard = ({ post, onDeleted, onSavedChange, onUpdated }) => {

    const { user } = useApp();

    const myId = String(user?._id || user?.id || "");

    const [reaction, setReaction] = useState(post.reactionByMe || (post.likedByMe ? "like" : null));
    const [likeCount, setLikeCount] = useState(post.likeCount);
    const [reactionCounts, setReactionCounts] = useState(post.reactionCounts || {});
    const [saved, setSaved] = useState(Boolean(post.isSavedByMe));
    const [commentCount, setCommentCount] = useState(post.commentCount);
    const [showComments, setShowComments] = useState(false);
    const [slide, setSlide] = useState(0);
    const [viewerSlide, setViewerSlide] = useState(null);
    const [shareMessage, setShareMessage] = useState("");
    const [postError, setPostError] = useState("");
    const [postMenuOpen, setPostMenuOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(false);
    const [savingPost, setSavingPost] = useState(false);
    const [editCaption, setEditCaption] = useState(post.caption || "");
    const [editVisibility, setEditVisibility] = useState(post.visibility || "public");
    const [postContent, setPostContent] = useState({
        caption: post.caption || "",
        visibility: post.visibility || "public"
    });
    useEffect(() => {
        setPostContent({
            caption: post.caption || "",
            visibility: post.visibility || "public"
        });
    }, [post.caption, post.visibility]);
    const photoUrls = (post.media || []).map(media => getUploadUrl(media.url));
    const closeMediaViewer = useCallback(() => {
        setViewerSlide(null);
        setShowComments(false);
    }, []);
    const toggleViewerComments = useCallback(() => {
        setShowComments(open => !open);
    }, []);

    const author = post.author || {};
    const liked = Boolean(reaction);

    const canDelete =
        String(author._id) === myId || user?.role === "admin";
    const canEdit = String(author._id) === myId &&
        post.kind === "post" && !post.community && !post.originalPost;

    const updateReaction = async nextReaction => {
        const previousReaction = reaction;
        const nextCounts = { ...reactionCounts };
        if (previousReaction) nextCounts[previousReaction] = Math.max(0, (nextCounts[previousReaction] || 0) - 1);
        if (nextReaction) nextCounts[nextReaction] = (nextCounts[nextReaction] || 0) + 1;
        setReaction(nextReaction);
        setReactionCounts(nextCounts);
        setLikeCount(count => count + Number(Boolean(nextReaction)) - Number(Boolean(previousReaction)));
        try {
            await api.put(`/posts/${post._id}/reaction`, { reaction: nextReaction });
        } catch (e) {
            setReaction(previousReaction);
            setReactionCounts(reactionCounts);
            setLikeCount(count => count + Number(Boolean(previousReaction)) - Number(Boolean(nextReaction)));
            setShareMessage(e.response?.data?.message || "Could not update your reaction.");
        }
    };

    const toggleLike = () => updateReaction(reaction === "like" ? null : "like");

    const toggleSaved = async () => {
        const next = !saved;
        setSaved(next);
        try {
            await api.put(`/posts/${post._id}/saved`, { saved: next });
            if (!next && onSavedChange) onSavedChange(post._id, false);
        } catch (error) {
            setSaved(!next);
            setShareMessage(error.response?.data?.message || "Could not update saved posts.");
        }
    };

    const repost = async () => {
        try {
            await api.post(`/posts/${post._id}/repost`);
            setShareMessage("Post reposted.");
        } catch (error) {
            setShareMessage(error.response?.data?.message || "Could not repost this post.");
        }
    };

    const remove = async () => {

        if (!window.confirm("Remove this post for everyone? This cannot be undone.")) return;

        try {
            await api.delete(`/posts/${post._id}`);
            if (onDeleted) onDeleted(post._id);
        } catch (e) {
            setPostError(e.response?.data?.message || "Could not remove this post.");
        }

    };

    const openPostEditor = () => {
        setEditCaption(postContent.caption);
        setEditVisibility(postContent.visibility);
        setPostError("");
        setEditingPost(true);
        setPostMenuOpen(false);
    };

    const savePost = async event => {
        event.preventDefault();
        if (savingPost) return;

        setSavingPost(true);
        setPostError("");
        try {
            const response = await api.patch(`/posts/${post._id}`, {
                caption: editCaption,
                visibility: editVisibility
            });
            const updatedPost = response.data.data;
            const updatedContent = {
                caption: updatedPost.caption,
                visibility: updatedPost.visibility
            };
            setPostContent(updatedContent);
            setEditingPost(false);
            setShareMessage("Post updated.");
            if (onUpdated) onUpdated(updatedPost);
        } catch (error) {
            setPostError(error.response?.data?.message || "Could not update your post.");
        } finally {
            setSavingPost(false);
        }
    };

    const sharePost = async () => {
        const url = new URL(`/post/${post._id}`, window.location.origin).toString();
        const shareData = {
            title: `${author.name || "Someone"} shared a post on E Top`,
            text: postContent.caption || "View this post on E Top.",
            url
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                setShareMessage("Post shared.");
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                setShareMessage("Post link copied.");
            } else {
                throw new Error("Sharing and clipboard are unavailable.");
            }
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error("SHARE POST ERROR:", error);
            setShareMessage("Could not share this post.");
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
                        {postContent.visibility && postContent.visibility !== "public" && (
                            <small className="post-audience-label">
                                {postContent.visibility === "followers" ? "Followers only" : "Only me"}
                            </small>
                        )}
                    </div>
                </Link>

                {(canEdit || canDelete) && (
                    <div className="post-menu-wrap">
                        <button
                            type="button"
                            className="icon-btn post-menu-trigger"
                            aria-label="More post options"
                            aria-expanded={postMenuOpen}
                            onClick={() => setPostMenuOpen(open => !open)}
                        >
                            <FaEllipsisH />
                        </button>
                        {postMenuOpen && (
                            <div className="post-menu" role="group" aria-label="Post options">
                                {canEdit && (
                                    <button type="button" onClick={openPostEditor}>
                                        <FaPen /> Edit post
                                    </button>
                                )}
                                {canDelete && (
                                    <button type="button" onClick={() => {
                                        setPostMenuOpen(false);
                                        remove();
                                    }}>
                                        <FaTrash /> Remove post
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

            </header>

            {postError && <p className="post-error" role="alert">{postError}</p>}

            {editingPost && (
                <form className="post-edit-form" onSubmit={savePost}>
                    <label>
                        Caption
                        <textarea
                            aria-label="Edit post caption"
                            value={editCaption}
                            onChange={event => setEditCaption(event.target.value)}
                            maxLength={2200}
                            rows={3}
                        />
                    </label>
                    <label>
                        Audience
                        <select
                            aria-label="Edit post audience"
                            value={editVisibility}
                            onChange={event => setEditVisibility(event.target.value)}
                        >
                            <option value="public">Public</option>
                            <option value="followers">Followers only</option>
                            <option value="private">Only me</option>
                        </select>
                    </label>
                    <div className="post-edit-actions">
                        <button type="button" onClick={() => setEditingPost(false)} disabled={savingPost}>
                            Cancel
                        </button>
                        <button type="submit" disabled={savingPost}>
                            {savingPost ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </form>
            )}

            {postContent.caption && <p className="post-caption">{postContent.caption}</p>}

            {post.originalPost && (
                <section className="post-original" aria-label="Reposted post">
                    <Link
                        to={`/user/${post.originalPost.author?._id}`}
                        className="post-original-author"
                    >
                        {post.originalPost.author?.name || "Original post"}
                    </Link>
                    {post.originalPost.caption && <p>{post.originalPost.caption}</p>}
                    {post.originalPost.media?.[0]?.url && (
                        <img
                            src={getUploadUrl(post.originalPost.media[0].url)}
                            alt=""
                            loading="lazy"
                        />
                    )}
                </section>
            )}

            {post.media?.length > 0 && (
            <div className="post-media">

                <button
                    type="button"
                    className="post-media-image-button"
                    aria-label="View photo full screen"
                    onClick={() => setViewerSlide(slide)}
                >
                    <img src={photoUrls[slide]} alt="" loading="lazy" />
                </button>

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
            )}

            <div className="post-actions">

                <ReactionPicker
                    reaction={reaction}
                    reactionCounts={reactionCounts}
                    likeCount={likeCount}
                    onSelect={updateReaction}
                />

                <button type="button" onClick={() => setShowComments(v => !v)}>
                    <FaRegComment /> {commentCount}
                </button>

                <button type="button" onClick={sharePost} aria-label="Share post">
                    <FaShare /> Share
                </button>

                <button
                    type="button"
                    onClick={toggleSaved}
                    aria-label={saved ? "Remove saved post" : "Save post"}
                    aria-pressed={saved}
                    className={saved ? "is-saved" : ""}
                >
                    {saved ? <FaBookmark /> : <FaRegBookmark />}
                </button>

                {post.kind === "post" && !post.originalPost && !post.community &&
                    (!post.visibility || post.visibility === "public") && (
                        <button type="button" onClick={repost} aria-label="Repost">
                            <FaRetweet /> Repost
                        </button>
                    )}

            </div>

            {shareMessage && (
                <p className="post-share-status" role="status">{shareMessage}</p>
            )}

            {showComments && viewerSlide === null && (
                <CommentsPanel
                    postId={post._id}
                    onCount={setCommentCount}
                    onClose={() => setShowComments(false)}
                />
            )}

            {viewerSlide !== null && (
                <MediaViewer
                    items={photoUrls}
                    index={viewerSlide}
                    onChange={setViewerSlide}
                    onClose={closeMediaViewer}
                    author={{
                        ...author,
                        profileImage: author.profileImage || author.avatar
                            ? getUploadUrl(author.profileImage || author.avatar)
                            : null
                    }}
                    myId={myId}
                    createdAt={post.createdAt}
                    caption={post.caption}
                    liked={liked}
                    likeCount={likeCount}
                    commentCount={commentCount}
                    onLike={toggleLike}
                    onToggleComments={toggleViewerComments}
                    commentsOpen={showComments}
                    comments={(
                        <CommentsPanel
                            postId={post._id}
                            onCount={setCommentCount}
                            onClose={toggleViewerComments}
                        />
                    )}
                />
            )}

        </article>
    );

};

export default PostCard;
