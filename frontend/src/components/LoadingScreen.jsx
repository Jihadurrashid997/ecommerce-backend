```javascript
import React, {
    useEffect,
    useState
} from "react";

import {
    motion,
    AnimatePresence
} from "framer-motion";


const LoadingScreen = ({
    onComplete
}) => {

    const [
        exiting,
        setExiting
    ] = useState(false);


    useEffect(() => {

        const timer =
            setTimeout(
                () => {

                    setExiting(true);

                    setTimeout(
                        () => {

                            if (onComplete) {
                                onComplete();
                            }

                        },
                        850
                    );

                },
                3000
            );


        return () =>
            clearTimeout(timer);

    }, [onComplete]);


    const particles =
        Array.from(
            {
                length: 18
            },
            (_, index) =>
                index
        );


    return (

        <AnimatePresence>

            {!exiting && (

                <motion.div
                    initial={{
                        opacity: 1
                    }}
                    animate={{
                        opacity: 1
                    }}
                    exit={{
                        opacity: 0,
                        scale: 1.08,
                        filter:
                            "blur(14px)"
                    }}
                    transition={{
                        duration: 0.85,
                        ease:
                            [0.22, 1, 0.36, 1]
                    }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 999999,
                        overflow: "hidden",
                        display: "flex",
                        alignItems:
                            "center",
                        justifyContent:
                            "center",
                        background:
                            "radial-gradient(circle at 50% 35%, #182848 0%, #080d18 42%, #03050a 100%)",
                        color: "#fff",
                        fontFamily:
                            "Inter, Arial, sans-serif"
                    }}
                >

                    {/* =================================================
                        AMBIENT GLOW
                    ================================================= */}

                    <motion.div
                        animate={{
                            scale: [
                                1,
                                1.25,
                                1
                            ],
                            opacity: [
                                0.25,
                                0.5,
                                0.25
                            ]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease:
                                "easeInOut"
                        }}
                        style={{
                            position:
                                "absolute",
                            width:
                                "520px",
                            height:
                                "520px",
                            borderRadius:
                                "50%",
                            background:
                                "radial-gradient(circle, rgba(99,102,241,.45), transparent 68%)",
                            filter:
                                "blur(30px)"
                        }}
                    />


                    {/* =================================================
                        PARTICLES
                    ================================================= */}

                    {particles.map(
                        particle => (

                            <motion.span
                                key={
                                    particle
                                }
                                initial={{
                                    opacity: 0,
                                    y: 40
                                }}
                                animate={{
                                    opacity: [
                                        0,
                                        0.8,
                                        0
                                    ],
                                    y: [
                                        40,
                                        -160,
                                        -260
                                    ],
                                    x: [
                                        0,
                                        (particle % 2
                                            ? 1
                                            : -1) *
                                            (30 +
                                                particle *
                                                4)
                                    ]
                                }}
                                transition={{
                                    duration:
                                        2.6 +
                                        (particle %
                                            5) *
                                            0.25,
                                    delay:
                                        particle *
                                        0.08,
                                    repeat:
                                        Infinity,
                                    ease:
                                        "easeOut"
                                }}
                                style={{
                                    position:
                                        "absolute",
                                    left:
                                        `${15 +
                                        (particle *
                                            4.7) %
                                            70}%`,
                                    top:
                                        `${50 +
                                        (particle %
                                            5) *
                                            5}%`,
                                    width:
                                        particle %
                                            3 ===
                                        0
                                            ? "5px"
                                            : "3px",
                                    height:
                                        particle %
                                            3 ===
                                        0
                                            ? "5px"
                                            : "3px",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#fff",
                                    boxShadow:
                                        "0 0 14px rgba(255,255,255,.9)"
                                }}
                            />

                        )
                    )}


                    {/* =================================================
                        3D LOGO SCENE
                    ================================================= */}

                    <div
                        style={{
                            position:
                                "relative",
                            width:
                                "310px",
                            height:
                                "390px",
                            display:
                                "flex",
                            flexDirection:
                                "column",
                            alignItems:
                                "center",
                            justifyContent:
                                "center",
                            perspective:
                                "1000px"
                        }}
                    >

                        {/* ORBIT 1 */}

                        <motion.div
                            animate={{
                                rotateX: 70,
                                rotateZ: 360
                            }}
                            transition={{
                                rotateZ: {
                                    duration:
                                        5,
                                    repeat:
                                        Infinity,
                                    ease:
                                        "linear"
                                }
                            }}
                            style={{
                                position:
                                    "absolute",
                                width:
                                    "280px",
                                height:
                                    "280px",
                                border:
                                    "1px solid rgba(129,140,248,.5)",
                                borderRadius:
                                    "50%",
                                boxShadow:
                                    "0 0 30px rgba(99,102,241,.25)"
                            }}
                        />


                        {/* ORBIT 2 */}

                        <motion.div
                            animate={{
                                rotateY:
                                    70,
                                rotateZ:
                                    -360
                            }}
                            transition={{
                                rotateZ: {
                                    duration:
                                        7,
                                    repeat:
                                        Infinity,
                                    ease:
                                        "linear"
                                }
                            }}
                            style={{
                                position:
                                    "absolute",
                                width:
                                    "235px",
                                height:
                                    "235px",
                                border:
                                    "1px solid rgba(56,189,248,.45)",
                                borderRadius:
                                    "50%"
                            }}
                        />


                        {/* 3D CARD */}

                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0.2,
                                rotateX: -80,
                                rotateY: 80
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                rotateX: 0,
                                rotateY: 0
                            }}
                            transition={{
                                duration:
                                    1.2,
                                ease:
                                    [0.16, 1, 0.3, 1]
                            }}
                            style={{
                                width:
                                    "150px",
                                height:
                                    "150px",
                                borderRadius:
                                    "36px",
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                justifyContent:
                                    "center",
                                position:
                                    "relative",
                                zIndex: 5,
                                transformStyle:
                                    "preserve-3d",
                                background:
                                    "linear-gradient(145deg, rgba(255,255,255,.2), rgba(255,255,255,.04))",
                                border:
                                    "1px solid rgba(255,255,255,.3)",
                                boxShadow:
                                    "0 35px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.35)",
                                backdropFilter:
                                    "blur(18px)"
                            }}
                        >

                            <motion.div
                                animate={{
                                    rotateY: [
                                        0,
                                        360
                                    ]
                                }}
                                transition={{
                                    duration:
                                        4,
                                    repeat:
                                        Infinity,
                                    ease:
                                        "linear"
                                }}
                                style={{
                                    fontSize:
                                        "64px",
                                    fontWeight:
                                        900,
                                    letterSpacing:
                                        "-5px",
                                    background:
                                        "linear-gradient(135deg, #fff, #818cf8, #38bdf8)",
                                    WebkitBackgroundClip:
                                        "text",
                                    WebkitTextFillColor:
                                        "transparent",
                                    textShadow:
                                        "0 10px 40px rgba(99,102,241,.5)"
                                }}
                            >
                                JR
                            </motion.div>

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
                                delay:
                                    0.75,
                                duration:
                                    0.7
                            }}
                            style={{
                                marginTop:
                                    "42px",
                                marginBottom:
                                    "6px",
                                fontSize:
                                    "36px",
                                fontWeight:
                                    800,
                                letterSpacing:
                                    "-1px"
                            }}
                        >
                            JR
                            <span
                                style={{
                                    fontWeight:
                                        400,
                                    marginLeft:
                                        "7px",
                                    opacity:
                                        0.85
                                }}
                            >
                                Store
                            </span>
                        </motion.h1>


                        <motion.p
                            initial={{
                                opacity: 0
                            }}
                            animate={{
                                opacity: 0.75
                            }}
                            transition={{
                                delay:
                                    1.1,
                                duration:
                                    0.6
                            }}
                            style={{
                                margin: 0,
                                fontSize:
                                    "13px",
                                letterSpacing:
                                    "3px",
                                textTransform:
                                    "uppercase"
                            }}
                        >
                            Buy • Sell • Connect
                        </motion.p>


                        {/* LOADING BAR */}

                        <div
                            style={{
                                width:
                                    "190px",
                                height:
                                    "3px",
                                marginTop:
                                    "28px",
                                borderRadius:
                                    "999px",
                                overflow:
                                    "hidden",
                                background:
                                    "rgba(255,255,255,.12)"
                            }}
                        >

                            <motion.div
                                initial={{
                                    width: 0
                                }}
                                animate={{
                                    width:
                                        "100%"
                                }}
                                transition={{
                                    duration:
                                        2.5,
                                    ease:
                                        "linear"
                                }}
                                style={{
                                    height:
                                        "100%",
                                    borderRadius:
                                        "999px",
                                    background:
                                        "linear-gradient(90deg, #6366f1, #38bdf8, #a78bfa)",
                                    boxShadow:
                                        "0 0 18px rgba(99,102,241,.9)"
                                }}
                            />

                        </div>


                        <motion.span
                            animate={{
                                opacity: [
                                    0.35,
                                    1,
                                    0.35
                                ]
                            }}
                            transition={{
                                duration:
                                    1.2,
                                repeat:
                                    Infinity
                            }}
                            style={{
                                marginTop:
                                    "13px",
                                fontSize:
                                    "11px",
                                opacity:
                                    0.55
                            }}
                        >
                            Preparing your marketplace...
                        </motion.span>

                    </div>

                </motion.div>

            )}

        </AnimatePresence>

    );

};


export default LoadingScreen;
```
