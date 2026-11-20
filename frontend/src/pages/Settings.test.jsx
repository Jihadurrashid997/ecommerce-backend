import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import Settings from "./Settings";

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
const mockSetCart = jest.fn();
const mockSetWishlist = jest.fn();
const mockSetTheme = jest.fn();

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => mockNavigate
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn()
    },
    getUploadUrl: value => value
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

const settings = {
    theme: "dark",
    accountVisibility: "public",
    notifications: {
        follows: true,
        posts: true,
        communities: true,
        announcements: true
    }
};

const mockSettingsResponse = () => {
    api.get.mockImplementation(path => Promise.resolve({
        data: path === "/users/settings"
            ? { settings }
            : path === "/users/blocked"
                ? { users: [] }
                : { requests: [] }
    }));
};

describe("Settings", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSettingsResponse();
    });

    test("does not show default settings after load fails and offers a retry", async () => {
        let firstSettingsRequest = true;
        api.get.mockImplementation(path => {
            if (path === "/users/settings" && firstSettingsRequest) {
                firstSettingsRequest = false;
                return Promise.reject({ response: { data: { message: "Settings unavailable" } } });
            }
            return Promise.resolve({
                data: path === "/users/settings"
                    ? { settings }
                    : path === "/users/blocked"
                        ? { users: [] }
                        : { requests: [] }
            });
        });

        render(<Settings />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Settings unavailable");
        expect(screen.queryByText("Account visibility")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        await waitFor(() => expect(screen.getByText("Account visibility")).toBeVisible());
        expect(screen.getByRole("radio", { name: "Public" })).toBeChecked();
    });

    test("loads and saves account-wide notification settings", async () => {
        api.patch.mockResolvedValue({
            data: {
                settings: {
                    ...settings,
                    notifications: { ...settings.notifications, follows: false }
                }
            }
        });

        render(<Settings />);
        const notification = await screen.findByRole("checkbox", { name: /New followers/ });
        expect(notification).toBeChecked();
        fireEvent.click(notification);

        await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
            "/users/settings",
            { notifications: { follows: false } }
        ));
        expect(await screen.findByRole("status")).toHaveTextContent("Your settings have been saved.");
    });

    test("requires password and typed confirmation, then clears the local account", async () => {
        api.delete.mockResolvedValue({ data: { success: true } });
        render(<Settings />);

        expect(await screen.findByRole("heading", { name: /delete account permanently/i })).toBeInTheDocument();
        const passwordFields = screen.getAllByLabelText("Current password");
        fireEvent.change(passwordFields[1], { target: { value: "my-password" } });
        fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
            target: { value: "DELETE" }
        });
        fireEvent.click(screen.getByRole("button", { name: /permanently delete account/i }));

        await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/users/account", {
            data: { currentPassword: "my-password", confirmation: "DELETE" }
        }));
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
