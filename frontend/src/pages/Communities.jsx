import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    FaArrowLeft,
    FaArrowRight,
    FaCheck,
    FaGlobe,
    FaImage,
    FaLock,
    FaPlus,
    FaTimes,
    FaUserMinus,
    FaUserShield,
    FaUsers
} from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import PostCard from "../components/PostCard";
import "../styles/Communities.css";

const CommunityCard = ({ community, onJoin }) => (
    <article className="community-card">
        <div className={`community-card-icon ${community.privacy}`}>
            {community.privacy === "private" ? <FaLock /> : <FaGlobe />}
        </div>
        <div className="community-card-main">
            <Link to={`/communities/${community._id}`} className="community-card-title">
                {community.name}
            </Link>
            <p>{community.description || "A place to share ideas and meet people."}</p>
            <small>
                {community.membersCount} members · {community.privacy} community
            </small>
        </div>
        <div className="community-card-actions">
            {community.membershipStatus === "member" ? (
                <Link className="community-button secondary" to={`/communities/${community._id}`}>
                    Open <FaArrowRight />
                </Link>
            ) : community.membershipStatus === "requested" ? (
                <span className="community-requested">Request sent</span>
            ) : (
                <button type="button" className="community-button" onClick={() => onJoin(community)}>
                    {community.privacy === "private" ? "Request to join" : "Join"}
                </button>
            )}
        </div>
    </article>
);

const Communities = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useApp();
    const fileRef = useRef(null);

    const [activeTab, setActiveTab] = useState("mine");
    const [communities, setCommunities] = useState([]);
    const [community, setCommunity] = useState(null);
    const [posts, setPosts] = useState([]);
    const [members, setMembers] = useState([]);
    const [caption, setCaption] = useState("");
    const [files, setFiles] = useState([]);
    const [postsCursor, setPostsCursor] = useState(null);
    const [loadingMorePosts, setLoadingMorePosts] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [privacy, setPrivacy] = useState("public");
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadCommunity = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        setError("");
        try {
            const response = await api.get(`/communities/${id}`);
            const nextCommunity = response.data.data;
            setCommunity(nextCommunity);

            if (nextCommunity.privacy === "public" || nextCommunity.isMember) {
                const postsResponse = await api.get(`/posts/community/${id}/feed`);
                setPosts(postsResponse.data.data || []);
                setPostsCursor(postsResponse.data.nextCursor || null);
            } else {
                setPosts([]);
                setPostsCursor(null);
            }

            if (
                nextCommunity.isAdmin ||
                nextCommunity.isMember ||
                nextCommunity.privacy === "public"
            ) {
                const membersResponse = await api.get(`/communities/${id}/members`);
                setMembers(membersResponse.data.data || []);
            } else {
                setMembers([]);
            }
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not load this community.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!id) {
            let active = true;
            setLoading(true);
            api.get(`/communities/${activeTab === "mine" ? "mine" : "discover"}`)
                .then(response => {
                    if (active) {
                        setCommunities(response.data.data || []);
                        setError("");
                    }
                })
                .catch(requestError => {
                    if (active) {
                        setError(requestError.response?.data?.message || "Could not load communities.");
                    }
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
            return () => { active = false; };
        }

        loadCommunity();
    }, [activeTab, id, loadCommunity]);

    const joinCommunity = async target => {
        try {
            await api.post(`/communities/${target._id}/join`);
            if (id) {
                await loadCommunity();
                return;
            }
            const response = await api.get(`/communities/${activeTab === "mine" ? "mine" : "discover"}`);
            setCommunities(response.data.data || []);
        } catch (requestError) {
            alert(requestError.response?.data?.message || "Could not join this community.");
        }
    };

    const handlePhotoSelection = event => {
        const selected = Array.from(event.target.files || []);
        event.target.value = "";

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "image/heif"
        ];
        if (selected.some(file => !allowedTypes.includes(file.type))) {
            alert("Choose JPG, PNG, WebP, GIF, or HEIC photos.");
            return;
        }
        if (selected.some(file => file.size > 10 * 1024 * 1024)) {
            alert("Each photo must be under 10MB.");
            return;
        }

        if (files.length + selected.length > 5) {
            alert("You can add up to 5 photos.");
        }
        setFiles([...files, ...selected].slice(0, 5));
    };

    const loadMorePosts = async () => {
        if (!postsCursor || loadingMorePosts) return;
        setLoadingMorePosts(true);
        try {
            const response = await api.get(`/posts/community/${id}/feed`, {
                params: { before: postsCursor }
            });
            setPosts(current => [...current, ...(response.data.data || [])]);
            setPostsCursor(response.data.nextCursor || null);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not load more posts.");
        } finally {
            setLoadingMorePosts(false);
        }
    };

    const toggleMembers = async () => {
        const nextVisible = !showMembers;
        setShowMembers(nextVisible);
        if (nextVisible && members.length === 0) {
            try {
                const response = await api.get(`/communities/${id}/members`);
                setMembers(response.data.data || []);
            } catch (requestError) {
                alert(requestError.response?.data?.message || "Could not load community members.");
            }
        }
    };

    const createCommunity = async event => {
        event.preventDefault();
        if (!name.trim() || saving) return;

        setSaving(true);
        try {
            const response = await api.post("/communities", {
                name: name.trim(),
                description: description.trim(),
                privacy
            });
            navigate(`/communities/${response.data.data._id}`);
        } catch (requestError) {
            alert(requestError.response?.data?.message || "Could not create the community.");
        } finally {
            setSaving(false);
        }
    };

    const publishPost = async event => {
        event.preventDefault();
        if ((!caption.trim() && files.length === 0) || posting) return;

        const form = new FormData();
        form.append("caption", caption.trim());
        files.slice(0, 5).forEach(file => form.append("photos", file));

        setPosting(true);
        try {
            const response = await api.post(`/posts/community/${id}`, form, {
                timeout: 5 * 60 * 1000,
                headers: { "Content-Type": "multipart/form-data" }
            });
            setPosts(current => [response.data.data, ...current]);
            setCaption("");
            setFiles([]);
        } catch (requestError) {
            alert(requestError.response?.data?.message || "Could not publish your post.");
        } finally {
            setPosting(false);
        }
    };

    const membershipAction = async (action, targetUserId) => {
        try {
            const paths = {
                approve: `/communities/${id}/join-requests/${targetUserId}/approve`,
                decline: `/communities/${id}/join-requests/${targetUserId}`,
                remove: `/communities/${id}/members/${targetUserId}`,
                promote: `/communities/${id}/admins/${targetUserId}`,
                demote: `/communities/${id}/admins/${targetUserId}`
            };
            if (action === "approve" || action === "promote") {
                await api.post(paths[action]);
            } else {
                await api.delete(paths[action]);
            }
            await loadCommunity();
        } catch (requestError) {
            alert(requestError.response?.data?.message || "Could not update community membership.");
        }
    };

    const leaveCommunity = async () => {
        if (!window.confirm("Leave this community?")) return;
        try {
            await api.post(`/communities/${id}/leave`);
            navigate("/communities");
        } catch (requestError) {
            alert(requestError.response?.data?.message || "Could not leave the community.");
        }
    };

    if (id) {
        const privateLocked = community?.privacy === "private" && !community?.isMember;

        return (
            <main className="communities-page community-detail-page">
                <Link className="community-back-link" to="/communities"><FaArrowLeft /> Communities</Link>
                {loading && <p className="community-note">Loading community...</p>}
                {error && <div className="community-error">{error}</div>}
                {!loading && community && (
                    <>
                        <header className="community-detail-header">
                            <div className={`community-detail-symbol ${community.privacy}`}>
                                {community.privacy === "private" ? <FaLock /> : <FaGlobe />}
                            </div>
                            <div className="community-detail-copy">
                                <span className="community-eyebrow">
                                    {community.privacy === "private" ? "PRIVATE COMMUNITY" : "PUBLIC COMMUNITY"}
                                </span>
                                <h1>{community.name}</h1>
                                <p>{community.description || "A place to share ideas and meet people."}</p>
                                <small>{community.membersCount} members · Created by {community.createdBy?.name || "a community member"}</small>
                            </div>
                            <div className="community-detail-actions">
                                {community.isMember ? (
                                    <>
                                        {community.isAdmin && <span className="community-admin-pill"><FaUserShield /> Admin</span>}
                                        <button type="button" className="community-button secondary" onClick={leaveCommunity}>Leave</button>
                                    </>
                                ) : community.membershipStatus === "requested" ? (
                                    <span className="community-requested">Join request pending</span>
                                ) : (
                                    <button
                                        type="button"
                                        className="community-button"
                                        onClick={() => joinCommunity(community)}
                                    >
                                        {community.privacy === "private" ? "Request to join" : "Join community"}
                                    </button>
                                )}
                            </div>
                        </header>

                        {community.isAdmin && community.pendingRequests?.length > 0 && (
                            <section className="community-management-card">
                                <h2>Membership requests <span>{community.pendingRequests.length}</span></h2>
                                {community.pendingRequests.map(person => (
                                    <div className="community-person-row" key={person._id}>
                                        <span className="community-avatar">
                                            {person.profileImage
                                                ? <img src={getUploadUrl(person.profileImage)} alt="" />
                                                : (person.name || "U").charAt(0).toUpperCase()}
                                        </span>
                                        <b>{person.name || "Member"}</b>
                                        <button type="button" onClick={() => membershipAction("approve", person._id)}><FaCheck /> Approve</button>
                                        <button type="button" className="muted" onClick={() => membershipAction("decline", person._id)}><FaTimes /> Decline</button>
                                    </div>
                                ))}
                            </section>
                        )}

                        {community.isAdmin && (
                            <section className="community-management-card">
                                <button
                                    type="button"
                                    className="community-manage-toggle"
                                    onClick={toggleMembers}
                                >
                                    <span>Manage members <small>Up to 100 shown</small></span>
                                    <FaUsers />
                                </button>
                                {showMembers && members.map(person => (
                                    <div className="community-person-row" key={person._id}>
                                        <span className="community-avatar">
                                            {person.profileImage
                                                ? <img src={getUploadUrl(person.profileImage)} alt="" />
                                                : (person.name || "U").charAt(0).toUpperCase()}
                                        </span>
                                        <b>{person.name || "Member"}{person.isCreator ? " · Creator" : person.isAdmin ? " · Admin" : ""}</b>
                                        {String(community.createdBy?._id) === String(user?._id || user?.id) && !person.isCreator && (
                                            person.isAdmin ? (
                                                <button type="button" className="muted" onClick={() => membershipAction("demote", person._id)}>Remove admin</button>
                                            ) : (
                                                <button type="button" onClick={() => membershipAction("promote", person._id)}><FaUserShield /> Make admin</button>
                                            )
                                        )}
                                        {!person.isCreator && (
                                            <button type="button" className="muted" onClick={() => membershipAction("remove", person._id)}><FaUserMinus /> Remove</button>
                                        )}
                                    </div>
                                ))}
                            </section>
                        )}

                        {privateLocked ? (
                            <section className="community-private-note">
                                <FaLock />
                                <h2>This community is private</h2>
                                <p>Request to join to see member posts and discussions.</p>
                            </section>
                        ) : (
                            <div className="community-feed-layout">
                                <section className="community-feed">
                                    {community.isMember && (
                                        <form className="community-composer" onSubmit={publishPost}>
                                            <textarea
                                                value={caption}
                                                onChange={event => setCaption(event.target.value)}
                                                placeholder={`Share something with ${community.name}...`}
                                                maxLength={2200}
                                            />
                                            {files.length > 0 && (
                                                <div className="community-selected-files">
                                                    {files.map((file, index) => (
                                                        <span key={`${file.name}-${index}`}>
                                                            {file.name}
                                                            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><FaTimes /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="community-composer-actions">
                                                <button type="button" className="community-photo-button" onClick={() => fileRef.current?.click()}><FaImage /> Add photos</button>
                                                <input
                                                    ref={fileRef}
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                                                    multiple
                                                    hidden
                                                    onChange={handlePhotoSelection}
                                                />
                                                <small>{caption.length}/2200 · Up to 5 photos</small>
                                                <button type="submit" className="community-button" disabled={posting || (!caption.trim() && files.length === 0)}>
                                                    {posting ? "Sharing..." : "Share post"} <FaArrowRight />
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                    {posts.length === 0 ? (
                                        <div className="community-empty">
                                            <span><FaUsers /></span>
                                            <h2>Start the conversation</h2>
                                            <p>{community.isMember ? "Share a post and welcome people into the discussion." : "Join this community to take part in its discussions."}</p>
                                        </div>
                                    ) : posts.map(post => (
                                        <PostCard
                                            key={post._id}
                                            post={post}
                                            onDeleted={postId => setPosts(current => current.filter(item => item._id !== postId))}
                                        />
                                    ))}
                                    {postsCursor && (
                                        <button
                                            type="button"
                                            className="community-button secondary community-load-more"
                                            onClick={loadMorePosts}
                                            disabled={loadingMorePosts}
                                        >
                                            {loadingMorePosts ? "Loading..." : "Load more posts"} <FaArrowRight />
                                        </button>
                                    )}
                                </section>
                                <aside className="community-about-card">
                                    <h2>About</h2>
                                    <p>{community.description || "A place to share ideas and meet people."}</p>
                                    <span>{community.privacy === "private" ? <FaLock /> : <FaGlobe />} {community.privacy} · {community.membersCount} members</span>
                                    <button type="button" className="community-members-link" onClick={toggleMembers}>
                                        <FaUsers /> {community.membersCount} members
                                    </button>
                                    {showMembers && !community.isAdmin && (
                                        <div className="community-public-members">
                                            {members.slice(0, 20).map(person => (
                                                <span key={person._id}>
                                                    {person.profileImage
                                                        ? <img src={getUploadUrl(person.profileImage)} alt="" />
                                                        : (person.name || "U").charAt(0).toUpperCase()}
                                                    {person.name || "Member"}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </aside>
                            </div>
                        )}
                    </>
                )}
            </main>
        );
    }

    return (
        <main className="communities-page">
            <header className="communities-heading">
                <div>
                    <span className="community-eyebrow">FIND YOUR PEOPLE</span>
                    <h1>Communities</h1>
                    <p>Join a public space or create a private home for your interests.</p>
                </div>
                <button type="button" className="community-button" onClick={() => setShowCreate(value => !value)}>
                    <FaPlus /> Create community
                </button>
            </header>

            {showCreate && (
                <form className="community-create-form" onSubmit={createCommunity}>
                    <div className="community-form-heading">
                        <span><FaUsers /></span>
                        <div><h2>Build your community</h2><p>Choose who can find and join your space.</p></div>
                    </div>
                    <label>
                        Community name
                        <input value={name} onChange={event => setName(event.target.value)} maxLength={60} required minLength={2} placeholder="e.g. Dhaka Photography Club" />
                    </label>
                    <label>
                        Description
                        <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} placeholder="What brings people together here?" />
                    </label>
                    <label>
                        Privacy
                        <select value={privacy} onChange={event => setPrivacy(event.target.value)}>
                            <option value="public">Public — anyone can join and see posts</option>
                            <option value="private">Private — admins approve requests; posts are members-only</option>
                        </select>
                    </label>
                    <div className="community-create-actions">
                        <button type="button" className="community-button secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                        <button type="submit" className="community-button" disabled={saving || name.trim().length < 2}>{saving ? "Creating..." : "Create community"}</button>
                    </div>
                </form>
            )}

            <div className="communities-tabs" role="tablist" aria-label="Community lists">
                <button type="button" role="tab" aria-selected={activeTab === "mine"} className={activeTab === "mine" ? "active" : ""} onClick={() => setActiveTab("mine")}>Your communities</button>
                <button type="button" role="tab" aria-selected={activeTab === "discover"} className={activeTab === "discover" ? "active" : ""} onClick={() => setActiveTab("discover")}>Discover</button>
            </div>

            {loading && <p className="community-note">Finding communities...</p>}
            {error && <div className="community-error">{error}</div>}
            {!loading && !error && communities.length === 0 && (
                <div className="community-empty">
                    <span><FaUsers /></span>
                    <h2>{activeTab === "mine" ? "Your circle starts here" : "No communities to discover yet"}</h2>
                    <p>{activeTab === "mine" ? "Create a community or explore public spaces to meet people who share your interests." : "Come back soon to discover new spaces."}</p>
                    {activeTab === "mine" && <button type="button" className="community-button" onClick={() => setActiveTab("discover")}>Discover communities <FaArrowRight /></button>}
                </div>
            )}
            <div className="community-list">
                {communities.map(item => (
                    <CommunityCard key={item._id} community={item} onJoin={joinCommunity} />
                ))}
            </div>
        </main>
    );
};

export default Communities;
