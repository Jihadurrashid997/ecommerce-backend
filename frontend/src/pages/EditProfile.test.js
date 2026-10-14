import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditProfile from "./EditProfile";
import api from "../services/api";

const mockSetUser = jest.fn();
const mockUser = { email: "person@example.com" };
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({
        user: mockUser,
        setUser: mockSetUser
    })
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        put: jest.fn()
    },
    getUploadUrl: url => url
}));

describe("EditProfile photo upload", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        URL.createObjectURL = jest.fn(() => "blob:profile-preview");
        URL.revokeObjectURL = jest.fn();
        api.get.mockResolvedValue({
            data: {
                user: {
                    name: "A person",
                    bio: "",
                    location: "",
                    profileImage: ""
                }
            }
        });
        api.put.mockResolvedValue({
            data: {
                user: {
                    name: "A person",
                    profileImage: "https://cdn.example.com/profile.jpg"
                }
            }
        });
    });

    test("submits the selected profile image as multipart form data", async () => {
        render(<EditProfile />);
        await screen.findByLabelText("Profile photo");

        const image = new File(["image"], "profile.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText("Profile photo"), {
            target: { files: [image] }
        });
        expect(await screen.findByAltText("Profile")).toHaveAttribute(
            "src",
            "blob:profile-preview"
        );

        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
        const [route, payload, options] = api.put.mock.calls[0];
        expect(route).toBe("/users/profile");
        expect(payload).toBeInstanceOf(FormData);
        expect(payload.get("profileImage")).toBe(image);
        expect(options.headers["Content-Type"]).toBe("multipart/form-data");
    });
});
