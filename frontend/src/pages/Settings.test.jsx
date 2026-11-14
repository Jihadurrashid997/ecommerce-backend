import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import Settings from "./Settings";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props} />
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ theme: "dark", setTheme: jest.fn(), user: { name: "Viewer" } })
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
    mockSettingsResponse();
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
