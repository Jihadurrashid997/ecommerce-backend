import React from "react";

/*
=========================================================
E TOP LOGO

Reusable brand mark used on the loading screen, login,
register, and anywhere else the site needs the "E Top"
identity. Pure SVG + CSS gradient text - no image file
needed, scales crisply at any size.

Props:
  size       "sm" | "md" | "lg"   (default "md")
  withTagline  show "JR Group of Company" under the mark
  light        use the light (on-dark-background) palette
=========================================================
*/

const SIZE_MAP = {
    sm: { font: 22, crown: 14 },
    md: { font: 34, crown: 20 },
    lg: { font: 56, crown: 30 }
};

const EtopLogo = ({
    size = "md",
    withTagline = false,
    light = false
}) => {

    const dims =
        SIZE_MAP[size] || SIZE_MAP.md;

    return (

        <div
            className={`etop-logo etop-logo-${size} ${
                light ? "etop-logo-light" : ""
            }`}
        >

            <svg
                width={dims.font * 1.9}
                height={dims.font * 1.15}
                viewBox="0 0 160 96"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="etop-logo-mark"
            >

                <defs>

                    <linearGradient
                        id="etopGradient"
                        x1="0"
                        y1="0"
                        x2="160"
                        y2="96"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop offset="0%" stopColor="#7dd3fc" />
                        <stop offset="50%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>

                    <linearGradient
                        id="etopCrown"
                        x1="0"
                        y1="0"
                        x2="40"
                        y2="30"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop offset="0%" stopColor="#fde68a" />
                        <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>

                </defs>

                {/* Swoosh "E" mark */}
                <path
                    d="M72 8
                       C40 4, 10 22, 10 48
                       C10 74, 40 92, 72 88
                       C50 84, 30 70, 30 48
                       C30 26, 50 12, 72 8
                       Z"
                    fill="url(#etopGradient)"
                />

                <path
                    d="M78 30
                       C58 28, 42 36, 42 48
                       C42 60, 58 68, 78 66
                       C64 63, 54 56, 54 48
                       C54 40, 64 33, 78 30
                       Z"
                    fill="url(#etopGradient)"
                    opacity="0.85"
                />

                {/* Crown */}
                <path
                    d="M96 20
                       L103 32
                       L112 18
                       L121 32
                       L128 20
                       L126 40
                       L98 40
                       Z"
                    fill="url(#etopCrown)"
                />

            </svg>


            <span className="etop-logo-text">
                <span className="etop-logo-e">E</span>Top
            </span>


            {withTagline && (

                <div className="etop-logo-tagline">

                    <span className="etop-logo-company">
                        JR <b>Group</b>
                    </span>

                    <span className="etop-logo-company-sub">
                        of Company
                    </span>

                </div>

            )}

        </div>

    );

};

export default EtopLogo;
