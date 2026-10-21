import React from "react";
import { render, screen } from "@testing-library/react";
import TopTabs from "./TopTabs";
import { useApp } from "../context/AppContext";

jest.mock("../context/AppContext", () => ({
    useApp: jest.fn()
}));

jest.mock("react-router-dom", () => {
    const React = jest.requireActual("react");
    return {
        NavLink: props => {
            const { to, className, ...linkProps } = props;
            delete linkProps.end;
            return (
                <a
                    href={to}
                    className={typeof className === "function"
                        ? className({ isActive: false })
                        : className}
                    {...linkProps}
                />
            );
        }
    };
});

const renderTopTabs = unreadMessengerCount => {
    useApp.mockReturnValue({ unreadMessengerCount });
    return render(<TopTabs />);
};

test("shows the unread Messenger count over its navigation tab", () => {
    renderTopTabs(3);

    expect(screen.getByRole("link", { name: "MESSENGER, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
});

test("caps large unread Messenger counts at 99+", () => {
    renderTopTabs(120);

    expect(screen.getByRole("link", { name: "MESSENGER, 120 unread" })).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
});

test("does not show a Messenger badge when there are no unread messages", () => {
    renderTopTabs(0);

    expect(screen.getByRole("link", { name: "MESSENGER" })).toBeInTheDocument();
    expect(screen.queryByText("99+")).not.toBeInTheDocument();
});
