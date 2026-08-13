import React, { useEffect } from "react";
import { motion } from "framer-motion";

import "../styles/LoadingScreen.css";


const LoadingScreen = ({ onComplete }) => {


    useEffect(() => {

        const timer =
            setTimeout(() => {

                if (onComplete) {
                    onComplete();
                }

            }, 3000);


        return () => {
            clearTimeout(timer);
        };

    }, [onComplete]);


    return (

        <motion.div
            className="loading-screen"

            initial={{
                opacity: 1
            }}

            animate={{
                opacity: 1
            }}
        >

            <div className="loading-content">


                {/* 3D LOGO */}

                <motion.div
                    className="loading-logo"

                    initial={{
                        scale: 0,
                        rotateY: -180,
                        opacity: 0
                    }}

                    animate={{
                        scale: 1,
                        rotateY: 0,
                        opacity: 1
                    }}

                    transition={{
                        duration: 1,
                        ease: [0.22, 1, 0.36, 1]
                    }}
                >

                    JR

                </motion.div>


                {/* BRAND */}

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
                        delay: 0.45,
                        duration: 0.7
                    }}
                >

                    JR Store

                </motion.h1>


                <motion.p

                    initial={{
                        opacity: 0
                    }}

                    animate={{
                        opacity: 1
                    }}

                    transition={{
                        delay: 0.8,
                        duration: 0.6
                    }}
                >

                    Buy • Sell • Chat • Secure Payment

                </motion.p>


                {/* LOADING BAR */}

                <div className="loading-bar">

                    <motion.div
                        className="loading-bar-progress"

                        initial={{
                            width: "0%"
                        }}

                        animate={{
                            width: "100%"
                        }}

                        transition={{
                            duration: 2.5,
                            ease: "easeInOut"
                        }}
                    />

                </div>


                <motion.span
                    className="loading-status"

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

                    Preparing your marketplace...

                </motion.span>

            </div>

        </motion.div>

    );

};


export default LoadingScreen;
