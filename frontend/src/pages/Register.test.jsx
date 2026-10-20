import React from "react";
import { TextEncoder } from "util";
import { fireEvent, render, screen } from "@testing-library/react";
import api from "../services/api";
import Register from "./Register";

jest.mock("react-router-dom", () => ({
    Link: "a"
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { post: jest.fn() }
}));

describe("Register", () => {
    beforeAll(() => {
        global.TextEncoder = TextEncoder;
    });

    beforeEach(() => {
        api.post.mockReset();
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
});
