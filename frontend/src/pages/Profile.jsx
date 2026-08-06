import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/Profile.css";

const Profile = () => {

  const [user, setUser] = useState(null);

  useEffect(() => {

    loadProfile();

  }, []);

  const loadProfile = async () => {

    try {

      const res = await api.get("/auth/profile");

      setUser(res.data.user);

    } catch (err) {

      console.log(err);

    }

  };

  const logout = () => {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href="/login";

  }

  if(!user){

    return(

      <div className="loader"></div>

    )

  }

  return(

    <div className="profile-page">

      <div className="profile-card">

        <div className="profile-avatar">

          {user.name.charAt(0).toUpperCase()}

        </div>

        <h2>{user.name}</h2>

        <p>{user.email}</p>

        <span className="role">

          {user.role}

        </span>

        <button

        className="logout-btn"

        onClick={logout}

        >

          Logout

        </button>

      </div>

    </div>

  )

}

export default Profile;
