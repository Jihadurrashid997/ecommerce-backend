import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import UserProfile from "./UserProfile";
import api from "../services/api";

jest.mock("react-router-dom", () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => jest.fn(),
    useParams: () => ({ id: "member-1" })
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        defaults: { baseURL: "/api" }
    }
}));

jest.mock("../components/ProfileSocial", () => () => <div>Profile social</div>);
jest.mock("../components/VerifiedBadge", () => () => <span>Verified</span>);

describe("UserProfile", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each(["customer", "seller"])("does not show the %s role on a public profile", async role => {
        api.get.mockResolvedValue({
            data: {
                user: {
                    _id: "member-1",
                    name: "Aba Rupan",
                    role
                }
            }
        });

        render(<UserProfile />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Aba Rupan" })).toBeInTheDocument();
        });

        expect(screen.queryByText(new RegExp(`^${role}$`, "i"))).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /message/i })).toHaveClass("profile-message-btn");
    });
});
