```jsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../styles/Animation.css";

const LoadingScreen = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [finished, setFinished] = useState(false);

    useEffect(() => {
        let current = 0;

        const interval = setInterval(() => {
            current += Math.floor(Math.random() * 8) + 4;

            if (current >= 100) {
                current = 100;
                clearInterval(interval);

                setProgress(100);

                setTimeout(() => {
                    setFinished(true);

                    setTimeout(() => {
                        if (typeof onComplete === "function") {
                            onComplete();
                        }
                    }, 500);
                }, 500);
            } else {
                setProgress(current);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <AnimatePresence>
            {!finished && (
                <motion.div
                    className="loading-screen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                        opacity: 0,
                        scale: 1.05
                    }}
                    transition={{
                        duration: 0.6
                    }}
                >

                    {/* Animated background */}
                    <div className="loading-background">

                        <motion.div
                            className="loading-orb orb-one"
                            animate={{
                                x: [0, 80, 0],
                                y: [0, -50, 0],
                                scale: [1, 1.15, 1]
                            }}
                            transition={{
                                duration: 5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />

                        <motion.div
                            className="loading-orb orb-two"
                            animate={{
                                x: [0, -70, 0],
                                y: [0, 60, 0],
                                scale: [1, 1.2, 1]
                            }}
                            transition={{
                                duration: 6,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />

                        <motion.div
                            className="loading-orb orb-three"
                            animate={{
                                rotate: [0, 180, 360],
                                scale: [1, 1.1, 1]
                            }}
                            transition={{
                                duration: 8,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />

                    </div>


                    {/* Main content */}
                    <motion.div
                        className="loading-content"
                        initial={{
                            opacity: 0,
                            y: 40,
                            scale: 0.9
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1
                        }}
                        transition={{
                            duration: 0.9,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                    >

                        {/* Logo */}
                        <motion.div
                            className="loading-logo"
                            animate={{
                                y: [0, -8, 0],
                                rotateY: [0, 8, 0, -8, 0]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            JR
                        </motion.div>


                        {/* Brand */}
                        <motion.h1
                            className="loading-title"
                            initial={{
                                opacity: 0,
                                letterSpacing: "10px"
                            }}
                            animate={{
                                opacity: 1,
                                letterSpacing: "2px"
                            }}
                            transition={{
                                duration: 1
                            }}
                        >
                            <strong>JR</strong> Store
                        </motion.h1>


                        <motion.p
                            className="loading-subtitle"
                            initial={{
                                opacity: 0
                            }}
                            animate={{
                                opacity: 1
                            }}
                            transition={{
                                delay: 0.4,
                                duration: 0.7
                            }}
                        >
                            Buy • Sell • Chat • Secure Payment
                        </motion.p>


                        {/* 3D rotating ring */}
                        <div className="loading-loader">

                            <motion.div
                                className="loader-ring ring-one"
                                animate={{
                                    rotate: 360
                                }}
                                transition={{
                                    duration: 1.8,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />

                            <motion.div
                                className="loader-ring ring-two"
                                animate={{
                                    rotate: -360
                                }}
                                transition={{
                                    duration: 2.4,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />

                            <motion.div
                                className="loader-dot"
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.6, 1, 0.6]
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity
                                }}
                            />

                        </div>


                        {/* Progress */}
                        <div className="loading-progress-wrapper">

                            <div className="loading-progress">

                                <motion.div
                                    className="loading-progress-bar"
                                    initial={{
                                        width: "0%"
                                    }}
                                    animate={{
                                        width: `${progress}%`
                                    }}
                                    transition={{
                                        duration: 0.25
                                    }}
                                />

                            </div>

                            <div className="loading-progress-info">

                                <span>
                                    {progress < 100
                                        ? "Preparing your marketplace..."
                                        : "Welcome to JR Store"}
                                </span>

                                <span>
                                    {progress}%
                                </span>

                            </div>

                        </div>

                    </motion.div>


                    {/* Bottom text */}
                    <motion.div
                        className="loading-footer"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        transition={{
                            delay: 1
                        }}
                    >
                        <span>
                            © 2026 JR Store
                        </span>

                        <span>
                            Premium Marketplace
                        </span>
                    </motion.div>

                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoadingScreen;
```
