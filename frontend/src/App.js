import React, { useState } from "react";

import {
    BrowserRouter,
    Routes,
    Route,
    useLocation
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


// ======================================================
// FOOTER
// ======================================================

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


// ======================================================
// 404 PAGE
// ======================================================

function NotFound() {

    return (

        <div className="not-found">

            <h1>
                404
            </h1>

            <h2>
                Page Not Found
            </h2>

            <p>
                The page you're looking for doesn't exist.
            </p>

        </div>

    );

}


// ======================================================
// LAYOUT
// ======================================================

function AppLayout() {

    const location = useLocation();

    /*
     * Login/Register page-এ Navbar এবং Footer দেখাবো না।
     */

    const authPage =
        location.pathname === "/login" ||
        location.pathname === "/register";


    return (

        <>

            {/* ==========================
                NAVBAR
            =========================== */}

            {!authPage && <Navbar />}


            {/* ==========================
                ROUTES
            =========================== */}

            <Routes>


                {/* =================================================
                    PUBLIC AUTH ROUTES
                    শুধুমাত্র Login/Register public
                ================================================= */}

                <Route
                    path="/login"
                    element={
                        <Login />
                    }
                />

                <Route
                    path="/register"
                    element={
                        <Register />
                    }
                />


                {/* =================================================
                    JR STORE HOME
                    LOGIN REQUIRED
                ================================================= */}

                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <Home />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    PRODUCT
                    LOGIN REQUIRED
                ================================================= */}

                <Route
                    path="/product/:id"
                    element={
                        <PrivateRoute>
                            <ProductDetails />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    SEARCH
                    LOGIN REQUIRED
                ================================================= */}

                <Route
                    path="/search"
                    element={
                        <PrivateRoute>
                            <SearchResults />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    USER PROFILE
                    LOGIN REQUIRED
                ================================================= */}

                <Route
                    path="/user/:id"
                    element={
                        <PrivateRoute>
                            <UserProfile />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    PAYMENT ROUTES
                ================================================= */}

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


                {/* =================================================
                    PROFILE
                ================================================= */}

                <Route
                    path="/profile"
                    element={
                        <PrivateRoute>
                            <Profile />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    EDIT PROFILE
                ================================================= */}

                <Route
                    path="/edit-profile"
                    element={
                        <PrivateRoute>
                            <EditProfile />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    DASHBOARD
                ================================================= */}

                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    CART
                ================================================= */}

                <Route
                    path="/cart"
                    element={
                        <PrivateRoute>
                            <Cart />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    WISHLIST
                ================================================= */}

                <Route
                    path="/wishlist"
                    element={
                        <PrivateRoute>
                            <Wishlist />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    CHECKOUT
                ================================================= */}

                <Route
                    path="/checkout"
                    element={
                        <PrivateRoute>
                            <Checkout />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    ORDERS
                ================================================= */}

                <Route
                    path="/orders"
                    element={
                        <PrivateRoute>
                            <OrderHistory />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    EDIT PRODUCT
                ================================================= */}

                <Route
                    path="/edit-product/:id"
                    element={
                        <PrivateRoute>
                            <EditProduct />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    MESSENGER
                ================================================= */}

                <Route
                    path="/messenger"
                    element={
                        <PrivateRoute>
                            <Messenger />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    SELLER
                ================================================= */}

                <Route
                    path="/seller"
                    element={
                        <PrivateRoute>
                            <SellerDashboard />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    SELLER ORDERS
                ================================================= */}

                <Route
                    path="/seller/orders"
                    element={
                        <PrivateRoute>
                            <SellerOrders />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    ADMIN
                ================================================= */}

                <Route
                    path="/admin"
                    element={
                        <PrivateRoute>
                            <AdminDashboard />
                        </PrivateRoute>
                    }
                />


                {/* =================================================
                    404
                ================================================= */}

                <Route
                    path="*"
                    element={
                        <NotFound />
                    }
                />

            </Routes>


            {/* ==========================
                FOOTER
            =========================== */}

            {!authPage && <Footer />}

        </>

    );

}


// ======================================================
// MAIN APP
// ======================================================

function App() {

    const [showLoading, setShowLoading] =
        useState(true);


    // ==================================================
    // INITIAL LOADING
    // ==================================================

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

            <AppLayout />

        </BrowserRouter>

    );

}


export default App;
