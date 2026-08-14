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


// ======================================================
// CORS
// ======================================================

app.use(
    cors({
        origin: true,
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


// ======================================================
// BODY
// ======================================================

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


// ======================================================
// UPLOADS
// ======================================================

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


// ======================================================
// HEALTH
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.status(200).json({
            success: true,
            message: "JR Store API is running 🚀",
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

        res.json({
            success: true,
            message: "JR Store API is healthy",
            socket: "enabled",
            timestamp: new Date().toISOString()
        });

    }
);


// ======================================================
// API ROUTES
// ======================================================

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


// ======================================================
// 404
// ======================================================

app.use(
    (req, res) => {

        res.status(404).json({
            success: false,
            message:
                `Route not found: ${req.method} ${req.originalUrl}`
        });

    }
);


// ======================================================
// ERROR HANDLER
// ======================================================

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


// ======================================================
// SOCKET.IO
// ======================================================

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

            maxHttpBufferSize:
                10e6
        }
    );


// ======================================================
// ONLINE USERS
// userId -> Set(socketId)
// ======================================================

const onlineUsers =
    new Map();


// ======================================================
// NORMALIZE ID
// ======================================================

const normalizeId =
    (value) => {

        if (!value) {
            return null;
        }

        if (
            typeof value === "object"
        ) {

            return String(
                value._id ||
                value.id ||
                value.userId ||
                ""
            ) || null;

        }

        return String(value);

    };


// ======================================================
// ONLINE USER HELPERS
// ======================================================

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

        sockets.delete(socketId);

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


const sendToUser =
    (
        userId,
        event,
        data
    ) => {

        const id =
            normalizeId(userId);

        if (!id) {
            return;
        }

        const sockets =
            onlineUsers.get(id);

        if (!sockets) {
            return;
        }

        sockets.forEach(
            socketId => {

                io
                    .to(socketId)
                    .emit(
                        event,
                        data
                    );

            }
        );

    };


// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on(
    "connection",
    socket => {

        console.log(
            "🟢 Socket connected:",
            socket.id
        );


        // ==================================================
        // USER ONLINE
        // ==================================================

        socket.on(
            "user-online",
            userId => {

                const id =
                    normalizeId(userId);

                if (!id) {
                    return;
                }

                socket.userId = id;

                addOnlineUser(
                    id,
                    socket.id
                );

                io.emit(
                    "online-users",
                    getOnlineUsers()
                );

            }
        );


        // ==================================================
        // JOIN ROOM
        // ==================================================

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


        // ==================================================
        // LEAVE ROOM
        // ==================================================

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


        // ==================================================
        // MESSAGE
        // ==================================================

        socket.on(
            "send-message",
            payload => {

                if (!payload?.roomId) {
                    return;
                }

                const receiverId =
                    normalizeId(
                        payload.receiver
                    );

                io
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "receive-message",
                        payload
                    );

                if (receiverId) {

                    sendToUser(
                        receiverId,
                        "direct-message",
                        payload
                    );

                }

            }
        );


        // ==================================================
        // TYPING
        // ==================================================

        socket.on(
            "typing",
            payload => {

                if (!payload?.roomId) {
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
                                )
                        }
                    );

            }
        );


        socket.on(
            "stop-typing",
            payload => {

                if (!payload?.roomId) {
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
                                )
                        }
                    );

            }
        );


        // ==================================================
        // MESSAGE SEEN
        // ==================================================

        socket.on(
            "message-seen",
            payload => {

                if (!payload?.roomId) {
                    return;
                }

                io
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "messages-seen",
                        payload
                    );

            }
        );


        // ==================================================
        // ==================================================
        // WEBRTC CALL SIGNALING
        // ==================================================
        // ==================================================


        // --------------------------------------------------
        // CALL USER
        // --------------------------------------------------

        socket.on(
            "call-user",
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

                if (
                    !receiverId ||
                    !callerId
                ) {

                    return;

                }

                const callData = {

                    roomId:
                        payload.roomId,

                    callerId,

                    receiverId,

                    callerName:
                        payload.callerName ||
                        "User",

                    type:
                        payload.type === "video"
                            ? "video"
                            : "audio"

                };


                // Receiver-এর কাছে call পাঠাবে
                sendToUser(
                    receiverId,
                    "incoming-call",
                    callData
                );


                // Caller-কে ringing confirmation
                sendToUser(
                    callerId,
                    "call-ringing",
                    callData
                );

            }
        );


        // --------------------------------------------------
        // ACCEPT CALL
        // --------------------------------------------------

        socket.on(
            "accept-call",
            payload => {

                const callerId =
                    normalizeId(
                        payload?.callerId
                    );

                if (!callerId) {
                    return;
                }

                sendToUser(
                    callerId,
                    "call-accepted",
                    {
                        ...payload,
                        receiverId:
                            normalizeId(
                                payload.receiverId
                            )
                    }
                );

            }
        );


        // --------------------------------------------------
        // REJECT CALL
        // --------------------------------------------------

        socket.on(
            "reject-call",
            payload => {

                const callerId =
                    normalizeId(
                        payload?.callerId
                    );

                if (!callerId) {
                    return;
                }

                sendToUser(
                    callerId,
                    "call-rejected",
                    {
                        roomId:
                            payload.roomId
                    }
                );

            }
        );


        // --------------------------------------------------
        // END CALL
        // --------------------------------------------------

        socket.on(
            "end-call",
            payload => {

                const roomId =
                    payload?.roomId;

                if (!roomId) {
                    return;
                }

                io
                    .to(
                        String(roomId)
                    )
                    .emit(
                        "call-ended",
                        {
                            roomId
                        }
                    );

            }
        );


        // --------------------------------------------------
        // WEBRTC OFFER
        // --------------------------------------------------

        socket.on(
            "webrtc-offer",
            payload => {

                const receiverId =
                    normalizeId(
                        payload?.receiverId
                    );

                if (!receiverId) {
                    return;
                }

                sendToUser(
                    receiverId,
                    "webrtc-offer",
                    payload
                );

            }
        );


        // --------------------------------------------------
        // WEBRTC ANSWER
        // --------------------------------------------------

        socket.on(
            "webrtc-answer",
            payload => {

                const receiverId =
                    normalizeId(
                        payload?.receiverId
                    );

                if (!receiverId) {
                    return;
                }

                sendToUser(
                    receiverId,
                    "webrtc-answer",
                    payload
                );

            }
        );


        // --------------------------------------------------
        // ICE CANDIDATE
        // --------------------------------------------------

        socket.on(
            "webrtc-ice-candidate",
            payload => {

                const receiverId =
                    normalizeId(
                        payload?.receiverId
                    );

                if (!receiverId) {
                    return;
                }

                sendToUser(
                    receiverId,
                    "webrtc-ice-candidate",
                    payload
                );

            }
        );


        // --------------------------------------------------
        // CALL BUSY
        // --------------------------------------------------

        socket.on(
            "call-busy",
            payload => {

                const callerId =
                    normalizeId(
                        payload?.callerId
                    );

                if (!callerId) {
                    return;
                }

                sendToUser(
                    callerId,
                    "call-busy",
                    payload
                );

            }
        );


        // --------------------------------------------------
        // CALL MISSED
        // --------------------------------------------------

        socket.on(
            "call-missed",
            payload => {

                const callerId =
                    normalizeId(
                        payload?.callerId
                    );

                if (!callerId) {
                    return;
                }

                sendToUser(
                    callerId,
                    "call-missed",
                    payload
                );

            }
        );


        // ==================================================
        // DISCONNECT
        // ==================================================

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "🔴 Socket disconnected:",
                    socket.id,
                    reason
                );

                if (
                    socket.userId
                ) {

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


// ======================================================
// START SERVER
// ======================================================

const startServer =
    async () => {

        try {

            await connectDB();

            server.listen(
                PORT,
                "0.0.0.0",
                () => {

                    console.log(
                        `🚀 JR Store API running on port ${PORT}`
                    );

                    console.log(
                        "🗄️ MongoDB connected"
                    );

                    console.log(
                        "💬 Messenger enabled"
                    );

                    console.log(
                        "📞 Voice/Video WebRTC signaling enabled"
                    );

                }
            );

        } catch (error) {

            console.error(
                "❌ SERVER STARTUP FAILED:",
                error
            );

            process.exit(1);

        }

    };


startServer();
