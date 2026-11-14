import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        patch: jest.fn(),
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
    render(<PostCard post={{
        ...post,
        media: [
            { url: "/photo-one.jpg", altText: "A person walking beside a lake" },
            { url: "/photo-two.jpg" }
        ]
    }} />);

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
    expect(within(viewer).getByRole("img", { name: "A person walking beside a lake" }))
        .toHaveAttribute("src", "/photo-one.jpg");
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

test("opens and closes comments from the Instagram-style comment action", () => {
    render(<PostCard post={post} />);
    const commentAction = screen.getByRole("button", { name: "Comments, 1" });

    expect(commentAction).toHaveClass("post-comment-action");
    expect(commentAction).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(commentAction);

    expect(commentAction).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Post comments")).toBeVisible();
    fireEvent.click(commentAction);
    expect(commentAction).toHaveAttribute("aria-expanded", "false");
});

test("keeps a follow control beside another author's name in either follow state", async () => {
    api.post.mockReset();
    api.post
        .mockResolvedValueOnce({ data: { isFollowing: true, isFollowRequestPending: false } })
        .mockResolvedValueOnce({ data: { isFollowing: false, isFollowRequestPending: false } })
        .mockResolvedValue({ data: { isFollowing: false, isFollowRequestPending: false } });
    const onFollowChange = jest.fn();
    render(<PostCard post={post} onFollowChange={onFollowChange} />);

    const authorGroup = document.querySelector(".post-author-group");
    expect(within(authorGroup).getByRole("link", { name: /Author/ })).toBeVisible();
    fireEvent.click(within(authorGroup).getByRole("button", { name: "Follow" }));
    expect(await within(authorGroup).findByRole("button", { name: "Unfollow" }))
        .toHaveTextContent("Following");

    fireEvent.click(within(authorGroup).getByRole("button", { name: "Unfollow" }));
    expect(await within(authorGroup).findByRole("button", { name: "Follow" }))
        .toBeVisible();
    expect(api.post).toHaveBeenNthCalledWith(1, "/users/follow/author-1");
    expect(api.post).toHaveBeenNthCalledWith(2, "/users/follow/author-1");
    expect(onFollowChange).toHaveBeenCalledTimes(2);
});

test("does not show a follow control on the current user's own post", () => {
    render(<PostCard post={{
        ...post,
        author: { _id: "viewer", name: "Current User" }
    }} />);

    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
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

    fireEvent.keyDown(screen.getByRole("button", { name: "Like" }), { key: "ArrowDown" });
    expect(screen.getByRole("group", { name: "Reactions" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Like" })).toHaveTextContent("Like");
    expect(screen.queryByRole("combobox", { name: "Choose a reaction" })).not.toBeInTheDocument();
    const loveReaction = screen.getByRole("button", { name: "Love (0)" });
    expect(loveReaction).toHaveTextContent("❤️");
    expect(loveReaction).not.toHaveTextContent("Love");
    fireEvent.click(loveReaction);
    expect(api.put).toHaveBeenCalledWith("/posts/post-1/reaction", { reaction: "love" });
    expect(screen.getByRole("button", { name: "Love reaction selected; activate to remove" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Reactions" })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "Love reaction selected; activate to remove" }), {
        key: "ArrowDown"
    });
    fireEvent.click(screen.getByRole("button", { name: "Love (1)" }));
    expect(api.put).toHaveBeenLastCalledWith("/posts/post-1/reaction", { reaction: null });

    fireEvent.keyDown(screen.getByRole("button", { name: "Like" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "Love (0)" }));
    expect(screen.getByRole("button", { name: "Love reaction selected; activate to remove" })).toHaveTextContent("3");
    fireEvent.keyDown(screen.getByRole("button", { name: "Love reaction selected; activate to remove" }), {
        key: "ArrowDown"
    });
    fireEvent.click(screen.getByRole("button", { name: "No reaction" }));
    expect(api.put).toHaveBeenLastCalledWith("/posts/post-1/reaction", { reaction: null });
});

test("reposts a public post", async () => {
    render(<PostCard post={post} />);

    fireEvent.click(screen.getByRole("button", { name: "Repost" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Post reposted.");
    expect(api.post).toHaveBeenCalledWith("/posts/post-1/repost");
});

test("post owners can edit a caption and audience", async () => {
    const ownedPost = {
        ...post,
        author: { _id: "viewer", name: "Viewer" }
    };
    const updatedPost = { ...ownedPost, caption: "Edited caption", visibility: "followers" };
    const onUpdated = jest.fn();
    api.patch.mockResolvedValue({ data: { data: updatedPost } });
    render(<PostCard post={ownedPost} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "More post options" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit post" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit post caption" }), {
        target: { value: "Edited caption" }
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Edit post audience" }), {
        target: { value: "followers" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Edited caption")).toBeVisible();
    expect(api.patch).toHaveBeenCalledWith("/posts/post-1", {
        caption: "Edited caption",
        visibility: "followers"
    });
    expect(onUpdated).toHaveBeenCalledWith(updatedPost);
    expect(screen.getByText("Followers only")).toBeVisible();
});

test("non-owners do not see post editing or removal controls", () => {
    render(<PostCard post={post} />);
    expect(screen.queryByRole("button", { name: "More post options" })).not.toBeInTheDocument();
});

test("owners can remove their post for everyone", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleted = jest.fn();
    api.delete.mockResolvedValue({});
    render(<PostCard post={{ ...post, author: { _id: "viewer", name: "Viewer" } }} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "More post options" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove post" }));
    expect(confirm).toHaveBeenCalledWith("Remove this post for everyone? This cannot be undone.");
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/posts/post-1"));
    expect(onDeleted).toHaveBeenCalledWith("post-1");
    confirm.mockRestore();
});

test("a post can be reposted and undone", async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    api.delete.mockResolvedValue({ data: { success: true } });
    render(<PostCard post={post} />);

    fireEvent.click(screen.getByRole("button", { name: "Repost" }));
    expect(await screen.findByRole("button", { name: "Undo repost" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo repost" }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/posts/post-1/repost"));
    expect(await screen.findByRole("button", { name: "Repost" })).toBeVisible();
});
