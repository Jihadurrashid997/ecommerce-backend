import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

const PrivateRoute = ({ children }) => {

    const { user, loading } = useApp();
    const location = useLocation();

    const token = localStorage.getItem("token");

    // ==========================
    // AUTH LOADING
    // ==========================

    if (loading) {

        return (
            <div className="route-loader">

                <div className="route-loader-spinner"></div>

                <p>
                    Loading JR Store...
                </p>

            </div>
        );

    }

    // ==========================
    // NOT LOGGED IN
    // ==========================

    if (!token || !user) {

        return (
            <Navigate
                to="/login"
                state={{
                    from: location.pathname
                }}
                replace
            />
        );

    }

    // ==========================
    // AUTHENTICATED
    // ==========================

    return children;

};

export default PrivateRoute;
