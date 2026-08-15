import { io } from "socket.io-client";

const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";

const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

let currentUserId = null;

const registerUser = () => {
    if (!socket.connected || !currentUserId) {
        return;
    }

    socket.emit(
        "user-online",
        String(currentUserId)
    );
};

socket.on("connect", () => {
    console.log(
        "🟢 Messenger socket connected:",
        socket.id
    );

    registerUser();
});

socket.on("disconnect", (reason) => {
    console.log(
        "🔴 Messenger socket disconnected:",
        reason
    );
});

socket.on("connect_error", (error) => {
    console.error(
        "❌ Messenger socket error:",
        error?.message || error
    );
});

socket.on("reconnect", () => {
    registerUser();
});

export const connectSocket = (userId) => {
    if (userId) {
        currentUserId = String(userId);
    }

    if (!socket.connected) {
        socket.connect();
    } else {
        registerUser();
    }

    return socket;
};

export const disconnectSocket = () => {
    currentUserId = null;

    if (socket.connected) {
        socket.disconnect();
    }
};

export const getSocket = () => socket;

export const getCurrentSocketUserId = () =>
    currentUserId;

export default socket;
