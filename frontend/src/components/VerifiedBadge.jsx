import React from "react";
import { FaCheck } from "react-icons/fa";

const VerifiedBadge = ({ className = "" }) => (
    <span
        className={`verified-badge ${className}`.trim()}
        role="img"
        aria-label="Verified account"
        title="Verified account"
    >
        <FaCheck aria-hidden="true" />
    </span>
);

export default VerifiedBadge;
