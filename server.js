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

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        if (
            allowedOrigins.includes(origin) ||
            origin.endsWith(".onrender.com")
        ) {
            return callback(null, true);
        }

        return callback(null, true);
    },

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
    ],

    credentials: false
};

app.use(cors(corsOptions));

/* =========================================================
   BODY
========================================================= */

app.use(
    express.json({
        limit: "20mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb"
    })
);

/* =========================================================
   UPLOADS
========================================================= */

const uploadPath = path.join(
    __dirname,
    "uploads"
);

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
   LOGGER
========================================================= */

app.use(
    (req, res, next) => {
        console.log(
            `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
        );

        next();
    }
);

/* =========================================================
   HEALTH
========================================================= */

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
        res.status(200).json({
            success: true,
            message: "JR Store API is healthy",
            database: "connected",
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
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
    (err, req, res, next) => {
        console.error(
            "JR STORE API ERROR:",
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

const io = new Server(
    server,
    {
        cors: {
            origin: true,
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

        maxHttpBufferSize: 20e6
    }
);

/* =========================================================
   ONLINE USERS
========================================================= */

const onlineUsers = new Map();

/* =========================================================
   NORMALIZE USER ID
========================================================= */

function normalizeId(value) {
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
}

/* =========================================================
   ONLINE HELPERS
========================================================= */

function addOnlineUser(
    userId,
    socketId
) {
    const id =
        normalizeId(userId);

    if (!id) {
        return;
    }

    if (!onlineUsers.has(id)) {
        onlineUsers.set(
            id,
            new Set()
        );
    }

    onlineUsers
        .get(id)
        .add(socketId);
}

function removeOnlineUser(
    userId,
    socketId
) {
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
}

function getOnlineUsers() {
    return Array.from(
        onlineUsers.keys()
    );
}

function sendToUser(
    userId,
    event,
    data
) {
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
            io.to(socketId).emit(
                event,
                data
            );
        }
    );
}

/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            "🟢 Socket connected:",
            socket.id
        );

        /* ==================================================
           USER ONLINE
        ================================================== */

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

        /* ==================================================
           JOIN ROOM
        ================================================== */

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

        /* ==================================================
           LEAVE ROOM
        ================================================== */

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

        /* ==================================================
           MESSAGE
        ================================================== */

        socket.on(
            "send-message",
            payload => {

                if (
                    !payload ||
                    !payload.roomId
                ) {
                    return;
                }

                const receiverId =
                    normalizeId(
                        payload.receiverId ||
                        payload.receiver
                    );

                const senderId =
                    normalizeId(
                        payload.senderId ||
                        payload.sender
                    );

                const messageData = {
                    ...payload,
                    senderId,
                    receiverId,
                    createdAt:
                        payload.createdAt ||
                        new Date().toISOString()
                };

                io.to(
                    String(payload.roomId)
                ).emit(
                    "receive-message",
                    messageData
                );

                if (receiverId) {
                    sendToUser(
                        receiverId,
                        "direct-message",
                        messageData
                    );

                    sendToUser(
                        receiverId,
                        "message-notification",
                        messageData
                    );
                }
            }
        );

        /* ==================================================
           TYPING
        ================================================== */

        socket.on(
            "typing",
            payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                socket.to(
                    String(payload.roomId)
                ).emit(
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

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                socket.to(
                    String(payload.roomId)
                ).emit(
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

        /* ==================================================
           MESSAGE SEEN
        ================================================== */

        socket.on(
            "message-seen",
            payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                io.to(
                    String(payload.roomId)
                ).emit(
                    "messages-seen",
                    payload
                );
            }
        );

        /* ==================================================
           CALL USER
        ================================================== */

        socket.on(
            "call-user",
            payload => {

                const receiverId =
                    normalizeId(
                        payload?.receiverId
                    );

                const callerId =
                    normalizeId(
                        payload?.callerId
                    );

                if (
                    !receiverId ||
                    !callerId
                ) {
                    return;
                }

                const callData = {
                    ...payload,

                    callerId,

                    receiverId,

                    type:
                        payload.type === "video"
                            ? "video"
                            : "audio",

                    createdAt:
                        new Date().toISOString()
                };

                sendToUser(
                    receiverId,
                    "incoming-call",
                    callData
                );

                sendToUser(
                    receiverId,
                    "call-notification",
                    callData
                );

                sendToUser(
                    callerId,
                    "call-ringing",
                    callData
                );
            }
        );

        /* ==================================================
           ACCEPT CALL
        ================================================== */

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
                    payload
                );
            }
        );

        /* ==================================================
           REJECT CALL
        ================================================== */

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
                    payload
                );
            }
        );

        /* ==================================================
           END CALL
        ================================================== */

        socket.on(
            "end-call",
            payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                io.to(
                    String(payload.roomId)
                ).emit(
                    "call-ended",
                    payload
                );

                const receiverId =
                    normalizeId(
                        payload.receiverId
                    );

                if (receiverId) {
                    sendToUser(
                        receiverId,
                        "call-ended",
                        payload
                    );
                }
            }
        );

        /* ==================================================
           WEBRTC OFFER
        ================================================== */

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

        /* ==================================================
           WEBRTC ANSWER
        ================================================== */

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

        /* ==================================================
           ICE CANDIDATE
        ================================================== */

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

        /* ==================================================
           CALL BUSY
        ================================================== */

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

        /* ==================================================
           CALL MISSED
        ================================================== */

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

        /* ==================================================
           DISCONNECT
        ================================================== */

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

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

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
                    "📞 WebRTC signaling enabled"
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
}

startServer();
