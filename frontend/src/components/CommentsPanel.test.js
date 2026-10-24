import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import CommentsPanel from "./CommentsPanel";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: { _id: "comment-owner" } })
}));

const comment = {
    _id: "comment-1",
    text: "A useful comment",
    user: { _id: "comment-owner", name: "Comment owner" }
};

beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { data: [comment] } });
});

test("comment authors can delete their own comments and update the count", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    const onCount = jest.fn();
    api.delete.mockResolvedValue({ data: { commentCount: 0 } });
    render(<CommentsPanel postId="post-1" onCount={onCount} />);

    fireEvent.click(await screen.findByRole("button", {
        name: "Delete comment by Comment owner"
    }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(
        "/posts/post-1/comments/comment-1"
    ));
    expect(onCount).toHaveBeenCalledWith(0);
    await waitFor(() => expect(screen.queryByText("A useful comment")).not.toBeInTheDocument());
    confirm.mockRestore();
});

test("comment authors do not get a delete action for other users' comments", async () => {
    api.get.mockResolvedValue({
        data: {
            data: [{
                ...comment,
                user: { _id: "different-user", name: "Another user" }
            }]
        }
    });
    render(<CommentsPanel postId="post-1" />);
    expect(await screen.findByText("A useful comment")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Delete comment/ })).not.toBeInTheDocument();
});
