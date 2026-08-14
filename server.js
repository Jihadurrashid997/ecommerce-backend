// ============================================================
// JR STORE - PRODUCTION SERVER
// Express + MongoDB + Socket.IO + WebRTC Signaling
// ============================================================

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

const PORT = Number(process.env.PORT) || 5000;

// ============================================================
// CORS
// ============================================================

const allowedOrigins = [
    "https://ecommerce-backend-1-a9y7.onrender.com",
    "https://ecommerce-api-9wc9.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173"
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow server-to-server / Postman / Render health checks
            if (!origin) {
                return callback(null, true);
            }

            // Allow known production/local origins
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // Allow other origins so deployed frontend does not
            // randomly fail because Render generated a different URL.
            return callback(null, true);
        },

        credentials: true,

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
            "Authorization",
            "Accept"
        ]
    })
);

// ============================================================
// BODY PARSER
// ============================================================

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

// ============================================================
// UPLOADS
// ============================================================

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

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/",
    async (req, res) => {

        let database = "unknown";

        try {

            const mongoose =
                require("mongoose");

            database =
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected";

        } catch (error) {

            database = "unknown";

        }

        return res.status(200).json({
            success: true,
            message: "JR Store API is running 🚀",
            service: "ecommerce-backend",
            database,
            socket: "enabled",
            timestamp: new Date().toISOString()
        });

    }
);

app.get(
    "/api/health",
    async (req, res) => {

        let database = "unknown";

        try {

            const mongoose =
                require("mongoose");

            database =
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected";

        } catch (error) {

            database = "unknown";

        }

        return res.status(200).json({
            success: true,
            message: "JR Store API is healthy",
            database,
            socket: "enabled",
            timestamp: new Date().toISOString()
        });

    }
);

// ============================================================
// API ROUTES
// ============================================================

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

// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        return res.status(404).json({
            success: false,
            message:
                `Route not found: ${req.method} ${req.originalUrl}`
        });

    }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "❌ API ERROR:",
            err
        );

        if (res.headersSent) {
            return next(err);
        }

        return res.status(
            err.status || 500
        ).json({
            success: false,
            message:
                err.message ||
                "Internal server error"
        });

    }
);

// ============================================================
// SOCKET.IO
// ============================================================

const io =
    new Server(
        server,
        {
            cors: {
                origin: true,
                credentials: true,
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
                10 * 1024 * 1024
        }
    );

// ============================================================
// ONLINE USERS
// userId -> Set(socketId)
// ============================================================

const onlineUsers = new Map();

// ============================================================
// NORMALIZE USER ID
// ============================================================

const normalizeId = (value) => {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (
        typeof value === "object"
    ) {

        return normalizeId(
            value._id ||
            value.id ||
            value.userId
        );

    }

    return String(value);

};

// ============================================================
// ADD USER ONLINE
// ============================================================

const addOnlineUser = (
    userId,
    socketId
) => {

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

};

// ============================================================
// REMOVE USER ONLINE
// ============================================================

const removeOnlineUser = (
    userId,
    socketId
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

    sockets.delete(socketId);

    if (sockets.size === 0) {

        onlineUsers.delete(id);

    }

};

// ============================================================
// GET ONLINE USERS
// ============================================================

const getOnlineUsers = () => {

    return Array.from(
        onlineUsers.keys()
    );

};

// ============================================================
// SEND EVENT TO USER
// ============================================================

const sendToUser = (
    userId,
    event,
    data
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
        (socketId) => {

            io
                .to(socketId)
                .emit(
                    event,
                    data
                );

        }
    );

    return true;

};

// ============================================================
// SOCKET CONNECTION
// ============================================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "🟢 Socket connected:",
            socket.id
        );

        // ====================================================
        // USER ONLINE
        // ====================================================

        socket.on(
            "user-online",
            (userId) => {

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

        // ====================================================
        // JOIN ROOM
        // ====================================================

        socket.on(
            "join-room",
            (roomId) => {

                if (!roomId) {
                    return;
                }

                socket.join(
                    String(roomId)
                );

            }
        );

        // ====================================================
        // LEAVE ROOM
        // ====================================================

        socket.on(
            "leave-room",
            (roomId) => {

                if (!roomId) {
                    return;
                }

                socket.leave(
                    String(roomId)
                );

            }
        );

        // ====================================================
        // MESSAGE
        // ====================================================

        socket.on(
            "send-message",
            (payload = {}) => {

                if (!payload.roomId) {
                    return;
                }

                const roomId =
                    String(
                        payload.roomId
                    );

                const receiverId =
                    normalizeId(
                        payload.receiverId ||
                        payload.receiver
                    );

                // Room users
                io
                    .to(roomId)
                    .emit(
                        "receive-message",
                        payload
                    );

                // Receiver's other sockets/tabs
                if (receiverId) {

                    sendToUser(
                        receiverId,
                        "direct-message",
                        payload
                    );

                }

            }
        );

        // ====================================================
        // TYPING
        // ====================================================

        socket.on(
            "typing",
            (payload = {}) => {

                if (!payload.roomId) {
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

        // ====================================================
        // STOP TYPING
        // ====================================================

        socket.on(
            "stop-typing",
            (payload = {}) => {

                if (!payload.roomId) {
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

        // ====================================================
        // MESSAGE SEEN
        // ====================================================

        socket.on(
            "message-seen",
            (payload = {}) => {

                if (!payload.roomId) {
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

        // ====================================================
        // WEBRTC - CALL USER
        // ====================================================

        socket.on(
            "call-user",
            (payload = {}) => {

                const receiverId =
                    normalizeId(
                        payload.receiverId ||
                        payload.receiver
                    );

                const callerId =
                    normalizeId(
                        payload.callerId ||
                        socket.userId
                    );

                if (
                    !receiverId ||
                    !callerId
                ) {
                    return;
                }

                const callData = {

                    roomId:
                        payload.roomId ||
                        null,

                    callerId,

                    receiverId,

                    callerName:
                        payload.callerName ||
                        "User",

                    callerAvatar:
                        payload.callerAvatar ||
                        null,

                    type:
                        payload.type === "video"
                            ? "video"
                            : "audio"

                };

                sendToUser(
                    receiverId,
                    "incoming-call",
                    callData
                );

                sendToUser(
                    callerId,
                    "call-ringing",
                    callData
                );

            }
        );

        // ====================================================
        // ACCEPT CALL
        // ====================================================

        socket.on(
            "accept-call",
            (payload = {}) => {

                const callerId =
                    normalizeId(
                        payload.callerId
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
                                payload.receiverId ||
                                socket.userId
                            )
                    }
                );

            }
        );

        // ====================================================
        // REJECT CALL
        // ====================================================

        socket.on(
            "reject-call",
            (payload = {}) => {

                const callerId =
                    normalizeId(
                        payload.callerId
                    );

                if (!callerId) {
                    return;
                }

                sendToUser(
                    callerId,
                    "call-rejected",
                    {
                        roomId:
                            payload.roomId ||
                            null,

                        receiverId:
                            normalizeId(
                                payload.receiverId ||
                                socket.userId
                            )
                    }
                );

            }
        );

        // ====================================================
        // END CALL
        // ====================================================

        socket.on(
            "end-call",
            (payload = {}) => {

                const roomId =
                    payload.roomId;

                const receiverId =
                    normalizeId(
                        payload.receiverId
                    );

                if (roomId) {

                    io
                        .to(
                            String(roomId)
                        )
                        .emit(
                            "call-ended",
                            {
                                roomId:
                                    String(roomId)
                            }
                        );

                }

                if (receiverId) {

                    sendToUser(
                        receiverId,
                        "call-ended",
                        payload
                    );

                }

            }
        );

        // ====================================================
        // WEBRTC OFFER
        // ====================================================

        socket.on(
            "webrtc-offer",
            (payload = {}) => {

                const receiverId =
                    normalizeId(
                        payload.receiverId
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

        // ====================================================
        // WEBRTC ANSWER
        // ====================================================

        socket.on(
            "webrtc-answer",
            (payload = {}) => {

                const receiverId =
                    normalizeId(
                        payload.receiverId
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

        // ====================================================
        // ICE CANDIDATE
        // ====================================================

        socket.on(
            "webrtc-ice-candidate",
            (payload = {}) => {

                const receiverId =
                    normalizeId(
                        payload.receiverId
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

        // ====================================================
        // CALL BUSY
        // ====================================================

        socket.on(
            "call-busy",
            (payload = {}) => {

                const callerId =
                    normalizeId(
                        payload.callerId
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

        // ====================================================
        // CALL MISSED
        // ====================================================

        socket.on(
            "call-missed",
            (payload = {}) => {

                const callerId =
                    normalizeId(
                        payload.callerId
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

        // ====================================================
        // DISCONNECT
        // ====================================================

        socket.on(
            "disconnect",
            (reason) => {

                console.log(
                    "🔴 Socket disconnected:",
                    socket.id,
                    reason
                );

                if (socket.userId) {

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

// ============================================================
// START SERVER
// ============================================================

const startServer = async () => {

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

};

startServer();
