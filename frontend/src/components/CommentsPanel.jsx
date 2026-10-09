import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaTimes, FaPaperPlane } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";

const CommentsPanel = ({ postId, onCount, onClose }) => {

    const [comments, setComments] = useState([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {

        let alive = true;

        (async () => {
            try {
                const res = await api.get(`/posts/${postId}/comments`);
                if (alive) setComments(res.data?.data || []);
            } catch (e) {
                console.error("Load comments error:", e);
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
            if (onCount) onCount(res.data.commentCount);
        } catch (e) {
            alert(e.response?.data?.message || "Could not add comment.");
        } finally {
            setSending(false);
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

                {!loading && comments.length === 0 && (
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
