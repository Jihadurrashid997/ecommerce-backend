import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
        put: jest.fn().mockResolvedValue({}),
        delete: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: { _id: "viewer" } })
}));

jest.mock("./CommentsPanel", () => ({ onClose }) => (
    <section aria-label="Post comments">
        <button type="button" onClick={onClose}>Close comments</button>
    </section>
));

const post = {
    _id: "post-1",
    kind: "post",
    visibility: "public",
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
    const viewer = screen.getByRole("dialog", { name: "Post photo 1 of 2" });
    expect(viewer).toBeVisible();
    expect(viewer.parentElement).toBe(document.body);
    const postFooter = within(viewer).getByRole("contentinfo");
    const postInfo = postFooter.querySelector(".media-viewer-post-info");
    const actions = postFooter.querySelector(".media-viewer-actions");
    expect(within(postInfo).getByRole("link", { name: /Author/ })).toHaveAttribute("href", "/user/author-1");
    expect(within(postInfo).getByText("A shared moment")).toBeVisible();
    expect(postFooter.querySelector(".media-viewer-post-info").compareDocumentPosition(actions))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("img", { name: "Post media 1" })).toHaveAttribute("src", "/photo-one.jpg");
    expect(within(viewer).getByRole("button", { name: "Like post" })).toHaveAttribute("aria-pressed", "false");
    expect(within(viewer).getByRole("button", { name: "Comments, 1" })).toBeVisible();

    fireEvent.click(within(viewer).getByRole("button", { name: "Like post" }));
    expect(within(viewer).getByRole("button", { name: "Unlike post" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(viewer).getByRole("button", { name: "Comments, 1" }));
    expect(screen.getByRole("region", { name: "Post comments" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("dialog", { name: "Post photo 2 of 2" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Post media 2" })).toHaveAttribute("src", "/photo-two.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Back from photo viewer" }));
    expect(screen.queryByRole("dialog", { name: "Post photo 2 of 2" })).not.toBeInTheDocument();
});

test("closes the full-screen photo viewer with the visible close button", () => {
    render(<PostCard post={post} />);
    fireEvent.click(screen.getByRole("button", { name: "View photo full screen" }));

    expect(screen.getByRole("button", { name: "Close photo viewer" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close photo viewer" }));
    expect(screen.queryByRole("dialog", { name: "Post photo 1 of 2" })).not.toBeInTheDocument();
});

test("closes the full-screen photo viewer with Escape", () => {
    render(<PostCard post={post} />);
    fireEvent.click(screen.getByRole("button", { name: "View photo full screen" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Post photo 1 of 2" })).not.toBeInTheDocument();
});

test("copies a shareable post link when native sharing is unavailable", async () => {
    const originalClipboard = navigator.clipboard;
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText }
    });

    try {
        render(<PostCard post={post} />);
        fireEvent.click(screen.getByRole("button", { name: "Share post" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Post link copied.");
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/post/post-1`);
    } finally {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: originalClipboard
        });
    }
});

test("saves a post and offers icon-based reactions", async () => {
    render(<PostCard post={post} />);

    expect(document.querySelectorAll(".post-actions .reaction-picker-trigger")).toHaveLength(1);
    expect(document.querySelector(".post-actions > button.liked")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));
    expect(await screen.findByRole("button", { name: "Remove saved post" })).toHaveAttribute("aria-pressed", "true");
    expect(api.put).toHaveBeenCalledWith("/posts/post-1/saved", { saved: true });

    fireEvent.click(screen.getByRole("button", { name: "Choose reaction" }));
    expect(screen.getByRole("group", { name: "Reactions" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose reaction" })).toHaveTextContent("React");
    expect(screen.queryByRole("combobox", { name: "Choose a reaction" })).not.toBeInTheDocument();
    const loveReaction = screen.getByRole("button", { name: "Love (0)" });
    expect(loveReaction).toHaveTextContent("❤️");
    expect(loveReaction).not.toHaveTextContent("Love");
    fireEvent.click(loveReaction);
    expect(api.put).toHaveBeenCalledWith("/posts/post-1/reaction", { reaction: "love" });
    expect(screen.getByRole("button", { name: "Love reaction selected; choose reaction" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Reactions" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Love reaction selected; choose reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Love (1)" }));
    expect(api.put).toHaveBeenLastCalledWith("/posts/post-1/reaction", { reaction: null });

    fireEvent.click(screen.getByRole("button", { name: "Choose reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "Love (0)" }));
    expect(screen.getByRole("button", { name: "Love reaction selected; choose reaction" })).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("button", { name: "Love reaction selected; choose reaction" }));
    fireEvent.click(screen.getByRole("button", { name: "No reaction" }));
    expect(api.put).toHaveBeenLastCalledWith("/posts/post-1/reaction", { reaction: null });
});

test("reposts a public post", async () => {
    render(<PostCard post={post} />);

    fireEvent.click(screen.getByRole("button", { name: "Repost" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Post reposted.");
    expect(api.post).toHaveBeenCalledWith("/posts/post-1/repost");
});
