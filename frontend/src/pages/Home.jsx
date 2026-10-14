import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaArrowRight,
    FaCompass,
    FaImage,
    FaPlay,
    FaPlus,
    FaShoppingBag,
    FaSyncAlt,
    FaTimes,
    FaUsers
} from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import PostCard from "../components/PostCard";
import "../styles/Social.css";

const MAX_PHOTOS = 5;

const Home = () => {

    const { user } = useApp();

    const fileRef = useRef(null);

    const [posts, setPosts] = useState([]);
    const [following, setFollowing] = useState([]);
    const [feedScope, setFeedScope] = useState("for-you");
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

    const load = useCallback(async (before = null, scope = feedScope) => {

        try {

            before ? setLoadingMore(true) : setLoading(true);

            const res = await api.get("/posts/feed", {
                params: {
                    scope: scope === "following" ? "following" : "for-you",
                    ...(before ? { before } : {})
                }
            });

            setPosts(prev => before ? [...prev, ...res.data.data] : (res.data.data || []));
            setCursor(res.data.nextCursor || null);
            setError("");

        } catch (e) {
            setError(e.response?.data?.message || "Could not load the feed.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }

    }, [feedScope]);

    useEffect(() => {
        load(null, feedScope);
    }, [feedScope, load]);

    useEffect(() => {
        let active = true;

        api.get("/users/following")
            .then(response => {
                if (active) setFollowing(response.data.users || []);
            })
            .catch(() => {
                if (active) setFollowing([]);
            });

        return () => { active = false; };
    }, []);

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

        if ((files.length === 0 && !caption.trim()) || posting) return;

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
        <main className="home-experience">

            <section className="home-welcome">
                <div className="home-welcome-copy">
                    <span className="home-eyebrow"><FaCompass /> YOUR WORLD, IN ONE PLACE</span>
                    <h1>Good things happen<br /><em>when we share.</em></h1>
                    <p>A community for the things you love, the people you meet, and the finds you discover.</p>
                    <div className="home-welcome-actions">
                        <Link to="/shop" className="home-primary-link">Explore the shop <FaArrowRight /></Link>
                        <Link to="/reels" className="home-text-link"><FaPlay /> Watch reels</Link>
                    </div>
                </div>
                <div className="home-welcome-art" aria-hidden="true">
                    <span className="home-art-orbit home-art-orbit-one" />
                    <span className="home-art-orbit home-art-orbit-two" />
                    <span className="home-art-spark">✳</span>
                    <span className="home-art-note">Find your<br />kind of people.</span>
                </div>
            </section>

            <section className="home-shortcuts" aria-label="Explore E Top">
                <Link to="/reels"><span className="home-shortcut-icon violet"><FaPlay /></span><span><b>Reels</b><small>See what's moving</small></span><FaArrowRight /></Link>
                <Link to="/shop"><span className="home-shortcut-icon amber"><FaShoppingBag /></span><span><b>Marketplace</b><small>Shop independent</small></span><FaArrowRight /></Link>
                <Link to="/messenger"><span className="home-shortcut-icon mint"><FaUsers /></span><span><b>Your people</b><small>Pick up a conversation</small></span><FaArrowRight /></Link>
            </section>

            <div className="home-layout">
                <aside className="home-side home-side-left">
                    <section className="home-profile-panel">
                        <div className="home-profile-cover" />
                        <Link to="/profile" className="home-profile-avatar">
                            {user?.profileImage || user?.avatar
                                ? <img src={getUploadUrl(user.profileImage || user.avatar)} alt="" />
                                : (user?.name || "U").charAt(0).toUpperCase()}
                        </Link>
                        <div className="home-profile-info">
                            <b>{user?.name || "Welcome to E Top"}</b>
                            <span>Your space, your story.</span>
                            <Link to="/profile">View your profile <FaArrowRight /></Link>
                        </div>
                    </section>
                    <section className="home-side-card home-circle-card">
                        <div className="home-side-heading"><span>YOUR CIRCLE</span><Link to="/profile">See all</Link></div>
                        {following.length > 0 ? following.slice(0, 5).map(person => (
                            <Link className="home-person-row" to={`/user/${person._id}`} key={person._id}>
                                <span className="home-person-avatar">
                                    {person.profileImage
                                        ? <img src={getUploadUrl(person.profileImage)} alt="" />
                                        : (person.name || "U").charAt(0).toUpperCase()}
                                </span>
                                <span><b>{person.name}</b><small>{person.role === "seller" ? "Creator & seller" : "In your circle"}</small></span>
                                <FaArrowRight />
                            </Link>
                        )) : (
                            <div className="home-circle-empty">
                                <span className="home-empty-icon"><FaUsers /></span>
                                <b>Make your first connection</b>
                                <p>Follow people whose stories and finds inspire you.</p>
                                <Link to="/search">Discover people <FaArrowRight /></Link>
                            </div>
                        )}
                    </section>
                </aside>

                <div className="home-feed-column">
                    <section className="home-following-strip">
                        <div className="home-following-intro">
                            <span className="home-strip-orb"><FaUsers /></span>
                            <span><b>Your people, closer</b><small>{following.length ? `${following.length} people in your circle` : "Your circle starts with one follow"}</small></span>
                        </div>
                        <div className="home-following-avatars">
                            {following.slice(0, 4).map(person => (
                                <Link to={`/user/${person._id}`} key={person._id} title={person.name}>
                                    {person.profileImage
                                        ? <img src={getUploadUrl(person.profileImage)} alt={person.name} />
                                        : (person.name || "U").charAt(0).toUpperCase()}
                                </Link>
                            ))}
                            <Link className="home-add-circle" to="/search" aria-label="Find people"><FaPlus /></Link>
                        </div>
                    </section>

                    <form className="composer home-composer" onSubmit={publish}>

                        <div className="home-composer-title">
                            <span className="home-composer-orb"><FaPlus /></span>
                            <span><b>Start a little something</b><small>Share a moment with your community</small></span>
                        </div>

                        <div className="composer-row">

                    <div className="avatar-sm home-composer-avatar">
                        {user?.profileImage || user?.avatar
                            ? <img src={getUploadUrl(user.profileImage || user.avatar)} alt="" />
                            : (user?.name || "U").charAt(0).toUpperCase()}
                    </div>

                    <input
                        className="composer-input"
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder="What's worth sharing today?"
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

                        <div className="home-composer-footer">
                            <span className="home-composer-hint"><FaImage /> Add up to 5 photos</span>
                            <span className="home-composer-count">{caption.length}/2200</span>
                            <button className="btn-primary" type="submit" disabled={posting || (!caption.trim() && files.length === 0)}>
                                {posting ? "Sharing..." : "Share post"} <FaArrowRight />
                            </button>
                        </div>

            </form>

                    <div className="home-feed-heading">
                        <div><span className="home-eyebrow">A FRESH LOOK</span><h2>Your feed</h2></div>
                        <button type="button" className="home-refresh" onClick={() => load(null, feedScope)} disabled={loading} aria-label="Refresh feed">
                            <FaSyncAlt className={loading ? "is-spinning" : ""} />
                        </button>
                    </div>
                    <div className="home-feed-tabs">
                        <button className={feedScope === "for-you" ? "active" : ""} onClick={() => setFeedScope("for-you")} type="button">For you</button>
                        <button className={feedScope === "following" ? "active" : ""} onClick={() => setFeedScope("following")} type="button">Following <span>{following.length}</span></button>
                    </div>

                    {loading && <p className="social-note">Finding something good for you...</p>}

                    {error && <div className="home-error"><p>{error}</p><button type="button" onClick={() => load(null, feedScope)}>Try again</button></div>}

                    {!loading && !error && posts.length === 0 && (
                        <div className="home-empty-feed">
                            <span><FaCompass /></span>
                            <h3>{feedScope === "following" ? "Your circle is warming up." : "A blank canvas."}</h3>
                            <p>{feedScope === "following" ? "Follow a few people or be the first to share something here." : "Share a photo or a thought to start your community feed."}</p>
                            {feedScope === "following" && <Link to="/search">Find your people <FaArrowRight /></Link>}
                        </div>
                    )}

                    {posts.map(post => (
                        <PostCard
                            key={post._id}
                            post={post}
                            onDeleted={id => setPosts(prev => prev.filter(p => p._id !== id))}
                        />
                    ))}

                    {cursor && (
                        <button className="btn-ghost home-load-more" type="button" onClick={() => load(cursor, feedScope)} disabled={loadingMore}>
                            {loadingMore ? "Finding more..." : "Discover more"} <FaArrowRight />
                        </button>
                    )}
                </div>

                <aside className="home-side home-side-right">
                    <section className="home-editorial-card">
                        <span className="home-editorial-mark">E</span>
                        <span className="home-eyebrow">THE E TOP EDIT</span>
                        <h3>More than a feed.<br /><em>A feeling.</em></h3>
                        <p>Discover independent finds, meet your people, and make this corner of the internet yours.</p>
                        <Link to="/shop">Explore the edit <FaArrowRight /></Link>
                    </section>
                    <section className="home-side-card home-creator-card">
                        <div className="home-creator-icon"><FaShoppingBag /></div>
                        <span className="home-eyebrow">MADE BY PEOPLE</span>
                        <h3>Good finds.<br />Good stories.</h3>
                        <p>Meet the independent sellers bringing something different to the table.</p>
                        <Link to="/shop">Meet the makers <FaArrowRight /></Link>
                    </section>
                    <p className="home-footer-note">A little corner of the internet, made for everyone.<br />© 2026 E Top</p>
                </aside>
            </div>

        </main>
    );

};

export default Home;
