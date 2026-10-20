import React from "react";
import { render, screen } from "@testing-library/react";
import CallLogMessage from "./CallLogMessage";

test("shows the call type, ended status, and duration", () => {
    render(
        <CallLogMessage
            callType="video"
            callStatus="ended"
            callDuration={85}
        />
    );

    expect(screen.getByLabelText("Call details"))
        .toHaveTextContent("Video call ended");
    expect(screen.getByText("1:25")).toBeInTheDocument();
});

test("shows missed-call details without a duration", () => {
    render(
        <CallLogMessage
            callType="voice"
            callStatus="missed"
            callDuration={0}
        />
    );

    expect(screen.getByLabelText("Call details"))
        .toHaveTextContent("Voice missed call");
    expect(screen.queryByText("0:00")).not.toBeInTheDocument();
});

test.each([
    ["declined", "Voice call declined"],
    ["busy", "Voice call — user was busy"]
])("shows %s call details", (callStatus, expectedText) => {
    render(
        <CallLogMessage
            callType="voice"
            callStatus={callStatus}
            callDuration={0}
        />
    );

    expect(screen.getByLabelText("Call details"))
        .toHaveTextContent(expectedText);
});

test("shows group-call duration and participant count", () => {
    render(
        <CallLogMessage
            callType="voice"
            callStatus="ended"
            callDuration={125}
            isGroup
            participantCount={4}
        />
    );

    expect(screen.getByLabelText("Call details"))
        .toHaveTextContent("Group Voice call ended");
    expect(screen.getByText("2:05")).toBeInTheDocument();
    expect(screen.getByText("4 joined")).toBeInTheDocument();
});
