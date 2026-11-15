import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import Reels from "./Reels";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
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

    const reactionButton = await screen.findByRole("button", { name: "Like" });
    expect(reactionButton).toHaveClass("facebook-reaction-trigger");
    expect(reactionButton.closest(".reel-reaction-picker")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Like" }), { key: "ArrowDown" });
    expect(screen.getByRole("group", { name: "Reactions" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete reel" })).not.toBeInTheDocument();

    const followButton = await screen.findByRole("button", { name: "Follow" });
    const authorRow = followButton.closest(".reel-author-row");
    expect(authorRow).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Creator/ }).parentElement).toBe(authorRow);
    fireEvent.click(followButton);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/follow/creator-1"));
    expect(await screen.findByRole("button", { name: "Unfollow" })).toHaveTextContent("Following");
});

test("sizes the Reel stage to its video's aspect ratio", async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    render(<Reels />);
    const video = await screen.findByLabelText("Play reel");
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 1920 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 1080 });

    fireEvent.loadedMetadata(video);

    expect(video.closest(".reel-item")).toHaveStyle({ width: "900px" });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
});

test("keeps the Reel stage within mobile viewport width", async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    render(<Reels />);

    const video = await screen.findByLabelText("Play reel");
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 1920 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 1080 });
    fireEvent.loadedMetadata(video);

    expect(video.closest(".reel-item")).toHaveStyle({ width: "390px" });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
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

test("video clicks toggle playback and reveal 10-second seek controls for two seconds", async () => {
    render(<Reels />);
    const video = await screen.findByLabelText("Play reel");
    jest.useFakeTimers();
    try {
        Object.defineProperty(video, "paused", { configurable: true, writable: true, value: true });
        Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 20 });
        Object.defineProperty(video, "duration", { configurable: true, value: 35 });
        video.play = jest.fn().mockResolvedValue(undefined);
        video.pause = jest.fn();

        fireEvent.click(video);
        expect(video.play).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Rewind 10 seconds" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Forward 10 seconds" })).toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
        expect(video.currentTime).toBe(30);
        fireEvent.click(screen.getByRole("button", { name: "Rewind 10 seconds" }));
        expect(video.currentTime).toBe(20);

        act(() => jest.advanceTimersByTime(2000));
        expect(screen.queryByRole("button", { name: "Rewind 10 seconds" })).not.toBeInTheDocument();

        video.paused = false;
        fireEvent.click(video);
        expect(video.pause).toHaveBeenCalledTimes(1);
    } finally {
        jest.useRealTimers();
    }
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
