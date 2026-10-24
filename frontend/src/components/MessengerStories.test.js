import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import MessengerStories from "./MessengerStories";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn()
    },
    getUploadUrl: value => value
}));

const me = { _id: "me", name: "Me" };
const story = {
    _id: "status-1",
    owner: { _id: "friend", name: "Friend" },
    text: "Hello from today",
    media: { url: "", type: "" },
    audience: "followers",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    viewedByMe: false,
    viewersCount: 0
};

beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => "blob:story-photo");
    URL.revokeObjectURL = jest.fn();
    api.get.mockResolvedValue({ data: { data: [] } });
    api.post.mockResolvedValue({ data: { data: story } });
});

afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
});

test("loads and opens a follower status, recording the view", async () => {
    api.get.mockResolvedValue({ data: { data: [story] } });
    render(<MessengerStories active currentUser={me} />);

    const statusButton = await screen.findByRole("button", {
        name: "Friend's status, 1 item(s)"
    });
    fireEvent.click(statusButton);

    expect(await screen.findByText("Hello from today"))
        .toBeInTheDocument();
    await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/stories/status-1/view");
    });
});

test("keeps a visible close control alongside own-status actions", async () => {
    api.get.mockResolvedValue({
        data: { data: [{ ...story, owner: me }] }
    });
    render(<MessengerStories active currentUser={me} />);

    fireEvent.click(await screen.findByRole("button", {
        name: "Your's status, 1 item(s)"
    }));

    const viewer = await screen.findByRole("dialog", { name: "Status viewer" });
    expect(viewer.parentElement).toHaveClass("messenger-story-fullscreen");
    const closeButton = screen.getByRole("button", { name: "Close status" });
    expect(closeButton).toHaveTextContent("Close");
    expect(closeButton).toBeVisible();
    expect(screen.getByRole("button", { name: /0 views/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete status" })).toBeVisible();

    fireEvent.click(closeButton);
    expect(viewer).not.toBeInTheDocument();
});

test("publishes a text status with follower-only audience by default", async () => {
    render(<MessengerStories active currentUser={me} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add status" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Status text" }), {
        target: { value: "A new status" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Share status" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/stories",
        expect.any(FormData),
        expect.objectContaining({ onUploadProgress: expect.any(Function) })
    ));
    expect(screen.queryByRole("dialog", { name: "Create status" }))
        .not.toBeInTheDocument();
});

test("Home story composer accepts photos and rejects video files", async () => {
    const { container } = render(<MessengerStories active currentUser={me} allowVideo={false} home />);
    fireEvent.click(await screen.findByRole("button", { name: "Add story" }));
    expect(screen.getByText("Add photo (up to 20MB)")).toBeVisible();
    const fileInput = container.querySelector(".messenger-story-file input");
    const video = new File(["video"], "clip.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput, { target: { files: [video] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a photo for your story.");
    expect(fileInput).toHaveAttribute("accept", "image/*");
    expect(api.post).not.toHaveBeenCalled();
});

test("Home story composer publishes a selected photo", async () => {
    const photoStory = {
        ...story,
        _id: "new-story",
        owner: me,
        text: "A photo story",
        media: { url: "/photo.jpg", type: "image" },
        audience: "followers"
    };
    api.post.mockResolvedValue({ data: { data: photoStory } });
    const { container } = render(<MessengerStories active currentUser={me} allowVideo={false} home />);
    fireEvent.click(await screen.findByRole("button", { name: "Add story" }));
    const photo = new File(["image"], "story.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector(".messenger-story-file input"), {
        target: { files: [photo] }
    });
    expect(await screen.findByRole("img", { name: "Story photo preview" }))
        .toHaveAttribute("src", "blob:story-photo");
    fireEvent.click(screen.getByRole("button", { name: "Share story" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/stories/home",
        expect.any(FormData),
        expect.objectContaining({ onUploadProgress: expect.any(Function) })
    ));
    expect(api.post.mock.calls[0][1].get("media")).toEqual(photo);
});

test("existing Messenger status composer still accepts supported video stories", async () => {
    const video = new File(["video"], "status.mp4", { type: "video/mp4" });
    const { container } = render(<MessengerStories active currentUser={me} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add status" }));
    const fileInput = container.querySelector(".messenger-story-file input");
    fireEvent.change(fileInput, { target: { files: [video] } });
    expect(screen.getByText("status.mp4")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Status text" }), {
        target: { value: "Video status" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Share status" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/stories",
        expect.any(FormData),
        expect.objectContaining({ onUploadProgress: expect.any(Function) })
    ));
    expect(api.post.mock.calls[0][1].get("media")).toEqual(video);
});

test("displays story loading failures instead of an empty status list", async () => {
    api.get.mockRejectedValueOnce({
        response: { data: { message: "Status service is unavailable." } }
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    render(<MessengerStories active currentUser={me} />);

    expect(await screen.findByRole("alert"))
        .toHaveTextContent("Status service is unavailable.");
});
