import React, {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

const AppContext = createContext(null);

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
    // AUTH LOADING
    // ==========================

    const [loading, setLoading] = useState(true);


    // ==========================
    // THEME
    // ==========================

    const [theme, setTheme] = useState(
        localStorage.getItem("theme") || "dark"
    );


    // ==================================================
    // LOAD SAVED AUTH + DATA
    // ==================================================

    useEffect(() => {

        const loadAppData = () => {

            try {

                const token =
                    localStorage.getItem("token");

                const savedUser =
                    localStorage.getItem("user");

                const savedCart =
                    localStorage.getItem("cart");

                const savedWishlist =
                    localStorage.getItem("wishlist");

                const savedNotifications =
                    localStorage.getItem(
                        "notifications"
                    );


                // ==========================
                // AUTH
                // ==========================

                if (token && savedUser) {

                    try {

                        setUser(
                            JSON.parse(savedUser)
                        );

                    } catch {

                        localStorage.removeItem(
                            "user"
                        );

                    }

                } else {

                    // Token/user incomplete হলে
                    // clean করে দিচ্ছি

                    localStorage.removeItem(
                        "token"
                    );

                    localStorage.removeItem(
                        "user"
                    );

                    setUser(null);

                }


                // ==========================
                // CART
                // ==========================

                if (savedCart) {

                    try {

                        const parsedCart =
                            JSON.parse(savedCart);

                        setCart(
                            Array.isArray(parsedCart)
                                ? parsedCart
                                : []
                        );

                    } catch {

                        setCart([]);

                    }

                }


                // ==========================
                // WISHLIST
                // ==========================

                if (savedWishlist) {

                    try {

                        const parsedWishlist =
                            JSON.parse(
                                savedWishlist
                            );

                        setWishlist(
                            Array.isArray(
                                parsedWishlist
                            )
                                ? parsedWishlist
                                : []
                        );

                    } catch {

                        setWishlist([]);

                    }

                }


                // ==========================
                // NOTIFICATIONS
                // ==========================

                if (savedNotifications) {

                    try {

                        const parsedNotifications =
                            JSON.parse(
                                savedNotifications
                            );

                        setNotifications(
                            Array.isArray(
                                parsedNotifications
                            )
                                ? parsedNotifications
                                : []
                        );

                    } catch {

                        setNotifications([]);

                    }

                }

            } catch (error) {

                console.error(
                    "JR Store AppContext error:",
                    error
                );

            } finally {

                setLoading(false);

            }

        };


        loadAppData();

    }, []);


    // ==================================================
    // SAVE USER
    // ==================================================

    useEffect(() => {

        if (user) {

            localStorage.setItem(
                "user",
                JSON.stringify(user)
            );

        } else {

            localStorage.removeItem(
                "user"
            );

        }

    }, [user]);


    // ==================================================
    // SAVE CART
    // ==================================================

    useEffect(() => {

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );

    }, [cart]);


    // ==================================================
    // SAVE WISHLIST
    // ==================================================

    useEffect(() => {

        localStorage.setItem(
            "wishlist",
            JSON.stringify(wishlist)
        );

    }, [wishlist]);


    // ==================================================
    // SAVE NOTIFICATIONS
    // ==================================================

    useEffect(() => {

        localStorage.setItem(
            "notifications",
            JSON.stringify(
                notifications
            )
        );

    }, [notifications]);


    // ==================================================
    // THEME
    // ==================================================

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


    // ==================================================
    // TOGGLE THEME
    // ==================================================

    const toggleTheme = () => {

        setTheme(
            currentTheme =>
                currentTheme === "dark"
                    ? "light"
                    : "dark"
        );

    };


    // ==================================================
    // ADD NOTIFICATION
    // ==================================================

    const addNotification = (
        message,
        type = "info"
    ) => {

        const notification = {

            id:
                `${Date.now()}-${Math.random()}`,

            message,

            type,

            createdAt:
                new Date().toISOString(),

            read: false

        };


        setNotifications(
            previous => [
                notification,
                ...previous
            ]
        );

    };


    // ==================================================
    // MARK NOTIFICATION READ
    // ==================================================

    const markNotificationRead = (
        notificationId
    ) => {

        setNotifications(
            previous =>
                previous.map(
                    notification =>
                        String(
                            notification.id
                        ) ===
                        String(
                            notificationId
                        )
                            ? {
                                ...notification,
                                read: true
                            }
                            : notification
                )
        );

    };


    // ==================================================
    // CLEAR NOTIFICATIONS
    // ==================================================

    const clearNotifications = () => {

        setNotifications([]);

    };


    // ==================================================
    // CART COUNT
    // ==================================================

    const cartCount =
        cart.reduce(
            (total, item) =>
                total +
                Number(
                    item.quantity || 1
                ),
            0
        );


    // ==================================================
    // WISHLIST COUNT
    // ==================================================

    const wishlistCount =
        wishlist.length;


    // ==================================================
    // UNREAD NOTIFICATION COUNT
    // ==================================================

    const unreadNotificationCount =
        notifications.filter(
            notification =>
                !notification.read
        ).length;


    // ==================================================
    // LOGOUT
    // ==================================================

    const logout = () => {

        // JWT token remove

        localStorage.removeItem(
            "token"
        );


        // User remove

        localStorage.removeItem(
            "user"
        );


        // React state clear

        setUser(null);


        // Notifications clear

        setNotifications([]);


        /*
         * Cart & wishlist intentionally
         * রাখা হচ্ছে।
         *
         * চাইলে পরে logout-এর সময়
         * এগুলোও clear করতে পারবো।
         */

    };


    // ==================================================
    // CONTEXT VALUE
    // ==================================================

    const value = {

        // ==========================
        // AUTH
        // ==========================

        user,
        setUser,
        logout,


        // ==========================
        // CART
        // ==========================

        cart,
        setCart,
        cartCount,


        // ==========================
        // WISHLIST
        // ==========================

        wishlist,
        setWishlist,
        wishlistCount,


        // ==========================
        // NOTIFICATIONS
        // ==========================

        notifications,
        setNotifications,

        addNotification,

        markNotificationRead,

        clearNotifications,

        unreadNotificationCount,


        // ==========================
        // THEME
        // ==========================

        theme,
        setTheme,
        toggleTheme,


        // ==========================
        // APP
        // ==========================

        loading

    };


    return (

        <AppContext.Provider
            value={value}
        >

            {children}

        </AppContext.Provider>

    );

};


// ==================================================
// CUSTOM HOOK
// ==================================================

export const useApp = () => {

    const context =
        useContext(AppContext);


    if (!context) {

        throw new Error(
            "useApp must be used inside AppProvider"
        );

    }


    return context;

};
