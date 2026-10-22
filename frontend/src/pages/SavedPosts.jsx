import React, { useCallback, useEffect, useState } from "react";
import PostCard from "../components/PostCard";
import api from "../services/api";
import "../styles/Social.css";

const SavedPosts = () => {
    const [posts, setPosts] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async before => {
        before ? setLoadingMore(true) : setLoading(true);
        try {
            const response = await api.get("/posts/saved", {
                params: before ? { before } : {}
            });
            setPosts(current => before
                ? [...current, ...(response.data.data || [])]
                : (response.data.data || []));
            setCursor(response.data.nextCursor || null);
            setError("");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not load saved posts.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const removeSavedPost = (postId, saved) => {
        if (saved === false) {
            setPosts(current => current.filter(post => post._id !== postId));
        }
    };

    return (
        <main className="saved-posts-page">
            <header>
                <h1>Saved posts</h1>
                <p>Posts and reels you have saved.</p>
            </header>
            {error && <p role="alert">{error}</p>}
            {!loading && !error && posts.length === 0 && (
                <p className="saved-posts-empty">You have not saved any posts yet.</p>
            )}
            <div className="saved-posts-list">
                {posts.map(post => (
                    <PostCard
                        key={post._id}
                        post={post}
                        onDeleted={id => removeSavedPost(id, false)}
                        onSavedChange={removeSavedPost}
                    />
                ))}
            </div>
            {loading && <p role="status">Loading saved posts...</p>}
            {cursor && (
                <button
                    type="button"
                    className="saved-posts-more"
                    disabled={loadingMore}
                    onClick={() => load(cursor)}
                >
                    {loadingMore ? "Loading..." : "Load more"}
                </button>
            )}
        </main>
    );
};

export default SavedPosts;
