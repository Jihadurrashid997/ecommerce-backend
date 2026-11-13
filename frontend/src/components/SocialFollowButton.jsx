import React, { useEffect, useState } from "react";
import api from "../services/api";

const SocialFollowButton = ({
    userId,
    isFollowing = false,
    onFollowChange,
    className = ""
}) => {
    const [following, setFollowing] = useState(Boolean(isFollowing));
    const [pending, setPending] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setFollowing(Boolean(isFollowing));
    }, [isFollowing]);

    const toggleFollow = async () => {
        if (!userId || busy) return;
        setBusy(true);
        setError("");
        try {
            const response = await api.post(`/users/follow/${userId}`);
            const result = response.data || {};
            const nextFollowing = Boolean(result.isFollowing);
            const nextPending = Boolean(result.isFollowRequestPending);
            setFollowing(nextFollowing);
            setPending(nextPending);
            if (onFollowChange) onFollowChange(result);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not update follow.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <span className={`social-follow-control ${className}`}>
            <button
                type="button"
                className="social-follow-button"
                onClick={toggleFollow}
                disabled={busy}
                aria-label={following ? "Unfollow" : pending ? "Cancel follow request" : "Follow"}
                aria-pressed={following}
            >
                {busy ? "…" : following ? "Following" : pending ? "Requested" : "Follow"}
            </button>
            {error && <span className="social-follow-error" role="alert">{error}</span>}
        </span>
    );
};

export default SocialFollowButton;
