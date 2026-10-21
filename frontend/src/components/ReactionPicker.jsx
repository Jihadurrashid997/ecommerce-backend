import React, { useLayoutEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";

const REACTIONS = [
    { value: "like", label: "Like", emoji: "👍" },
    { value: "love", label: "Love", emoji: "❤️" },
    { value: "haha", label: "Haha", emoji: "😂" },
    { value: "wow", label: "Wow", emoji: "😮" },
    { value: "sad", label: "Sad", emoji: "😢" },
    { value: "angry", label: "Angry", emoji: "😡" }
];

const ReactionPicker = ({ reaction, reactionCounts = {}, likeCount = 0, onSelect }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const pickerRef = useRef(null);
    const optionsRef = useRef(null);
    const selected = REACTIONS.find(item => item.value === reaction);

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return undefined;
        }

        const trigger = pickerRef.current?.querySelector(".reaction-picker-trigger");
        const options = optionsRef.current;
        if (!trigger || !options) return undefined;

        const triggerRect = trigger.getBoundingClientRect();
        const optionsRect = options.getBoundingClientRect();
        const gutter = 8;
        const left = Math.max(
            gutter,
            Math.min(
                triggerRect.left + triggerRect.width / 2 - optionsRect.width / 2,
                window.innerWidth - optionsRect.width - gutter
            )
        );
        const top = Math.max(gutter, triggerRect.top - optionsRect.height - gutter);
        setPosition({ left, top });

        const closeOnViewportChange = () => setOpen(false);
        window.addEventListener("resize", closeOnViewportChange);
        window.addEventListener("scroll", closeOnViewportChange, true);
        return () => {
            window.removeEventListener("resize", closeOnViewportChange);
            window.removeEventListener("scroll", closeOnViewportChange, true);
        };
    }, [open]);

    const chooseReaction = value => {
        onSelect(reaction === value ? null : value);
        setOpen(false);
    };

    const clearReaction = () => {
        if (reaction) onSelect(null);
        setOpen(false);
    };

    return (
        <div
            ref={pickerRef}
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
                <span className="reaction-picker-label">{selected ? selected.label : "React"}</span>
                <span className="reaction-picker-count">{likeCount}</span>
            </button>
            {open && (
                <div
                    ref={optionsRef}
                    className="reaction-picker-options"
                    role="group"
                    aria-label="Reactions"
                    style={position ? { left: position.left, top: position.top } : undefined}
                >
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
                    <button
                        type="button"
                        className="reaction-picker-clear"
                        aria-label="No reaction"
                        title="No reaction"
                        onClick={clearReaction}
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReactionPicker;
