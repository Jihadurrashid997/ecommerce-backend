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
    FaArrowLeft,
    FaEnvelope,
    FaUserTag
} from "react-icons/fa";

import api from "../services/api";

import "../styles/UserProfile.css";

const UserProfile = () => {

    const {
        id
    } = useParams();

    const navigate =
        useNavigate();

    const [user, setUser] =
        useState(null);

    const [loading, setLoading] =
        useState(true);


    useEffect(() => {

        fetchUser();

    }, [id]);


    const fetchUser = async () => {

        try {

            setLoading(true);

            const response =
                await api.get(
                    `/users/public/${id}`
                );

            setUser(
                response.data?.user ||
                response.data
            );

        } catch (err) {

            console.error(err);

            setUser(null);

        } finally {

            setLoading(false);

        }

    };


    if (loading) {

        return (
            <div className="public-profile-loading">
                Loading profile...
            </div>
        );

    }


    if (!user) {

        return (

            <div className="public-profile-not-found">

                <h1>
                    User Not Found
                </h1>

                <button
                    onClick={() =>
                        navigate("/search")
                    }
                >
                    Back
                </button>

            </div>

        );

    }


    return (

        <div className="public-profile-page">

            <div className="public-profile-card">


                <Link
                    to="/"
                    className="public-profile-back"
                >
                    <FaArrowLeft />
                    Back to Marketplace
                </Link>


                <div className="public-profile-avatar">

                    {user.profileImage ? (

                        <img
                            src={
                                user.profileImage
                            }
                            alt={user.name}
                        />

                    ) : (

                        <FaUserCircle />

                    )}

                </div>


                <h1>
                    {user.name}
                </h1>


                <span className="public-profile-role">

                    <FaUserTag />

                    {user.role ||
                        "customer"}

                </span>


                {user.bio && (

                    <p className="public-profile-bio">
                        {user.bio}
                    </p>

                )}


                {user.location && (

                    <p className="public-profile-location">
                        📍 {user.location}
                    </p>

                )}


                <div className="public-profile-info">

                    <div>

                        <FaEnvelope />

                        <span>
                            {user.email}
                        </span>

                    </div>

                </div>


                <Link
                    to={`/messenger?user=${user._id}`}
                    className="public-profile-message"
                >

                    <FaComments />

                    Message

                </Link>

            </div>

        </div>

    );

};

export default UserProfile;
