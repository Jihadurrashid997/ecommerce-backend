import React from "react";
import { TextEncoder } from "util";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import { googleAuthUser } from "../services/auth";
import { useApp } from "../context/AppContext";
import Register from "./Register";

const mockNavigate = jest.fn();
const mockSetUser = jest.fn();

jest.mock("react-router-dom", () => ({
    Link: "a",
    useNavigate: () => mockNavigate
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { post: jest.fn() }
}));

jest.mock("../services/auth", () => ({
    googleAuthUser: jest.fn()
}));

jest.mock("../context/AppContext", () => ({
    useApp: jest.fn()
}));

jest.mock("../components/GoogleAuthButton", () => ({
    __esModule: true,
    default: ({ onCredential }) => (
        <button type="button" onClick={() => onCredential("google-id-token")}>
            Continue with Google
        </button>
    )
}));

describe("Register", () => {
    beforeAll(() => {
        global.TextEncoder = TextEncoder;
    });

    beforeEach(() => {
        api.post.mockReset();
        googleAuthUser.mockReset();
        mockNavigate.mockReset();
        mockSetUser.mockReset();
        useApp.mockReturnValue({ setUser: mockSetUser });
    });

    test("completes registration without requiring an email verification code", async () => {
        api.post.mockResolvedValueOnce({
            data: {
                success: true,
                verificationRequired: false,
                message: "Registration successful. You can now sign in.",
                email: "user@example.com"
            }
        });

        render(<Register />);

        fireEvent.change(screen.getByLabelText("Full Name"), {
            target: { value: "E Top User" }
        });
        fireEvent.change(screen.getByLabelText("Email Address"), {
            target: { value: "user@example.com" }
        });
        fireEvent.change(screen.getByLabelText("Password"), {
            target: { value: "correct horse battery" }
        });
        fireEvent.change(screen.getByLabelText("Confirm Password"), {
            target: { value: "correct horse battery" }
        });
        fireEvent.click(screen.getByRole("button", { name: /create account/i }));

        expect(await screen.findByText("Registration successful. You can now sign in.")).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(api.post).toHaveBeenCalledWith("/auth/register", {
            name: "E Top User",
            email: "user@example.com",
            password: "correct horse battery"
        });
        expect(screen.getByText(/continue to login/i).closest("a")).toHaveAttribute(
            "to",
            "/login"
        );
    });

    test("registers with Google and starts an authenticated session", async () => {
        const user = { id: "google-user", email: "user@example.com" };
        googleAuthUser.mockResolvedValue({
            data: { token: "session-token", user }
        });

        render(<Register />);
        fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

        await waitFor(() => {
            expect(googleAuthUser).toHaveBeenCalledWith("google-id-token");
            expect(mockSetUser).toHaveBeenCalledWith(user);
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });
});
