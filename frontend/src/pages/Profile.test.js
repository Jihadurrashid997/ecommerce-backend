import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Profile from "./Profile";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockUser = {
    _id: "member-1",
    name: "Riley Shah",
    email: "riley@example.com",
    role: "customer",
    bio: "Finding good things and good people.",
    location: "Dhaka",
    createdAt: "2025-03-15T00:00:00.000Z",
    isVerified: true
};

jest.mock("react-router-dom", () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    Navigate: () => null,
    useNavigate: () => mockNavigate
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: mockUser, logout: mockLogout })
}));

jest.mock("../services/api", () => ({
    getUploadUrl: url => url
}));

jest.mock("../components/ProfileSocial", () => () => <div>Your social profile</div>);
jest.mock("../components/VerifiedBadge", () => () => <span>Verified</span>);

describe("Profile", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("shows member details and useful account shortcuts", () => {
        render(<Profile />);

        expect(screen.getByRole("heading", { name: /riley shah/i })).toBeInTheDocument();
        expect(screen.getByText("riley@example.com")).toBeInTheDocument();
        expect(screen.getByText("Dhaka")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /messages/i })).toHaveAttribute("href", "/messenger");
        expect(screen.getByRole("link", { name: /your orders/i })).toHaveAttribute("href", "/shop/orders");
        expect(screen.getByRole("link", { name: /wishlist/i })).toHaveAttribute("href", "/shop/wishlist");
    });

    test("keeps profile editing and sign-out actions available", () => {
        render(<Profile />);

        fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));
        expect(mockNavigate).toHaveBeenCalledWith("/edit-profile");

        fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
        expect(mockLogout).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenLastCalledWith("/login");
    });
});
