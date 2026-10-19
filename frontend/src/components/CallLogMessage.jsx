import React from "react";
import { FaPhone, FaVideo } from "react-icons/fa";
import { formatDuration } from "./VoiceMessagePlayer";

const CALL_STATUS_LABELS = {
    ended: "call ended",
    missed: "missed call",
    declined: "call declined",
    busy: "call — user was busy"
};

const CallLogMessage = ({
    callType,
    callStatus,
    callDuration = 0
}) => (
    <div className="call-log-message" aria-label="Call details">
        {callType === "video"
            ? <FaVideo aria-hidden="true" />
            : <FaPhone aria-hidden="true" />}
        <span>
            {callType === "video" ? "Video" : "Voice"}{" "}
            {CALL_STATUS_LABELS[callStatus] || "call"}
        </span>
        {callStatus === "ended" && callDuration > 0 && (
            <small>{formatDuration(callDuration)}</small>
        )}
    </div>
);

export default CallLogMessage;
