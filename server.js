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


// ==========================
// MIDDLEWARE
// ==========================

app.use(cors());

app.use(express.json());


// ==========================
// UPLOAD FOLDER
// ==========================

if (!fs.existsSync("./uploads")) {
    fs.mkdirSync("./uploads");
}

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);


// ==========================
// DATABASE
// ==========================

connectDB();


// ==========================
// API ROUTES
// ==========================

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


// ==========================
// HOME
// ==========================

app.get("/", (req, res) => {

    res.send(
        "Ecommerce Backend is running perfectly! 🚀"
    );

});


// ==========================
// HTTP SERVER
// ==========================

const PORT =
    process.env.PORT || 5000;

const server =
    http.createServer(app);


// ==========================
// SOCKET.IO
// ==========================

const io =
    new Server(server, {

        cors: {
            origin: "*",
            methods: [
                "GET",
                "POST",
                "PUT",
                "DELETE"
            ]
        }

    });


// ==========================
// ONLINE USERS
// userId -> Set of socket IDs
// ==========================

const onlineUsers = new Map();


// ==========================
// ADD ONLINE USER
// ==========================

const addOnlineUser = (
    userId,
    socketId
) => {

    const id =
        userId.toString();

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


// ==========================
// REMOVE ONLINE USER
// ==========================

const removeOnlineUser = (
    userId,
    socketId
) => {

    const id =
        userId.toString();

    if (!onlineUsers.has(id)) {
        return;
    }

    const sockets =
        onlineUsers.get(id);

    sockets.delete(socketId);

    if (sockets.size === 0) {

        onlineUsers.delete(id);

    }

};


// ==========================
// GET ONLINE USER IDS
// ==========================

const getOnlineUserIds = () => {

    return Array.from(
        onlineUsers.keys()
    );

};


// ==========================
// SEND TO SPECIFIC USER
// ==========================

const sendToUser = (
    userId,
    event,
    data
) => {

    if (!userId) {
        return;
    }

    const sockets =
        onlineUsers.get(
            userId.toString()
        );

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

};


// ==========================
// SOCKET CONNECTION
// ==========================

io.on(
    "connection",
    socket => {

        console.log(
            "🟢 Socket connected:",
            socket.id
        );


        // ==========================
        // USER ONLINE
        // ==========================

        socket.on(
            "user-online",
            userId => {

                if (!userId) {
                    return;
                }

                socket.userId =
                    userId.toString();

                addOnlineUser(
                    userId,
                    socket.id
                );

                console.log(
                    "User online:",
                    userId
                );

                io.emit(
                    "online-users",
                    getOnlineUserIds()
                );

            }
        );


        // ==========================
        // JOIN CHAT ROOM
        // ==========================

        socket.on(
            "join-room",
            roomId => {

                if (!roomId) {
                    return;
                }

                socket.join(
                    roomId.toString()
                );

                console.log(
                    `Socket ${socket.id} joined room ${roomId}`
                );

            }
        );


        // ==========================
        // LEAVE CHAT ROOM
        // ==========================

        socket.on(
            "leave-room",
            roomId => {

                if (!roomId) {
                    return;
                }

                socket.leave(
                    roomId.toString()
                );

            }
        );


        // ==========================
        // REAL-TIME MESSAGE
        // ==========================

        socket.on(
            "send-message",
            message => {

                if (!message) {
                    return;
                }

                const {
                    roomId,
                    receiver
                } = message;


                if (!roomId) {
                    return;
                }


                // Send to everyone inside
                // current chat room

                io.to(
                    roomId.toString()
                ).emit(
                    "receive-message",
                    message
                );


                // Also send directly to receiver
                // even if receiver has not joined
                // the room yet.

                const receiverId =
                    receiver?._id ||
                    receiver?.id ||
                    receiver;


                if (receiverId) {

                    sendToUser(
                        receiverId,
                        "direct-message",
                        message
                    );

                }

            }
        );


        // ==========================
        // TYPING
        // ==========================

        socket.on(
            "typing",
            ({
                roomId,
                userId
            }) => {

                if (!roomId) {
                    return;
                }

                socket
                    .to(roomId.toString())
                    .emit(
                        "user-typing",
                        {
                            userId
                        }
                    );

            }
        );


        // ==========================
        // STOP TYPING
        // ==========================

        socket.on(
            "stop-typing",
            ({
                roomId,
                userId
            }) => {

                if (!roomId) {
                    return;
                }

                socket
                    .to(roomId.toString())
                    .emit(
                        "user-stop-typing",
                        {
                            userId
                        }
                    );

            }
        );


        // ==========================
        // MESSAGE SEEN
        // ==========================

        socket.on(
            "message-seen",
            ({
                roomId,
                senderId,
                receiverId
            }) => {

                if (!roomId) {
                    return;
                }


                io.to(
                    roomId.toString()
                ).emit(
                    "messages-seen",
                    {
                        senderId,
                        receiverId
                    }
                );


                if (senderId) {

                    sendToUser(
                        senderId,
                        "messages-seen",
                        {
                            senderId,
                            receiverId
                        }
                    );

                }

            }
        );


        // ==========================
        // DISCONNECT
        // ==========================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "🔴 Socket disconnected:",
                    socket.id
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


// ==========================
// START SERVER
// ==========================

server.listen(
    PORT,
    () => {

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        console.log(
            "💬 Socket.io real-time chat enabled"
        );

    }
);
