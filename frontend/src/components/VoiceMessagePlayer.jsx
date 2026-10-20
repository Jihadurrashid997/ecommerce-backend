import React, { useEffect, useRef, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";

export const formatDuration = seconds => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;

    return `${mins}:${String(secs).padStart(2, "0")}`;
};

const VoiceMessagePlayer = ({ url, own }) => {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState("");

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return undefined;
        }

        const onLoadedMetadata = () => {
            setDuration(
                Number.isFinite(audio.duration)
                    ? audio.duration
                    : 0
            );
            setError("");
        };
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onEnded = () => {
            setPlaying(false);
            setCurrentTime(0);
        };
        const onError = () => {
            setPlaying(false);
            setError("This voice message could not be loaded or played.");
        };

        audio.pause();
        audio.currentTime = 0;
        setPlaying(false);
        setDuration(0);
        setCurrentTime(0);
        setError("");
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onError);

        return () => {
            audio.pause();
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onError);
        };
    }, [url]);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        if (playing) {
            audio.pause();
            return;
        }

        setError("");
        try {
            await audio.play();
            setPlaying(true);
        } catch {
            setPlaying(false);
            setError("Tap play again or check this device's audio settings.");
        }
    };

    const seekTo = seconds => {
        const audio = audioRef.current;
        if (!audio || !duration) {
            return;
        }
        const nextTime = Math.min(duration, Math.max(0, seconds));
        audio.currentTime = nextTime;
        setCurrentTime(nextTime);
    };

    const handleSeekClick = event => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width > 0) {
            seekTo(
                ((event.clientX - rect.left) / rect.width) * duration
            );
        }
    };

    const handleSeekKeyDown = event => {
        if (!duration) {
            return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            seekTo(currentTime - 5);
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            seekTo(currentTime + 5);
        } else if (event.key === "Home") {
            event.preventDefault();
            seekTo(0);
        } else if (event.key === "End") {
            event.preventDefault();
            seekTo(duration);
        }
    };

    const retryLoad = () => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        setError("");
        audio.load();
    };

    const progressPercent =
        duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`voice-message-player ${own ? "own" : ""}`}>
            <audio
                ref={audioRef}
                src={url}
                preload="metadata"
                aria-label="Voice message"
            />
            <button
                type="button"
                className="voice-play-btn"
                onClick={togglePlay}
                aria-label={playing ? "Pause voice message" : "Play voice message"}
            >
                {playing ? <FaPause /> : <FaPlay />}
            </button>
            <div
                className="voice-progress-track"
                role="slider"
                aria-label="Voice message playback position"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={currentTime}
                aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
                aria-disabled={!duration}
                tabIndex={duration ? 0 : -1}
                onClick={handleSeekClick}
                onKeyDown={handleSeekKeyDown}
            >
                <div
                    className="voice-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
            <span className="voice-duration">
                {formatDuration(
                    duration > 0 && (playing || currentTime)
                        ? duration - currentTime
                        : duration
                )}
            </span>
            {error && (
                <div className="voice-playback-error">
                    <span role="status">{error}</span>
                    <button type="button" onClick={retryLoad}>
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceMessagePlayer;
