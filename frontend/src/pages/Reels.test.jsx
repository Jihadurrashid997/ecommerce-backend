import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import Reels from "./Reels";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props} />,
    useNavigate: () => jest.fn()
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: { _id: "viewer", role: "admin" } })
}));

const reel = {
    _id: "reel-1",
    kind: "reel",
    author: { _id: "creator-1", name: "Creator" },
    media: [{ url: "/reel.mp4" }],
    caption: "A new reel",
    likeCount: 3,
    commentCount: 2,
    views: 14,
    isFollowedByMe: false
};

const originalIntersectionObserver = global.IntersectionObserver;
const originalClipboard = navigator.clipboard;

beforeEach(() => {
    jest.clearAllMocks();
    global.IntersectionObserver = jest.fn(function () {
        this.observe = jest.fn();
        this.disconnect = jest.fn();
    });
    api.get.mockResolvedValue({ data: { data: [reel], nextCursor: null } });
    api.post.mockResolvedValue({ data: { isFollowing: true, isFollowRequestPending: false } });
    api.put.mockResolvedValue({});
});

afterAll(() => {
    global.IntersectionObserver = originalIntersectionObserver;
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard
    });
});

test("shows a follow control for another creator and keeps its Following state", async () => {
    render(<Reels />);

    expect(await screen.findByRole("button", { name: "Like" })).toHaveClass("facebook-reaction-trigger");
    fireEvent.keyDown(screen.getByRole("button", { name: "Like" }), { key: "ArrowDown" });
    expect(screen.getByRole("group", { name: "Reactions" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete reel" })).not.toBeInTheDocument();

    const followButton = await screen.findByRole("button", { name: "Follow" });
    fireEvent.click(followButton);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/follow/creator-1"));
    expect(await screen.findByRole("button", { name: "Unfollow" })).toHaveTextContent("Following");
});

test("shows the delete control only on the current user's own reel", async () => {
    api.get.mockResolvedValueOnce({
        data: {
            data: [{ ...reel, author: { _id: "viewer", name: "Viewer" } }],
            nextCursor: null
        }
    });

    render(<Reels />);

    expect(await screen.findByRole("button", { name: "Delete reel" })).toBeVisible();
});

test("shares a reel link and exposes view and mute controls accessibly", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText }
    });

    render(<Reels />);

    expect(await screen.findByLabelText("14 views")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unmute reel" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Share reel" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/post/reel-1`
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Reel link copied.");
});

test("retries a failed feed load and opens and closes the reel upload dialog", async () => {
    api.get
        .mockRejectedValueOnce({ response: { data: { message: "Reels unavailable" } } })
        .mockResolvedValueOnce({ data: { data: [reel], nextCursor: null } });

    render(<Reels />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Reels unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Follow" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Reel/ }));
    expect(screen.getByRole("dialog", { name: "New reel" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close reel upload" }));
    expect(screen.queryByRole("dialog", { name: "New reel" })).not.toBeInTheDocument();
});
