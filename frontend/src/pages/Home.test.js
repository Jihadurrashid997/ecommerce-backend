import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Home from "./Home";
import api from "../services/api";
import { clearHomeDraft, loadHomeDraft, saveHomeDraft } from "../services/homeDraft";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn()
    },
    getUploadUrl: value => value
}));

jest.mock("../services/homeDraft", () => ({
    loadHomeDraft: jest.fn().mockResolvedValue(null),
    saveHomeDraft: jest.fn().mockResolvedValue(undefined),
    clearHomeDraft: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../context/AppContext", () => ({
    useApp: () => ({ user: { _id: "current-user", name: "Current User" } })
}));

jest.mock("../components/PostCard", () => ({ post }) => <article>{post.caption}</article>);

jest.mock("../components/MessengerStories", () => ({ allowVideo, home }) => (
    <section aria-label={home ? "Stories" : "Messenger statuses"} data-video-upload={allowVideo}>
        <button type="button" aria-label={home ? "Add story" : "Add status"}>Add</button>
    </section>
));

beforeEach(() => {
    jest.clearAllMocks();
    loadHomeDraft.mockResolvedValue(null);
    saveHomeDraft.mockResolvedValue(undefined);
    clearHomeDraft.mockResolvedValue(undefined);
    URL.createObjectURL = jest.fn(() => "blob:post-photo");
    URL.revokeObjectURL = jest.fn();
    api.get.mockImplementation(path => Promise.resolve({
        data: path === "/users/following"
            ? { users: [{ _id: "friend-1", name: "A friend" }] }
            : path === "/users/suggestions"
                ? { data: [] }
            : { data: [], nextCursor: null }
    }));
});

afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
});

test("photo feed posts include the selected audience and reset to public", async () => {
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

    const { container } = render(<Home />);

    const audience = await screen.findByRole("combobox", { name: "Post audience" });
    fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [new File(["photo"], "moment.jpg", { type: "image/jpeg" })] }
    });
    fireEvent.change(audience, { target: { value: "followers" } });
    fireEvent.change(screen.getByPlaceholderText("Write a caption for your photos..."), {
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
    expect(api.post.mock.calls[0][1].getAll("photos")).toHaveLength(1);
    await waitFor(() => expect(audience).toHaveValue("public"));
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
});

test("Home includes a story bar configured to allow photo-only story uploads", async () => {
    render(<Home />);
    const stories = await screen.findByRole("region", { name: "Stories" });
    expect(stories).toHaveAttribute("data-video-upload", "false");
    expect(screen.getByRole("button", { name: "Add story" })).toBeVisible();
    expect(screen.getByPlaceholderText("Write a caption for your photos...")).toBeVisible();
});

test("follow suggestions appear in Instagram-style cards with mutuals and dismissal", async () => {
    api.get.mockImplementation(path => Promise.resolve({
        data: path === "/users/following"
            ? { users: [] }
            : path === "/users/suggestions"
                ? {
                    data: [
                        {
                            _id: "suggestion-1",
                            name: "Suggested One",
                            mutualConnections: 2,
                            profileImage: "/suggested.jpg",
                            mutualProfiles: [{
                                _id: "mutual-1",
                                name: "Mutual One",
                                profileImage: "/mutual.jpg"
                            }]
                        },
                        { _id: "suggestion-2", name: "Suggested Two" },
                        { _id: "suggestion-3", name: "Suggested Three" },
                        { _id: "suggestion-4", name: "Suggested Four" },
                        { _id: "suggestion-5", name: "Suggested Five" }
                    ]
                }
                : { data: [], nextCursor: null }
    }));

    render(<Home />);

    const suggestions = await screen.findByRole("region", { name: "Suggested for you" });
    expect(within(suggestions).getByRole("link", { name: "Suggested One" }))
        .toHaveAttribute("href", "/user/suggestion-1");
    expect(within(suggestions).getByText("2 mutuals")).toBeVisible();
    expect(within(suggestions).getByRole("link", { name: "View Mutual One profile" }))
        .toHaveAttribute("href", "/user/mutual-1");
    expect(within(suggestions).getByRole("button", { name: "Show suggestion page 2" }))
        .toBeVisible();

    fireEvent.click(within(suggestions).getByRole("button", {
        name: "Dismiss Suggested One suggestion"
    }));
    expect(within(suggestions).queryByRole("link", { name: "Suggested One" })).not.toBeInTheDocument();
});

test("requires at least one photo before sharing a Home post", async () => {
    render(<Home />);
    const caption = await screen.findByPlaceholderText("Write a caption for your photos...");
    fireEvent.change(caption, { target: { value: "A caption by itself" } });

    expect(screen.getByRole("button", { name: /Share post/ })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
});

test("photo uploads send the selected image and show upload progress", async () => {
    let finishUpload;
    api.post.mockImplementation((path, form, options) => {
        options.onUploadProgress({ loaded: 5, total: 10 });
        return new Promise(resolve => {
            finishUpload = () => resolve({
                data: {
                    data: {
                        _id: "photo-post",
                        author: { _id: "current-user", name: "Current User" },
                        caption: "A sunny day",
                        visibility: "public",
                        media: [{ url: "/photo.jpg", type: "image" }],
                        createdAt: new Date().toISOString()
                    }
                }
            });
        });
    });

    const { container } = render(<Home />);
    const photo = new File(["photo-bytes"], "sunny-day.jpg", { type: "image/jpeg" });
    const fileInput = container.querySelector('input[type="file"]');
    await waitFor(() => expect(fileInput).toBeEnabled());
    fireEvent.change(fileInput, {
        target: { files: [photo] }
    });
    fireEvent.change(screen.getByPlaceholderText("Write a caption for your photos..."), {
        target: { value: "  A sunny day  " }
    });

    fireEvent.click(screen.getByRole("button", { name: /Share post/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/posts",
        expect.any(FormData),
        expect.objectContaining({
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: expect.any(Function)
        })
    ));
    const form = api.post.mock.calls[0][1];
    expect(form.getAll("photos")).toEqual([photo]);
    expect(form.get("caption")).toBe("A sunny day");
    expect(form.get("visibility")).toBe("public");
    expect(await screen.findByRole("button", { name: /Sharing 50%/ })).toBeDisabled();

    finishUpload();
    expect(await screen.findByRole("article")).toBeInTheDocument();
    await waitFor(() => {
        expect(screen.getByPlaceholderText("Write a caption for your photos...")).toHaveValue("");
        expect(screen.getByRole("button", { name: /Share post/ })).toBeDisabled();
    });
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
});

test("photo posts include the selected, rights-confirmed soundtrack segment", async () => {
    api.post.mockResolvedValue({
        data: { data: { _id: "photo-audio-post", caption: "With music", media: [] } }
    });
    const { container } = render(<Home />);
    const photo = new File(["photo"], "moment.jpg", { type: "image/jpeg" });
    const photoInput = container.querySelector('input[type="file"]');
    await waitFor(() => expect(photoInput).toBeEnabled());
    fireEvent.change(photoInput, {
        target: { files: [photo] }
    });
    const soundtrack = new File(["ID3audio"], "original.mp3", { type: "audio/mpeg" });
    fireEvent.change(container.querySelector(".home-audio-picker input"), {
        target: { files: [soundtrack] }
    });
    const preview = container.querySelector(".home-audio-preview audio");
    Object.defineProperty(preview, "duration", { configurable: true, value: 42 });
    fireEvent.loadedMetadata(preview);
    await screen.findByRole("slider", { name: "Soundtrack start time" });
    fireEvent.click(screen.getByLabelText("I own this audio or have permission to use it."));
    fireEvent.change(screen.getByPlaceholderText("Write a caption for your photos..."), {
        target: { value: "With music" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Share post/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/posts",
        expect.any(FormData),
        expect.objectContaining({ onUploadProgress: expect.any(Function) })
    ));
    const form = api.post.mock.calls[0][1];
    expect(form.get("audio")).toEqual(soundtrack);
    expect(form.get("audioStartSeconds")).toBe("0");
    expect(form.get("audioDurationSeconds")).toBe("30");
    expect(form.get("audioRightsConfirmed")).toBe("true");
});

test("photo posts include alt text, a place, and selected people tags", async () => {
    api.get.mockImplementation(path => {
        if (path === "/users/search") {
            return Promise.resolve({
                data: { users: [{ _id: "tagged-person", name: "Tagged Person" }] }
            });
        }
        if (path === "/users/following") return Promise.resolve({ data: { users: [] } });
        if (path === "/users/suggestions") return Promise.resolve({ data: [] });
        return Promise.resolve({ data: [], nextCursor: null });
    });
    api.post.mockResolvedValue({
        data: { data: { _id: "post-with-tags", media: [] } }
    });
    const { container } = render(<Home />);
    const photoInput = container.querySelector('input[type="file"]');
    await waitFor(() => expect(photoInput).toBeEnabled());
    fireEvent.change(photoInput, {
        target: { files: [new File(["photo"], "place.jpg", { type: "image/jpeg" })] }
    });
    fireEvent.change(screen.getByLabelText("Photo 1 description (for screen readers)"), {
        target: { value: "A quiet mountain lake" }
    });
    fireEvent.change(screen.getByPlaceholderText("Add a place name (no precise location)"), {
        target: { value: "Lake District" }
    });
    fireEvent.change(screen.getByPlaceholderText("Search people by name"), {
        target: { value: "Tagged" }
    });
    fireEvent.click(await screen.findByRole("option", { name: "Tagged Person" }));
    fireEvent.click(screen.getByRole("button", { name: /Share post/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
        "/posts",
        expect.any(FormData),
        expect.objectContaining({ onUploadProgress: expect.any(Function) })
    ));
    const form = api.post.mock.calls[0][1];
    expect(JSON.parse(form.get("altTexts"))).toEqual(["A quiet mountain lake"]);
    expect(JSON.parse(form.get("taggedUsers"))).toEqual(["tagged-person"]);
    expect(form.get("location")).toBe("Lake District");
});

test("rejects unsupported and oversized photos before publishing", async () => {
    const { container } = render(<Home />);
    const fileInput = container.querySelector('input[type="file"]');
    await waitFor(() => expect(fileInput).toBeEnabled());

    fireEvent.change(fileInput, {
        target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] }
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPG, PNG, WebP, GIF, or HEIC image.");
    expect(container.querySelector(".composer-thumb")).not.toBeInTheDocument();

    fireEvent.change(fileInput, {
        target: {
            files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.jpg", {
                type: "image/jpeg"
            })]
        }
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Each photo must be under 10MB.");
    expect(container.querySelector(".composer-thumb")).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
});

test("limits a post to five uploaded photos", async () => {
    api.post.mockResolvedValue({
        data: {
            data: {
                _id: "photo-post",
                caption: "Five photos",
                media: [],
                createdAt: new Date().toISOString()
            }
        }
    });
    const { container } = render(<Home />);
    const photos = Array.from({ length: 6 }, (_, index) =>
        new File([`photo-${index}`], `photo-${index}.jpg`, { type: "image/jpeg" })
    );

    const fileInput = container.querySelector('input[type="file"]');
    await waitFor(() => expect(fileInput).toBeEnabled());
    fireEvent.change(fileInput, {
        target: { files: photos }
    });
    expect(screen.getByRole("alert")).toHaveTextContent("You can add up to 5 photos.");
    expect(container.querySelectorAll(".composer-thumb")).toHaveLength(5);
    fireEvent.change(screen.getByPlaceholderText("Write a caption for your photos..."), {
        target: { value: "Five photos" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Share post/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].getAll("photos")).toHaveLength(5);
    expect(api.post.mock.calls[0][1].getAll("photos")).toEqual(photos.slice(0, 5));
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
});

test("keeps the draft available when photo publishing fails", async () => {
    api.post.mockRejectedValue({
        response: { data: { message: "Upload failed. Try again." } }
    });
    const { container } = render(<Home />);
    const photo = new File(["photo"], "moment.jpg", { type: "image/jpeg" });
    const fileInput = container.querySelector('input[type="file"]');
    await waitFor(() => expect(fileInput).toBeEnabled());
    fireEvent.change(fileInput, {
        target: { files: [photo] }
    });
    const caption = screen.getByPlaceholderText("Write a caption for your photos...");
    fireEvent.change(caption, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: /Share post/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed. Try again.");
    expect(caption).toHaveValue("Keep this draft");
    expect(container.querySelectorAll(".composer-thumb")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Retry upload" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry upload" }));
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(clearHomeDraft).not.toHaveBeenCalled();
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
});

test("restores the user's Home draft, including selected photos", async () => {
    const photo = new File(["photo"], "saved.jpg", { type: "image/jpeg" });
    loadHomeDraft.mockResolvedValueOnce({
        caption: "Restored caption",
        visibility: "private",
        files: [photo]
    });
    const { container } = render(<Home />);

    expect(await screen.findByPlaceholderText("Write a caption for your photos..."))
        .toHaveValue("Restored caption");
    expect(screen.getByRole("combobox", { name: "Post audience" })).toHaveValue("private");
    expect(container.querySelectorAll(".composer-thumb")).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft"));
    expect(loadHomeDraft).toHaveBeenCalledWith("current-user");
});

test("autosaves non-empty Home drafts for the current user", async () => {
    render(<Home />);
    const caption = await screen.findByPlaceholderText("Write a caption for your photos...");
    fireEvent.change(caption, { target: { value: "A saved thought" } });

    await waitFor(() => expect(saveHomeDraft).toHaveBeenCalledWith(
        "current-user",
        expect.objectContaining({
            caption: "A saved thought",
            visibility: "public",
            files: []
        })
    ), { timeout: 2000 });
});

test("clears the saved Home draft only after a successful publish", async () => {
    api.post.mockResolvedValue({
        data: { data: { _id: "published-post", caption: "Publish this", media: [] } }
    });
    const { container } = render(<Home />);
    fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [new File(["photo"], "moment.jpg", { type: "image/jpeg" })] }
    });
    fireEvent.change(await screen.findByPlaceholderText("Write a caption for your photos..."), {
        target: { value: "Publish this" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Share post" }));

    await waitFor(() => expect(clearHomeDraft).toHaveBeenCalledWith("current-user"));
    expect(screen.getByPlaceholderText("Write a caption for your photos...")).toHaveValue("");
});

test("loads additional feed posts using the next cursor", async () => {
    const post = (id, caption) => ({
        _id: id,
        caption,
        author: { _id: "friend-1", name: "A friend" },
        media: [],
        createdAt: new Date().toISOString()
    });
    let feedRequest = 0;
    api.get.mockImplementation(path => {
        if (path === "/users/following") {
            return Promise.resolve({ data: { users: [{ _id: "friend-1", name: "A friend" }] } });
        }
        if (path === "/users/suggestions") {
            return Promise.resolve({ data: { data: [] } });
        }

        feedRequest += 1;
        return Promise.resolve({
            data: feedRequest === 1
                ? { data: [post("post-1", "First post")], nextCursor: "cursor-1" }
                : { data: [post("post-1", "First post"), post("post-2", "Second post")], nextCursor: null }
        });
    });

    render(<Home />);

    expect(await screen.findByText("First post")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Discover more/ }));

    expect(await screen.findByText("Second post")).toBeVisible();
    expect(screen.getAllByText("First post")).toHaveLength(1);
    expect(api.get).toHaveBeenLastCalledWith("/posts/feed", {
        params: { scope: "for-you", before: "cursor-1" }
    });
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
});

test("switches between the For you and Following feeds", async () => {
    render(<Home />);

    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Following 1" }));

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/posts/feed", {
        params: { scope: "following" }
    }));
    expect(screen.getByRole("button", { name: "Following 1" })).toHaveClass("active");
    fireEvent.click(screen.getByRole("button", { name: "For you" }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/posts/feed", {
        params: { scope: "for-you" }
    }));
});

test("shows feed errors and retries the feed request", async () => {
    let feedRequest = 0;
    api.get.mockImplementation(path => {
        if (path === "/users/following") {
            return Promise.resolve({ data: { users: [{ _id: "friend-1", name: "A friend" }] } });
        }
        if (path === "/users/suggestions") {
            return Promise.resolve({ data: { data: [] } });
        }

        feedRequest += 1;
        return feedRequest === 1
            ? Promise.reject({ response: { data: { message: "Feed unavailable" } } })
            : Promise.resolve({ data: { data: [], nextCursor: null } });
    });

    render(<Home />);

    expect(await screen.findByText("Feed unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("A blank canvas.")).toBeVisible();
    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
    expect(feedRequest).toBe(2);
});

test("shows a retry action when the following list cannot be loaded", async () => {
    let followingRequest = 0;
    api.get.mockImplementation(path => {
        if (path === "/users/following") {
            followingRequest += 1;
            return followingRequest === 1
                ? Promise.reject({ response: { data: { message: "Circle unavailable" } } })
                : Promise.resolve({ data: { users: [{ _id: "friend-1", name: "A friend" }] } });
        }
        if (path === "/users/suggestions") {
            return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: [], nextCursor: null } });
    });

    render(<Home />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Circle unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: /A friend/ })).toBeVisible();
    expect(followingRequest).toBe(2);
});

test("shows follow suggestions and removes a person after following", async () => {
    api.get.mockImplementation(path => Promise.resolve({
        data: path === "/users/following"
            ? { users: [] }
            : path === "/users/suggestions"
                ? { data: [{ _id: "suggested-1", name: "Suggested creator", mutualConnections: 2 }] }
                : { data: [], nextCursor: null }
    }));
    api.post.mockResolvedValue({ data: { isFollowing: true, action: "followed" } });

    render(<Home />);
    expect(await screen.findByText("Suggested creator")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/follow/suggested-1"));
    await waitFor(() => expect(screen.queryByText("Suggested creator")).not.toBeInTheDocument());
});
