import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

const ProtectedRoute = ({ children }) => {

    const { user, loading } = useApp();
    const location = useLocation();

    // AppContext এখনো user load করছে
    if (loading) {
        return (
            <div className="protected-loading">
                <div className="protected-loader"></div>
                <h2>JR Store</h2>
                <p>Loading...</p>
            </div>
        );
    }

    // Login করা না থাকলে
    if (!user) {
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

    return children;
};

export default ProtectedRoute;
