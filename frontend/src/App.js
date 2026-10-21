import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FaBell, FaCog } from "react-icons/fa";

import {
    BrowserRouter,
    Routes,
    Route,
    useLocation,
    useParams,
    Navigate,
    Link
} from "react-router-dom";
import { useApp } from "./context/AppContext";
import api from "./services/api";


// ======================================================
// STYLES
// ======================================================

import "./styles/App.css";
import "./styles/Navbar.css";
import "./styles/ProductCard.css";
import "./styles/Dashboard.css";
import "./styles/Messenger.css";
import "./styles/Responsive.css";
import "./styles/Animation.css";
import "./styles/Shop.css";


// ======================================================
// COMPONENTS
// ======================================================

import Navbar from "./components/Navbar";
import Messenger from "./components/Messenger";
import Dashboard from "./components/Dashboard";
import PrivateRoute from "./components/PrivateRoute";
import LoadingScreen from "./components/LoadingScreen";


// ======================================================
// PAGES
// ======================================================

import Home from "./pages/Home";
import SharedPost from "./pages/SharedPost";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Reels from "./pages/Reels";
import Shop from "./pages/Shop";
import AdminControl from "./pages/AdminControl";
import TopTabs from "./components/TopTabs";
import Profile from "./pages/Profile";
import SellerDashboard from "./pages/SellerDashboard";
import SellerOrders from "./pages/SellerOrders";
import SellerProducts from "./pages/SellerProducts";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import ProductDetails from "./pages/ProductDetails";
import EditProduct from "./pages/EditProduct";
import AdminDashboard from "./pages/AdminDashboard";
import Checkout from "./pages/Checkout";
import OrderHistory from "./pages/OrderHistory";
import ShopNotifications from "./pages/ShopNotifications";
import ShopSettings from "./pages/ShopSettings";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailed from "./pages/PaymentFailed";
import EditProfile from "./pages/EditProfile";
import SearchResults from "./pages/SearchResults";
import UserProfile from "./pages/UserProfile";
import Communities from "./pages/Communities";
import Settings from "./pages/Settings";


// ======================================================
// FOOTER
// ======================================================

function Footer() {

    return (

        <footer className="footer">

            <div className="container">

                <h2>
                    E Top
                </h2>

                <p>
                    Share • Connect • Chat
                </p>

                <p>
                    © 2026 E Top. All Rights Reserved.
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

function ShopRedirect({ target }) {
    const location = useLocation();
    const { id } = useParams();
    const path = target.replace(":id", id || "");

    return <Navigate to={`${path}${location.search}`} replace />;
}

function ShopSectionNavigation({ user }) {
    const [unreadCount, setUnreadCount] = useState(0);
    const location = useLocation();

    useEffect(() => {
        let cancelled = false;
        const loadUnreadCount = async () => {
            try {
                const response = await api.get("/shop-notifications/unread-count");
                if (!cancelled) {
                    setUnreadCount(Number(response.data?.unreadCount) || 0);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("SHOP NOTIFICATION COUNT ERROR:", error);
                }
            }
        };

        loadUnreadCount();
        const intervalId = window.setInterval(loadUnreadCount, 30000);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [location.pathname, user?._id]);

    return (
        <nav className="shop-section-nav" aria-label="Shop">
            <Link to="/shop" aria-current={location.pathname === "/shop" ? "page" : undefined}>Browse</Link>
            <Link to="/shop/cart" aria-current={location.pathname === "/shop/cart" ? "page" : undefined}>Cart</Link>
            <Link to="/shop/wishlist" aria-current={location.pathname === "/shop/wishlist" ? "page" : undefined}>Wishlist</Link>
            <Link to="/shop/orders" aria-current={location.pathname === "/shop/orders" ? "page" : undefined}>Orders</Link>
            <Link
                to="/shop/notifications"
                className="shop-notifications-nav-link"
                aria-current={location.pathname === "/shop/notifications" ? "page" : undefined}
                aria-label={`Shop notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            >
                <FaBell aria-hidden="true" />
                Notifications
                {unreadCount > 0 && (
                    <span className="shop-notifications-badge">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </Link>
            <Link to="/shop/settings" aria-current={location.pathname === "/shop/settings" ? "page" : undefined}>
                <FaCog aria-hidden="true" /> Settings
            </Link>
            {user?.role === "seller" && (
                <>
                    <Link to="/shop/dashboard" aria-current={location.pathname === "/shop/dashboard" ? "page" : undefined}>Dashboard</Link>
                    <Link to="/shop/seller" aria-current={location.pathname === "/shop/seller" ? "page" : undefined}>Add product</Link>
                    <Link to="/shop/seller/products" aria-current={location.pathname === "/shop/seller/products" ? "page" : undefined}>My products</Link>
                    <Link to="/shop/seller/orders" aria-current={location.pathname === "/shop/seller/orders" ? "page" : undefined}>Seller orders</Link>
                </>
            )}
        </nav>
    );
}


// ======================================================
// APP LAYOUT
// ======================================================

function AppLayout() {

    const location =
        useLocation();
    const prefersReducedMotion =
        useReducedMotion();
    const { user } = useApp();
    const shopSection =
        location.pathname === "/shop" ||
        location.pathname.startsWith("/shop/");


    // ==================================================
    // AUTH PAGES
    // Navbar/Footer login-register page এ থাকবে না
    // ==================================================

    const authPage =
        location.pathname === "/login" ||
        location.pathname === "/register" ||
        location.pathname === "/verify-email";
    const messengerPage =
        location.pathname === "/messenger";
    const reelsPage =
        location.pathname === "/reels";


  return (

    <>

        {/* ==================================================
            NAVBAR
        ================================================== */}

        {!authPage && !reelsPage && (
            <Navbar />
        )}

        {!authPage && !reelsPage && location.pathname !== "/forgot-password" && (
            <TopTabs />
        )}

        {!authPage && shopSection && (
            <ShopSectionNavigation user={user} />
        )}


        {/* ==================================================
            ROUTES
        ================================================== */}

        <AnimatePresence mode="wait">
        <motion.div
            key={location.pathname}
            className="route-3d-stage"
            initial={prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 18, rotateX: 3, rotateY: -1, scale: 0.99 }
            }
            animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 }}
            exit={prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -12, rotateX: -2, rotateY: 1, scale: 0.995 }
            }
            transition={prefersReducedMotion
                ? { duration: 0.12 }
                : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
            }
            style={{
                transformPerspective: 1400,
                transformOrigin: "top center",
                backfaceVisibility: "hidden"
            }}
        >
        <Routes location={location}>


                {/* =================================================
                    PUBLIC ROUTES
                    Login এবং Register ছাড়া সব protected
                ================================================== */}


                {/* ==========================
                    LOGIN
                =========================== */}

                <Route
                    path="/login"
                    element={
                        <Login />
                    }
                />


                {/* ==========================
                    FORGOT / RESET PASSWORD
                =========================== */}

                <Route
                    path="/forgot-password"
                    element={
                        <ForgotPassword />
                    }
                />


                {/* ==========================
                    REGISTER
                =========================== */}

                <Route
                    path="/register"
                    element={
                        <Register />
                    }
                />

                <Route
                    path="/verify-email"
                    element={<VerifyEmail />}
                />



                {/* =================================================
                    PROTECTED JR STORE ROUTES
                ================================================== */}


                {/* ==========================
                    HOME
                =========================== */}

                <Route
                    path="/"
                    element={

                        <PrivateRoute>

                            <Home />

                        </PrivateRoute>

                    }
                />

                <Route
                    path="/reels"
                    element={
                        <PrivateRoute>
                            <Reels />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/post/:id"
                    element={
                        <PrivateRoute>
                            <SharedPost />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/communities"
                    element={
                        <PrivateRoute>
                            <Communities />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/communities/:id"
                    element={
                        <PrivateRoute>
                            <Communities />
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/shop"
                    element={
                        <PrivateRoute>
                            <Shop />
                        </PrivateRoute>
                    }
                />

                <Route path="/shop/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/shop/product/:id" element={<PrivateRoute><ProductDetails /></PrivateRoute>} />
                <Route path="/shop/payment-success" element={<PrivateRoute><PaymentSuccess /></PrivateRoute>} />
                <Route path="/shop/payment-fail" element={<PrivateRoute><PaymentFailed /></PrivateRoute>} />
                <Route path="/shop/payment-cancel" element={<PrivateRoute><PaymentFailed /></PrivateRoute>} />
                <Route path="/shop/cart" element={<PrivateRoute><Cart /></PrivateRoute>} />
                <Route path="/shop/wishlist" element={<PrivateRoute><Wishlist /></PrivateRoute>} />
                <Route path="/shop/checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />
                <Route path="/shop/orders" element={<PrivateRoute><OrderHistory /></PrivateRoute>} />
                <Route path="/shop/notifications" element={<PrivateRoute><ShopNotifications /></PrivateRoute>} />
                <Route path="/shop/settings" element={<PrivateRoute><ShopSettings /></PrivateRoute>} />
                <Route path="/shop/seller" element={<PrivateRoute allowedRoles={["seller"]}><SellerDashboard /></PrivateRoute>} />
                <Route path="/shop/seller/products" element={<PrivateRoute allowedRoles={["seller"]}><SellerProducts /></PrivateRoute>} />
                <Route path="/shop/seller/orders" element={<PrivateRoute allowedRoles={["seller"]}><SellerOrders /></PrivateRoute>} />
                <Route path="/shop/edit-product/:id" element={<PrivateRoute allowedRoles={["seller", "admin"]}><EditProduct /></PrivateRoute>} />

                <Route path="/product/:id" element={<ShopRedirect target="/shop/product/:id" />} />
                <Route path="/payment-success" element={<ShopRedirect target="/shop/payment-success" />} />
                <Route path="/payment-fail" element={<ShopRedirect target="/shop/payment-fail" />} />
                <Route path="/payment-cancel" element={<ShopRedirect target="/shop/payment-cancel" />} />
                <Route path="/cart" element={<ShopRedirect target="/shop/cart" />} />
                <Route path="/wishlist" element={<ShopRedirect target="/shop/wishlist" />} />
                <Route path="/checkout" element={<ShopRedirect target="/shop/checkout" />} />
                <Route path="/orders" element={<ShopRedirect target="/shop/orders" />} />
                <Route path="/dashboard" element={<ShopRedirect target="/shop/dashboard" />} />
                <Route path="/edit-product/:id" element={<ShopRedirect target="/shop/edit-product/:id" />} />
                <Route path="/seller" element={<ShopRedirect target="/shop/seller" />} />
                <Route path="/seller/orders" element={<ShopRedirect target="/shop/seller/orders" />} />

                {/* ==========================
                    PRODUCT DETAILS
                =========================== */}


                {/* ==========================
                    SEARCH
                =========================== */}

                <Route
                    path="/search"
                    element={

                        <PrivateRoute>

                            <SearchResults />

                        </PrivateRoute>

                    }
                />


                {/* ==========================
                    USER PROFILE
                =========================== */}

                <Route
                    path="/user/:id"
                    element={

                        <PrivateRoute>

                            <UserProfile />

                        </PrivateRoute>

                    }
                />



                {/* =================================================
                    PAYMENT
                ================================================== */}


                {/* ==========================
                    PAYMENT SUCCESS
                =========================== */}



                {/* ==========================
                    PAYMENT FAILED
                =========================== */}



                {/* ==========================
                    PAYMENT CANCEL
                =========================== */}




                {/* =================================================
                    USER
                ================================================== */}


                {/* ==========================
                    PROFILE
                =========================== */}

                <Route
                    path="/profile"
                    element={

                        <PrivateRoute>

                            <Profile />

                        </PrivateRoute>

                    }
                />


                {/* ==========================
                    EDIT PROFILE
                =========================== */}

                <Route
                    path="/edit-profile"
                    element={

                        <PrivateRoute>

                            <EditProfile />

                        </PrivateRoute>

                    }
                />

                <Route
                    path="/settings"
                    element={
                        <PrivateRoute>
                            <Settings />
                        </PrivateRoute>
                    }
                />


                {/* ==========================
                    DASHBOARD
                =========================== */}



                {/* ==========================
                    CART
                =========================== */}



                {/* ==========================
                    WISHLIST
                =========================== */}



                {/* ==========================
                    CHECKOUT
                =========================== */}



                {/* ==========================
                    ORDER HISTORY
                =========================== */}



                {/* ==========================
                    EDIT PRODUCT
                =========================== */}



                {/* ==========================
                    MESSENGER
                =========================== */}

                <Route
                    path="/messenger"
                    element={

                        <PrivateRoute>
                            <div />
                        </PrivateRoute>

                    }
                />



                {/* =================================================
                    SELLER
                ================================================== */}


                {/* ==========================
                    SELLER DASHBOARD
                =========================== */}



                {/* ==========================
                    SELLER ORDERS
                =========================== */}




                {/* =================================================
                    ADMIN
                ================================================== */}


                <Route
                    path="/admin/control"
                    element={
                        <PrivateRoute>
                            <AdminControl />
                        </PrivateRoute>
                    }
                />

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
                ================================================== */}

                <Route
                    path="*"
                    element={
                        <NotFound />
                    }
                />

            </Routes>
        </motion.div>
        </AnimatePresence>

            {user && (
                <Messenger isActive={location.pathname === "/messenger"} />
            )}

            {/* ==================================================
                FOOTER
            ================================================== */}

            {!authPage && !messengerPage && !reelsPage && (
                <Footer />
            )}

        </>

    );

}


// ======================================================
// MAIN APP
// ======================================================

function App() {

    const [
        showLoading,
        setShowLoading
    ] = useState(true);


    // ==================================================
    // INITIAL LOADING SCREEN
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


    // ==================================================
    // BROWSER ROUTER
    // ==================================================

    return (

        <BrowserRouter>

            <AppLayout />

        </BrowserRouter>

    );

}


export default App;
