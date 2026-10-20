import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import MessengerStories from "./MessengerStories";

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
    api.get.mockResolvedValue({ data: { data: [] } });
    api.post.mockResolvedValue({ data: { data: story } });
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

test("publishes a text status with follower-only audience by default", async () => {
    render(<MessengerStories active currentUser={me} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add status" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Status text" }), {
        target: { value: "A new status" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Share status" }));

    await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
            "/stories",
            expect.any(FormData)
        );
    });
    expect(screen.queryByRole("dialog", { name: "Create status" }))
        .not.toBeInTheDocument();
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
