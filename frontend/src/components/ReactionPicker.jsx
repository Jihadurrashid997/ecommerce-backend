import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import "./ReactionPicker.css";

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
    const pointerTimerRef = useRef(null);
    const longPressRef = useRef(false);
    const selected = REACTIONS.find(item => item.value === reaction);

    useEffect(() => () => clearTimeout(pointerTimerRef.current), []);

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
        clearTimeout(pointerTimerRef.current);
        longPressRef.current = false;
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
            className="reaction-picker facebook-reaction-picker"
            onPointerEnter={event => {
                if (event.pointerType === "mouse") setOpen(true);
            }}
            onPointerDown={event => {
                if (event.pointerType !== "touch") return;
                longPressRef.current = false;
                pointerTimerRef.current = setTimeout(() => {
                    longPressRef.current = true;
                    setOpen(true);
                }, 500);
            }}
            onPointerUp={() => clearTimeout(pointerTimerRef.current)}
            onPointerCancel={() => {
                clearTimeout(pointerTimerRef.current);
                longPressRef.current = false;
            }}
            onPointerLeave={event => {
                if (event.pointerType === "mouse") setOpen(false);
            }}
            onKeyDown={event => {
                if (event.key === "Escape") setOpen(false);
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setOpen(true);
                }
            }}
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
        >
            <button
                type="button"
                className={`reaction-picker-trigger facebook-reaction-trigger${selected ? " selected" : ""}`}
                aria-label={selected ? `${selected.label} reaction selected; activate to remove` : "Like"}
                aria-expanded={open}
                onClick={() => {
                    if (longPressRef.current) {
                        longPressRef.current = false;
                        return;
                    }
                    chooseReaction(reaction === "like" ? null : "like");
                }}
            >
                <span aria-hidden="true">{selected?.emoji || "👍"}</span>
                <span className="reaction-picker-label">{selected ? selected.label : "Like"}</span>
                <span className="reaction-picker-count">{likeCount}</span>
            </button>
            {open && (
                <div
                    ref={optionsRef}
                    className="reaction-picker-options facebook-reaction-options"
                    role="group"
                    aria-label="Reactions"
                    style={position ? { left: position.left, top: position.top } : undefined}
                >
                    {REACTIONS.map(item => (
                        <button
                            key={item.value}
                            type="button"
                            className={`facebook-reaction-option${reaction === item.value ? " selected" : ""}`}
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
                        className="reaction-picker-clear facebook-reaction-clear"
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
