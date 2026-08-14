import React from "react";

import {
    motion
} from "framer-motion";

import "../styles/LoadingScreen.css";


const LoadingScreen = ({
    onComplete
}) => {

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
                duration: 0.45
            }}

            onAnimationComplete={() => {

                if (onComplete) {

                    onComplete();

                }

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
                        duration: 0.65,
                        ease: "easeOut"
                    }}

                >

                    JR

                </motion.div>


                <motion.h1

                    initial={{
                        opacity: 0,
                        y: 20
                    }}

                    animate={{
                        opacity: 1,
                        y: 0
                    }}

                    transition={{
                        delay: 0.25,
                        duration: 0.45
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
                        delay: 0.4,
                        duration: 0.4
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
                        delay: 0.35,
                        duration: 0.6
                    }}

                />

            </div>

        </motion.div>

    );

};


export default LoadingScreen;
