import React, { useState } from "react";

import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import "./styles/App.css";
import "./styles/Navbar.css";
import "./styles/ProductCard.css";
import "./styles/Dashboard.css";
import "./styles/Messenger.css";
import "./styles/Responsive.css";
import "./styles/Animation.css";

import Navbar from "./components/Navbar";
import Messenger from "./components/Messenger";
import Dashboard from "./components/Dashboard";
import PrivateRoute from "./components/PrivateRoute";
import LoadingScreen from "./components/LoadingScreen";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import SellerDashboard from "./pages/SellerDashboard";
import SellerOrders from "./pages/SellerOrders";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import ProductDetails from "./pages/ProductDetails";
import EditProduct from "./pages/EditProduct";
import AdminDashboard from "./pages/AdminDashboard";
import Checkout from "./pages/Checkout";
import OrderHistory from "./pages/OrderHistory";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import EditProfile from "./pages/EditProfile";
import SearchResults from "./pages/SearchResults";
import UserProfile from "./pages/UserProfile";


// ==========================
// FOOTER
// ==========================

function Footer() {

    return (

        <footer className="footer">

            <div className="container">

                <h2>
                    JR Store
                </h2>

                <p>
                    Buy • Sell • Chat • Secure Payment
                </p>

                <p>
                    © 2026 JR Store. All Rights Reserved.
                </p>

            </div>

        </footer>

    );
}


// ==========================
// 404 PAGE
// ==========================

function NotFound() {

    return (

        <div className="not-found">

            <h1>
                404
            </h1>

            <h2>
                Page Not Found
            </h2>

        </div>

    );
}


// ==========================
// APP
// ==========================

function App() {

    const [showLoading, setShowLoading] =
        useState(true);


    // ==========================
    // INITIAL LOADING
    // ==========================

    if (showLoading) {

        return (

            <LoadingScreen
                onComplete={() =>
                    setShowLoading(false)
                }
            />

        );

    }


    return (

        <BrowserRouter>

            {/* ==========================
                NAVBAR
            =========================== */}

            <Navbar />


            {/* ==========================
                ROUTES
            =========================== */}

            <Routes>


                {/* =================================
                    PUBLIC ROUTES
                ================================= */}

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />


                {/* =================================
                    PROTECTED HOME
                ================================= */}

                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <Home />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    PROTECTED PRODUCT
                ================================= */}

                <Route
                    path="/product/:id"
                    element={
                        <PrivateRoute>
                            <ProductDetails />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    PROTECTED SEARCH
                ================================= */}

                <Route
                    path="/search"
                    element={
                        <PrivateRoute>
                            <SearchResults />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    PROTECTED USER PROFILE
                ================================= */}

                <Route
                    path="/user/:id"
                    element={
                        <PrivateRoute>
                            <UserProfile />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    PAYMENT ROUTES
                ================================= */}

                <Route
                    path="/payment-success"
                    element={
                        <PrivateRoute>
                            <PaymentSuccess />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/payment-fail"
                    element={
                        <PrivateRoute>
                            <PaymentFailed />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/payment-cancel"
                    element={
                        <PrivateRoute>
                            <PaymentFailed />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    USER ROUTES
                ================================= */}

                <Route
                    path="/profile"
                    element={
                        <PrivateRoute>
                            <Profile />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/edit-profile"
                    element={
                        <PrivateRoute>
                            <EditProfile />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/cart"
                    element={
                        <PrivateRoute>
                            <Cart />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/wishlist"
                    element={
                        <PrivateRoute>
                            <Wishlist />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/checkout"
                    element={
                        <PrivateRoute>
                            <Checkout />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/orders"
                    element={
                        <PrivateRoute>
                            <OrderHistory />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/edit-product/:id"
                    element={
                        <PrivateRoute>
                            <EditProduct />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/messenger"
                    element={
                        <PrivateRoute>
                            <Messenger />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    SELLER ROUTES
                ================================= */}

                <Route
                    path="/seller"
                    element={
                        <PrivateRoute>
                            <SellerDashboard />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/seller/orders"
                    element={
                        <PrivateRoute>
                            <SellerOrders />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    ADMIN ROUTES
                ================================= */}

                <Route
                    path="/admin"
                    element={
                        <PrivateRoute>
                            <AdminDashboard />
                        </PrivateRoute>
                    }
                />


                {/* =================================
                    404
                ================================= */}

                <Route
                    path="*"
                    element={<NotFound />}
                />

            </Routes>


            {/* ==========================
                FOOTER
            =========================== */}

            <Footer />

        </BrowserRouter>

    );

}


export default App;
