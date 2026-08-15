import { io } from "socket.io-client";

const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";

const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

export const connectSocket = (userId) => {
    if (!socket.connected) {
        socket.connect();
    }

    if (userId) {
        socket.emit("user-online", String(userId));
    }

    return socket;
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

export const getSocket = () => socket;

export default socket;
