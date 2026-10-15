import React, { useEffect, useState } from "react";
import "../styles/LoadingScreen.css";

const LoadingScreen = ({ onComplete }) => {

    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {

        let current = 0;
        let completionTimeout;

        const interval = setInterval(() => {

            current += Math.floor(
                Math.random() * 8
            ) + 3;

            if (current >= 100) {

                current = 100;

                clearInterval(interval);

                setProgress(100);
                setIsComplete(true);

                completionTimeout = setTimeout(() => {

                    if (typeof onComplete === "function") {
                        onComplete();
                    }

                }, 500);
            }

            setProgress(current);

        }, 120);

        return () => {
            clearInterval(interval);
            clearTimeout(completionTimeout);
        };

    }, [onComplete]);


    return (
        <div
            className={`loading-screen ${isComplete ? "is-complete" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={`Loading E Top, ${progress}%`}
        >

            <div className="loading-background">

                <div className="loading-orb loading-orb-one" />

                <div className="loading-orb loading-orb-two" />

                <div className="loading-orb loading-orb-three" />

                <div className="loading-grid" />

            </div>


            <div className="loading-content">

                <div className="loading-eyebrow">
                    <span />
                    YOUR SOCIAL MARKETPLACE
                    <span />
                </div>

                <div className="loading-brand loading-brand-etop">
                    <img
                        className="loading-logo-image"
                        src={`${process.env.PUBLIC_URL}/brand/etop-loading-logo.png`}
                        alt="E Top"
                    />
                </div>

                <h1 className="loading-headline">
                    Discover. Connect. <span>Shop.</span>
                </h1>

                <p className="loading-description">
                    Your community is getting ready.
                </p>

                <div className="loading-progress">

                    <div
                        className="loading-progress-track"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={progress}
                    >
                        <div
                            className="loading-progress-bar"
                            style={{
                                width: `${progress}%`
                            }}
                        />
                    </div>

                    <div className="loading-progress-text">
                        <span>
                            <i className="loading-status-dot" />
                            Preparing your experience
                        </span>
                        <span>{progress}%</span>
                    </div>

                </div>

                <div className="loading-company">
                    <img
                        src={`${process.env.PUBLIC_URL}/brand/jr-group-logo.png`}
                        alt="JR Group of Company"
                    />
                    <span>Powered by</span>
                </div>

            </div>

        </div>
    );
};

export default LoadingScreen;
