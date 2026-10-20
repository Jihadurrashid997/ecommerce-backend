import React, {
    createContext,
    useCallback,
    useContext,
    useState,
    useEffect
} from "react";

const CartContext = createContext();

export const CartProvider = ({ children }) => {

    const [cart, setCart] = useState(() => {

        try {
            const saved = localStorage.getItem("cart");
            const parsed = saved ? JSON.parse(saved) : [];

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Could not read saved cart:", error);
            return [];
        }

    });

    useEffect(() => {

        localStorage.setItem("cart", JSON.stringify(cart));

    }, [cart]);

    const addToCart = useCallback((product) => {
        setCart(previous => {
            const parsedStock = Number(product.stock ?? 1);
            const stockLimit = Number.isSafeInteger(parsedStock) && parsedStock >= 0
                ? parsedStock
                : 0;
            const exists = previous.some(item => item._id === product._id);
            const currentQuantity = previous.find(
                item => item._id === product._id
            )?.quantity || 0;

            if (currentQuantity >= stockLimit) {
                return previous;
            }

            return exists
                ? previous.map(item =>
                    item._id === product._id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
                : [...previous, { ...product, quantity: 1 }];
        });
    }, []);

    const removeFromCart = useCallback((id) => {
        setCart(previous => previous.filter(item => item._id !== id));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

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
