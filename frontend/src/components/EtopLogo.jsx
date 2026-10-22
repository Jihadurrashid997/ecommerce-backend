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
            withTagline ? "etop-logo-with-tagline" : ""
        } ${
            light ? "etop-logo-light" : ""
        }`}
    >
        <span className="etop-logo-mark">
            <img
                className="etop-logo-image"
                src={`${process.env.PUBLIC_URL}/brand/etop-logo-hd.png`}
                alt="E Top"
                width={SIZE_MAP[size] || SIZE_MAP.md}
            />
        </span>

        {withTagline && (
            <span className="etop-logo-tagline">
                <img
                    className="etop-logo-company-image"
                    src={`${process.env.PUBLIC_URL}/brand/jr-group-logo-hd.png`}
                    alt="JR Group of Company"
                />
            </span>
        )}
    </div>
);

export default EtopLogo;
