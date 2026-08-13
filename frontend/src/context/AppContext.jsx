import React, {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {

    // ==========================
    // USER
    // ==========================

    const [user, setUser] = useState(null);


    // ==========================
    // CART
    // ==========================

    const [cart, setCart] = useState([]);


    // ==========================
    // WISHLIST
    // ==========================

    const [wishlist, setWishlist] = useState([]);


    // ==========================
    // NOTIFICATIONS
    // ==========================

    const [notifications, setNotifications] = useState([]);


    // ==========================
    // LOADING
    // ==========================

    const [loading, setLoading] = useState(true);


    // ==========================
    // APP THEME
    // ==========================

    const [theme, setTheme] = useState(
        localStorage.getItem("theme") || "dark"
    );


    // ==========================
    // LOAD SAVED DATA
    // ==========================

    useEffect(() => {

        try {

            const savedUser =
                localStorage.getItem("user");

            const savedCart =
                localStorage.getItem("cart");

            const savedWishlist =
                localStorage.getItem("wishlist");

            const savedNotifications =
                localStorage.getItem("notifications");


            if (savedUser) {

                setUser(
                    JSON.parse(savedUser)
                );

            }


            if (savedCart) {

                setCart(
                    JSON.parse(savedCart)
                );

            }


            if (savedWishlist) {

                setWishlist(
                    JSON.parse(savedWishlist)
                );

            }


            if (savedNotifications) {

                setNotifications(
                    JSON.parse(savedNotifications)
                );

            }

        } catch (err) {

            console.error(
                "Local storage error:",
                err
            );

        } finally {

            setLoading(false);

        }

    }, []);


    // ==========================
    // SAVE USER
    // ==========================

    useEffect(() => {

        if (user) {

            localStorage.setItem(
                "user",
                JSON.stringify(user)
            );

        } else {

            localStorage.removeItem("user");

        }

    }, [user]);


    // ==========================
    // SAVE CART
    // ==========================

    useEffect(() => {

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );

    }, [cart]);


    // ==========================
    // SAVE WISHLIST
    // ==========================

    useEffect(() => {

        localStorage.setItem(
            "wishlist",
            JSON.stringify(wishlist)
        );

    }, [wishlist]);


    // ==========================
    // SAVE NOTIFICATIONS
    // ==========================

    useEffect(() => {

        localStorage.setItem(
            "notifications",
            JSON.stringify(notifications)
        );

    }, [notifications]);


    // ==========================
    // THEME
    // ==========================

    useEffect(() => {

        document.documentElement.setAttribute(
            "data-theme",
            theme
        );

        localStorage.setItem(
            "theme",
            theme
        );

    }, [theme]);


    // ==========================
    // TOGGLE THEME
    // ==========================

    const toggleTheme = () => {

        setTheme((currentTheme) =>
            currentTheme === "dark"
                ? "light"
                : "dark"
        );

    };


    // ==========================
    // ADD NOTIFICATION
    // ==========================

    const addNotification = (
        message,
        type = "info"
    ) => {

        const notification = {

            id:
                Date.now() +
                Math.random(),

            message,

            type,

            createdAt:
                new Date().toISOString(),

            read: false

        };


        setNotifications(
            (previous) => [
                notification,
                ...previous
            ]
        );

    };


    // ==========================
    // MARK NOTIFICATION READ
    // ==========================

    const markNotificationRead = (
        notificationId
    ) => {

        setNotifications(
            (previous) =>
                previous.map(
                    (notification) =>
                        notification.id ===
                        notificationId
                            ? {
                                ...notification,
                                read: true
                            }
                            : notification
                )
        );

    };


    // ==========================
    // CLEAR NOTIFICATIONS
    // ==========================

    const clearNotifications = () => {

        setNotifications([]);

    };


    // ==========================
    // CART COUNT
    // ==========================

    const cartCount =
        cart.reduce(
            (total, item) =>
                total +
                Number(item.quantity || 1),
            0
        );


    // ==========================
    // WISHLIST COUNT
    // ==========================

    const wishlistCount =
        wishlist.length;


    // ==========================
    // UNREAD NOTIFICATION COUNT
    // ==========================

    const unreadNotificationCount =
        notifications.filter(
            (notification) =>
                !notification.read
        ).length;


    // ==========================
    // LOGOUT
    // ==========================

    const logout = () => {

        localStorage.removeItem("token");

        localStorage.removeItem("user");

        setUser(null);

        setNotifications([]);

    };


    // ==========================
    // CONTEXT
    // ==========================

    return (

        <AppContext.Provider
            value={{

                // User
                user,
                setUser,

                // Cart
                cart,
                setCart,
                cartCount,

                // Wishlist
                wishlist,
                setWishlist,
                wishlistCount,

                // Notifications
                notifications,
                setNotifications,
                addNotification,
                markNotificationRead,
                clearNotifications,
                unreadNotificationCount,

                // Theme
                theme,
                setTheme,
                toggleTheme,

                // App
                loading,

                // Auth
                logout

            }}
        >

            {children}

        </AppContext.Provider>

    );

};


// ==========================
// CUSTOM HOOK
// ==========================

export const useApp = () =>
    useContext(AppContext);
