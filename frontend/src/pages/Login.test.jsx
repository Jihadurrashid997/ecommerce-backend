import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { googleAuthUser } from "../services/auth";
import { useApp } from "../context/AppContext";
import Login from "./Login";

const mockNavigate = jest.fn();
const mockSetUser = jest.fn();

jest.mock("react-router-dom", () => ({
    Link: "a",
    useLocation: () => ({ search: "", state: null }),
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

describe("Login", () => {
    beforeEach(() => {
        googleAuthUser.mockReset();
        mockNavigate.mockReset();
        mockSetUser.mockReset();
        useApp.mockReturnValue({ user: null, setUser: mockSetUser });
    });

    test("signs in with Google and redirects to the home page", async () => {
        const user = { id: "google-user", email: "user@example.com" };
        googleAuthUser.mockResolvedValue({
            data: { token: "session-token", user }
        });

        render(<Login />);
        fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

        await waitFor(() => {
            expect(googleAuthUser).toHaveBeenCalledWith("google-id-token");
            expect(mockSetUser).toHaveBeenCalledWith(user);
            expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        });
    });
});
