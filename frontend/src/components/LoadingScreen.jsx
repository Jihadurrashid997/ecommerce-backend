import React, { useEffect } from "react";
import { motion } from "framer-motion";

import "../styles/LoadingScreen.css";

const LoadingScreen = ({ onComplete }) => {

    useEffect(() => {

        const timer = setTimeout(() => {

            if (onComplete) {
                onComplete();
            }

        }, 3000);

        return () => clearTimeout(timer);

    }, [onComplete]);


    return (

        <motion.div
            className="loading-screen"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
        >

            {/* BACKGROUND */}

            <div className="loading-orb orb-one" />
            <div className="loading-orb orb-two" />
            <div className="loading-grid" />


            {/* CONTENT */}

            <div className="loading-content">

                <motion.div
                    className="loading-logo"
                    initial={{
                        scale: 0,
                        opacity: 0,
                        rotate: -180
                    }}
                    animate={{
                        scale: 1,
                        opacity: 1,
                        rotate: 0
                    }}
                    transition={{
                        duration: 1,
                        ease: [0.22, 1, 0.36, 1]
                    }}
                >

                    JR

                </motion.div>


                <motion.h1
                    initial={{
                        opacity: 0,
                        y: 25
                    }}
                    animate={{
                        opacity: 1,
                        y: 0
                    }}
                    transition={{
                        delay: 0.5,
                        duration: 0.7
                    }}
                >

                    JR Store

                </motion.h1>


                <motion.p
                    initial={{
                        opacity: 0,
                        y: 10
                    }}
                    animate={{
                        opacity: 1,
                        y: 0
                    }}
                    transition={{
                        delay: 0.8,
                        duration: 0.6
                    }}
                >

                    Buy • Sell • Chat • Secure Payment

                </motion.p>


                <div className="premium-loader">

                    <motion.div
                        className="premium-loader-bar"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                            duration: 2.5,
                            ease: "easeInOut"
                        }}
                    />

                </div>


                <motion.span
                    className="loading-text"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        delay: 1,
                        duration: 0.5
                    }}
                >

                    Preparing your marketplace...

                </motion.span>

            </div>

        </motion.div>

    );

};

export default LoadingScreen;
