import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Communities from "./Communities";
import api from "../services/api";

jest.mock("react-router-dom", () => ({
    Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => jest.fn(),
    useParams: () => ({ id: global.__communityTestId || undefined })
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
    useApp: () => ({ user: { _id: "current-user" } })
}));

jest.mock("../components/PostCard", () => () => <div data-testid="community-post-card" />);

const renderRoute = () => render(
    <Communities />
);

beforeEach(() => {
    jest.clearAllMocks();
});

test("community directory switches between joined and discovery lists", async () => {
    global.__communityTestId = undefined;
    api.get.mockImplementation(path => Promise.resolve({
        data: {
            data: path.endsWith("/mine")
                ? []
                : [{
                      _id: "community-1",
                      name: "Dhaka Photography",
                      description: "Share your photos.",
                      privacy: "public",
                      membersCount: 12,
                      membershipStatus: "none"
                  }]
        }
    }));

    renderRoute();
    fireEvent.click(screen.getByRole("tab", { name: "Discover" }));

    expect(await screen.findByText("Dhaka Photography")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
});

test("private community posts remain hidden until membership is granted", async () => {
    global.__communityTestId = "private-1";
    api.get.mockImplementation(path => {
        if (path === "/communities/private-1") {
            return Promise.resolve({
                data: {
                    data: {
                        _id: "private-1",
                        name: "Private Writers",
                        description: "Members only.",
                        privacy: "private",
                        isMember: false,
                        isAdmin: false,
                        membershipStatus: "none",
                        membersCount: 4,
                        createdBy: { name: "Creator" }
                    }
                }
            });
        }

        throw new Error(`Unexpected API call: ${path}`);
    });

    renderRoute();

    expect(await screen.findByText("This community is private")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request to join" })).toBeInTheDocument();
    await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId("community-post-card")).not.toBeInTheDocument();
});
