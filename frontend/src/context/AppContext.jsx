import React, { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

export const AppProvider = ({ children }) => {

    const [user, setUser] = useState(null);

    const [cart, setCart] = useState([]);

    const [wishlist, setWishlist] = useState([]);

    const [notifications, setNotifications] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        const savedUser = localStorage.getItem("user");

        const savedCart = localStorage.getItem("cart");

        const savedWishlist = localStorage.getItem("wishlist");

        if(savedUser){

            setUser(JSON.parse(savedUser));

        }

        if(savedCart){

            setCart(JSON.parse(savedCart));

        }

        if(savedWishlist){

            setWishlist(JSON.parse(savedWishlist));

        }

        setLoading(false);

    },[]);

    useEffect(()=>{

        localStorage.setItem("cart",JSON.stringify(cart));

    },[cart]);

    useEffect(()=>{

        localStorage.setItem("wishlist",JSON.stringify(wishlist));

    },[wishlist]);

    return(

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

            loading

        }}

        >

            {children}

        </AppContext.Provider>

    );

}

export const useApp = ()=>useContext(AppContext);
