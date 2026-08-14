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


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: false
    })
);

app.use(
    express.json({
        limit: "10mb"
    })
);


// ======================================================
// UPLOADS
// ======================================================

const uploadPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

app.use(
    "/uploads",
    express.static(uploadPath)
);


// ======================================================
// DATABASE
// ======================================================

connectDB();


// ======================================================
// API ROUTES
// ======================================================

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/seller", require("./routes/sellerRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "JR Store API is running 🚀",
        service: "ecommerce-backend",
        socket: "enabled",
        timestamp: new Date().toISOString()
    });
});


// ======================================================
// 404 API
// ======================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});


// ======================================================
// HTTP SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);


// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000
});


// ======================================================
// ONLINE USERS
// userId -> Set(socketId)
// ======================================================

const onlineUsers = new Map();


// ======================================================
// HELPERS
// ======================================================

const normalizeId = value => {
    if (!value) {
        return null;
    }

    if (typeof value === "object") {
        return String(
            value._id ||
            value.id ||
            value.userId ||
            ""
        ) || null;
    }

    return String(value);
};


const getOnlineUserIds = () => {
    return Array.from(
        onlineUsers.keys()
    );
};


const addOnlineUser = (
    userId,
    socketId
) => {

    const id = normalizeId(userId);

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


const removeOnlineUser = (
    userId,
    socketId
) => {

    const id = normalizeId(userId);

    if (!id || !onlineUsers.has(id)) {
        return;
    }

    const sockets =
        onlineUsers.get(id);

    sockets.delete(socketId);

    if (sockets.size === 0) {
        onlineUsers.delete(id);
    }
};


const sendToUser = (
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
            io.to(socketId).emit(
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
                    getOnlineUserIds()
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
        // SEND MESSAGE
        // ==================================================

        socket.on(
            "send-message",
            payload => {

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


                // Current conversation
                io.to(
                    String(roomId)
                ).emit(
                    "receive-message",
                    message
                );


                // Receiver's other open tabs/windows
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


        // ==================================================
        // STOP TYPING
        // ==================================================

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


                io.to(
                    String(
                        payload.roomId
                    )
                ).emit(
                    "messages-seen",
                    data
                );


                if (data.senderId) {

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
            reason => {

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
                    getOnlineUserIds()
                );

            }
        );

    }
);


// ======================================================
// START
// ======================================================

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
```
