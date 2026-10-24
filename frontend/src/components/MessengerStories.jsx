import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaPlus, FaTimes, FaTrash, FaEye } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import "./MessengerStories.css";

const STORY_IMAGE_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"
]);
const STORY_VIDEO_TYPES = new Set([
    "video/mp4", "video/webm", "video/quicktime", "video/3gpp"
]);
const MAX_STORY_FILE_SIZE = 20 * 1024 * 1024;

const userIdOf = user => String(user?._id || user?.id || user || "");
const ownerOf = story => story.owner || {};

const groupStories = stories => {
    const groups = new Map();
    stories.forEach(story => {
        const owner = ownerOf(story);
        const id = userIdOf(owner);
        if (!id) {
            return;
        }
        if (!groups.has(id)) {
            groups.set(id, { owner, stories: [] });
        }
        groups.get(id).stories.push(story);
    });
    return [...groups.values()];
};

const MessengerStories = ({ active, currentUser, allowVideo = true, home = false }) => {
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showComposer, setShowComposer] = useState(false);
    const [text, setText] = useState("");
    const [audience, setAudience] = useState("followers");
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selected, setSelected] = useState(null);
    const [viewers, setViewers] = useState(null);

    const groups = useMemo(() => groupStories(stories), [stories]);
    const ownId = userIdOf(currentUser);
    const selectedGroup =
        selected === null ? null : groups[selected.groupIndex];
    const currentStory =
        selectedGroup?.stories?.[selected.storyIndex] || null;
    const currentIndex = selected?.storyIndex || 0;
    const storyCount = selectedGroup?.stories?.length || 0;
    const filePreview = useMemo(
        () => file && STORY_IMAGE_TYPES.has(file.type) ? URL.createObjectURL(file) : "",
        [file]
    );

    useEffect(() => () => {
        if (filePreview) URL.revokeObjectURL(filePreview);
    }, [filePreview]);

    const loadStories = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/stories");
            setStories(response.data?.data || []);
        } catch (loadError) {
            console.error("Load Messenger statuses error:", loadError);
            setError(
                loadError.response?.data?.message ||
                "Statuses could not be loaded."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active) {
            loadStories();
        }
    }, [active, loadStories]);

    useEffect(() => {
        if (!selected) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const closeOnEscape = event => {
            if (event.key === "Escape") {
                setSelected(null);
                setViewers(null);
            }
        };
        window.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [selected]);

    const publishStory = async event => {
        event.preventDefault();
        if (!text.trim() && !file) {
            setError(`Write a status or choose ${allowVideo ? "a photo/video" : "a photo"}.`);
            return;
        }
        if (file && !STORY_IMAGE_TYPES.has(file.type) &&
            (!allowVideo || !STORY_VIDEO_TYPES.has(file.type))) {
            setError(allowVideo ? "Choose a supported photo or video." : "Choose a photo for your story.");
            return;
        }
        if (file?.size > MAX_STORY_FILE_SIZE) {
            setError("Story photos and videos must be under 20MB.");
            return;
        }
        setBusy(true);
        setError("");
        setUploadProgress(0);
        try {
            const formData = new FormData();
            formData.append("text", text.trim());
            formData.append("audience", audience);
            if (file) {
                formData.append("media", file);
            }
            const response = await api.post(home ? "/stories/home" : "/stories", formData, {
                onUploadProgress: event => {
                    if (event.total) setUploadProgress(Math.round(event.loaded / event.total * 100));
                }
            });
            setStories(previous => [response.data.data, ...previous]);
            setText("");
            setFile(null);
            setAudience("followers");
            setShowComposer(false);
        } catch (publishError) {
            console.error("Publish Messenger status error:", publishError);
            setError(
                publishError.response?.data?.message ||
                "The status could not be published."
            );
        } finally {
            setBusy(false);
            setUploadProgress(0);
        }
    };

    const viewStory = async (story, groupIndex, storyIndex = 0) => {
        setSelected({ groupIndex, storyIndex });
        setViewers(null);
        if (userIdOf(ownerOf(story)) === ownId) {
            return;
        }
        try {
            await api.post(`/stories/${story._id}/view`);
            setStories(previous =>
                previous.map(item =>
                    item._id === story._id
                        ? { ...item, viewedByMe: true }
                        : item
                )
            );
        } catch (viewError) {
            console.error("Mark Messenger status viewed error:", viewError);
        }
    };

    const closeViewer = useCallback(() => {
        setSelected(null);
        setViewers(null);
    }, []);

    const moveStory = direction => {
        const nextIndex = currentIndex + direction;
        setViewers(null);
        if (nextIndex >= 0 && nextIndex < storyCount) {
            setSelected(previous => ({
                ...previous,
                storyIndex: nextIndex
            }));
            const nextStory = selectedGroup.stories[nextIndex];
            if (userIdOf(ownerOf(nextStory)) !== ownId) {
                void api.post(`/stories/${nextStory._id}/view`)
                    .then(() => setStories(previous =>
                        previous.map(item =>
                            item._id === nextStory._id
                                ? { ...item, viewedByMe: true }
                                : item
                        )
                    ))
                    .catch(viewError => {
                        console.error(
                            "Mark Messenger status viewed error:",
                            viewError
                        );
                    });
            }
            return;
        }

        const nextGroupIndex = selected.groupIndex + direction;
        if (nextGroupIndex >= 0 && nextGroupIndex < groups.length) {
            const nextGroup = groups[nextGroupIndex];
            setSelected({
                groupIndex: nextGroupIndex,
                storyIndex: direction > 0 ? 0 : nextGroup.stories.length - 1
            });
            const nextStory = nextGroup.stories[
                direction > 0 ? 0 : nextGroup.stories.length - 1
            ];
            if (userIdOf(ownerOf(nextStory)) !== ownId) {
                void api.post(`/stories/${nextStory._id}/view`)
                    .then(() => setStories(previous =>
                        previous.map(item =>
                            item._id === nextStory._id
                                ? { ...item, viewedByMe: true }
                                : item
                        )
                    ))
                    .catch(viewError => {
                        console.error(
                            "Mark Messenger status viewed error:",
                            viewError
                        );
                    });
            }
        } else {
            closeViewer();
        }
    };

    const deleteCurrentStory = async () => {
        if (!currentStory) {
            return;
        }
        setBusy(true);
        try {
            await api.delete(`/stories/${currentStory._id}`);
            setStories(previous =>
                previous.filter(item => item._id !== currentStory._id)
            );
            if (storyCount > 1) {
                setSelected(previous => ({
                    ...previous,
                    storyIndex: Math.min(currentIndex, storyCount - 2)
                }));
            } else {
                closeViewer();
            }
        } catch (deleteError) {
            console.error("Delete Messenger status error:", deleteError);
            setError(
                deleteError.response?.data?.message ||
                "The status could not be deleted."
            );
        } finally {
            setBusy(false);
        }
    };

    const loadViewers = async () => {
        try {
            const response = await api.get(
                `/stories/${currentStory._id}/viewers`
            );
            setViewers(response.data?.data || []);
        } catch (viewerError) {
            console.error("Load Messenger status viewers error:", viewerError);
            setError(
                viewerError.response?.data?.message ||
                "Status viewers could not be loaded."
            );
        }
    };

    if (!active) {
        return null;
    }

    return (
        <>
            <section
                className={`messenger-stories${home ? " home-stories" : ""}`}
                aria-label={home ? "Stories" : "Messenger statuses"}
            >
                <div className="messenger-stories-heading">
                    <strong>{home ? "Stories" : "Status"}</strong>
                    <button
                        type="button"
                        onClick={() => setShowComposer(true)}
                        aria-label={home ? "Add story" : "Add status"}
                        title={home ? "Add story" : "Add status"}
                    >
                        <FaPlus aria-hidden="true" />
                    </button>
                </div>
                {loading && <p className="messenger-stories-message">Loading stories…</p>}
                {error && !showComposer && (
                    <div className="messenger-stories-error" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={loadStories} disabled={loading}>Try again</button>
                    </div>
                )}
                {!loading && !groups.length && (
                    <p className="messenger-stories-message">Share a story that expires after 24 hours.</p>
                )}
                <div className="messenger-stories-list">
                    {groups.map((group, groupIndex) => {
                        const isOwn = userIdOf(group.owner) === ownId;
                        const hasUnread = group.stories.some(
                            story => !story.viewedByMe && !isOwn
                        );
                        return (
                            <button
                                type="button"
                                className={`messenger-story-avatar ${hasUnread ? "has-unread" : ""}`}
                                key={userIdOf(group.owner)}
                                onClick={() => viewStory(group.stories[0], groupIndex)}
                                aria-label={`${isOwn ? "Your" : group.owner.name}'s ${home ? "story" : "status"}, ${group.stories.length} item(s)`}
                            >
                                {group.owner.profileImage || group.owner.avatar ? (
                                    <img
                                        src={getUploadUrl(group.owner.profileImage || group.owner.avatar)}
                                        alt=""
                                    />
                                ) : (
                                    <span>{(group.owner.name || "U").charAt(0).toUpperCase()}</span>
                                )}
                                <small>{isOwn ? "You" : group.owner.name || "User"}</small>
                            </button>
                        );
                    })}
                </div>
            </section>

            {showComposer && (
                <div className="messenger-story-overlay" role="presentation">
                    <section className="messenger-story-composer" role="dialog" aria-modal="true" aria-labelledby="status-compose-title">
                        <header>
                            <h3 id="status-compose-title">Create {home ? "story" : "status"}</h3>
                            <button type="button" aria-label="Close" onClick={() => setShowComposer(false)}>
                                <FaTimes />
                            </button>
                        </header>
                        <form onSubmit={publishStory}>
                            <textarea
                                value={text}
                                onChange={event => setText(event.target.value)}
                                maxLength={700}
                                placeholder="What’s on your mind?"
                                aria-label="Status text"
                            />
                            <label className="messenger-story-file">
                                {allowVideo ? "Add photo or video (up to 20MB)" : "Add photo (up to 20MB)"}
                                <input
                                    type="file"
                                    accept={allowVideo ? "image/*,video/mp4,video/webm,video/quicktime,video/3gpp" : "image/*"}
                                    onChange={event => {
                                        const selectedFile = event.target.files?.[0] || null;
                                        if (selectedFile && !STORY_IMAGE_TYPES.has(selectedFile.type) &&
                                            (!allowVideo || !STORY_VIDEO_TYPES.has(selectedFile.type))) {
                                            setError(allowVideo
                                                ? "Choose a supported photo or video."
                                                : "Choose a photo for your story.");
                                            setFile(null);
                                            event.target.value = "";
                                            return;
                                        }
                                        if (selectedFile?.size > MAX_STORY_FILE_SIZE) {
                                            setError("Story photos and videos must be under 20MB.");
                                            setFile(null);
                                            event.target.value = "";
                                            return;
                                        }
                                        setError("");
                                        setFile(selectedFile);
                                    }}
                                />
                            </label>
                            {file && (
                                <div className="messenger-story-file-preview">
                                    {filePreview && <img src={filePreview} alt="Selected story preview" />}
                                    <span className="messenger-story-file-name">{file.name}</span>
                                    <button
                                        type="button"
                                        aria-label="Remove selected story photo"
                                        onClick={() => {
                                            setFile(null);
                                            setError("");
                                        }}
                                        disabled={busy}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            )}
                            <label>
                                Who can see this?
                                <select
                                    value={audience}
                                    onChange={event => setAudience(event.target.value)}
                                >
                                    <option value="followers">Followers</option>
                                    <option value="public">Everyone</option>
                                </select>
                            </label>
                            {error && <p role="alert" className="messenger-stories-error">{error}</p>}
                            {busy && <progress max="100" value={uploadProgress} aria-label="Story upload progress" />}
                            <button type="submit" disabled={busy}>
                                {busy ? `Publishing… ${uploadProgress}%` : `Share ${home ? "story" : "status"}`}
                            </button>
                        </form>
                    </section>
                </div>
            )}

            {selectedGroup && currentStory && (
                <div className="messenger-story-overlay messenger-story-fullscreen" role="presentation">
                    <section className="messenger-story-viewer" role="dialog" aria-modal="true" aria-label={home ? "Story viewer" : "Status viewer"}>
                        <div className="messenger-story-progress" aria-label={`Status ${currentIndex + 1} of ${storyCount}`}>
                            {selectedGroup.stories.map((story, index) => (
                                <span
                                    key={story._id}
                                    className={index <= currentIndex ? "is-active" : ""}
                                />
                            ))}
                        </div>
                        <header>
                            <strong>{ownerOf(currentStory).name || "User"}</strong>
                            <span>
                                {new Date(currentStory.createdAt).toLocaleString()}
                                {currentStory.expiresAt && ` · Expires ${new Date(currentStory.expiresAt).toLocaleString()}`}
                            </span>
                            <button
                                type="button"
                                className="messenger-story-close"
                                aria-label="Close status"
                                onClick={closeViewer}
                            >
                                <FaTimes />
                                <span>Close</span>
                            </button>
                        </header>
                        {currentStory.media?.type === "video" ? (
                            <video
                                src={getUploadUrl(currentStory.media.url)}
                                controls
                                autoPlay
                                playsInline
                            />
                        ) : currentStory.media?.url ? (
                            <img
                                src={getUploadUrl(currentStory.media.url)}
                                alt="Status"
                            />
                        ) : null}
                        {currentStory.text && <p>{currentStory.text}</p>}
                        <nav aria-label="Status navigation">
                            <button type="button" onClick={() => moveStory(-1)} aria-label="Previous status">‹</button>
                            <button type="button" onClick={() => moveStory(1)} aria-label="Next status">›</button>
                        </nav>
                        {userIdOf(ownerOf(currentStory)) === ownId ? (
                            <footer>
                                <button type="button" onClick={loadViewers}>
                                    <FaEye /> {currentStory.viewersCount} views
                                </button>
                                <button type="button" onClick={deleteCurrentStory} disabled={busy} aria-label="Delete status">
                                    <FaTrash />
                                </button>
                                {viewers && (
                                    <ul aria-label="Status viewers">
                                        {viewers.map(viewer => (
                                            <li key={userIdOf(viewer.user)}>
                                                {viewer.user.name} · {new Date(viewer.viewedAt).toLocaleString()}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </footer>
                        ) : null}
                    </section>
                </div>
            )}
        </>
    );
};

export default MessengerStories;
