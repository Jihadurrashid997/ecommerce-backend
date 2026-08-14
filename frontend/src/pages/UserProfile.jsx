import React, {
    useEffect,
    useState
} from "react";

import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import {
    FaArrowLeft,
    FaComments,
    FaMapMarkerAlt,
    FaEnvelope,
    FaUserCircle
} from "react-icons/fa";

import api from "../services/api";

import "../styles/Profile.css";


const UserProfile = () => {

    const { id } = useParams();

    const navigate = useNavigate();


    const [user, setUser] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    // =====================================================
    // LOAD PUBLIC PROFILE
    // =====================================================

    useEffect(() => {

        let cancelled = false;


        const loadProfile = async () => {

            if (!id) {

                setError(
                    "User profile not found."
                );

                setLoading(false);

                return;
            }


            try {

                setLoading(true);
                setError("");


                const response =
                    await api.get(
                        `/users/public/${id}`
                    );


                if (cancelled) {
                    return;
                }


                const profile =
                    response.data?.user ||
                    response.data?.data ||
                    response.data;


                if (!profile) {

                    throw new Error(
                        "User not found"
                    );

                }


                setUser(profile);

            } catch (err) {

                console.error(
                    "Public profile error:",
                    err
                );


                if (!cancelled) {

                    setError(
                        err.response?.data?.message ||
                        "User profile not found."
                    );

                }

            } finally {

                if (!cancelled) {
                    setLoading(false);
                }

            }

        };


        loadProfile();


        return () => {
            cancelled = true;
        };

    }, [id]);


    // =====================================================
    // IMAGE
    // =====================================================

    const getImageUrl = image => {

        if (!image) {
            return null;
        }


        if (
            image.startsWith("http://") ||
            image.startsWith("https://")
        ) {

            return image;

        }


        const baseURL =
            api.defaults.baseURL
                ?.replace("/api", "") || "";


        return `${baseURL}${
            image.startsWith("/")
                ? ""
                : "/"
        }${image}`;

    };


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <div className="profile-page">

                <div className="profile-loading">

                    Loading profile...

                </div>

            </div>

        );

    }


    // =====================================================
    // ERROR
    // =====================================================

    if (error || !user) {

        return (

            <div className="profile-page">

                <div className="profile-error">

                    <FaUserCircle />

                    <h2>
                        User Not Found
                    </h2>

                    <p>
                        {
                            error ||
                            "This profile does not exist."
                        }
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            navigate(-1)
                        }
                    >
                        <FaArrowLeft />
                        Go Back
                    </button>

                </div>

            </div>

        );

    }


    const image =
        user.profileImage ||
        user.avatar ||
        user.image;


    const userId =
        user._id ||
        user.id;


    return (

        <div className="profile-page">

            <div className="profile-card">


                {/* BACK */}

                <Link
                    to="/"
                    className="profile-back"
                >
                    <FaArrowLeft />
                    Marketplace
                </Link>


                {/* AVATAR */}

                <div className="profile-avatar">

                    {image ? (

                        <img
                            src={getImageUrl(image)}
                            alt={
                                user.name ||
                                "User"
                            }
                        />

                    ) : (

                        <FaUserCircle />

                    )}

                </div>


                {/* NAME */}

                <h1>
                    {
                        user.name ||
                        "Marketplace User"
                    }
                </h1>


                {/* ROLE */}

                <span className="profile-role">

                    {
                        user.role ||
                        "customer"
                    }

                </span>


                {/* EMAIL */}

                {user.email && (

                    <p>

                        <FaEnvelope />

                        {user.email}

                    </p>

                )}


                {/* LOCATION */}

                {user.location && (

                    <p>

                        <FaMapMarkerAlt />

                        {user.location}

                    </p>

                )}


                {/* BIO */}

                {user.bio && (

                    <p className="profile-bio">

                        {user.bio}

                    </p>

                )}


                {/* ACTIONS */}

                <div className="profile-actions">

                    <Link
                        to={`/messenger?user=${userId}`}
                        className="profile-message-btn"
                    >

                        <FaComments />

                        Message

                    </Link>

                </div>


                <small className="profile-member">

                    Member since{" "}

                    {user.createdAt
                        ? new Date(
                            user.createdAt
                        ).toLocaleDateString()
                        : "2026"}

                </small>

            </div>

        </div>

    );

};


export default UserProfile;
