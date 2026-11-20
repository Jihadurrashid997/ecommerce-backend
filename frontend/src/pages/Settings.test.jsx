import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Settings from "./Settings";
import api from "../services/api";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockSetCart = jest.fn();
const mockSetWishlist = jest.fn();
const mockSetTheme = jest.fn();

jest.mock("react-router-dom", () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => mockNavigate
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({
        theme: "dark",
        setTheme: mockSetTheme,
        user: { name: "Riley" },
        logout: mockLogout,
        setCart: mockSetCart,
        setWishlist: mockSetWishlist
    })
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn()
    },
    getUploadUrl: url => url
}));

describe("Settings account deletion", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        api.get.mockImplementation(path => {
            if (path === "/users/settings") {
                return Promise.resolve({
                    data: {
                        settings: {
                            theme: "dark",
                            accountVisibility: "public",
                            notifications: {
                                follows: true,
                                posts: true,
                                communities: true,
                                announcements: true
                            }
                        }
                    }
                });
            }
            return Promise.resolve({ data: { users: [], requests: [] } });
        });
        api.delete.mockResolvedValue({ data: { success: true } });
    });

    test("requires password and typed confirmation, then clears the local account", async () => {
        render(<Settings />);

        expect(await screen.findByRole("heading", { name: /delete account permanently/i })).toBeInTheDocument();
        const passwordFields = screen.getAllByLabelText("Current password");
        fireEvent.change(passwordFields[1], { target: { value: "my-password" } });
        fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
            target: { value: "DELETE" }
        });

        fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

        await waitFor(() => {
            expect(api.delete).toHaveBeenCalledWith("/users/account", {
                data: { currentPassword: "my-password", confirmation: "DELETE" }
            });
        });
        expect(mockSetCart).toHaveBeenCalledWith([]);
        expect(mockSetWishlist).toHaveBeenCalledWith([]);
        expect(mockLogout).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
        expect(screen.getAllByRole("link", { name: /forgot your password/i })[1]).toHaveAttribute(
            "href",
            "/forgot-password"
        );
    });
});
