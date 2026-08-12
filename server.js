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
// Middleware
// ==========================

app.use(cors());

app.use(express.json());


// ==========================
// Upload Folder
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
// Connect MongoDB
// ==========================

connectDB();


// ==========================
// API Routes
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
// Home Route
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

const io = new Server(server, {

    cors: {
        origin: "*",
        methods: [
            "GET",
            "POST"
        ]
    }

});


// ==========================
// ONLINE USERS
// ==========================

const onlineUsers = new Map();


// ==========================
// SOCKET CONNECTION
// ==========================

io.on(
    "connection",
    (socket) => {

        console.log(
            "🟢 User connected:",
            socket.id
        );


        // ==========================
        // USER ONLINE
        // ==========================

        socket.on(
            "user-online",
            (userId) => {

                if (!userId) {
                    return;
                }

                onlineUsers.set(
                    userId.toString(),
                    socket.id
                );

                console.log(
                    "User online:",
                    userId
                );


                io.emit(
                    "online-users",
                    Array.from(
                        onlineUsers.keys()
                    )
                );

            }
        );


        // ==========================
        // JOIN PRIVATE ROOM
        // ==========================

        socket.on(
            "join-room",
            (roomId) => {

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
        // SEND MESSAGE
        // ==========================

        socket.on(
            "send-message",
            (message) => {

                if (!message) {
                    return;
                }


                const {
                    roomId
                } = message;


                if (!roomId) {
                    return;
                }


                io.to(
                    roomId.toString()
                ).emit(
                    "receive-message",
                    message
                );

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
        // DISCONNECT
        // ==========================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "🔴 User disconnected:",
                    socket.id
                );


                for (
                    const [
                        userId,
                        socketId
                    ] of onlineUsers.entries()
                ) {

                    if (
                        socketId ===
                        socket.id
                    ) {

                        onlineUsers.delete(
                            userId
                        );

                        break;

                    }

                }


                io.emit(
                    "online-users",
                    Array.from(
                        onlineUsers.keys()
                    )
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
