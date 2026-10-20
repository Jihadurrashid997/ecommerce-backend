import React from "react";
import { TextEncoder } from "util";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import Register from "./Register";

jest.mock("react-router-dom", () => ({
    Link: "a"
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { post: jest.fn() }
}));

describe("Register email verification", () => {
    beforeAll(() => {
        global.TextEncoder = TextEncoder;
    });

    beforeEach(() => {
        api.post.mockReset();
    });

    test("verifies the emailed code on the registration page before showing success", async () => {
        api.post
            .mockResolvedValueOnce({
                data: {
                    success: true,
                    verificationRequired: true,
                    email: "user@example.com"
                }
            })
            .mockResolvedValueOnce({
                data: { success: true }
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

        expect(await screen.findByLabelText("6-digit verification code")).toBeInTheDocument();
        expect(api.post).toHaveBeenNthCalledWith(1, "/auth/register", {
            name: "E Top User",
            email: "user@example.com",
            password: "correct horse battery"
        });

        fireEvent.change(screen.getByLabelText("6-digit verification code"), {
            target: { value: "123456" }
        });
        fireEvent.click(screen.getByRole("button", { name: /verify and finish registration/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenNthCalledWith(2, "/auth/verify-email", {
                email: "user@example.com",
                code: "123456"
            });
        });
        expect(await screen.findByText("Registration successful. Your email is verified.")).toBeInTheDocument();
    });
});
