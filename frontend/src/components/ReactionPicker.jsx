import React, { useState } from "react";

const REACTIONS = [
    { value: "like", label: "Like", emoji: "👍" },
    { value: "love", label: "Love", emoji: "❤️" },
    { value: "haha", label: "Haha", emoji: "😂" },
    { value: "wow", label: "Wow", emoji: "😮" },
    { value: "sad", label: "Sad", emoji: "😢" },
    { value: "angry", label: "Angry", emoji: "😡" }
];

const ReactionPicker = ({ reaction, reactionCounts = {}, onSelect }) => {
    const [open, setOpen] = useState(false);
    const selected = REACTIONS.find(item => item.value === reaction);

    const chooseReaction = value => {
        onSelect(reaction === value ? null : value);
        setOpen(false);
    };

    return (
        <div
            className="reaction-picker"
            onPointerEnter={event => {
                if (event.pointerType === "mouse") setOpen(true);
            }}
            onPointerLeave={event => {
                if (event.pointerType === "mouse") setOpen(false);
            }}
            onKeyDown={event => {
                if (event.key === "Escape") setOpen(false);
            }}
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
        >
            <button
                type="button"
                className={`reaction-picker-trigger${selected ? " selected" : ""}`}
                aria-label={selected ? `${selected.label} reaction selected; choose reaction` : "Choose reaction"}
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
            >
                <span aria-hidden="true">{selected?.emoji || "☺"}</span>
            </button>
            {open && (
                <div className="reaction-picker-options" role="group" aria-label="Reactions">
                    {REACTIONS.map(item => (
                        <button
                            key={item.value}
                            type="button"
                            className={reaction === item.value ? "selected" : ""}
                            aria-label={`${item.label} (${reactionCounts[item.value] || 0})`}
                            aria-pressed={reaction === item.value}
                            title={item.label}
                            onClick={() => chooseReaction(item.value)}
                        >
                            <span aria-hidden="true">{item.emoji}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReactionPicker;
