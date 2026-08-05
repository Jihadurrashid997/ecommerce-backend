import React, { createContext, useContext, useEffect, useState } from "react";

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {

    const [wishlist, setWishlist] = useState(() => {

        const saved = localStorage.getItem("wishlist");

        return saved ? JSON.parse(saved) : [];

    });

    useEffect(() => {

        localStorage.setItem("wishlist", JSON.stringify(wishlist));

    }, [wishlist]);

    const addToWishlist = (product) => {

        const exists = wishlist.find(item => item._id === product._id);

        if (!exists) {

            setWishlist([...wishlist, product]);

        }

    };

    const removeFromWishlist = (id) => {

        setWishlist(wishlist.filter(item => item._id !== id));

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
