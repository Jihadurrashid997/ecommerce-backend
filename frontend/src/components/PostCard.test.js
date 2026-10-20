import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import api from "../services/api";
import PostCard from "./PostCard";

jest.mock("react-router-dom", () => {
    const ReactForLink = require("react");
    return {
        Link: ({ to, ...props }) => ReactForLink.createElement("a", {
            ...props,
            href: to
        })
    };
});

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
        delete: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: { _id: "viewer" } })
}));

jest.mock("./CommentsPanel", () => () => null);

const post = {
    _id: "post-1",
    author: { _id: "author-1", name: "Author" },
    media: [{ url: "/photo-one.jpg" }, { url: "/photo-two.jpg" }],
    caption: "A shared moment",
    likeCount: 2,
    commentCount: 1,
    createdAt: new Date().toISOString()
};

test("opens post photos in a full-screen viewer with navigation and close", () => {
    render(<PostCard post={post} />);

    fireEvent.click(screen.getByRole("button", { name: "View photo full screen" }));
    expect(screen.getByRole("dialog", { name: "Photo 1 of 2" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Post media 1" })).toHaveAttribute("src", "/photo-one.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("dialog", { name: "Photo 2 of 2" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Post media 2" })).toHaveAttribute("src", "/photo-two.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Close photo" }));
    expect(screen.queryByRole("dialog", { name: "Photo 2 of 2" })).not.toBeInTheDocument();
});

test("closes the full-screen photo viewer with Escape", () => {
    render(<PostCard post={post} />);
    fireEvent.click(screen.getByRole("button", { name: "View photo full screen" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Photo 1 of 2" })).not.toBeInTheDocument();
});
