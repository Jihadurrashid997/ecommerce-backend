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

const allowedOrigins = [
    "https://ecommerce-backend-1-a9y7.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001"
];

app.use(
    cors({
        origin: function (origin, callback) {

            // Allow Postman, server-to-server and mobile clients
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
// REQUEST LOGGER
// ======================================================

app.use(
    (req, res, next) => {

        console.log(
            `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
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
            message: "JR Store API is running 🚀",
            service: "ecommerce-backend",
            database: "connected",
            socket: "enabled",
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
            message: "API is healthy",
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
// API 404
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

            pingInterval: 25000,
            pingTimeout: 20000
        }
    );


// ======================================================
// ONLINE USERS
// ======================================================

const onlineUsers =
    new Map();


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


const getOnlineUsers =
    () => {

        return Array.from(
            onlineUsers.keys()
        );

    };


const addOnlineUser =
    (userId, socketId) => {

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
    (userId, socketId) => {

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
            socketId => {

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
        // JOIN PRIVATE CHAT ROOM
        // ==================================================

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


        // ==================================================
        // LEAVE ROOM
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

                const receiverId =
                    normalizeId(
                        payload.receiver
                    );

                const message = {
                    ...payload
                };


                // Send to current room
                io
                    .to(
                        String(roomId)
                    )
                    .emit(
                        "receive-message",
                        message
                    );


                // Send notification to receiver
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
        // TYPING
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
        // STOP TYPING
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
// START SERVER ONLY AFTER DATABASE CONNECTION
// ======================================================

const startServer =
    async () => {

        try {

            await connectDB();

            server.listen(
                PORT,
                () => {

                    console.log(
                        `🚀 JR Store API running on port ${PORT}`
                    );

                    console.log(
                        "💬 Real-time Messenger enabled"
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
