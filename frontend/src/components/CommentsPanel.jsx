import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaTimes, FaPaperPlane, FaTrash } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";

const CommentsPanel = ({ postId, onCount, onClose }) => {
    const { user } = useApp();
    const currentUserId = String(user?._id || user?.id || "");

    const [comments, setComments] = useState([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {

        let alive = true;

        (async () => {
            try {
                const res = await api.get(`/posts/${postId}/comments`);
                if (alive) setComments(res.data?.data || []);
            } catch (e) {
                console.error("Load comments error:", e);
                if (alive) setError(e.response?.data?.message || "Could not load comments.");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => { alive = false; };

    }, [postId]);

    const submit = async event => {

        event.preventDefault();

        const value = text.trim();

        if (!value || sending) return;

        try {
            setSending(true);
            const res = await api.post(`/posts/${postId}/comments`, { text: value });
            setComments(prev => [...prev, res.data.data]);
            setText("");
            setError("");
            if (onCount) onCount(res.data.commentCount);
        } catch (e) {
            setError(e.response?.data?.message || "Could not add comment.");
        } finally {
            setSending(false);
        }

    };

    const deleteComment = async comment => {
        if (!window.confirm("Delete this comment?")) return;
        setError("");
        try {
            const response = await api.delete(`/posts/${postId}/comments/${comment._id}`);
            setComments(previous => previous.filter(item => item._id !== comment._id));
            if (onCount) onCount(response.data.commentCount);
        } catch (deleteError) {
            setError(deleteError.response?.data?.message || "Could not delete comment.");
        }
    };

    return (
        <div className="comments-panel">

            <div className="comments-head">
                <strong>Comments</strong>
                {onClose && (
                    <button type="button" onClick={onClose} aria-label="Close">
                        <FaTimes />
                    </button>
                )}
            </div>

            <div className="comments-list">

                {loading && <p className="comments-empty">Loading...</p>}
                {error && <p className="comments-error" role="alert">{error}</p>}

                {!loading && !error && comments.length === 0 && (
                    <p className="comments-empty">No comments yet. Be the first!</p>
                )}

                {comments.map(c => (
                    <div className="comment-row" key={c._id}>
                        <div className="avatar-sm">
                            {c.user?.profileImage || c.user?.avatar
                                ? <img src={getUploadUrl(c.user.profileImage || c.user.avatar)} alt="" />
                                : (c.user?.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <Link to={`/user/${c.user?._id}`}><b>{c.user?.name || "User"}</b></Link>
                            <span>{c.text}</span>
                        </div>
                        {(String(c.user?._id || c.user) === currentUserId || user?.role === "admin") && (
                            <button
                                type="button"
                                className="comment-delete"
                                aria-label={`Delete comment by ${c.user?.name || "User"}`}
                                onClick={() => deleteComment(c)}
                            >
                                <FaTrash />
                            </button>
                        )}
                    </div>
                ))}

            </div>

            <form className="comments-form" onSubmit={submit}>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Write a comment..."
                    maxLength={1000}
                />
                <button type="submit" disabled={!text.trim() || sending}>
                    <FaPaperPlane />
                </button>
            </form>

        </div>
    );

};

export default CommentsPanel;
