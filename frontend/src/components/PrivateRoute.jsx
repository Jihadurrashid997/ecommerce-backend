import React from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const PrivateRoute = ({ children }) => {

    const { user, loading } = useApp();

    const token =
        localStorage.getItem("token");

    if (loading) {

        return (
            <div className="loader"></div>
        );

    }

    if (!token || !user) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }

    return children;

};

export default PrivateRoute;
