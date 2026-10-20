import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import MessengerDeviceSettings from "./MessengerDeviceSettings";

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        delete: jest.fn(),
        put: jest.fn()
    }
}));

beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({
        data: {
            data: [
                {
                    deviceId: "current-device-123456",
                    name: "Chrome on Windows",
                    isCurrent: true,
                    lastActiveAt: new Date().toISOString()
                },
                {
                    deviceId: "other-device-123456",
                    name: "Safari on iPhone",
                    isCurrent: false,
                    lastActiveAt: new Date().toISOString()
                }
            ]
        }
    });
});

test("lists linked devices and lets the user revoke another device", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.delete.mockResolvedValue({ data: { success: true } });
    render(<MessengerDeviceSettings />);

    expect(await screen.findByText("Chrome on Windows"))
        .toBeInTheDocument();
    expect(screen.getByText("Safari on iPhone")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith(
            "/auth/devices/other-device-123456"
        );
    });
    expect(confirm).toHaveBeenCalled();
});

test("shows server errors when linked devices cannot be loaded", async () => {
    api.get.mockRejectedValueOnce({
        response: { data: { message: "Sign in again to manage devices." } }
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    render(<MessengerDeviceSettings />);

    expect(await screen.findByRole("alert"))
        .toHaveTextContent("Sign in again to manage devices.");
});
