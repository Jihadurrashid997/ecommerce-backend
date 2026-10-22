import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../services/api";
import SearchResults from "./SearchResults";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
    const ReactForLink = require("react");
    return {
        Link: ({ to, children, ...props }) => ReactForLink.createElement(
            "a",
            { href: to, ...props },
            children
        ),
        useNavigate: () => mockNavigate,
        useSearchParams: () => [
            new URLSearchParams(globalThis.location.search)
        ]
    };
});

jest.mock("../services/api", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        defaults: { baseURL: "https://example.test/api" }
    }
}));

const renderSearch = path => {
    window.history.pushState({}, "", path);
    return render(<SearchResults />);
};

beforeEach(() => {
    mockNavigate.mockReset();
    api.get.mockResolvedValue({ data: { users: [] } });
});

test("search page provides a search form when opened without a query", () => {
    renderSearch("/search");

    expect(screen.getByRole("heading", { name: "Search people" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search people" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
});

test("submitting a mobile search navigates to the results query", () => {
    renderSearch("/search");

    const input = screen.getByRole("searchbox", { name: "Search people" });
    fireEvent.change(input, { target: { value: "Jihadur" } });
    fireEvent.submit(input.closest("form"));

    expect(mockNavigate).toHaveBeenCalledWith("/search?q=Jihadur");
});

test("query results fetch and display people matches", async () => {
    renderSearch("/search?q=Jihadur");

    expect(await screen.findByText(/No people found for/)).toBeVisible();
    await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith("/users/search?q=Jihadur", { timeout: 12000 });
    });
    expect(screen.getByRole("searchbox", { name: "Search people" })).toHaveValue("Jihadur");
});
