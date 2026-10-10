import React, { useCallback, useEffect, useState } from "react";
import { FaTimes, FaPlay, FaTrash } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import PostCard from "./PostCard";
import CommentsPanel from "./CommentsPanel";
import "../styles/Social.css";

/*
 * Stats + Follow button + Posts/Reels grid for a profile.
 * Used on both your own Profile and other people's profiles.
 */

const ProfileSocial = ({ userId, isSelf = false }) => {

    const { user: me } = useApp();

    const myId = String(me?._id || me?.id || "");

    const [stats, setStats] = useState(null);
    const [following, setFollowing] = useState(false);
    const [followBusy, setFollowBusy] = useState(false);

    const [tab, setTab] = useState("post");
    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(null);

    /* ---- stats ---- */

    useEffect(() => {

        if (!userId) return undefined;

        let alive = true;

        (async () => {
            try {
                const res = await api.get(`/users/social/${userId}`);
                if (!alive) return;
                setStats(res.data);
                setFollowing(Boolean(res.data.isFollowing));
            } catch (e) {
                console.error("Social stats error:", e);
            }
        })();

        return () => { alive = false; };

    }, [userId]);

    /* ---- grid ---- */

    const load = useCallback(async (kind, before = null) => {

        if (!userId) return;

        try {

            setLoading(true);

            const res = await api.get(`/posts/user/${userId}`, {
                params: { kind, ...(before ? { before } : {}) }
            });

            setItems(prev => before ? [...prev, ...res.data.data] : res.data.data);
            setCursor(res.data.nextCursor || null);

        } catch (e) {
            console.error("Load profile posts error:", e);
        } finally {
            setLoading(false);
        }

    }, [userId]);

    useEffect(() => {
        setItems([]);
        setCursor(null);
        load(tab);
    }, [tab, load]);

    /* ---- follow ---- */

    const toggleFollow = async () => {

        if (followBusy) return;

        try {

            setFollowBusy(true);

            const res = await api.post(`/users/follow/${userId}`);

            setFollowing(res.data.isFollowing);
            setStats(prev => prev && { ...prev, followersCount: res.data.followersCount });

        } catch (e) {
            alert(e.response?.data?.message || "Could not update follow.");
        } finally {
            setFollowBusy(false);
        }

    };

    const removeItem = id => {
        setItems(prev => prev.filter(p => p._id !== id));
        setStats(prev => prev && ({
            ...prev,
            postsCount: tab === "post" ? Math.max(0, prev.postsCount - 1) : prev.postsCount,
            reelsCount: tab === "reel" ? Math.max(0, prev.reelsCount - 1) : prev.reelsCount
        }));
        setOpen(null);
    };

    const deleteReel = async reel => {

        if (!window.confirm("Delete this reel?")) return;

        try {
            await api.delete(`/posts/${reel._id}`);
            removeItem(reel._id);
        } catch (e) {
            alert(e.response?.data?.message || "Could not delete.");
        }

    };

    return (
        <section className="profile-social">

            <div className="profile-stats">

                <div><b>{stats?.postsCount ?? "-"}</b><span>Posts</span></div>
                <div><b>{stats?.reelsCount ?? "-"}</b><span>Reels</span></div>
                <div><b>{stats?.followersCount ?? "-"}</b><span>Followers</span></div>
                <div><b>{stats?.followingCount ?? "-"}</b><span>Following</span></div>

            </div>

            {!isSelf && String(userId) !== myId && (
                <button
                    type="button"
                    className={`follow-btn ${following ? "on" : ""}`}
                    onClick={toggleFollow}
                    disabled={followBusy}
                >
                    {following ? "Following" : "Follow"}
                </button>
            )}

            <div className="profile-tabs">
                <button type="button" className={tab === "post" ? "on" : ""} onClick={() => setTab("post")}>
                    Photos
                </button>
                <button type="button" className={tab === "reel" ? "on" : ""} onClick={() => setTab("reel")}>
                    Reels
                </button>
            </div>

            {!loading && items.length === 0 && (
                <p className="social-note">
                    {tab === "post" ? "No photos yet." : "No reels yet."}
                </p>
            )}

            <div className="profile-grid">

                {items.map(item => (
                    <button
                        type="button"
                        key={item._id}
                        className="grid-cell"
                        onClick={() => setOpen(item)}
                    >

                        {item.kind === "reel" ? (
                            <>
                                <video
                                    src={`${getUploadUrl(item.media[0]?.url)}#t=0.1`}
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                                <FaPlay className="grid-play" />
                            </>
                        ) : (
                            <img src={getUploadUrl(item.media[0]?.url)} alt="" loading="lazy" />
                        )}

                    </button>
                ))}

            </div>

            {loading && items.length > 0 && <p className="social-note">Loading...</p>}

            {cursor && !loading && (
                <button type="button" className="btn-ghost" onClick={() => load(tab, cursor)}>
                    Load more
                </button>
            )}

            {open && (
                <div className="sheet-overlay center" onClick={() => setOpen(null)}>

                    <div className="viewer" onClick={e => e.stopPropagation()}>

                        <button type="button" className="viewer-close" onClick={() => setOpen(null)}>
                            <FaTimes />
                        </button>

                        {open.kind === "reel" ? (
                            <div className="viewer-reel">

                                <video src={getUploadUrl(open.media[0]?.url)} controls autoPlay playsInline />

                                {open.caption && <p>{open.caption}</p>}

                                {(String(open.author?._id) === myId || me?.role === "admin") && (
                                    <button type="button" className="btn-ghost" onClick={() => deleteReel(open)}>
                                        <FaTrash /> Delete
                                    </button>
                                )}

                                <CommentsPanel postId={open._id} />

                            </div>
                        ) : (
                            <PostCard post={open} onDeleted={removeItem} />
                        )}

                    </div>

                </div>
            )}

        </section>
    );

};

export default ProfileSocial;
