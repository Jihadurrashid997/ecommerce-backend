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
// BASIC APP SETTINGS
// ======================================================

app.disable("x-powered-by");


// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",

    // Current Render backend
    "https://ecommerce-backend-1-a9y7.onrender.com",

    // Current Render frontend/API deployments if used
    "https://ecommerce-api-9wc9.onrender.com"
];

app.use(
    cors({
        origin: function (origin, callback) {

            // Server-to-server / Postman / mobile
            if (!origin) {
                return callback(null, true);
            }

            // Allow known origins
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            // Allow Render deployments
            if (origin.endsWith(".onrender.com")) {
                return callback(null, true);
            }

            // Keep compatibility with current frontend
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
            "Authorization",
            "Accept"
        ],

        credentials: false
    })
);


// ======================================================
// BODY PARSER
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
// UPLOAD DIRECTORY
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
// REQUEST LOGGER
// ======================================================

app.use(
    (req, res, next) => {

        const startedAt =
            Date.now();

        res.on(
            "finish",
            () => {

                const duration =
                    Date.now() - startedAt;

                console.log(
                    `${new Date().toISOString()} | ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms`
                );

            }
        );

        next();

    }
);


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                "JR Store API is running 🚀",

            service:
                "ecommerce-backend",

            database:
                "connected",

            socket:
                "enabled",

            version:
                "2.0.0",

            timestamp:
                new Date().toISOString()

        });

    }
);


app.get(
    "/api/health",
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                "JR Store API is healthy",

            socket:
                "enabled",

            timestamp:
                new Date().toISOString()

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
// API 404 HANDLER
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
// GLOBAL ERROR HANDLER
// ======================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "GLOBAL API ERROR:",
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

            pingInterval:
                25000,

            pingTimeout:
                20000,

            maxHttpBufferSize:
                10e6

        }
    );


// ======================================================
// ONLINE USERS
// ======================================================

const onlineUsers =
    new Map();


// ======================================================
// NORMALIZE USER ID
// ======================================================

const normalizeId =
    (value) => {

        if (!value) {
            return null;
        }

        if (
            typeof value ===
            "object"
        ) {

            const id =
                value._id ||
                value.id ||
                value.userId;

            return id
                ? String(id)
                : null;

        }

        return String(value);

    };


// ======================================================
// GET ONLINE USERS
// ======================================================

const getOnlineUsers =
    () => {

        return Array.from(
            onlineUsers.keys()
        );

    };


// ======================================================
// ADD ONLINE USER
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


// ======================================================
// REMOVE ONLINE USER
// ======================================================

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


// ======================================================
// SEND EVENT TO SPECIFIC USER
// ======================================================

const sendToUser =
    (
        userId,
        event,
        payload
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
            (socketId) => {

                io
                    .to(socketId)
                    .emit(
                        event,
                        payload
                    );

            }
        );

    };


// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "🟢 Socket connected:",
            socket.id
        );


        // ==================================================
        // USER ONLINE
        // ==================================================

        socket.on(
            "user-online",
            (userId) => {

                const id =
                    normalizeId(userId);

                if (!id) {
                    return;
                }

                socket.userId =
                    id;

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
        // JOIN CHAT ROOM
        // ==================================================

        socket.on(
            "join-room",
            (roomId) => {

                if (!roomId) {
                    return;
                }

                const room =
                    String(roomId);

                socket.join(room);

                console.log(
                    `💬 ${socket.id} joined room ${room}`
                );

            }
        );


        // ==================================================
        // LEAVE CHAT ROOM
        // ==================================================

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


        // ==================================================
        // REAL-TIME MESSAGE
        // ==================================================

        socket.on(
            "send-message",
            (payload) => {

                if (!payload) {
                    return;
                }

                const roomId =
                    payload.roomId;

                if (!roomId) {
                    return;
                }

                const message = {
                    ...payload
                };

                const receiverId =
                    normalizeId(
                        payload.receiver
                    );


                // Send to everyone inside room
                io
                    .to(
                        String(roomId)
                    )
                    .emit(
                        "receive-message",
                        message
                    );


                // Direct notification
                if (receiverId) {

                    sendToUser(
                        receiverId,
                        "direct-message",
                        message
                    );

                }

            }
        );


        // ==================================================
        // TYPING START
        // ==================================================

        socket.on(
            "typing",
            (payload) => {

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
                                )

                        }
                    );

            }
        );


        // ==================================================
        // TYPING STOP
        // ==================================================

        socket.on(
            "stop-typing",
            (payload) => {

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
            (payload) => {

                if (
                    !payload?.roomId
                ) {

                    return;

                }

                const data = {

                    senderId:
                        normalizeId(
                            payload.senderId
                        ),

                    receiverId:
                        normalizeId(
                            payload.receiverId
                        )

                };


                io
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "messages-seen",
                        data
                    );


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


        // ==================================================
        // MESSAGE DELIVERED
        // ==================================================

        socket.on(
            "message-delivered",
            (payload) => {

                if (
                    !payload?.roomId
                ) {

                    return;

                }

                io
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "message-delivered",
                        payload
                    );

            }
        );


        // ==================================================
        // CHAT NOTIFICATION
        // ==================================================

        socket.on(
            "chat-notification",
            (payload) => {

                const receiverId =
                    normalizeId(
                        payload?.receiverId
                    );

                if (!receiverId) {
                    return;
                }

                sendToUser(
                    receiverId,
                    "chat-notification",
                    payload
                );

            }
        );


        // ==================================================
        // DISCONNECT
        // ==================================================

        socket.on(
            "disconnect",
            (reason) => {

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
// SERVER START
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
                        "💬 Socket.IO Messenger enabled"
                    );

                    console.log(
                        "🟢 Online presence enabled"
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


// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

const shutdown =
    async (signal) => {

        console.log(
            `\n${signal} received. Shutting down...`
        );

        io.close(
            () => {

                server.close(
                    () => {

                        console.log(
                            "✅ Server closed safely"
                        );

                        process.exit(0);

                    }
                );

            }
        );

    };


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);


// ======================================================
// START
// ======================================================

startServer();
