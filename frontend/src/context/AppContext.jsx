import React, {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {

    const [user, setUser] = useState(null);

    const [cart, setCart] = useState([]);

    const [wishlist, setWishlist] = useState([]);

    const [notifications, setNotifications] = useState([]);

    const [loading, setLoading] = useState(true);

    // ==========================
    // Load Saved Data
    // ==========================

    useEffect(() => {

        try {

            const savedUser =
                localStorage.getItem("user");

            const savedCart =
                localStorage.getItem("cart");

            const savedWishlist =
                localStorage.getItem("wishlist");

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

        } catch (err) {

            console.log(
                "Local storage error:",
                err
            );

        } finally {

            setLoading(false);

        }

    }, []);

    // ==========================
    // Save User
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
    // Save Cart
    // ==========================

    useEffect(() => {

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );

    }, [cart]);

    // ==========================
    // Save Wishlist
    // ==========================

    useEffect(() => {

        localStorage.setItem(
            "wishlist",
            JSON.stringify(wishlist)
        );

    }, [wishlist]);

    // ==========================
    // Logout
    // ==========================

    const logout = () => {

        localStorage.removeItem("token");

        localStorage.removeItem("user");

        setUser(null);

    };

    return (

        <AppContext.Provider

            value={{

                user,

                setUser,

                cart,

                setCart,

                wishlist,

                setWishlist,

                notifications,

                setNotifications,

                loading,

                logout

            }}

        >

            {children}

        </AppContext.Provider>

    );

};

export const useApp = () =>
    useContext(AppContext);
