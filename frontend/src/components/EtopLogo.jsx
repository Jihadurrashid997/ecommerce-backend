import React from "react";

const SIZE_MAP = {
    sm: 112,
    md: 210,
    lg: 360
};

const EtopLogo = ({
    size = "md",
    withTagline = false,
    light = false
}) => (
    <div
        className={`etop-logo etop-logo-${size} ${
            light ? "etop-logo-light" : ""
        }`}
    >
        <span className="etop-logo-mark">
            <img
                className="etop-logo-image"
                src={`${process.env.PUBLIC_URL}/brand/etop-loading-logo.png`}
                alt="E Top"
                width={SIZE_MAP[size] || SIZE_MAP.md}
            />
        </span>

        {withTagline && (
            <span className="etop-logo-tagline">
                <span className="etop-logo-company">
                    JR <b>Group</b>
                </span>
                <span className="etop-logo-company-sub">
                    of Company
                </span>
            </span>
        )}
    </div>
);

export default EtopLogo;
