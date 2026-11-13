import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import SocialFollowButton from "./SocialFollowButton";

jest.mock("../services/api", () => ({
    __esModule: true,
    default: { post: jest.fn() }
}));

test("follows a person and reports the resulting relationship", async () => {
    const onFollowChange = jest.fn();
    api.post.mockResolvedValue({
        data: { isFollowing: true, isFollowRequestPending: false, action: "followed" }
    });

    render(<SocialFollowButton userId="person-1" onFollowChange={onFollowChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users/follow/person-1"));
    expect(await screen.findByRole("button", { name: "Unfollow" }))
        .toHaveTextContent("Following");
    expect(onFollowChange).toHaveBeenCalledWith({
        isFollowing: true,
        isFollowRequestPending: false,
        action: "followed"
    });
});
