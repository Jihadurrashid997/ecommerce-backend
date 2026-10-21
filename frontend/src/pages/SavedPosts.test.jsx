import React from "react";
import { render, screen } from "@testing-library/react";
import api from "../services/api";
import SavedPosts from "./SavedPosts";

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { get: jest.fn() }
}));

jest.mock("../components/PostCard", () => ({ post }) => (
    <article aria-label={`Saved ${post._id}`} />
));

test("loads the signed-in user's saved posts", async () => {
    api.get.mockResolvedValue({
        data: {
            data: [{ _id: "saved-post-1" }],
            nextCursor: null
        }
    });

    render(<SavedPosts />);

    expect(await screen.findByRole("article", { name: "Saved saved-post-1" })).toBeVisible();
    expect(api.get).toHaveBeenCalledWith("/posts/saved", { params: {} });
});

test("shows an empty state when no posts are saved", async () => {
    api.get.mockResolvedValue({ data: { data: [], nextCursor: null } });

    render(<SavedPosts />);

    expect(await screen.findByText("You have not saved any posts yet.")).toBeVisible();
});
