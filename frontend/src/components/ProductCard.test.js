import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ProductCard from "./ProductCard";
import { CartProvider } from "../context/CartContext";
import { WishlistProvider } from "../context/WishlistContext";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));

const renderProduct = product => render(
    <CartProvider>
        <WishlistProvider>
            <ProductCard product={product} />
        </WishlistProvider>
    </CartProvider>
);

describe("ProductCard marketplace actions", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("adds a product to the wishlist and cart with visible feedback", () => {
        renderProduct({
            _id: "product-1",
            name: "Handmade mug",
            price: 450,
            stock: 3
        });

        expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/product/product-1");
        fireEvent.click(screen.getByRole("button", { name: "Add Handmade mug to wishlist" }));
        expect(screen.getByRole("button", { name: "Remove Handmade mug from wishlist" }))
            .toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: /Add to bag/ }));
        expect(screen.getByRole("button", { name: /Added to bag/ })).toBeInTheDocument();
        expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    });

    test("prevents adding out-of-stock products to the cart", () => {
        renderProduct({
            _id: "product-2",
            name: "Sold-out notebook",
            price: 250,
            stock: 0
        });

        expect(screen.getByRole("button", { name: /Sold out/ })).toBeDisabled();
    });
});
