import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaHeart, FaRegHeart, FaRegComment, FaPlus, FaTimes,
    FaVolumeMute, FaVolumeUp, FaTrash
} from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import CommentsPanel from "../components/CommentsPanel";
import "../styles/Social.css";

const MAX_SECONDS = 60;

/* ---------------- one reel ---------------- */

const ReelItem = ({ reel, muted, setMuted, myId, isAdmin, onDeleted }) => {

    const videoRef = useRef(null);
    const viewed = useRef(false);

    const [liked, setLiked] = useState(reel.likedByMe);
    const [likeCount, setLikeCount] = useState(reel.likeCount);
    const [commentCount, setCommentCount] = useState(reel.commentCount);
    const [showComments, setShowComments] = useState(false);

    // play only the reel that's actually on screen
    useEffect(() => {

        const video = videoRef.current;

        if (!video) return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => {

                if (entry.isIntersecting && entry.intersectionRatio > 0.6) {

                    video.play().catch(() => {});

                    if (!viewed.current) {
                        viewed.current = true;
                        api.post(`/posts/${reel._id}/view`).catch(() => {});
                    }

                } else {
                    video.pause();
                }

            },
            { threshold: [0, 0.6, 1] }
        );

        observer.observe(video);

        return () => observer.disconnect();

    }, [reel._id]);

    const toggleLike = async () => {

        const next = !liked;

        setLiked(next);
        setLikeCount(c => c + (next ? 1 : -1));

        try {
            await api.post(`/posts/${reel._id}/like`);
        } catch (e) {
            setLiked(!next);
            setLikeCount(c => c + (next ? -1 : 1));
        }

    };

    const remove = async () => {

        if (!window.confirm("Delete this reel?")) return;

        try {
            await api.delete(`/posts/${reel._id}`);
            onDeleted(reel._id);
        } catch (e) {
            alert(e.response?.data?.message || "Could not delete.");
        }

    };

    const author = reel.author || {};

    const canDelete = String(author._id) === myId || isAdmin;

    return (
        <section className="reel-item">

            <video
                ref={videoRef}
                src={getUploadUrl(reel.media[0]?.url)}
                loop
                playsInline
                muted={muted}
                preload="metadata"
                onClick={() => setMuted(m => !m)}
            />

            <div className="reel-overlay">

                <Link to={String(author._id) === myId ? "/profile" : `/user/${author._id}`} className="reel-author">
                    <div className="avatar-sm">
                        {author.profileImage || author.avatar
                            ? <img src={getUploadUrl(author.profileImage || author.avatar)} alt="" />
                            : (author.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <b>{author.name || "User"}</b>
                </Link>

                {reel.caption && <p>{reel.caption}</p>}

            </div>

            <div className="reel-side">

                <button type="button" onClick={toggleLike} className={liked ? "liked" : ""}>
                    {liked ? <FaHeart /> : <FaRegHeart />}
                    <span>{likeCount}</span>
                </button>

                <button type="button" onClick={() => setShowComments(true)}>
                    <FaRegComment />
                    <span>{commentCount}</span>
                </button>

                <button type="button" onClick={() => setMuted(m => !m)}>
                    {muted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>

                {canDelete && (
                    <button type="button" onClick={remove}>
                        <FaTrash />
                    </button>
                )}

            </div>

            {showComments && (
                <div className="reel-comments">
                    <CommentsPanel
                        postId={reel._id}
                        onCount={setCommentCount}
                        onClose={() => setShowComments(false)}
                    />
                </div>
            )}

        </section>
    );

};

/* ---------------- upload sheet ---------------- */

const UploadSheet = ({ onClose, onUploaded }) => {

    const [file, setFile] = useState(null);
    const [duration, setDuration] = useState(0);
    const [caption, setCaption] = useState("");
    const [progress, setProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState("");

    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const choose = event => {

        const picked = event.target.files?.[0];

        event.target.value = "";

        if (!picked) return;

        setError("");

        const url = URL.createObjectURL(picked);

        const probe = document.createElement("video");

        probe.preload = "metadata";

        probe.onloadedmetadata = () => {

            if (probe.duration > MAX_SECONDS + 0.5) {
                URL.revokeObjectURL(url);
                setError(`Reels can be at most ${MAX_SECONDS} seconds. This video is ${Math.round(probe.duration)}s.`);
                return;
            }

            setDuration(probe.duration);
            setFile(picked);
            setPreview(url);

        };

        probe.onerror = () => {
            URL.revokeObjectURL(url);
            setError("This video can't be read. Try an MP4 file.");
        };

        probe.src = url;

    };

    const upload = async () => {

        if (!file || uploading) return;

        const form = new FormData();

        form.append("video", file);
        form.append("caption", caption.trim());
        form.append("duration", String(Math.round(duration)));

        try {

            setUploading(true);
            setError("");

            const res = await api.post("/posts/reels", form, {
                onUploadProgress: e => {
                    if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
                },
                timeout: 5 * 60 * 1000
            });

            onUploaded(res.data.data);

        } catch (e) {
            setError(e.response?.data?.message || "Upload failed. Please try again.");
            setUploading(false);
        }

    };

    return (
        <div className="sheet-overlay">
            <div className="sheet">

                <div className="comments-head">
                    <strong>New reel</strong>
                    <button type="button" onClick={onClose} disabled={uploading}><FaTimes /></button>
                </div>

                {!file ? (
                    <label className="pick-video">
                        <FaPlus />
                        <span>Choose a video (max {MAX_SECONDS}s)</span>
                        <input type="file" accept="video/*" hidden onChange={choose} />
                    </label>
                ) : (
                    <video className="sheet-preview" src={preview} controls playsInline />
                )}

                {file && (
                    <input
                        className="composer-input"
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="Write a caption..."
                        maxLength={2200}
                        disabled={uploading}
                    />
                )}

                {error && <p className="social-note error">{error}</p>}

                {uploading && (
                    <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
                )}

                {file && (
                    <button className="btn-primary" type="button" onClick={upload} disabled={uploading}>
                        {uploading ? `Uploading ${progress}%` : "Share reel"}
                    </button>
                )}

            </div>
        </div>
    );

};

/* ---------------- page ---------------- */

const Reels = () => {

    const { user } = useApp();

    const myId = String(user?._id || user?.id || "");

    const [reels, setReels] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [muted, setMuted] = useState(true);
    const [showUpload, setShowUpload] = useState(false);

    const load = useCallback(async (before = null) => {

        try {

            const res = await api.get("/posts/reels", {
                params: before ? { before } : {}
            });

            setReels(prev => before ? [...prev, ...res.data.data] : res.data.data);
            setCursor(res.data.nextCursor || null);

        } catch (e) {
            setError(e.response?.data?.message || "Could not load reels.");
        } finally {
            setLoading(false);
        }

    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="reels-page">

            <button type="button" className="reel-add" onClick={() => setShowUpload(true)}>
                <FaPlus /> Reel
            </button>

            {loading && <p className="social-note">Loading reels...</p>}

            {error && <p className="social-note error">{error}</p>}

            {!loading && !error && reels.length === 0 && (
                <p className="social-note">No reels yet. Tap “+ Reel” to share a video up to 60 seconds.</p>
            )}

            {reels.map(reel => (
                <ReelItem
                    key={reel._id}
                    reel={reel}
                    muted={muted}
                    setMuted={setMuted}
                    myId={myId}
                    isAdmin={user?.role === "admin"}
                    onDeleted={id => setReels(prev => prev.filter(r => r._id !== id))}
                />
            ))}

            {cursor && (
                <button className="btn-ghost reel-more" type="button" onClick={() => load(cursor)}>
                    Load more reels
                </button>
            )}

            {showUpload && (
                <UploadSheet
                    onClose={() => setShowUpload(false)}
                    onUploaded={reel => {
                        setReels(prev => [reel, ...prev]);
                        setShowUpload(false);
                    }}
                />
            )}

        </div>
    );

};

export default Reels;
