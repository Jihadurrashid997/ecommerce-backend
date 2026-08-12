import React from "react";
import { motion } from "framer-motion";

import "../styles/LoadingScreen.css";

const LoadingScreen = ({ onComplete }) => {

    return (

        <motion.div
            className="loading-screen"

            initial={{
                opacity: 1
            }}

            animate={{
                opacity: 1
            }}

            exit={{
                opacity: 0
            }}

            transition={{
                duration: 0.8
            }}

            onAnimationComplete={() => {

                setTimeout(() => {

                    if (onComplete) {
                        onComplete();
                    }

                }, 1400);

            }}
        >

            <div className="loading-content">

                <motion.div
                    className="loading-logo"

                    initial={{
                        scale: 0,
                        opacity: 0,
                        rotate: -20
                    }}

                    animate={{
                        scale: 1,
                        opacity: 1,
                        rotate: 0
                    }}

                    transition={{
                        duration: 0.8,
                        ease: "easeOut"
                    }}
                >

                    M

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

                    Marketplace

                </motion.h1>


                <motion.p

                    initial={{
                        opacity: 0
                    }}

                    animate={{
                        opacity: 1
                    }}

                    transition={{
                        delay: 0.9,
                        duration: 0.6
                    }}
                >

                    Buy • Sell • Chat • Secure Payment

                </motion.p>


                <motion.div
                    className="loading-line"

                    initial={{
                        width: 0
                    }}

                    animate={{
                        width: "180px"
                    }}

                    transition={{
                        delay: 1,
                        duration: 1
                    }}
                />

            </div>

        </motion.div>

    );

};

export default LoadingScreen;
