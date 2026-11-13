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
const MAX_STORY_AUDIO_SIZE = 10 * 1024 * 1024;
const STORY_AUDIO_TYPES = new Set([
    "audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg", "audio/webm"
]);
const STORY_AUDIO_CLIP_SECONDS = 15;

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
    const [audioFile, setAudioFile] = useState(null);
    const [audioTitle, setAudioTitle] = useState("");
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioStartSeconds, setAudioStartSeconds] = useState(0);
    const [audioRightsConfirmed, setAudioRightsConfirmed] = useState(false);
    const [pollEnabled, setPollEnabled] = useState(false);
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [pollBusy, setPollBusy] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [replyBusy, setReplyBusy] = useState(false);
    const [replyStatus, setReplyStatus] = useState("");
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
    const audioPreview = useMemo(
        () => audioFile ? URL.createObjectURL(audioFile) : "",
        [audioFile]
    );

    useEffect(() => () => {
        if (filePreview) URL.revokeObjectURL(filePreview);
    }, [filePreview]);
    useEffect(() => () => {
        if (audioPreview) URL.revokeObjectURL(audioPreview);
    }, [audioPreview]);

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
        if (audioFile && (
            !home ||
            !file ||
            !STORY_IMAGE_TYPES.has(file.type) ||
            !audioRightsConfirmed ||
            audioDuration <= 0
        )) {
            setError("Choose a photo, confirm audio rights, and wait for the soundtrack to load.");
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
            if (audioFile) {
                formData.append("audio", audioFile);
                formData.append("audioTitle", audioTitle);
                formData.append("audioStartSeconds", String(audioStartSeconds));
                formData.append("audioDurationSeconds", String(
                    Math.min(STORY_AUDIO_CLIP_SECONDS, audioDuration)
                ));
                formData.append("audioRightsConfirmed", "true");
            }
            if (pollEnabled) {
                formData.append("poll", JSON.stringify({
                    question: pollQuestion,
                    options: pollOptions
                }));
            }
            const response = await api.post(home ? "/stories/home" : "/stories", formData, {
                onUploadProgress: event => {
                    if (event.total) setUploadProgress(Math.round(event.loaded / event.total * 100));
                }
            });
            setStories(previous => [response.data.data, ...previous]);
            setText("");
            setFile(null);
            setAudioFile(null);
            setAudioTitle("");
            setAudioDuration(0);
            setAudioStartSeconds(0);
            setAudioRightsConfirmed(false);
            setPollEnabled(false);
            setPollQuestion("");
            setPollOptions(["", ""]);
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
        setReplyText("");
        setReplyStatus("");
    }, []);

    const voteInPoll = async optionIndex => {
        if (!currentStory?.poll || currentStory.poll.myVote !== null || pollBusy) return;
        setPollBusy(true);
        setError("");
        try {
            const response = await api.post(`/stories/${currentStory._id}/poll`, { optionIndex });
            setStories(previous => previous.map(item =>
                item._id === currentStory._id ? response.data.data : item
            ));
        } catch (voteError) {
            setError(voteError.response?.data?.message || "Could not save your vote.");
        } finally {
            setPollBusy(false);
        }
    };

    const replyToStory = async event => {
        event.preventDefault();
        const receiver = userIdOf(ownerOf(currentStory));
        if (!replyText.trim() || !receiver || replyBusy) return;
        setReplyBusy(true);
        setReplyStatus("");
        try {
            await api.post("/messages/send", {
                receiver,
                message: replyText.trim()
            });
            setReplyText("");
            setReplyStatus("Reply sent.");
        } catch (replyError) {
            setReplyStatus(replyError.response?.data?.message || "Could not send your reply.");
        } finally {
            setReplyBusy(false);
        }
    };

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
                                            setAudioFile(null);
                                            setAudioTitle("");
                                            setAudioDuration(0);
                                            setAudioStartSeconds(0);
                                            setAudioRightsConfirmed(false);
                                            event.target.value = "";
                                            return;
                                        }
                                        if (selectedFile?.size > MAX_STORY_FILE_SIZE) {
                                            setError("Story photos and videos must be under 20MB.");
                                            setFile(null);
                                            setAudioFile(null);
                                            setAudioTitle("");
                                            setAudioDuration(0);
                                            setAudioStartSeconds(0);
                                            setAudioRightsConfirmed(false);
                                            event.target.value = "";
                                            return;
                                        }
                                        setError("");
                                        setFile(selectedFile);
                                        if (!selectedFile || !STORY_IMAGE_TYPES.has(selectedFile.type)) {
                                            setAudioFile(null);
                                            setAudioTitle("");
                                            setAudioRightsConfirmed(false);
                                        }
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
                                            setAudioFile(null);
                                            setAudioTitle("");
                                            setAudioDuration(0);
                                            setAudioStartSeconds(0);
                                            setAudioRightsConfirmed(false);
                                            setError("");
                                        }}
                                        disabled={busy}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            )}
                            {!pollEnabled ? (
                                <button
                                    type="button"
                                    className="messenger-story-add-poll"
                                    onClick={() => setPollEnabled(true)}
                                    disabled={busy}
                                >
                                    Add poll
                                </button>
                            ) : (
                                <div className="messenger-story-poll-editor">
                                    <label>
                                        Poll question
                                        <input
                                            value={pollQuestion}
                                            onChange={event => setPollQuestion(event.target.value.slice(0, 120))}
                                            maxLength={120}
                                            placeholder="Ask your followers"
                                        />
                                    </label>
                                    {pollOptions.map((option, index) => (
                                        <div className="messenger-story-poll-option" key={index}>
                                            <input
                                                aria-label={`Poll option ${index + 1}`}
                                                value={option}
                                                onChange={event => setPollOptions(previous =>
                                                    previous.map((item, itemIndex) =>
                                                        itemIndex === index
                                                            ? event.target.value.slice(0, 60)
                                                            : item
                                                    )
                                                )}
                                                maxLength={60}
                                                placeholder={`Option ${index + 1}`}
                                            />
                                            {pollOptions.length > 2 && (
                                                <button type="button" onClick={() =>
                                                    setPollOptions(previous => previous.filter((_, itemIndex) => itemIndex !== index))
                                                }>Remove</button>
                                            )}
                                        </div>
                                    ))}
                                    {pollOptions.length < 4 && (
                                        <button type="button" onClick={() =>
                                            setPollOptions(previous => [...previous, ""])
                                        }>Add option</button>
                                    )}
                                    <button type="button" onClick={() => {
                                        setPollEnabled(false);
                                        setPollQuestion("");
                                        setPollOptions(["", ""]);
                                    }}>Remove poll</button>
                                </div>
                            )}
                            {home && file && STORY_IMAGE_TYPES.has(file.type) && (
                                <div className="messenger-story-audio-tools">
                                    <label className="messenger-story-file">
                                        Add your own soundtrack (up to 10MB)
                                        <input
                                            type="file"
                                            accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/webm"
                                            disabled={busy}
                                            onChange={event => {
                                                const selectedAudio = event.target.files?.[0] || null;
                                                event.target.value = "";
                                                if (selectedAudio && !STORY_AUDIO_TYPES.has(selectedAudio.type)) {
                                                    setError("Choose an MP3, MP4, AAC, WAV, OGG, or WebM audio file.");
                                                    return;
                                                }
                                                if (selectedAudio?.size > MAX_STORY_AUDIO_SIZE) {
                                                    setError("Audio must be under 10MB.");
                                                    return;
                                                }
                                                setAudioFile(selectedAudio);
                                                setAudioTitle(selectedAudio?.name.replace(/\.[^.]+$/, "").slice(0, 100) || "");
                                                setAudioDuration(0);
                                                setAudioStartSeconds(0);
                                                setAudioRightsConfirmed(false);
                                                setError("");
                                            }}
                                        />
                                    </label>
                                    {audioFile && (
                                        <div className="messenger-story-audio-preview">
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
                                                        Math.min(STORY_AUDIO_CLIP_SECONDS, audioDuration)) {
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
                                                    disabled={busy}
                                                />
                                            </label>
                                            {audioDuration > STORY_AUDIO_CLIP_SECONDS && (
                                                <label>
                                                    Start at {Math.floor(audioStartSeconds)}s
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={Math.floor(audioDuration - STORY_AUDIO_CLIP_SECONDS)}
                                                        step="1"
                                                        value={Math.min(audioStartSeconds, audioDuration - STORY_AUDIO_CLIP_SECONDS)}
                                                        onChange={event => setAudioStartSeconds(Number(event.target.value))}
                                                        aria-label="Story soundtrack start time"
                                                    />
                                                </label>
                                            )}
                                            <label className="messenger-story-audio-rights">
                                                <input
                                                    type="checkbox"
                                                    checked={audioRightsConfirmed}
                                                    onChange={event => setAudioRightsConfirmed(event.target.checked)}
                                                    disabled={busy}
                                                />
                                                I own this audio or have permission to use it.
                                            </label>
                                            <button type="button" onClick={() => {
                                                setAudioFile(null);
                                                setAudioTitle("");
                                                setAudioDuration(0);
                                                setAudioStartSeconds(0);
                                                setAudioRightsConfirmed(false);
                                            }} disabled={busy}>
                                                Remove soundtrack
                                            </button>
                                        </div>
                                    )}
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
                        {currentStory.poll && (
                            <section className="messenger-story-poll" aria-label="Story poll">
                                <strong>{currentStory.poll.question}</strong>
                                {currentStory.poll.options.map((option, index) => {
                                    const totalVotes = currentStory.poll.options.reduce(
                                        (total, item) => total + item.votes, 0
                                    );
                                    const percentage = totalVotes
                                        ? Math.round(option.votes / totalVotes * 100)
                                        : 0;
                                    return (
                                        <button
                                            type="button"
                                            key={`${index}-${option.text}`}
                                            onClick={() => voteInPoll(index)}
                                            disabled={currentStory.poll.myVote !== null || pollBusy}
                                            className={currentStory.poll.myVote === index ? "is-selected" : ""}
                                        >
                                            <span>{option.text}</span>
                                            {currentStory.poll.myVote !== null && (
                                                <small>{percentage}% · {option.votes}</small>
                                            )}
                                        </button>
                                    );
                                })}
                                {currentStory.poll.myVote === null && (
                                    <small>Vote once to see results</small>
                                )}
                            </section>
                        )}
                        {currentStory.audio?.url && (
                            <div className="messenger-story-audio-playback">
                                <strong>{currentStory.audio.title || "Story soundtrack"}</strong>
                                <audio
                                    key={currentStory._id}
                                    src={getUploadUrl(currentStory.audio.url)}
                                    controls
                                    autoPlay
                                    onLoadedMetadata={event => {
                                        event.currentTarget.currentTime =
                                            Number(currentStory.audio.startSeconds) || 0;
                                    }}
                                    onTimeUpdate={event => {
                                        const audio = currentStory.audio;
                                        const end = (Number(audio.startSeconds) || 0) +
                                            (Number(audio.durationSeconds) || STORY_AUDIO_CLIP_SECONDS);
                                        if (event.currentTarget.currentTime >= end) {
                                            event.currentTarget.pause();
                                            event.currentTarget.currentTime = end;
                                        }
                                    }}
                                />
                            </div>
                        )}
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
                        ) : (
                            <form className="messenger-story-reply" onSubmit={replyToStory}>
                                <input
                                    value={replyText}
                                    onChange={event => setReplyText(event.target.value)}
                                    maxLength={1000}
                                    placeholder="Reply to story"
                                    aria-label="Reply to story"
                                    disabled={replyBusy}
                                />
                                <button type="submit" disabled={replyBusy || !replyText.trim()}>
                                    {replyBusy ? "Sending…" : "Send"}
                                </button>
                                {replyStatus && <small role="status">{replyStatus}</small>}
                            </form>
                        )}
                    </section>
                </div>
            )}
        </>
    );
};

export default MessengerStories;
