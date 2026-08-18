// frontend/src/services/socket.js

import { io } from "socket.io-client";

const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";

let socket = null;
let currentUserId = null;

const connectSocket = (userId) => {
    if (!userId) return null;

    currentUserId = String(userId);

    if (socket?.connected) {
        socket.emit("user-online", currentUserId);
        return socket;
    }

    if (socket) {
        socket.auth = {
            userId: currentUserId
        };

        if (!socket.connected) {
            socket.connect();
        }

        return socket;
    }

    socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        auth: {
            userId: currentUserId
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true
    });

    socket.on("connect", () => {
        console.log(
            "🟢 Socket connected:",
            socket.id
        );

        if (currentUserId) {
            socket.emit(
                "user-online",
                currentUserId
            );
        }
    });

    socket.on("disconnect", (reason) => {
        console.log(
            "🔴 Socket disconnected:",
            reason
        );
    });

    socket.on("connect_error", (error) => {
        console.error(
            "❌ Socket connection error:",
            error?.message || error
        );
    });

    return socket;
};

const getSocket = () => socket;

const isSocketConnected = () =>
    Boolean(socket?.connected);

const disconnectSocket = () => {
    if (!socket) return;

    try {
        socket.removeAllListeners();
        socket.disconnect();
    } catch (error) {
        console.error(
            "Socket disconnect error:",
            error
        );
    }

    socket = null;
    currentUserId = null;
};

const emitSocket = (
    event,
    payload
) => {
    if (!socket?.connected) {
        return false;
    }

    socket.emit(event, payload);

    return true;
};

const onSocket = (
    event,
    callback
) => {
    if (
        !socket ||
        typeof callback !== "function"
    ) {
        return () => {};
    }

    socket.on(event, callback);

    return () => {
        socket?.off(event, callback);
    };
};

const onceSocket = (
    event,
    callback
) => {
    if (
        !socket ||
        typeof callback !== "function"
    ) {
        return () => {};
    }

    socket.once(event, callback);

    return () => {
        socket?.off(event, callback);
    };
};

const offSocket = (
    event,
    callback
) => {
    if (!socket) return;

    if (callback) {
        socket.off(event, callback);
    } else {
        socket.off(event);
    }
};

const joinRoom = (roomId) => {
    if (!roomId) return false;

    return emitSocket(
        "join-room",
        String(roomId)
    );
};

const leaveRoom = (roomId) => {
    if (!roomId) return false;

    return emitSocket(
        "leave-room",
        String(roomId)
    );
};

const sendSocketMessage = (payload) =>
    emitSocket(
        "send-message",
        payload
    );

const startTyping = (payload) =>
    emitSocket(
        "typing",
        payload
    );

const stopTyping = (payload) =>
    emitSocket(
        "stop-typing",
        payload
    );

const markMessagesSeen = (payload) =>
    emitSocket(
        "message-seen",
        payload
    );

const callUser = (payload) =>
    emitSocket(
        "call-user",
        payload
    );

const acceptCall = (payload) =>
    emitSocket(
        "accept-call",
        payload
    );

const rejectCall = (payload) =>
    emitSocket(
        "reject-call",
        payload
    );

const endCall = (payload) =>
    emitSocket(
        "end-call",
        payload
    );

const sendWebRTCOffer = (payload) =>
    emitSocket(
        "webrtc-offer",
        payload
    );

const sendWebRTCAnswer = (payload) =>
    emitSocket(
        "webrtc-answer",
        payload
    );

const sendICECandidate = (payload) =>
    emitSocket(
        "webrtc-ice-candidate",
        payload
    );

const sendCallBusy = (payload) =>
    emitSocket(
        "call-busy",
        payload
    );

const sendCallMissed = (payload) =>
    emitSocket(
        "call-missed",
        payload
    );


/*
   IMPORTANT:
   Messenger.jsx uses:
   import socket, { connectSocket } ...
   
   So default export must be the actual
   Socket.IO instance, not the service object.
*/

export {
    connectSocket,
    getSocket,
    isSocketConnected,
    disconnectSocket,
    emitSocket,
    onSocket,
    onceSocket,
    offSocket,
    joinRoom,
    leaveRoom,
    sendSocketMessage,
    startTyping,
    stopTyping,
    markMessagesSeen,
    callUser,
    acceptCall,
    rejectCall,
    endCall,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendICECandidate,
    sendCallBusy,
    sendCallMissed
};

export default {
    on: (...args) =>
        socket?.on(...args),

    off: (...args) =>
        socket?.off(...args),

    once: (...args) =>
        socket?.once(...args),

    emit: (...args) =>
        socket?.emit(...args),

    connect: () =>
        socket?.connect(),

    disconnect: () =>
        socket?.disconnect(),

    get connected() {
        return Boolean(
            socket?.connected
        );
    },

    get id() {
        return socket?.id;
    }
};
