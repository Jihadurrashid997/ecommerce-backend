import React, { useState } from "react";
import api from "../services/api";

const ReportItemButton = ({ targetType, targetId, compact = false }) => {
    const [busy, setBusy] = useState(false);

    const report = async () => {
        const reason = window.prompt("Why are you reporting this item? (required, up to 500 characters)");
        if (reason === null) return;
        if (!reason.trim()) {
            window.alert("Please include a reason.");
            return;
        }
        try {
            setBusy(true);
            await api.post("/moderation/reports", { targetType, targetId, reason: reason.trim() });
            window.alert("Report submitted for review.");
        } catch (error) {
            window.alert(error.response?.data?.message || "Could not submit report.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <button type="button" onClick={report} disabled={busy} aria-label={`Report ${targetType}`}>
            {busy ? "Sending..." : compact ? "Report" : `Report ${targetType}`}
        </button>
    );
};

export default ReportItemButton;
