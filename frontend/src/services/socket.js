import { io } from "socket.io-client";

/* =========================================================
   JR STORE - SOCKET SERVICE
========================================================= */

const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";

let socket = null;


/* =========================================================
   CONNECT
========================================================= */

export const connectSocket = (userId) => {

    if (!userId) {
        return null;
    }

    if (socket?.connected) {
        socket.emit(
            "user-online",
            String(userId)
        );

        return socket;
    }

    socket = io(
        SOCKET_URL,
        {
            transports: [
                "websocket",
                "polling"
            ],

            reconnection: true,

            reconnectionAttempts: Infinity,

            reconnectionDelay: 1000,

            reconnectionDelayMax: 5000,

            timeout: 20000,

            autoConnect: true
        }
    );


    socket.on(
        "connect",
        () => {

            console.log(
                "🟢 Messenger socket connected:",
                socket.id
            );

            socket.emit(
                "user-online",
                String(userId)
            );

        }
    );


    socket.on(
        "disconnect",
        (reason) => {

            console.log(
                "🔴 Messenger socket disconnected:",
                reason
            );

        }
    );


    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "❌ Messenger socket error:",
                error?.message || error
            );

        }
    );


    return socket;
};


/* =========================================================
   GET SOCKET
========================================================= */

export const getSocket = () => {
    return socket;
};


/* =========================================================
   DISCONNECT
========================================================= */

export const disconnectSocket = () => {

    if (!socket) {
        return;
    }

    socket.disconnect();

    socket = null;
};


/* =========================================================
   EMIT
========================================================= */

export const emitSocket = (
    event,
    payload
) => {

    if (
        !socket ||
        !socket.connected
    ) {
        return false;
    }

    socket.emit(
        event,
        payload
    );

    return true;
};


/* =========================================================
   LISTEN
========================================================= */

export const onSocket = (
    event,
    callback
) => {

    if (!socket) {
        return () => {};
    }

    socket.on(
        event,
        callback
    );

    return () => {

        socket.off(
            event,
            callback
        );

    };
};


/* =========================================================
   REMOVE LISTENER
========================================================= */

export const offSocket = (
    event,
    callback
) => {

    if (!socket) {
        return;
    }

    if (callback) {

        socket.off(
            event,
            callback
        );

    } else {

        socket.off(
            event
        );

    }
};


/* =========================================================
   JOIN ROOM
========================================================= */

export const joinRoom = (
    roomId
) => {

    if (!roomId) {
        return;
    }

    emitSocket(
        "join-room",
        String(roomId)
    );
};


/* =========================================================
   LEAVE ROOM
========================================================= */

export const leaveRoom = (
    roomId
) => {

    if (!roomId) {
        return;
    }

    emitSocket(
        "leave-room",
        String(roomId)
    );
};


/* =========================================================
   SEND MESSAGE
========================================================= */

export const sendSocketMessage = (
    payload
) => {

    return emitSocket(
        "send-message",
        payload
    );
};


/* =========================================================
   TYPING
========================================================= */

export const startTyping = (
    payload
) => {

    return emitSocket(
        "typing",
        payload
    );
};


export const stopTyping = (
    payload
) => {

    return emitSocket(
        "stop-typing",
        payload
    );
};


/* =========================================================
   MESSAGE SEEN
========================================================= */

export const markMessagesSeen = (
    payload
) => {

    return emitSocket(
        "message-seen",
        payload
    );
};


/* =========================================================
   CALL
========================================================= */

export const callUser = (
    payload
) => {

    return emitSocket(
        "call-user",
        payload
    );
};


export const acceptCall = (
    payload
) => {

    return emitSocket(
        "accept-call",
        payload
    );
};


export const rejectCall = (
    payload
) => {

    return emitSocket(
        "reject-call",
        payload
    );
};


export const endCall = (
    payload
) => {

    return emitSocket(
        "end-call",
        payload
    );
};


/* =========================================================
   WEBRTC SIGNALING
========================================================= */

export const sendWebRTCOffer = (
    payload
) => {

    return emitSocket(
        "webrtc-offer",
        payload
    );
};


export const sendWebRTCAnswer = (
    payload
) => {

    return emitSocket(
        "webrtc-answer",
        payload
    );
};


export const sendICECandidate = (
    payload
) => {

    return emitSocket(
        "webrtc-ice-candidate",
        payload
    );
};


/* =========================================================
   CALL STATUS
========================================================= */

export const sendCallBusy = (
    payload
) => {

    return emitSocket(
        "call-busy",
        payload
    );
};


export const sendCallMissed = (
    payload
) => {

    return emitSocket(
        "call-missed",
        payload
    );
};


export default {
    connectSocket,
    getSocket,
    disconnectSocket,
    emitSocket,
    onSocket,
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
