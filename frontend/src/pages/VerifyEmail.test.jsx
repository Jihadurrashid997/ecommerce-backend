import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import VerifyEmail from "./VerifyEmail";

jest.mock("react-router-dom", () => ({
    Link: "a",
    useLocation: () => ({ state: null }),
    useNavigate: () => jest.fn(),
    useSearchParams: () => [new URLSearchParams("email=user%40example.com")]
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { post: jest.fn() }
}));

describe("VerifyEmail", () => {
    beforeEach(() => {
        api.post.mockReset();
    });

    test("submits the email and verification code", async () => {
        api.post.mockResolvedValue({ data: { success: true } });
        render(<VerifyEmail />);

        fireEvent.change(screen.getByLabelText("6-digit code"), {
            target: { value: "123456" }
        });
        fireEvent.click(screen.getByRole("button", { name: /verify email/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith("/auth/verify-email", {
                email: "user@example.com",
                code: "123456"
            });
        });
        expect(await screen.findByText("Email verified")).toBeInTheDocument();
    });

    test("resends a verification code for the entered email", async () => {
        api.post.mockResolvedValue({
            data: { message: "If the account needs verification, a new code will be sent." }
        });
        render(<VerifyEmail />);

        fireEvent.change(screen.getByLabelText("Email address"), {
            target: { value: "user@example.com" }
        });
        fireEvent.click(screen.getByRole("button", { name: /resend verification code/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                "/auth/resend-verification",
                { email: "user@example.com" }
            );
        });
        expect(await screen.findByRole("status")).toHaveTextContent(
            "If the account needs verification, a new code will be sent."
        );
    });
});
