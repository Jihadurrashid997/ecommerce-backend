const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const isDatabaseReady = require("./services/databaseHealth");
const {
    canJoinDirectConversationRoom
} = require("./services/socketRoomAccess");
const {
    canHandleDirectCall,
    canStartDirectCall,
    getConnectedCallDuration,
    hasBlockedUser
} = require("./services/directCallAccess");
const Message = require("./models/Message");
const User = require("./models/User");
const Order = require("./models/Order");
const ShopNotification = require("./models/ShopNotification");
const GroupConversation = require("./models/GroupConversation");
const DeviceSession = require("./models/DeviceSession");
const { sendPushToUsers } = require("./services/pushNotifications");
const { purgeExpiredStories } = require("./services/storyCleanup");
const { startOrderReservationCleanup } = require("./services/orderReservationCleanup");

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
    "http://localhost:5173",
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS || "").split(",")
]
    .filter(Boolean)
    .map(origin => origin.trim().replace(/\/+$/, ""));

app.use(
    cors({
        origin: (origin, callback) => {

            if (!origin) {
                return callback(null, true);
            }

            return callback(null, allowedOrigins.includes(origin));
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
            "Authorization",
            "Idempotency-Key"
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
        const databaseReady =
            isDatabaseReady(mongoose.connection.readyState);

        res.status(databaseReady ? 200 : 503).json({
            success: databaseReady,
            message: databaseReady
                ? "JR Store API is running"
                : "JR Store API database is unavailable",
            service: "ecommerce-backend",
            database: databaseReady ? "connected" : "disconnected",
            socket: "enabled",
            timestamp: new Date().toISOString()
        });

    }
);

app.get(
    "/api/health",
    (req, res) => {
        const databaseReady =
            isDatabaseReady(mongoose.connection.readyState);

        res.status(databaseReady ? 200 : 503).json({
            success: databaseReady,
            message: databaseReady
                ? "JR Store API is healthy"
                : "JR Store API database is unavailable",
            database: databaseReady ? "connected" : "disconnected",
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
    "/api/notifications",
    require("./routes/platformNotificationRoutes")
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
    "/api/shop-notifications",
    require("./routes/shopNotificationRoutes")
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

app.use(
    "/api/groups",
    require("./routes/groupRoutes")
);

app.use(
    "/api/posts",
    require("./routes/postRoutes")
);
app.use(
    "/api/stories",
    require("./routes/storyRoutes")
);
app.use(
    "/api/communities",
    require("./routes/communityRoutes")
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
                origin: allowedOrigins,
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

app.set("io", io);

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
            return false;
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

            // Fully offline now (no other tabs/devices
            // still connected for this user).
            return true;

        }

        return false;

    };

const getOnlineUsers =
    () => {

        return Array.from(
            onlineUsers.keys()
        );

    };

io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = normalizeId(decoded?.id || decoded?._id || decoded?.userId);

        if (!userId) {
            return next(new Error("Invalid socket identity"));
        }

        if (decoded.sid) {
            const session = await DeviceSession.findOne({
                user: userId,
                sessionId: decoded.sid,
                deviceId: decoded.deviceId
            }).select("_id");
            if (!session) {
                return next(new Error("This device session has been revoked"));
            }
            socket.data.sessionId = decoded.sid;
        }

        socket.userId = userId;
        return next();
    } catch (error) {
        return next(new Error("Invalid or expired socket token"));
    }
});

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
        if (socket.data.sessionId) {
            socket.join(`device:${socket.data.sessionId}`);
        }

        /* =================================================
           USER ONLINE
        ================================================= */

        socket.on(
            "user-online",
            userId => {

                const id =
                    normalizeId(userId);

                if (!id || id !== socket.userId) {
                    return;
                }

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
            async roomId => {

                if (!roomId) {
                    return;
                }

                const groupRoom =
                    /^group:([a-f\d]{24})$/i.exec(String(roomId));

                if (groupRoom) {
                    if (!socket.userId) {
                        return;
                    }

                    try {
                        const isMember = await GroupConversation.exists({
                            _id: groupRoom[1],
                            participants: socket.userId
                        });

                        if (!isMember) {
                            return;
                        }
                    } catch (error) {
                        console.error("Group room membership check error:", error);
                        return;
                    }
                } else if (
                    !canJoinDirectConversationRoom(
                        roomId,
                        socket.userId
                    )
                ) {
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

        socket.on(
            "group-call-invite",
            async payload => {
                const callerId = socket.userId;
                const groupId = normalizeId(payload?.groupId);
                const callId =
                    typeof payload?.callId === "string" &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.callId)
                        ? payload.callId
                        : crypto.randomUUID();

                if (
                    !callerId ||
                    !groupId ||
                    !/^[a-f\d]{24}$/i.test(groupId)
                ) {
                    return;
                }

                try {
                    const group = await GroupConversation.findOne({
                        _id: groupId,
                        participants: callerId
                    }).select("name participants");

                    if (!group) {
                        return;
                    }

                    const caller = await User.findById(callerId)
                        .select("name profileImage")
                        .lean();
                    const invitation = {
                        groupId,
                        callId,
                        groupName: group.name,
                        callerId,
                        callerName: caller?.name || "Group member",
                        callerAvatar: caller?.profileImage || "",
                        type: payload?.type === "video" ? "video" : "audio",
                        startedAt: Date.now()
                    };

                    group.participants.forEach(memberId => {
                        if (String(memberId) !== callerId) {
                            sendToUser(
                                String(memberId),
                                "group-call-incoming",
                                invitation
                            );
                        }
                    });
                } catch (error) {
                    console.error("Group call invitation error:", error);
                }
            }
        );

        /* =================================================
           SEND MESSAGE
        ================================================= */

        socket.on(
            "send-message",
            async payload => {

                if (!payload) {
                    return;
                }

                if (payload.groupId) {
                    const senderId = socket.userId;
                    const groupId = normalizeId(payload.groupId);

                    if (!senderId || !groupId) {
                        return;
                    }

                    try {
                        const group = await GroupConversation.findOne({
                            _id: groupId,
                            participants: senderId
                        }).select("participants");

                        if (!group) {
                            return;
                        }

                        const messageId =
                            normalizeId(payload._id || payload.id);
                        const storedMessage = messageId
                            ? await Message.findOne({
                                  _id: messageId,
                                  groupId,
                                  sender: senderId
                              }).populate(
                                  "sender",
                                  "name username fullName displayName isVerified"
                              ).populate({
                                  path: "replyTo",
                                  select: "message fileUrl fileName fileType sender createdAt",
                                  populate: {
                                      path: "sender",
                                      select: "name username fullName displayName"
                                  }
                              }).populate(
                                  "reactions.user",
                                  "name username fullName displayName"
                              )
                            : null;

                        if (!storedMessage) {
                            return;
                        }

                        const roomId = `group:${groupId}`;
                        const message = {
                            ...storedMessage.toObject(),
                            _id: String(storedMessage._id),
                            id: String(storedMessage._id),
                            groupId,
                            roomId,
                            senderId,
                            senderName:
                                storedMessage.sender?.name ||
                                storedMessage.sender?.username ||
                                storedMessage.sender?.fullName ||
                                storedMessage.sender?.displayName ||
                                "Group member",
                            receiver: null,
                            receiverId: null,
                            timestamp: new Date(storedMessage.createdAt).getTime()
                        };

                        io.to(roomId).emit("group-message", message);

                        group.participants.forEach(memberId => {
                            sendToUser(
                                memberId,
                                "group-message-notification",
                                message
                            );
                        });
                        void sendPushToUsers({
                            userIds: group.participants
                                .filter(memberId =>
                                    String(memberId) !== String(senderId)
                                ),
                            title: "New group message",
                            tag: `messenger-group-${groupId}`
                        }).catch(error => {
                            console.error("Group message push error:", error);
                        });
                    } catch (error) {
                        console.error("Group message socket error:", error);
                    }

                    return;
                }

                const senderId = socket.userId;

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

                const messageId =
                    normalizeId(payload._id || payload.id);

                if (!senderId || !receiverId || !messageId) {
                    return;
                }

                let storedMessage;

                try {
                    storedMessage = await Message.findOne({
                        _id: messageId,
                        sender: senderId,
                        receiver: receiverId
                    })
                        .populate(
                            "sender",
                            "name email role profileImage avatar username fullName displayName firstName isVerified"
                        )
                        .populate(
                            "receiver",
                            "name email role profileImage avatar username fullName displayName firstName"
                        )
                        .populate({
                            path: "replyTo",
                            select: "message fileUrl fileName fileType sender createdAt",
                            populate: {
                                path: "sender",
                                select: "name username fullName displayName firstName"
                            }
                        })
                        .populate({
                            path: "forwardedFrom",
                            select: "message fileUrl fileName fileType sender createdAt",
                            populate: {
                                path: "sender",
                                select: "name username fullName displayName firstName"
                            }
                        })
                        .populate(
                            "reactions.user",
                            "name username fullName displayName firstName"
                        );
                } catch (error) {
                    console.error("Load direct message for socket error:", error);
                    return;
                }

                if (!storedMessage) {
                    return;
                }

                const roomId = [senderId, receiverId].sort().join("_");
                const message = {
                    ...storedMessage.toObject(),
                    _id: String(storedMessage._id),
                    id: String(storedMessage._id),
                    roomId,
                    senderId,
                    receiverId,
                    timestamp: new Date(storedMessage.createdAt).getTime()
                };

                io.to(roomId).emit("receive-message", message);

                const wasDelivered =
                    sendToUser(
                        receiverId,
                        "direct-message",
                        message
                    );
                void sendPushToUsers({
                    userIds: [receiverId],
                    title: "New message",
                    tag: `messenger-message-${messageId}`
                }).catch(error => {
                    console.error("Direct message push error:", error);
                });

                /*
                 * DELIVERED STATUS:
                 * If the receiver currently has an
                 * active socket connection, the message
                 * just reached their device - mark it
                 * delivered and tell the sender right
                 * away so their tick can update from
                 * single-check to double-check, without
                 * waiting for the receiver to actually
                 * open the chat (that's what flips it to
                 * "seen" instead, via message-seen).
                 */

                if (
                    wasDelivered &&
                    messageId
                ) {

                    Message.findByIdAndUpdate(
                        messageId,
                        {
                            isDelivered: true
                        }
                    ).catch(
                        error => {

                            console.error(
                                "Mark delivered error:",
                                error
                            );

                        }
                    );

                    sendToUser(
                        senderId,
                        "message-delivered",
                        {
                            messageId,
                            receiverId
                        }
                    );

                }

            }
        );

        /* =================================================
           TYPING
        ================================================= */

        socket.on(
            "typing",
            async payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                const groupRoom =
                    /^group:([a-f\d]{24})$/i.exec(String(payload.roomId));

                if (groupRoom) {
                    try {
                        const isMember = await GroupConversation.exists({
                            _id: groupRoom[1],
                            participants: socket.userId
                        });
                        if (!isMember) {
                            return;
                        }
                    } catch (error) {
                        console.error("Group typing membership check error:", error);
                        return;
                    }
                }

                socket
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "user-typing",
                        groupRoom
                            ? {
                                  userId: socket.userId,
                                  groupId: groupRoom[1]
                              }
                            : { userId: socket.userId }
                    );

            }
        );

        /* =================================================
           STOP TYPING
        ================================================= */

        socket.on(
            "stop-typing",
            async payload => {

                if (
                    !payload?.roomId
                ) {
                    return;
                }

                const groupRoom =
                    /^group:([a-f\d]{24})$/i.exec(String(payload.roomId));

                if (groupRoom) {
                    try {
                        const isMember = await GroupConversation.exists({
                            _id: groupRoom[1],
                            participants: socket.userId
                        });
                        if (!isMember) {
                            return;
                        }
                    } catch (error) {
                        console.error("Group stop-typing membership check error:", error);
                        return;
                    }
                }

                socket
                    .to(
                        String(
                            payload.roomId
                        )
                    )
                    .emit(
                        "user-stop-typing",
                        groupRoom
                            ? {
                                  userId: socket.userId,
                                  groupId: groupRoom[1]
                              }
                            : { userId: socket.userId }
                    );

            }
        );

        /* =================================================
           MESSAGE SEEN
        ================================================= */

        socket.on(
            "message-seen",
            async payload => {

                if (!payload) {
                    return;
                }

                const senderId = normalizeId(payload.senderId);
                const messageId = normalizeId(payload.messageId);
                const receiverId = socket.userId;

                if (!senderId || !messageId || !receiverId) {
                    return;
                }

                try {
                    const message = await Message.findOneAndUpdate(
                        {
                            _id: messageId,
                            sender: senderId,
                            receiver: receiverId
                        },
                        {
                            $set: {
                                isSeen: true,
                                isDelivered: true
                            }
                        },
                        { new: true }
                    ).select("_id");

                    if (!message) {
                        return;
                    }

                    sendToUser(senderId, "messages-seen", {
                        senderId,
                        receiverId,
                        messageId: String(message._id)
                    });
                } catch (error) {
                    console.error("Message seen socket validation error:", error);
                }
            }
        );


        /* =================================================
           MESSAGE REACTION
        ================================================= */

        socket.on(
            "message-reaction",
            async payload => {

                if (
                    !payload ||
                    !payload.message
                ) {
                    return;
                }

                const groupId =
                    normalizeId(payload.message.groupId);

                if (groupId) {
                    try {
                        const isMember = await GroupConversation.exists({
                            _id: groupId,
                            participants: socket.userId
                        });

                        if (!isMember) {
                            return;
                        }

                        const messageId =
                            normalizeId(
                                payload.message._id ||
                                payload.message.id
                            );
                        const storedMessage = messageId
                            ? await Message.findOne({
                                  _id: messageId,
                                  groupId
                              }).populate(
                                  "sender reactions.user",
                                  "name username fullName displayName"
                              )
                            : null;

                        if (!storedMessage) {
                            return;
                        }

                        io.to(`group:${groupId}`).emit(
                            "message-reaction",
                            { message: storedMessage }
                        );
                    } catch (error) {
                        console.error("Group reaction membership check error:", error);
                    }

                    return;
                }

                const messageId =
                    normalizeId(
                        payload.message._id ||
                        payload.message.id
                    );
                const actorId = socket.userId;

                if (!messageId || !actorId) {
                    return;
                }

                try {
                    const storedMessage = await Message.findById(messageId)
                        .populate(
                            "sender reactions.user",
                            "name username fullName displayName"
                        )
                        .populate(
                            "receiver",
                            "name username fullName displayName"
                        );

                    if (!storedMessage) {
                        return;
                    }

                    const senderId = normalizeId(storedMessage.sender?._id);
                    const receiverId = normalizeId(storedMessage.receiver?._id);

                    if (![senderId, receiverId].includes(actorId)) {
                        return;
                    }

                    const message = storedMessage.toObject();
                    const event = { message };

                    [senderId, receiverId]
                        .filter(Boolean)
                        .forEach(userId => {
                            sendToUser(userId, "message-reaction", event);
                        });
                } catch (error) {
                    console.error("Direct message reaction validation error:", error);
                }

            }
        );

/* =========================================================
   CALL USER
========================================================= */

socket.on(
    "call-user",
    async payload => {

        if (!payload) {
            return;
        }

        const callerId = normalizeId(socket.userId)?.toLowerCase();
        const requestedCallerId =
            normalizeId(payload.callerId)?.toLowerCase();

        const receiverId =
            normalizeId(payload.receiverId)?.toLowerCase();

        const roomId =
            payload.roomId
                ? String(payload.roomId).toLowerCase()
                : null;

        const callType =
            payload.type === "video"
                ? "video"
                : "audio";

        if (
            !callerId ||
            !receiverId ||
            !roomId ||
            (requestedCallerId && requestedCallerId !== callerId) ||
            !canStartDirectCall({
                socketUserId: callerId,
                callerId,
                receiverId,
                roomId
            })
        ) {
            return;
        }

        const callId = crypto.randomUUID();
        let caller;
        let receiver;
        try {
            [caller, receiver] = await Promise.all([
                User.findById(callerId)
                    .select("blockedUsers")
                    .lean(),
                User.findById(receiverId)
                    .select("blockedUsers")
                    .lean()
            ]);
        } catch (error) {
            console.error("Direct call participant lookup error:", error);
            sendToUser(callerId, "call-rejected", {
                callId,
                roomId,
                callerId,
                receiverId,
                type: callType,
                status: "rejected",
                reason: "unavailable"
            });
            return;
        }

        if (!caller || !receiver) {
            sendToUser(callerId, "call-rejected", {
                callId,
                roomId,
                callerId,
                receiverId,
                type: callType,
                status: "rejected",
                reason: "unavailable"
            });
            return;
        }

        const blockedByCaller = hasBlockedUser(caller, receiverId);
        const blockedByReceiver = hasBlockedUser(receiver, callerId);
        if (blockedByCaller || blockedByReceiver) {
            sendToUser(callerId, "call-rejected", {
                callId,
                roomId,
                callerId,
                receiverId,
                type: callType,
                status: "rejected",
                reason: "blocked"
            });
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
                    callId,
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
                    callId,
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

            callId,

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

        const receiverIsReachable =
            sendToUser(
                receiverId,
                "incoming-call",
                callData
            );


        /* -----------------------------------------
           SEND RINGING
           
           IMPORTANT:
           Only caller gets call-ringing, and only
           when the receiver's device actually
           received the incoming-call signal above.
           Previously this was sent unconditionally,
           so a caller would see "Ringing" even when
           the other person was completely offline
           and never got notified at all. Now the
           caller correctly stays on "Calling..."
           until either the receiver's device picks
           it up (this event) or the ring timeout
           below fires a missed call.
        ----------------------------------------- */

        if (receiverIsReachable) {

            sendToUser(
                callerId,
                "call-ringing",
                {
                    ...callData,
                    status: "ringing"
                }
            );

        }


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
                ? String(payload.roomId).toLowerCase()
                : null;

        const callerId =
            normalizeId(payload.callerId)?.toLowerCase();

        const receiverId =
            normalizeId(payload.receiverId)?.toLowerCase() ||
            normalizeId(socket.userId)?.toLowerCase();


        if (!roomId || !callerId || !receiverId) {
            return;
        }


        const call =
            getCall(roomId);


        if (
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: socket.userId,
                callerId,
                receiverId,
                role: "receiver"
            }) ||
            call.status !== "ringing"
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
                ? String(payload.roomId).toLowerCase()
                : null;

        const callerId =
            normalizeId(payload.callerId)?.toLowerCase();

        const receiverId =
            normalizeId(payload.receiverId)?.toLowerCase() ||
            normalizeId(socket.userId)?.toLowerCase();


        if (
            !roomId ||
            !callerId ||
            !receiverId
        ) {
            return;
        }


        const call =
            getCall(roomId);


        if (
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: socket.userId,
                callerId,
                receiverId,
                role: "receiver"
            }) ||
            call.status !== "ringing"
        ) {
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
   CALL CONNECTED
========================================================= */

socket.on(
    "call-connected",
    payload => {
        const roomId = String(payload?.roomId || "").toLowerCase();
        const call = getCall(roomId);
        const participantId = normalizeId(socket.userId)?.toLowerCase();
        const otherParticipantId =
            participantId === call?.callerId
                ? call?.receiverId
                : call?.callerId;

        if (
            !call ||
            call.status !== "accepted" ||
            !participantId ||
            (payload?.callId && payload.callId !== call.callId) ||
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: participantId,
                callerId: participantId,
                receiverId: otherParticipantId,
                role: "participant"
            })
        ) {
            return;
        }

        if (!call.connectedAt) {
            call.connectedAt = Date.now();
            activeCalls.set(roomId, call);
            emitCallToBoth(call, "call-connected", {
                connectedAt: call.connectedAt
            });
        }
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
            normalizeId(payload.callerId)?.toLowerCase();

        const receiverId =
            normalizeId(payload.receiverId)?.toLowerCase();

        const roomId =
            payload.roomId
                ? String(payload.roomId).toLowerCase()
                : null;

        const call = getCall(roomId);
        if (
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: socket.userId,
                callerId,
                receiverId,
                role: "receiver"
            }) ||
            call.status !== "ringing"
        ) {
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


        clearCall(roomId);

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
                ? String(payload.roomId).toLowerCase()
                : null;

        if (!roomId) {
            return;
        }


        const call =
            getCall(roomId);


        if (!call) {
            return;
        }


        const senderId = normalizeId(socket.userId)?.toLowerCase();
        const otherUserId =
            senderId === call.callerId
                ? call.receiverId
                : call.callerId;

        if (
            !senderId ||
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: senderId,
                callerId: senderId,
                receiverId: otherUserId,
                role: "participant"
            })
        ) {
            return;
        }


        /* -----------------------------------------
           DURATION

           Count only from the first successful peer
           connection; a call that only rang stays at 0.
        ----------------------------------------- */

        const duration = getConnectedCallDuration(call);


        const endedPayload = {

            ...call,

            endedBy:
                senderId,

            status:
                "ended",

            duration

        };


        /* -----------------------------------------
           NOTIFY BOTH PARTIES

           Previously only the other user got
           "call-ended", so whoever pressed "end"
           never saw a "call ended" log for their
           own side of the chat. Both sides now go
           through the exact same code path/message.
        ----------------------------------------- */

        sendToUser(
            otherUserId,
            "call-ended",
            endedPayload
        );

        sendToUser(
            senderId,
            "call-ended",
            endedPayload
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
            normalizeId(payload.receiverId)?.toLowerCase();

        const callerId =
            normalizeId(payload.callerId)?.toLowerCase() ||
            normalizeId(socket.userId)?.toLowerCase();

        const roomId =
            payload.roomId
                ? String(payload.roomId).toLowerCase()
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
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: socket.userId,
                callerId,
                receiverId,
                role: "caller"
            }) ||
            call.status !== "accepted"
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
            normalizeId(payload.receiverId)?.toLowerCase();

        const callerId =
            normalizeId(payload.callerId)?.toLowerCase();

        const roomId =
            payload.roomId
                ? String(payload.roomId).toLowerCase()
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
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: socket.userId,
                callerId,
                receiverId,
                role: "receiver"
            }) ||
            call.status !== "accepted"
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
            normalizeId(payload.receiverId)?.toLowerCase();

        const callerId =
            normalizeId(payload.callerId)?.toLowerCase() ||
            normalizeId(socket.userId)?.toLowerCase();

        const roomId =
            payload.roomId
                ? String(payload.roomId).toLowerCase()
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
            !canHandleDirectCall({
                call,
                roomId,
                socketUserId: socket.userId,
                callerId,
                receiverId,
                role: "participant"
            }) ||
            call.status !== "accepted"
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

                                    duration:
                                        getConnectedCallDuration(call),

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

                if (
                    socket.userId &&
                    !onlineUsers.has(
                        socket.userId
                    )
                ) {

                    const lastSeen =
                        new Date();

                    User.findByIdAndUpdate(
                        socket.userId,
                        {
                            lastSeen
                        }
                    ).catch(
                        error => {

                            console.error(
                                "Save lastSeen error:",
                                error
                            );

                        }
                    );

                    io.emit(
                        "user-last-seen",
                        {
                            userId:
                                socket.userId,
                            lastSeen:
                                lastSeen.getTime()
                        }
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
            await Promise.all([
                Order.createIndexes(),
                ShopNotification.createIndexes()
            ]);

            const storyCleanupTimer = setInterval(() => {
                void purgeExpiredStories().catch(error => {
                    console.error("Scheduled story cleanup error:", error);
                });
            }, 60 * 60 * 1000);
            storyCleanupTimer.unref();
            startOrderReservationCleanup();

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
