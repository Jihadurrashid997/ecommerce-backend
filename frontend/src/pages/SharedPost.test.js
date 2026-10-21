import React from "react";
import { render, screen } from "@testing-library/react";
import api from "../services/api";
import SharedPost from "./SharedPost";

jest.mock("react-router-dom", () => ({
    useNavigate: () => jest.fn(),
    useParams: () => ({ id: "post-1" })
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn()
    }
}));

jest.mock("../components/PostCard", () => ({ post }) => (
    <article data-testid="shared-post">{post.caption}</article>
));

test("loads the post addressed by a shared link", async () => {
    api.get.mockResolvedValue({
        data: {
            data: {
                _id: "post-1",
                caption: "A post shared with you"
            }
        }
    });

    render(<SharedPost />);

    expect(await screen.findByTestId("shared-post"))
        .toHaveTextContent("A post shared with you");
    expect(api.get).toHaveBeenCalledWith("/posts/post-1");
});

test("shows an access-safe message when a shared post cannot be loaded", async () => {
    api.get.mockRejectedValue({
        response: { data: { message: "Post not found." } }
    });

    render(<SharedPost />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Post not found.");
});
