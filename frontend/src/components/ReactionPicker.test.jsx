import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ReactionPicker from "./ReactionPicker";

test("keeps the reaction tray inside the viewport on narrow screens", () => {
    const originalInnerWidth = window.innerWidth;
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 290 });
    jest.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
        if (this.classList?.contains("reaction-picker-trigger")) {
            return { left: 78, top: 440, width: 30, height: 30, right: 108, bottom: 470 };
        }
        if (this.classList?.contains("reaction-picker-options")) {
            return { left: 0, top: 0, width: 251, height: 50, right: 251, bottom: 50 };
        }
        return originalGetBoundingClientRect.call(this);
    });

    try {
        render(<ReactionPicker onSelect={jest.fn()} />);
        fireEvent.keyDown(screen.getByRole("button", { name: "Like" }), {
            key: "ArrowDown"
        });

        const tray = screen.getByRole("group", { name: "Reactions" });
        expect(tray).toHaveStyle({ left: "8px", top: "382px" });
        expect(screen.getAllByRole("button", { name: /\(\d+\)$/ })).toHaveLength(6);
        expect(screen.getByRole("button", { name: "No reaction" })).toBeVisible();
    } finally {
        Element.prototype.getBoundingClientRect.mockRestore();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    }
});

test("clicking the trigger toggles the Like reaction", () => {
    const onSelect = jest.fn();
    render(<ReactionPicker onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onSelect).toHaveBeenLastCalledWith("like");

    render(<ReactionPicker reaction="like" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /reaction selected/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
});
