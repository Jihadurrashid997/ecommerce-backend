import React, { useEffect, useState } from "react";
import "../styles/LoadingScreen.css";

const LoadingScreen = ({ onComplete }) => {

    const [progress, setProgress] = useState(0);

    useEffect(() => {

        let current = 0;

        const interval = setInterval(() => {

            current += Math.floor(
                Math.random() * 8
            ) + 3;

            if (current >= 100) {

                current = 100;

                clearInterval(interval);

                setProgress(100);

                setTimeout(() => {

                    if (typeof onComplete === "function") {
                        onComplete();
                    }

                }, 500);
            }

            setProgress(current);

        }, 120);

        return () => {
            clearInterval(interval);
        };

    }, [onComplete]);


    return (
        <div className="loading-screen">

            <div className="loading-background">

                <div className="loading-orb loading-orb-one" />

                <div className="loading-orb loading-orb-two" />

                <div className="loading-orb loading-orb-three" />

            </div>


            <div className="loading-content">

                <div className="loading-logo">

                    <div className="loading-logo-box">
                        JR
                    </div>

                </div>


                <div className="loading-brand">

                    <h1>
                        JR <span>Store</span>
                    </h1>

                    <p>
                        Your trusted marketplace
                    </p>

                </div>


                <div className="loading-spinner">

                    <span />
                    <span />
                    <span />
                    <span />

                </div>


                <div className="loading-progress">

                    <div className="loading-progress-track">

                        <div
                            className="loading-progress-bar"
                            style={{
                                width: `${progress}%`
                            }}
                        />

                    </div>


                    <div className="loading-progress-text">

                        <span>
                            Loading marketplace
                        </span>

                        <span>
                            {progress}%
                        </span>

                    </div>

                </div>


                <p className="loading-tagline">
                    Buy • Sell • Chat • Discover
                </p>

            </div>

        </div>
    );
};

export default LoadingScreen;
