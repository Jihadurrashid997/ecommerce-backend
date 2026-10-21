import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import api from "../services/api";
import PostCard from "../components/PostCard";
import "../styles/Social.css";

const SharedPost = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");

        api.get(`/posts/${id}`)
            .then(response => {
                if (active) setPost(response.data.data);
            })
            .catch(loadError => {
                if (active) {
                    setError(
                        loadError.response?.data?.message ||
                        "This post could not be loaded."
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [id]);

    return (
        <main className="shared-post-page">
            <button type="button" className="shared-post-back" onClick={() => navigate(-1)}>
                <FaArrowLeft /> Back
            </button>
            {loading && <p role="status">Loading post...</p>}
            {error && <p className="shared-post-error" role="alert">{error}</p>}
            {post && <PostCard post={post} />}
        </main>
    );
};

export default SharedPost;
