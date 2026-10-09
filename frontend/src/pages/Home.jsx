import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaImage, FaTimes } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import PostCard from "../components/PostCard";
import "../styles/Social.css";

const MAX_PHOTOS = 5;

const Home = () => {

    const { user } = useApp();

    const fileRef = useRef(null);

    const [posts, setPosts] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const [caption, setCaption] = useState("");
    const [files, setFiles] = useState([]);
    const [posting, setPosting] = useState(false);

    // created once per selection (not on every keystroke) and released afterwards
    const previews = useMemo(
        () => files.map(f => URL.createObjectURL(f)),
        [files]
    );

    useEffect(
        () => () => previews.forEach(url => URL.revokeObjectURL(url)),
        [previews]
    );

    const load = useCallback(async (before = null) => {

        try {

            before ? setLoadingMore(true) : setLoading(true);

            const res = await api.get("/posts/feed", {
                params: before ? { before } : {}
            });

            setPosts(prev => before ? [...prev, ...res.data.data] : res.data.data);
            setCursor(res.data.nextCursor || null);
            setError("");

        } catch (e) {
            setError(e.response?.data?.message || "Could not load the feed.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }

    }, []);

    useEffect(() => { load(); }, [load]);

    const pickFiles = event => {

        const picked = Array.from(event.target.files || []);

        event.target.value = "";

        const next = [...files, ...picked].slice(0, MAX_PHOTOS);

        if (files.length + picked.length > MAX_PHOTOS) {
            alert(`You can add up to ${MAX_PHOTOS} photos.`);
        }

        const tooBig = next.find(f => f.size > 10 * 1024 * 1024);

        if (tooBig) {
            alert("Each photo must be under 10MB.");
            return;
        }

        setFiles(next);

    };

    const publish = async event => {

        event.preventDefault();

        if (files.length === 0 || posting) return;

        const form = new FormData();

        files.forEach(f => form.append("photos", f));
        form.append("caption", caption.trim());

        try {

            setPosting(true);

            const res = await api.post("/posts", form);

            setPosts(prev => [res.data.data, ...prev]);
            setFiles([]);
            setCaption("");

        } catch (e) {
            alert(e.response?.data?.message || "Could not publish your post.");
        } finally {
            setPosting(false);
        }

    };

    return (
        <div className="social-page">

            <form className="composer" onSubmit={publish}>

                <div className="composer-row">

                    <div className="avatar-sm">
                        {user?.profileImage || user?.avatar
                            ? <img src={getUploadUrl(user.profileImage || user.avatar)} alt="" />
                            : (user?.name || "U").charAt(0).toUpperCase()}
                    </div>

                    <input
                        className="composer-input"
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="What's on your mind?"
                        maxLength={2200}
                    />

                    <button
                        type="button"
                        className="icon-btn big"
                        onClick={() => fileRef.current?.click()}
                        title="Add photos"
                    >
                        <FaImage />
                    </button>

                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={pickFiles}
                    />

                </div>

                {files.length > 0 && (
                    <div className="composer-previews">
                        {previews.map((src, i) => (
                            <div key={i} className="composer-thumb">
                                <img src={src} alt="" />
                                <button
                                    type="button"
                                    onClick={() => setFiles(files.filter((_, n) => n !== i))}
                                    aria-label="Remove"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {files.length > 0 && (
                    <button className="btn-primary" type="submit" disabled={posting}>
                        {posting ? "Posting..." : "Post"}
                    </button>
                )}

            </form>

            {loading && <p className="social-note">Loading feed...</p>}

            {error && <p className="social-note error">{error}</p>}

            {!loading && !error && posts.length === 0 && (
                <p className="social-note">No posts yet. Share the first photo!</p>
            )}

            {posts.map(post => (
                <PostCard
                    key={post._id}
                    post={post}
                    onDeleted={id => setPosts(prev => prev.filter(p => p._id !== id))}
                />
            ))}

            {cursor && (
                <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => load(cursor)}
                    disabled={loadingMore}
                >
                    {loadingMore ? "Loading..." : "Load more"}
                </button>
            )}

        </div>
    );

};

export default Home;
