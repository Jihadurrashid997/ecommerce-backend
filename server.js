const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
    "https://ecommerce-backend-1-a9y7.onrender.com",
    "https://ecommerce-api-9wc9.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173"
];

app.use(
    cors({
        origin: (origin, callback) => {

            if (!origin) {
                return callback(null, true);
            }

            if (
                allowedOrigins.includes(origin) ||
                origin.endsWith(".onrender.com")
            ) {
                return callback(null, true);
            }

            // Previously this fell through to
            // `callback(null, true)` no matter what,
            // which meant the allowlist above did
            // nothing and every origin was accepted.
            return callback(
                new Error("Not allowed by CORS"),
                false
            );
        },

        credentials: false,

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

/* =========================================================
   BODY PARSER
========================================================= */

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

/* =========================================================
   UPLOADS
========================================================= */

const uploadPath =
    path.join(__dirname, "uploads");

if (!fs.existsSync(uploadPath)) {

    fs.mkdirSync(
        uploadPath,
        {
            recursive: true
        }
    );

}

app.use(
    "/uploads",
    express.static(uploadPath)
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.status(200).json({
            success: true,
            message: "JR Store API is running",
            service: "ecommerce-backend",
            database: "connected",
            socket: "enabled",
            timestamp: new Date().toISOString()
        });

    }
);

app.get(
    "/api/health",
    (req, res) => {

        res.status(200).json({
            success: true,
            message: "JR Store API is healthy",
            socket: "enabled",
            timestamp: new Date().toISOString()
        });

    }
);

/* =========================================================
   API ROUTES
========================================================= */

app.use(
    "/api/auth",
    require("./routes/authRoutes")
);

app.use(
    "/api/users",
    require("./routes/userRoutes")
);

app.use(
    "/api/admin",
    require("./routes/adminRoutes")
);

app.use(
    "/api/seller",
    require("./routes/sellerRoutes")
);

app.use(
    "/api/orders",
    require("./routes/orderRoutes")
);

app.use(
    "/api/payment",
    require("./routes/paymentRoutes")
);

app.use(
    "/api/products",
    require("./routes/productRoutes")
);

app.use(
    "/api/messages",
    require("./routes/messageRoutes")
);

/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({
            success: false,
            message:
                `Route not found: ${req.method} ${req.originalUrl}`
        });

    }
);

/* =========================================================
   GLOBAL ERROR
========================================================= */

app.use(
    (err, req, res, next) => {

        console.error(
            "API ERROR:",
            err
        );

        if (res.headersSent) {
            return next(err);
        }

        res.status(
            err.status || 500
        ).json({
            success: false,
            message:
                err.message ||
                "Internal server error"
        });

    }
);

/* =========================================================
   SOCKET.IO
========================================================= */

const io =
    new Server(
        server,
        {
            cors: {
                origin: "*",
                methods: [
                    "GET",
                    "POST"
                ]
            },

            transports: [
                "websocket",
                "polling"
            ],

            pingInterval: 25000,

            pingTimeout: 20000,

            maxHttpBufferSize: 10e6
        }
    );

/* =========================================================
   ONLINE USERS

   userId -> Set(socketId)
========================================================= */

const onlineUsers =
    new Map();

/* =========================================================
   ACTIVE CALLS

   roomId -> {
       callerId,
       receiverId,
       status,
       type,
       createdAt
   }
========================================================= */

const activeCalls =
    new Map();

/* =========================================================
   CALL TIMEOUT

   Ringing calls automatically become missed.
========================================================= */

const CALL_RING_TIMEOUT =
    45000;

/* =========================================================
   NORMALIZE ID
========================================================= */

const normalizeId =
    value => {

        if (!value) {
            return null;
        }

        if (
            typeof value === "object"
        ) {

            return (
                String(
                    value._id ||
                    value.id ||
                    value.userId ||
                    ""
                ) || null
            );

        }

        return String(value);

    };

/* =========================================================
   ONLINE USER HELPERS
========================================================= */

const addOnlineUser =
    (
        userId,
        socketId
    ) => {

        const id =
            normalizeId(userId);

        if (!id) {
            return;
        }

        if (
            !onlineUsers.has(id)
        ) {

            onlineUsers.set(
                id,
                new Set()
            );

        }

        onlineUsers
            .get(id)
            .add(socketId);

    };

const removeOnlineUser =
    (
        userId,
        socketId
    ) => {

        const id =
            normalizeId(userId);

        if (
            !id ||
            !onlineUsers.has(id)
        ) {
            return;
        }

        const sockets =
            onlineUsers.get(id);

        sockets.delete(
            socketId
        );

        if (
            sockets.size === 0
        ) {

            onlineUsers.delete(id);

        }

    };

const getOnlineUsers =
    () => {

        return Array.from(
            onlineUsers.keys()
        );

    };

/* =========================================================
   SEND EVENT TO USER
========================================================= */

const sendToUser =
    (
        userId,
        event,
        payload
    ) => {

        const id =
            normalizeId(userId);

        if (!id) {
            return false;
        }

        const sockets =
            onlineUsers.get(id);

        if (
            !sockets ||
            sockets.size === 0
        ) {

            return false;

        }

        sockets.forEach(
            socketId => {

                io
                    .to(socketId)
                    .emit(
                        event,
                        payload
                    );

            }
        );

        return true;

    };

/* =========================================================
   CALL HELPERS
========================================================= */

const getCall =
    roomId => {

        if (!roomId) {
            return null;
        }

        return activeCalls.get(
            String(roomId)
        ) || null;

    };

const isUserInCall =
    userId => {

        const id =
            normalizeId(userId);

        if (!id) {
            return false;
        }

        for (
            const call of activeCalls.values()
        ) {

            if (
                call.callerId === id ||
                call.receiverId === id
            ) {

                return true;

            }

        }

        return false;

    };

const clearCall =
    roomId => {

        if (!roomId) {
            return;
        }

        activeCalls.delete(
            String(roomId)
        );

    };

const emitCallToBoth =
    (
        call,
        event,
        extra = {}
    ) => {

        if (!call) {
            return;
        }

        const payload = {
            ...call,
            ...extra
        };

        sendToUser(
            call.callerId,
            event,
            payload
        );

        sendToUser(
            call.receiverId,
            event,
            payload
        );

    };

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            "Socket connected:",
            socket.id
        );

        /* =================================================
           USER ONLINE
        ================================================= */

        socket.on(
            "user-online",
            userId => {

                const id =
                    normalizeId(userId);

                if (!id) {
                    return;
                }

                socket.userId =
                    id;

                socket.join(
                    `user:${id}`
                );

                addOnlineUser(
                    id,
                    socket.id
                );

                io.emit(
                    "online-users",
                    getOnlineUsers()
                );

                console.log(
                    "User online:",
                    id
                );

            }
        );

        /* =================================================
           JOIN ROOM
        ================================================= */

        socket.on(
            "join-room",
            roomId => {

                if (!roomId) {
                    return;
                }

                socket.join(
                    String(roomId)
                );

            }
        );

        /* =================================================
           LEAVE ROOM
        ================================================= */

        socket.on(
            "leave-room",
            roomId => {

                if (!roomId) {
                    return;
                }

                socket.leave(
                    String(roomId)
                );

            }
        );

        /* =================================================
           SEND MESSAGE
        ================================================= */

        socket.on(
            "send-message",
            payload => {

                if (!payload) {
                    return;
                }

                const roomId =
                    payload.roomId ||
                    null;

                const senderId =
                    normalizeId(
                        payload.sender
                    ) ||
                    normalizeId(
                        payload.senderId
                    ) ||
                    socket.userId;

                const receiverId =
                    normalizeId(
                        payload.receiver
                    ) ||
                    normalizeId(
                        payload.receiverId
                    );

                if (
                    !senderId ||
                    !receiverId
                ) {
                    return;
                }

                const message = {

                    ...payload,

                    sender:
                        senderId,

                    senderId,

                    receiver:
                        receiverId,

                    receiverId,

                    createdAt:
                        payload.createdAt ||
                        new Date().toISOString(),

                    timestamp:
                        payload.timestamp ||
                        Date.now()

                };

                if (roomId) {

                    io
                        .to(
                            String(roomId)
                        )
                        .emit(
                            "receive-message",
                            message
                        );

                }

                sendToUser(
                    receiverId,
                    "direct-message",
                    message
                );

            }
        );

        /* =================================================
           TYPING
        ================================================= */

        socket.on(
            "typing",
            payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                socket
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "user-typing",
                        {
                            userId:
                                normalizeId(
                                    payload.userId
                                ) ||
                                socket.userId
                        }
                    );

            }
        );

        /* =================================================
           STOP TYPING
        ================================================= */

        socket.on(
            "stop-typing",
            payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                socket
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "user-stop-typing",
                        {
                            userId:
                                normalizeId(
                                    payload.userId
                                ) ||
                                socket.userId
                        }
                    );

            }
        );

        /* =================================================
           MESSAGE SEEN
        ================================================= */

        socket.on(
            "message-seen",
            payload => {

                if (!payload) {
                    return;
                }

                const data = {

                    roomId:
                        payload.roomId ||
                        null,

                    senderId:
                        normalizeId(
                            payload.senderId
                        ),

                    receiverId:
                        normalizeId(
                            payload.receiverId
                        ),

                    messageId:
                        payload.messageId ||
                        null

                };

                if (data.roomId) {

                    io
                        .to(
                            String(
                                data.roomId
                            )
                        )
                        .emit(
                            "messages-seen",
                            data
                        );

                }

                if (
                    data.senderId
                ) {

                    sendToUser(
                        data.senderId,
                        "messages-seen",
                        data
                    );

                }

            }
        );

/* =========================================================
   CALL USER
========================================================= */

socket.on(
    "call-user",
    payload => {

        if (!payload) {
            return;
        }

        const callerId =
            normalizeId(
                payload.callerId
            ) || socket.userId;

        const receiverId =
            normalizeId(
                payload.receiverId
            );

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;

        const callType =
            payload.type === "video"
                ? "video"
                : "audio";

        if (
            !callerId ||
            !receiverId ||
            !roomId
        ) {
            return;
        }

        if (
            callerId === receiverId
        ) {
            return;
        }

        /* -----------------------------------------
           CALLER BUSY
        ----------------------------------------- */

        if (
            isUserInCall(callerId)
        ) {

            sendToUser(
                callerId,
                "call-busy",
                {
                    roomId,
                    callerId,
                    receiverId,
                    type: callType,
                    status: "busy"
                }
            );

            return;
        }


        /* -----------------------------------------
           RECEIVER BUSY
        ----------------------------------------- */

        if (
            isUserInCall(receiverId)
        ) {

            sendToUser(
                callerId,
                "call-busy",
                {
                    roomId,
                    callerId,
                    receiverId,
                    type: callType,
                    status: "busy"
                }
            );

            return;
        }


        /* -----------------------------------------
           CREATE CALL
        ----------------------------------------- */

        const callData = {

            roomId,

            callerId,

            receiverId,

            callerName:
                payload.callerName ||
                "User",

            callerAvatar:
                payload.callerAvatar ||
                "",

            type:
                callType,

            status:
                "ringing",

            createdAt:
                Date.now()

        };


        activeCalls.set(
            roomId,
            callData
        );


        /* -----------------------------------------
           JOIN SOCKET ROOM
        ----------------------------------------- */

        socket.join(
            roomId
        );


        /* -----------------------------------------
           SEND INCOMING CALL
           
           IMPORTANT:
           Only receiver gets incoming-call.
        ----------------------------------------- */

        sendToUser(
            receiverId,
            "incoming-call",
            callData
        );


        /* -----------------------------------------
           SEND RINGING
           
           IMPORTANT:
           Only caller gets call-ringing.
           
           Receiver will NEVER receive this.
        ----------------------------------------- */

        sendToUser(
            callerId,
            "call-ringing",
            {
                ...callData,
                status: "ringing"
            }
        );


        /* -----------------------------------------
           AUTO MISSED CALL
        ----------------------------------------- */

        setTimeout(
            () => {

                const currentCall =
                    getCall(roomId);

                if (
                    !currentCall ||
                    currentCall.status !==
                        "ringing"
                ) {
                    return;
                }


                currentCall.status =
                    "missed";


                sendToUser(
                    callerId,
                    "call-missed",
                    currentCall
                );


                sendToUser(
                    receiverId,
                    "call-missed",
                    currentCall
                );


                clearCall(
                    roomId
                );


            },
            CALL_RING_TIMEOUT
        );

    }
);


/* =========================================================
   ACCEPT CALL
========================================================= */

socket.on(
    "accept-call",
    payload => {

        if (!payload) {
            return;
        }

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;

        const callerId =
            normalizeId(
                payload.callerId
            );

        const receiverId =
            normalizeId(
                payload.receiverId
            ) || socket.userId;


        if (
            !roomId ||
            !callerId ||
            !receiverId
        ) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        /* -----------------------------------------
           SECURITY CHECK
        ----------------------------------------- */

        if (
            call.callerId !== callerId ||
            call.receiverId !== receiverId
        ) {
            return;
        }


        /* -----------------------------------------
           UPDATE CALL STATUS
        ----------------------------------------- */

        call.status =
            "accepted";

        call.acceptedAt =
            Date.now();


        activeCalls.set(
            roomId,
            call
        );


        /* -----------------------------------------
           JOIN ROOM
        ----------------------------------------- */

        socket.join(
            roomId
        );


        /* -----------------------------------------
           IMPORTANT
           
           ONLY CALLER GETS call-accepted.
           
           Receiver does NOT get this event.
           This prevents both sides creating
           an offer simultaneously.
        ----------------------------------------- */

        sendToUser(
            callerId,
            "call-accepted",
            {
                ...call,
                status: "accepted"
            }
        );

    }
);


/* =========================================================
   REJECT CALL
========================================================= */

socket.on(
    "reject-call",
    payload => {

        if (!payload) {
            return;
        }

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;

        const callerId =
            normalizeId(
                payload.callerId
            );

        const receiverId =
            normalizeId(
                payload.receiverId
            ) || socket.userId;


        if (
            !roomId ||
            !callerId ||
            !receiverId
        ) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        /* -----------------------------------------
           SEND REJECTED ONLY TO CALLER
        ----------------------------------------- */

        sendToUser(
            callerId,
            "call-rejected",
            {
                ...call,
                status: "rejected"
            }
        );


        /* -----------------------------------------
           CLEAR CALL
        ----------------------------------------- */

        clearCall(
            roomId
        );

    }
);


/* =========================================================
   BUSY
========================================================= */

socket.on(
    "call-busy",
    payload => {

        if (!payload) {
            return;
        }

        const callerId =
            normalizeId(
                payload.callerId
            );

        const receiverId =
            normalizeId(
                payload.receiverId
            );

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;


        if (!callerId) {
            return;
        }


        sendToUser(
            callerId,
            "call-busy",
            {
                roomId,
                callerId,
                receiverId,
                type:
                    payload.type ||
                    "audio",
                status:
                    "busy"
            }
        );


        if (roomId) {
            clearCall(
                roomId
            );
        }

    }
);


/* =========================================================
   END CALL
========================================================= */

socket.on(
    "end-call",
    payload => {

        if (!payload) {
            return;
        }

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;

        if (!roomId) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        const senderId =
            normalizeId(
                payload.userId
            ) || socket.userId;


        const otherUserId =
            senderId === call.callerId
                ? call.receiverId
                : call.callerId;


        /* -----------------------------------------
           NOTIFY OTHER USER
        ----------------------------------------- */

        sendToUser(
            otherUserId,
            "call-ended",
            {
                ...call,
                endedBy:
                    senderId,
                status:
                    "ended"
            }
        );


        /* -----------------------------------------
           CLEAR CALL
        ----------------------------------------- */

        clearCall(
            roomId
        );


        /* -----------------------------------------
           LEAVE SOCKET ROOM
        ----------------------------------------- */

        socket.leave(
            roomId
        );

    }
);


/* =========================================================
   WEBRTC OFFER
========================================================= */

socket.on(
    "webrtc-offer",
    payload => {

        if (!payload) {
            return;
        }

        const receiverId =
            normalizeId(
                payload.receiverId
            );

        const callerId =
            normalizeId(
                payload.callerId
            ) || socket.userId;

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;


        if (
            !receiverId ||
            !callerId ||
            !roomId ||
            !payload.offer
        ) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        /* -----------------------------------------
           ONLY CALLER CAN SEND OFFER
        ----------------------------------------- */

        if (
            call.callerId !==
            callerId
        ) {
            return;
        }


        sendToUser(
            receiverId,
            "webrtc-offer",
            {
                roomId,

                callerId,

                receiverId,

                offer:
                    payload.offer
            }
        );

    }
);


/* =========================================================
   WEBRTC ANSWER
========================================================= */

socket.on(
    "webrtc-answer",
    payload => {

        if (!payload) {
            return;
        }

        const receiverId =
            normalizeId(
                payload.receiverId
            );

        const callerId =
            normalizeId(
                payload.callerId
            );

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;


        if (
            !receiverId ||
            !callerId ||
            !roomId ||
            !payload.answer
        ) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        /* -----------------------------------------
           ONLY RECEIVER SENDS ANSWER
        ----------------------------------------- */

        if (
            call.receiverId !==
            receiverId
        ) {
            return;
        }


        sendToUser(
            callerId,
            "webrtc-answer",
            {
                roomId,

                callerId,

                receiverId,

                answer:
                    payload.answer
            }
        );

    }
);


/* =========================================================
   WEBRTC ICE CANDIDATE
========================================================= */

socket.on(
    "webrtc-ice-candidate",
    payload => {

        if (!payload) {
            return;
        }

        const receiverId =
            normalizeId(
                payload.receiverId
            );

        const callerId =
            normalizeId(
                payload.callerId
            ) || socket.userId;

        const roomId =
            payload.roomId
                ? String(payload.roomId)
                : null;


        if (
            !receiverId ||
            !callerId ||
            !roomId ||
            !payload.candidate
        ) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        /* -----------------------------------------
           ONLY TWO PARTICIPANTS
        ----------------------------------------- */

        if (
            !(
                (
                    callerId ===
                        call.callerId &&
                    receiverId ===
                        call.receiverId
                ) ||
                (
                    callerId ===
                        call.receiverId &&
                    receiverId ===
                        call.callerId
                )
            )
        ) {
            return;
        }


        sendToUser(
            receiverId,
            "webrtc-ice-candidate",
            {
                roomId,

                callerId,

                receiverId,

                candidate:
                    payload.candidate
            }
        );

    }
);

        /* =================================================
           DISCONNECT
        ================================================= */

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "Socket disconnected:",
                    socket.id,
                    reason
                );

                /*
                 * If this socket was participating
                 * in an active call, notify the other
                 * participant.
                 */

                if (
                    socket.userId
                ) {

                    for (
                        const [
                            roomId,
                            call
                        ] of activeCalls.entries()
                    ) {

                        if (
                            call.callerId ===
                                socket.userId ||
                            call.receiverId ===
                                socket.userId
                        ) {

                            const otherUser =
                                call.callerId ===
                                    socket.userId
                                    ? call.receiverId
                                    : call.callerId;

                            sendToUser(
                                otherUser,
                                "call-ended",
                                {

                                    ...call,

                                    roomId,

                                    endedBy:
                                        socket.userId,

                                    status:
                                        "ended",

                                    reason:
                                        "disconnect",

                                    timestamp:
                                        Date.now()

                                }
                            );

                            clearCall(
                                roomId
                            );

                        }

                    }

                    removeOnlineUser(
                        socket.userId,
                        socket.id
                    );

                }

                io.emit(
                    "online-users",
                    getOnlineUsers()
                );

            }
        );

    }
);

/* =========================================================
   START SERVER
========================================================= */

const startServer =
    async () => {

        try {

            await connectDB();

            server.listen(
                PORT,
                "0.0.0.0",
                () => {

                    console.log(
                        `JR Store API running on port ${PORT}`
                    );

                    console.log(
                        "MongoDB connected"
                    );

                    console.log(
                        "Messenger enabled"
                    );

                    console.log(
                        "WebRTC signaling enabled"
                    );

                }
            );

        } catch (error) {

            console.error(
                "SERVER STARTUP FAILED:",
                error
            );

            process.exit(1);

        }

    };

startServer();
