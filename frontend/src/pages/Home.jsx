import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    FaArrowRight,
    FaCompass,
    FaImage,
    FaPlay,
    FaPlus,
    FaSyncAlt,
    FaTimes,
    FaUsers
} from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { clearHomeDraft, loadHomeDraft, saveHomeDraft } from "../services/homeDraft";
import { useApp } from "../context/AppContext";
import PostCard from "../components/PostCard";
import MessengerStories from "../components/MessengerStories";
import SocialFollowButton from "../components/SocialFollowButton";
import "../styles/Social.css";

const MAX_PHOTOS = 5;
const MAX_POST_AUDIO_SIZE = 10 * 1024 * 1024;
const POST_AUDIO_TYPES = new Set([
    "audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg", "audio/webm"
]);
const POST_AUDIO_CLIP_SECONDS = 30;

const Home = () => {

    const { user } = useApp();

    const fileRef = useRef(null);
    const followingRequestRef = useRef(0);
    const feedRequestRef = useRef(0);
    const draftSaveRequestRef = useRef(0);
    const userId = String(user?._id || user?.id || "");

    const [posts, setPosts] = useState([]);
    const [following, setFollowing] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [followingError, setFollowingError] = useState("");
    const [suggestionsError, setSuggestionsError] = useState("");
    const [feedScope, setFeedScope] = useState("for-you");
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const [caption, setCaption] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [files, setFiles] = useState([]);
    const [audioFile, setAudioFile] = useState(null);
    const [audioTitle, setAudioTitle] = useState("");
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioStartSeconds, setAudioStartSeconds] = useState(0);
    const [audioRightsConfirmed, setAudioRightsConfirmed] = useState(false);
    const [location, setLocation] = useState("");
    const [altTexts, setAltTexts] = useState([]);
    const [tagSearch, setTagSearch] = useState("");
    const [tagResults, setTagResults] = useState([]);
    const [taggedUsers, setTaggedUsers] = useState([]);
    const [posting, setPosting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState("");
    const [draftReady, setDraftReady] = useState(false);
    const [draftUserId, setDraftUserId] = useState("");
    const [draftLoadError, setDraftLoadError] = useState("");
    const [draftStatus, setDraftStatus] = useState("");

    // created once per selection (not on every keystroke) and released afterwards
    const previews = useMemo(
        () => files.map(f => URL.createObjectURL(f)),
        [files]
    );
    const audioPreview = useMemo(
        () => audioFile ? URL.createObjectURL(audioFile) : "",
        [audioFile]
    );

    useEffect(
        () => () => previews.forEach(url => URL.revokeObjectURL(url)),
        [previews]
    );
    useEffect(() => () => {
        if (audioPreview) URL.revokeObjectURL(audioPreview);
    }, [audioPreview]);

    const load = useCallback(async (before = null, scope = feedScope) => {
        const requestId = before ? feedRequestRef.current : ++feedRequestRef.current;

        try {

            before ? setLoadingMore(true) : setLoading(true);

            const res = await api.get("/posts/feed", {
                params: {
                    scope: scope === "following" ? "following" : "for-you",
                    ...(before ? { before } : {})
                }
            });

            if (requestId !== feedRequestRef.current) return;
            const incomingPosts = res.data.data || [];
            setPosts(previous => {
                const seen = new Set();
                const combined = before ? [...previous, ...incomingPosts] : incomingPosts;
                return combined.filter(post => {
                    const id = String(post._id);
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });
            });
            setCursor(res.data.nextCursor || null);
            setError("");

        } catch (e) {
            if (requestId === feedRequestRef.current) {
                setError(e.response?.data?.message || "Could not load the feed.");
            }
        } finally {
            if (requestId === feedRequestRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }

    }, [feedScope]);

    useEffect(() => {
        load(null, feedScope);
    }, [feedScope, load]);

    const loadFollowing = useCallback(async () => {
        const requestId = ++followingRequestRef.current;
        try {
            const response = await api.get("/users/following");
            if (requestId !== followingRequestRef.current) return;
            setFollowing(response.data.users || []);
            setFollowingError("");
        } catch (e) {
            if (requestId !== followingRequestRef.current) return;
            console.error("HOME FOLLOWING LOAD ERROR:", e);
            setFollowingError(
                e.response?.data?.message || "Could not load your circle."
            );
        }
    }, []);

    const loadSuggestions = useCallback(async () => {
        try {
            const response = await api.get("/users/suggestions");
            setSuggestions(response.data.data || []);
            setSuggestionsError("");
        } catch (loadError) {
            console.error("HOME FOLLOW SUGGESTIONS LOAD ERROR:", loadError);
            setSuggestionsError(
                loadError.response?.data?.message || "Could not load follow suggestions."
            );
        }
    }, []);

    useEffect(() => {
        loadFollowing();
        loadSuggestions();
    }, [loadFollowing, loadSuggestions]);

    useEffect(() => {
        const query = tagSearch.trim();
        if (query.length < 2) {
            setTagResults([]);
            return undefined;
        }
        let active = true;
        const timeout = setTimeout(async () => {
            try {
                const response = await api.get("/users/search", { params: { q: query } });
                if (active) {
                    const selectedIds = new Set(taggedUsers.map(item => String(item._id)));
                    setTagResults((response.data.users || [])
                        .filter(person => String(person._id) !== userId && !selectedIds.has(String(person._id)))
                        .slice(0, 5));
                }
            } catch (searchError) {
                console.error("HOME PEOPLE TAG SEARCH ERROR:", searchError);
                if (active) setTagResults([]);
            }
        }, 250);
        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [tagSearch, taggedUsers, userId]);

    useEffect(() => () => {
        followingRequestRef.current += 1;
    }, []);

    useEffect(() => {
        let active = true;
        setDraftReady(false);
        setDraftLoadError("");
        setDraftUserId("");
        if (!userId) return () => { active = false; };

        loadHomeDraft(userId).then(draft => {
            if (!active) return;
            if (draft) {
                setCaption(draft.caption || "");
                setVisibility(draft.visibility || "public");
                setFiles(Array.isArray(draft.files) ? draft.files : []);
                setAudioFile(draft.audioFile || null);
                setAudioTitle(draft.audioTitle || "");
                setAudioStartSeconds(Number(draft.audioStartSeconds) || 0);
                setAudioRightsConfirmed(Boolean(draft.audioRightsConfirmed));
                setLocation(draft.location || "");
                setAltTexts(Array.isArray(draft.altTexts) ? draft.altTexts : []);
                setTaggedUsers(Array.isArray(draft.taggedUsers) ? draft.taggedUsers : []);
            }
            setDraftUserId(userId);
            setDraftReady(true);
            setDraftStatus(draft ? "Draft restored." : "");
        }).catch(error => {
            console.error("HOME DRAFT LOAD ERROR:", error);
            if (!active) return;
            setDraftLoadError("Your saved draft could not be loaded. Changes will not overwrite it; refresh to try again.");
            setDraftUserId(userId);
            setDraftReady(true);
        });

        return () => { active = false; };
    }, [userId]);

    useEffect(() => {
        if (!userId || !draftReady || draftUserId !== userId || draftLoadError) return undefined;

        const requestId = ++draftSaveRequestRef.current;
        setDraftStatus("Saving draft...");
        const timeout = setTimeout(async () => {
            const draft = {
                caption,
                visibility,
                files,
                audioFile,
                audioTitle,
                audioStartSeconds,
                audioRightsConfirmed,
                location,
                altTexts,
                taggedUsers
            };
            const isEmpty = !caption.trim() && files.length === 0 && !audioFile &&
                !location.trim() && !taggedUsers.length;
            try {
                if (isEmpty) {
                    await clearHomeDraft(userId);
                    if (requestId === draftSaveRequestRef.current) setDraftStatus("");
                } else {
                    await saveHomeDraft(userId, draft);
                    if (requestId === draftSaveRequestRef.current) setDraftStatus("Draft saved.");
                }
            } catch (error) {
                console.error("HOME DRAFT SAVE ERROR:", error);
                if (requestId === draftSaveRequestRef.current) {
                    setDraftStatus("Draft could not be saved.");
                }
            }
        }, 350);

        return () => clearTimeout(timeout);
    }, [
        caption, visibility, files, audioFile, audioTitle, audioStartSeconds,
        audioRightsConfirmed, location, altTexts, taggedUsers,
        userId, draftReady, draftUserId, draftLoadError
    ]);

    const pickFiles = event => {

        const picked = Array.from(event.target.files || []);

        event.target.value = "";

        const unsupported = picked.find(file =>
            !["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]
                .includes(file.type)
        );

        if (unsupported) {
            setUploadError("Choose a JPG, PNG, WebP, GIF, or HEIC image.");
            return;
        }

        const next = [...files, ...picked].slice(0, MAX_PHOTOS);

        if (files.length + picked.length > MAX_PHOTOS) {
            setUploadError(`You can add up to ${MAX_PHOTOS} photos. The first ${MAX_PHOTOS} are kept.`);
        }

        const tooBig = next.find(f => f.size > 10 * 1024 * 1024);

        if (tooBig) {
            setUploadError("Each photo must be under 10MB.");
            return;
        }

        setFiles(next);
        setAltTexts(previous => [
            ...previous,
            ...Array.from({ length: Math.max(0, next.length - previous.length) }, () => "")
        ].slice(0, next.length));
        if (files.length + picked.length <= MAX_PHOTOS) setUploadError("");

    };

    const publish = async event => {

        event.preventDefault();

        if (files.length === 0 || posting) return;
        if (audioFile && (!audioRightsConfirmed || audioDuration <= 0)) {
            setUploadError("Confirm audio rights and wait for the soundtrack to load before sharing.");
            return;
        }

        const form = new FormData();

        files.forEach(f => form.append("photos", f));
        form.append("altTexts", JSON.stringify(altTexts));
        form.append("taggedUsers", JSON.stringify(taggedUsers.map(person => person._id)));
        form.append("caption", caption.trim());
        form.append("visibility", visibility);
        form.append("location", location.trim());
        if (audioFile) {
            form.append("audio", audioFile);
            form.append("audioTitle", audioTitle);
            form.append("audioStartSeconds", String(audioStartSeconds));
            form.append("audioDurationSeconds", String(
                Math.min(POST_AUDIO_CLIP_SECONDS, audioDuration)
            ));
            form.append("audioRightsConfirmed", "true");
        }

        try {

            setPosting(true);

            const res = await api.post("/posts", form, {
                timeout: 5 * 60 * 1000,
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: event => {
                    if (event.total) {
                        setUploadProgress(Math.round((event.loaded / event.total) * 100));
                    }
                }
            });

            setPosts(prev => [res.data.data, ...prev]);
            setFiles([]);
            setAudioFile(null);
            setAudioTitle("");
            setAudioDuration(0);
            setAudioStartSeconds(0);
            setAudioRightsConfirmed(false);
            setLocation("");
            setAltTexts([]);
            setTaggedUsers([]);
            setCaption("");
            setVisibility("public");
            setUploadError("");
            if (!draftLoadError) {
                draftSaveRequestRef.current += 1;
                clearHomeDraft(userId).catch(error => {
                    console.error("HOME DRAFT CLEAR ERROR:", error);
                    setDraftStatus("Post shared, but the saved draft could not be cleared.");
                });
            }

        } catch (e) {
            setUploadError(e.response?.data?.message || "Could not publish your post. Your draft is still here; retry when ready.");
        } finally {
            setPosting(false);
            setUploadProgress(0);
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
                        {followingError ? (
                            <div className="home-circle-empty">
                                <p role="alert">{followingError}</p>
                                <button
                                    type="button"
                                    className="home-circle-retry"
                                    onClick={loadFollowing}
                                >
                                    Try again
                                </button>
                            </div>
                        ) : following.length > 0 ? following.slice(0, 5).map(person => (
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
                    <MessengerStories active currentUser={user} allowVideo={false} home />

                    <section className="home-following-strip">
                        <div className="home-following-intro">
                            <span className="home-strip-orb"><FaUsers /></span>
                            <span><b>Your people, closer</b><small>{followingError
                                ? "Your circle could not be loaded"
                                : following.length
                                    ? `${following.length} people in your circle`
                                    : "Your circle starts with one follow"}</small></span>
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

                        <div className="home-post-details">
                            <label>
                                Place (optional)
                                <input
                                    value={location}
                                    onChange={event => setLocation(event.target.value.slice(0, 100))}
                                    maxLength={100}
                                    placeholder="Add a place name (no precise location)"
                                    disabled={!draftReady || posting}
                                />
                            </label>
                            <label>
                                Tag people (optional)
                                <input
                                    value={tagSearch}
                                    onChange={event => setTagSearch(event.target.value)}
                                    placeholder="Search people by name"
                                    disabled={!draftReady || posting || taggedUsers.length >= 10}
                                />
                            </label>
                            {tagResults.length > 0 && (
                                <div className="home-tag-results" role="listbox" aria-label="People to tag">
                                    {tagResults.map(person => (
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected="false"
                                            key={person._id}
                                            onClick={() => {
                                                setTaggedUsers(previous => [...previous, {
                                                    _id: person._id,
                                                    name: person.name
                                                }].slice(0, 10));
                                                setTagSearch("");
                                                setTagResults([]);
                                            }}
                                        >
                                            {person.name || "E Top member"}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {taggedUsers.length > 0 && (
                                <div className="home-tag-chips" aria-label="Tagged people">
                                    {taggedUsers.map(person => (
                                        <span key={person._id}>
                                            {person.name}
                                            <button
                                                type="button"
                                                aria-label={`Remove ${person.name}`}
                                                onClick={() => setTaggedUsers(previous =>
                                                    previous.filter(item => item._id !== person._id)
                                                )}
                                                disabled={posting}
                                            >×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {files.map((photo, index) => (
                            <label className="home-photo-alt-text" key={`${photo.name}-${index}`}>
                                Photo {index + 1} description (for screen readers)
                                <input
                                    value={altTexts[index] || ""}
                                    onChange={event => setAltTexts(previous =>
                                        previous.map((value, itemIndex) =>
                                            itemIndex === index ? event.target.value.slice(0, 250) : value
                                        )
                                    )}
                                    maxLength={250}
                                    placeholder="Describe this photo"
                                    disabled={posting}
                                />
                            </label>
                        ))}

                        <div className="composer-row">

                    <div className="avatar-sm home-composer-avatar">
                        {user?.profileImage || user?.avatar
                            ? <img src={getUploadUrl(user.profileImage || user.avatar)} alt="" />
                            : (user?.name || "U").charAt(0).toUpperCase()}
                    </div>

                    <input
                        className="composer-input"
                        value={caption}
                        onChange={e => {
                            setCaption(e.target.value);
                            setUploadError("");
                        }}
                        placeholder="Write a caption for your photos..."
                        maxLength={2200}
                        disabled={!draftReady || posting}
                    />

                    <button
                        type="button"
                        className="icon-btn big"
                        onClick={() => fileRef.current?.click()}
                        title="Add photos"
                        disabled={!draftReady || posting}
                    >
                        <FaImage />
                    </button>

                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        multiple
                        hidden
                        disabled={!draftReady || posting}
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
                                    disabled={posting}
                                    onClick={() => {
                                        setFiles(files.filter((_, n) => n !== i));
                                        setAltTexts(previous => previous.filter((_, n) => n !== i));
                                        setUploadError("");
                                    }}
                                    aria-label="Remove"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {audioFile && (
                    <p className="home-audio-note" role="note">
                        Soundtracks are user-uploaded. Use only audio you own or have permission to share.
                    </p>
                )}

                <div className="home-audio-tools">
                    <label className="home-audio-picker">
                        Add your own soundtrack (up to 10MB)
                        <input
                            type="file"
                            accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/webm"
                            disabled={!draftReady || posting}
                            onChange={event => {
                                const selectedAudio = event.target.files?.[0] || null;
                                event.target.value = "";
                                if (selectedAudio && !POST_AUDIO_TYPES.has(selectedAudio.type)) {
                                    setUploadError("Choose an MP3, MP4, AAC, WAV, OGG, or WebM audio file.");
                                    return;
                                }
                                if (selectedAudio?.size > MAX_POST_AUDIO_SIZE) {
                                    setUploadError("Audio must be under 10MB.");
                                    return;
                                }
                                setAudioFile(selectedAudio);
                                setAudioTitle(selectedAudio?.name.replace(/\.[^.]+$/, "").slice(0, 100) || "");
                                setAudioDuration(0);
                                setAudioStartSeconds(0);
                                setAudioRightsConfirmed(false);
                                setUploadError("");
                            }}
                        />
                    </label>
                    {audioFile && (
                        <div className="home-audio-preview">
                            <audio
                                src={audioPreview}
                                controls
                                preload="metadata"
                                onPlay={event => {
                                    event.currentTarget.currentTime = audioStartSeconds;
                                }}
                                onTimeUpdate={event => {
                                    const audio = event.currentTarget;
                                    if (audio.currentTime >= audioStartSeconds +
                                        Math.min(POST_AUDIO_CLIP_SECONDS, audioDuration)) {
                                        audio.pause();
                                    }
                                }}
                                onLoadedMetadata={event => {
                                    const duration = event.currentTarget.duration;
                                    if (Number.isFinite(duration) && duration > 0) setAudioDuration(duration);
                                }}
                            />
                            <label>
                                Track title
                                <input
                                    value={audioTitle}
                                    onChange={event => setAudioTitle(event.target.value.slice(0, 100))}
                                    maxLength={100}
                                    disabled={posting}
                                />
                            </label>
                            {audioDuration > POST_AUDIO_CLIP_SECONDS && (
                                <label>
                                    Start at {Math.floor(audioStartSeconds)}s
                                    <input
                                        type="range"
                                        min="0"
                                        max={Math.floor(audioDuration - POST_AUDIO_CLIP_SECONDS)}
                                        step="1"
                                        value={Math.min(audioStartSeconds, audioDuration - POST_AUDIO_CLIP_SECONDS)}
                                        onChange={event => setAudioStartSeconds(Number(event.target.value))}
                                        aria-label="Soundtrack start time"
                                    />
                                </label>
                            )}
                            <label className="home-audio-rights">
                                <input
                                    type="checkbox"
                                    checked={audioRightsConfirmed}
                                    onChange={event => setAudioRightsConfirmed(event.target.checked)}
                                    disabled={posting}
                                />
                                I own this audio or have permission to use it.
                            </label>
                            <button
                                type="button"
                                className="home-audio-remove"
                                onClick={() => {
                                    setAudioFile(null);
                                    setAudioTitle("");
                                    setAudioDuration(0);
                                    setAudioStartSeconds(0);
                                    setAudioRightsConfirmed(false);
                                }}
                                disabled={posting}
                            >
                                Remove soundtrack
                            </button>
                        </div>
                    )}
                </div>

                        {uploadError && <div className="home-upload-error" role="alert">{uploadError}</div>}
                        {draftLoadError && <p className="home-draft-error" role="alert">{draftLoadError}</p>}
                        {!draftReady && <p className="home-draft-status" role="status">Loading your saved draft...</p>}
                        {!draftLoadError && draftStatus && (
                            <p className="home-draft-status" role="status">{draftStatus}</p>
                        )}

                        <div className="home-composer-footer">
                            <span className="home-composer-hint"><FaImage /> Add up to 5 photos</span>
                            <label className="home-audience-picker">
                                <span>Audience</span>
                                <select
                                    aria-label="Post audience"
                                    value={visibility}
                                    onChange={event => {
                                        setVisibility(event.target.value);
                                        setUploadError("");
                                    }}
                                    disabled={!draftReady || posting}
                                >
                                    <option value="public">Public</option>
                                    <option value="followers">Followers only</option>
                                    <option value="private">Only me</option>
                                </select>
                            </label>
                            <span className="home-composer-count">{caption.length}/2200</span>
                            <button className="btn-primary" type="submit" disabled={!draftReady || posting || files.length === 0}>
                                {posting ? `Sharing ${uploadProgress}%...` : uploadError ? "Retry upload" : "Share post"} <FaArrowRight />
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

                    {loading && (
                        <>
                            <p className="social-note">Finding something good for you...</p>
                            <div className="home-feed-skeletons" aria-hidden="true">
                                {[0, 1].map(item => (
                                    <div className="home-feed-skeleton" key={item}>
                                        <span className="home-skeleton-avatar" />
                                        <span className="home-skeleton-line" />
                                        <span className="home-skeleton-line short" />
                                        <span className="home-skeleton-content" />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

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
                            onUpdated={updated => setPosts(prev => prev.map(item =>
                                item._id === updated._id ? { ...item, ...updated } : item
                            ))}
                            onFollowChange={(author, result) => {
                                setPosts(previous => previous.map(item =>
                                    String(item.author?._id || item.author) === String(author._id)
                                        ? { ...item, isFollowedByMe: Boolean(result.isFollowing) }
                                        : item
                                ));
                                loadFollowing();
                            }}
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
                        <p>Meet your people and make this corner of the internet yours.</p>
                        <Link to="/communities">Explore communities <FaArrowRight /></Link>
                    </section>
                    <section className="home-side-card home-suggestions-card">
                        <div className="home-side-heading"><span>PEOPLE TO FOLLOW</span></div>
                        {suggestionsError ? (
                            <div className="home-circle-empty">
                                <p role="alert">{suggestionsError}</p>
                                <button type="button" className="home-circle-retry" onClick={loadSuggestions}>
                                    Try again
                                </button>
                            </div>
                        ) : suggestions.length ? suggestions.slice(0, 5).map(person => (
                            <div className="home-suggestion-row" key={person._id}>
                                <Link className="home-person-row" to={`/user/${person._id}`}>
                                    <span className="home-person-avatar">
                                        {person.profileImage || person.avatar
                                            ? <img src={getUploadUrl(person.profileImage || person.avatar)} alt="" />
                                            : (person.name || "U").charAt(0).toUpperCase()}
                                    </span>
                                    <span>
                                        <b>{person.name}</b>
                                        <small>{person.mutualConnections
                                            ? `${person.mutualConnections} mutual connection${person.mutualConnections === 1 ? "" : "s"}`
                                            : person.role === "seller" ? "Creator & seller" : "Suggested for you"}</small>
                                    </span>
                                </Link>
                                <SocialFollowButton
                                    userId={person._id}
                                    onFollowChange={result => {
                                        if (result.isFollowing) {
                                            setSuggestions(current => current.filter(item => item._id !== person._id));
                                            loadFollowing();
                                        }
                                    }}
                                />
                            </div>
                        )) : (
                            <div className="home-circle-empty">
                                <p>New people to discover will show up here.</p>
                                <Link to="/search">Explore people <FaArrowRight /></Link>
                            </div>
                        )}
                    </section>
                    <p className="home-footer-note">A little corner of the internet, made for everyone.<br />© 2026 E Top</p>
                </aside>
            </div>

        </main>
    );

};

export default Home;
