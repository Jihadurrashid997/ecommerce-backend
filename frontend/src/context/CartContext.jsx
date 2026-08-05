import React, { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export const CartProvider = ({ children }) => {

    const [cart, setCart] = useState(() => {

        const saved = localStorage.getItem("cart");

        return saved ? JSON.parse(saved) : [];

    });

    useEffect(() => {

        localStorage.setItem("cart", JSON.stringify(cart));

    }, [cart]);

    const addToCart = (product) => {

        const exist = cart.find(item => item._id === product._id);

        if (exist) {

            setCart(cart.map(item =>
                item._id === product._id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));

        } else {

            setCart([...cart, { ...product, quantity: 1 }]);

        }

    };

    const removeFromCart = (id) => {

        setCart(cart.filter(item => item._id !== id));

    };

    const clearCart = () => {

        setCart([]);

    };

    return (

        <CartContext.Provider

            value={{

                cart,

                addToCart,

                removeFromCart,

                clearCart

            }}

        >

            {children}

        </CartContext.Provider>

    );

};

export const useCart = () => useContext(CartContext);
