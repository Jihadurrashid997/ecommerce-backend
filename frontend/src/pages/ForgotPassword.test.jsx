import React from "react";
import { TextEncoder } from "util";
import { fireEvent, render, screen } from "@testing-library/react";
import api from "../services/api";
import ForgotPassword from "./ForgotPassword";

jest.mock("react-router-dom", () => ({
    Link: "a",
    useNavigate: () => jest.fn()
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { post: jest.fn() }
}));

describe("ForgotPassword", () => {
    beforeAll(() => {
        global.TextEncoder = TextEncoder;
    });

    beforeEach(() => {
        api.post.mockReset();
    });

    test("requests, resends, verifies, and consumes a password reset code", async () => {
        api.post
            .mockResolvedValueOnce({ data: { success: true } })
            .mockResolvedValueOnce({
                data: { success: true, message: "A new code has been sent." }
            })
            .mockResolvedValueOnce({
                data: { success: true, resetToken: "a".repeat(64) }
            })
            .mockResolvedValueOnce({ data: { success: true } });

        render(<ForgotPassword />);

        fireEvent.change(screen.getByLabelText("Email"), {
            target: { value: "user@example.com" }
        });
        fireEvent.click(screen.getByRole("button", { name: /send code/i }));

        expect(await screen.findByLabelText("6-digit code")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /resend reset code/i }));
        expect(await screen.findByRole("status")).toHaveTextContent(
            "A new code has been sent."
        );

        fireEvent.change(screen.getByLabelText("6-digit code"), {
            target: { value: "123456" }
        });
        fireEvent.click(screen.getByRole("button", { name: /verify code/i }));
        expect(await screen.findByLabelText("New password")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("New password"), {
            target: { value: "a new secure password" }
        });
        fireEvent.change(screen.getByLabelText("Confirm new password"), {
            target: { value: "a new secure password" }
        });
        fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(await screen.findByRole("heading", { name: "All done!" })).toBeInTheDocument();
        expect(api.post).toHaveBeenNthCalledWith(1, "/auth/forgot-password", {
            email: "user@example.com"
        });
        expect(api.post).toHaveBeenNthCalledWith(2, "/auth/forgot-password", {
            email: "user@example.com"
        });
        expect(api.post).toHaveBeenNthCalledWith(3, "/auth/verify-reset-code", {
            email: "user@example.com",
            code: "123456"
        });
        expect(api.post).toHaveBeenNthCalledWith(4, "/auth/reset-password", {
            resetToken: "a".repeat(64),
            password: "a new secure password"
        });
    });

    test("does not advance when code verification returns no reset token", async () => {
        api.post
            .mockResolvedValueOnce({ data: { success: true } })
            .mockResolvedValueOnce({ data: { success: true } });

        render(<ForgotPassword />);
        fireEvent.change(screen.getByLabelText("Email"), {
            target: { value: "user@example.com" }
        });
        fireEvent.click(screen.getByRole("button", { name: /send code/i }));

        fireEvent.change(await screen.findByLabelText("6-digit code"), {
            target: { value: "123456" }
        });
        fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

        expect(
            await screen.findByText(
                "The code could not be verified. Request a new code and try again."
            )
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    });
});
