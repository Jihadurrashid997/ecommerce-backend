import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "./Home";
import api from "../services/api";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: { _id: "current-user", name: "Current User" } })
}));

jest.mock("../components/PostCard", () => () => <article />);

beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation(path => Promise.resolve({
        data: path === "/users/following"
            ? { users: [] }
            : { data: [], nextCursor: null }
    }));
});

test("new feed posts include the selected audience and reset to public", async () => {
    api.post.mockResolvedValue({
        data: {
            data: {
                _id: "post-1",
                author: { _id: "current-user", name: "Current User" },
                caption: "A followers-only update",
                visibility: "followers",
                media: [],
                createdAt: new Date().toISOString()
            }
        }
    });

    render(<Home />);

    const audience = await screen.findByRole("combobox", { name: "Post audience" });
    fireEvent.change(audience, { target: { value: "followers" } });
    fireEvent.change(screen.getByPlaceholderText("What's worth sharing today?"), {
        target: { value: "A followers-only update" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Share post/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/posts",
        expect.any(FormData),
        expect.objectContaining({
            headers: { "Content-Type": "multipart/form-data" }
        })
    ));
    expect(api.post.mock.calls[0][1].get("visibility")).toBe("followers");
    await waitFor(() => expect(audience).toHaveValue("public"));
});
