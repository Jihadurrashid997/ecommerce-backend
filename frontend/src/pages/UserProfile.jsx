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
    FaUserCircle,
    FaComments,
    FaArrowLeft
} from "react-icons/fa";

import api from "../services/api";

import "../styles/Profile.css";


const UserProfile = () => {

    const { id } =
        useParams();

    const navigate =
        useNavigate();


    const [user, setUser] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    // ==================================================
    // LOAD PROFILE
    // ==================================================

    useEffect(() => {

        let cancelled = false;

        const loadProfile =
            async () => {

                if (!id) {

                    setError(
                        "Invalid user profile."
                    );

                    setLoading(false);

                    return;

                }


                try {

                    setLoading(true);
                    setError("");


                    const response =
                        await api.get(
                            `/users/public/${id}`,
                            {
                                timeout: 12000
                            }
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
                            "User not found."
                        );

                    }


                    setUser(profile);

                } catch (err) {

                    if (cancelled) {
                        return;
                    }

                    console.error(
                        "PUBLIC PROFILE ERROR:",
                        err
                    );

                    setError(
                        err.response?.data?.message ||
                        "User profile could not be loaded."
                    );

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


    // ==================================================
    // IMAGE
    // ==================================================

    const getImageUrl = (
        image
    ) => {

        if (!image) {
            return null;
        }

        if (
            image.startsWith("http://") ||
            image.startsWith("https://") ||
            image.startsWith("data:")
        ) {

            return image;

        }

        const base =
            (
                api.defaults.baseURL ||
                ""
            ).replace(
                /\/api\/?$/,
                ""
            );

        return (
            base +
            (
                image.startsWith("/")
                    ? image
                    : `/${image}`
            )
        );

    };


    // ==================================================
    // LOADING
    // ==================================================

    if (loading) {

        return (

            <div className="profile-page">

                <div className="profile-loading">

                    Loading profile...

                </div>

            </div>

        );

    }


    // ==================================================
    // ERROR
    // ==================================================

    if (
        error ||
        !user
    ) {

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

                    <Link to="/">

                        <FaArrowLeft />

                        Back to Marketplace

                    </Link>

                </div>

            </div>

        );

    }


    const image =
        user.profileImage ||
        user.avatar ||
        user.image;


    return (

        <div className="profile-page">

            <div className="profile-card">


                {/* AVATAR */}

                <div className="profile-avatar">

                    {image ? (

                        <img
                            src={
                                getImageUrl(
                                    image
                                )
                            }
                            alt={
                                user.name ||
                                "User"
                            }
                            onError={(e) => {

                                e.currentTarget.style.display =
                                    "none";

                                if (
                                    e.currentTarget
                                        .nextSibling
                                ) {

                                    e.currentTarget
                                        .nextSibling
                                        .style.display =
                                        "flex";

                                }

                            }}
                        />

                    ) : null}


                    <FaUserCircle
                        style={{
                            display:
                                image
                                    ? "none"
                                    : "block"
                        }}
                    />

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
                        📧 {user.email}
                    </p>

                )}


                {/* LOCATION */}

                {user.location && (

                    <p>
                        📍{" "}
                        {user.location}
                    </p>

                )}


                {/* BIO */}

                {user.bio && (

                    <p className="profile-bio">

                        {user.bio}

                    </p>

                )}


                {/* MESSAGE */}

                <button
                    type="button"
                    className="profile-message-btn"
                    onClick={() =>
                        navigate(
                            `/messenger?user=${user._id}`
                        )
                    }
                >

                    <FaComments />

                    Message

                </button>


            </div>

        </div>

    );

};


export default UserProfile;
