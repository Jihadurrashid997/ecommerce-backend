import React, { createContext, useContext, useEffect, useState } from "react";

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {

    const [wishlist, setWishlist] = useState(() => {

        try {
            const saved = localStorage.getItem("wishlist");
            const parsed = saved ? JSON.parse(saved) : [];

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Could not read saved wishlist:", error);
            return [];
        }

    });

    useEffect(() => {

        localStorage.setItem("wishlist", JSON.stringify(wishlist));

    }, [wishlist]);

    const addToWishlist = (product) => {

        const productId = String(product._id || product.id || "");

        setWishlist(previous => {
            const exists = previous.some(
                item => String(item._id || item.id || "") === productId
            );

            return exists ? previous : [...previous, product];
        });

    };

    const removeFromWishlist = (id) => {

        const productId = String(id);
        setWishlist(previous => previous.filter(
            item => String(item._id || item.id || "") !== productId
        ));

    };

    const clearWishlist = () => {

        setWishlist([]);

    };

    return (

        <WishlistContext.Provider

            value={{

                wishlist,

                addToWishlist,

                removeFromWishlist,

                clearWishlist

            }}

        >

            {children}

        </WishlistContext.Provider>

    );

};

export const useWishlist = () => useContext(WishlistContext);
