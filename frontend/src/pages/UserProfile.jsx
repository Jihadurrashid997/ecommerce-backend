import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";

import "../styles/Profile.css";


const UserProfile = () => {

    const { id } = useParams();

    const [user, setUser] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    // =====================================================
    // LOAD PUBLIC PROFILE
    // =====================================================

    useEffect(() => {

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
                    "Profile loading error:",
                    err
                );


                setError(
                    err.response?.data?.message ||
                    "User profile not found."
                );

            } finally {

                setLoading(false);

            }

        };


        loadProfile();

    }, [id]);


    // =====================================================
    // IMAGE URL
    // =====================================================

    const getImageUrl = (image) => {

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
            api.defaults.baseURL?.replace(
                "/api",
                ""
            ) || "";


        return `${baseURL}${image.startsWith("/") ? "" : "/"}${image}`;

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

                    <h2>
                        User Not Found
                    </h2>

                    <p>
                        {error ||
                            "This profile does not exist."}
                    </p>


                    <Link to="/search">
                        Back to Search
                    </Link>

                </div>

            </div>

        );

    }


    // =====================================================
    // PROFILE
    // =====================================================

    const image =
        user.profileImage ||
        user.avatar ||
        user.image;


    return (

        <div className="profile-page">

            <div className="profile-card">


                {/* PROFILE IMAGE */}

                <div className="profile-avatar">

                    {image ? (

                        <img
                            src={
                                getImageUrl(image)
                            }
                            alt={
                                user.name ||
                                "User"
                            }
                        />

                    ) : (

                        <span>

                            {
                                user.name
                                    ?.charAt(0)
                                    ?.toUpperCase() ||
                                "U"
                            }

                        </span>

                    )}

                </div>



                {/* NAME */}

                <h1>
                    {
                        user.name ||
                        "User"
                    }
                </h1>



                {/* ROLE */}

                {user.role && (

                    <span className="profile-role">

                        {
                            user.role
                        }

                    </span>

                )}



                {/* EMAIL */}

                {user.email && (

                    <p>
                        📧 {user.email}
                    </p>

                )}



                {/* BIO */}

                {user.bio && (

                    <p className="profile-bio">
                        {user.bio}
                    </p>

                )}



                {/* LOCATION */}

                {user.location && (

                    <p>
                        📍 {user.location}
                    </p>

                )}



                {/* MESSAGE */}

                <Link
                    to="/messenger"
                    className="profile-message-btn"
                >
                    💬 Message
                </Link>


            </div>

        </div>

    );

};


export default UserProfile;
