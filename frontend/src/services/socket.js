// frontend/src/services/socket.js

import { io } from "socket.io-client";

/* =========================================================
   JR STORE - SOCKET SERVICE
   Production-ready Messenger + WebRTC socket service
========================================================= */

const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";

let socket = null;
let currentUserId = null;


/* =========================================================
   CONNECT SOCKET
========================================================= */

export const connectSocket = (userId) => {

    if (!userId) {
        return null;
    }

    currentUserId = String(userId);

    /* Already connected */
    if (socket?.connected) {

        socket.emit(
            "user-online",
            currentUserId
        );

        return socket;
    }


    /* Existing socket but reconnecting */
    if (socket) {

        socket.auth = {
            userId: currentUserId
        };

        if (!socket.connected) {
            socket.connect();
        }

        return socket;
    }


    socket = io(
        SOCKET_URL,
        {
            transports: [
                "websocket",
                "polling"
            ],

            auth: {
                userId: currentUserId
            },

            reconnection: true,

            reconnectionAttempts: Infinity,

            reconnectionDelay: 1000,

            reconnectionDelayMax: 5000,

            randomizationFactor: 0.5,

            timeout: 20000,

            autoConnect: true,

            forceNew: false
        }
    );


    /* =====================================================
       CONNECT
    ===================================================== */

    socket.on(
        "connect",
        () => {

            console.log(
                "🟢 JR Store socket connected:",
                socket.id
            );

            socket.emit(
                "user-online",
                currentUserId
            );

        }
    );


    /* =====================================================
       RECONNECT
    ===================================================== */

    socket.io.on(
        "reconnect",
        () => {

            console.log(
                "🔄 JR Store socket reconnected"
            );

            if (currentUserId) {

                socket.emit(
                    "user-online",
                    currentUserId
                );

            }

        }
    );


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
        "disconnect",
        (reason) => {

            console.log(
                "🔴 JR Store socket disconnected:",
                reason
            );

        }
    );


    /* =====================================================
       CONNECT ERROR
    ===================================================== */

    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "❌ JR Store socket connection error:",
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
   IS CONNECTED
========================================================= */

export const isSocketConnected = () => {

    return Boolean(
        socket?.connected
    );

};


/* =========================================================
   DISCONNECT SOCKET
========================================================= */

export const disconnectSocket = () => {

    if (!socket) {
        return;
    }

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


/* =========================================================
   EMIT
========================================================= */

export const emitSocket = (
    event,
    payload
) => {

    if (!socket) {
        return false;
    }

    if (!socket.connected) {
        return false;
    }

    try {

        socket.emit(
            event,
            payload
        );

        return true;

    } catch (error) {

        console.error(
            `Socket emit error [${event}]:`,
            error
        );

        return false;
    }
};


/* =========================================================
   LISTEN
========================================================= */

export const onSocket = (
    event,
    callback
) => {

    if (!socket || typeof callback !== "function") {
        return () => {};
    }

    socket.on(
        event,
        callback
    );

    return () => {

        socket?.off(
            event,
            callback
        );

    };
};


/* =========================================================
   LISTEN ONCE
========================================================= */

export const onceSocket = (
    event,
    callback
) => {

    if (!socket || typeof callback !== "function") {
        return () => {};
    }

    socket.once(
        event,
        callback
    );

    return () => {

        socket?.off(
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
        return false;
    }

    return emitSocket(
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
        return false;
    }

    return emitSocket(
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

    if (!payload) {
        return false;
    }

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
   WEBRTC OFFER
========================================================= */

export const sendWebRTCOffer = (
    payload
) => {

    return emitSocket(
        "webrtc-offer",
        payload
    );
};


/* =========================================================
   WEBRTC ANSWER
========================================================= */

export const sendWebRTCAnswer = (
    payload
) => {

    return emitSocket(
        "webrtc-answer",
        payload
    );
};


/* =========================================================
   ICE CANDIDATE
========================================================= */

export const sendICECandidate = (
    payload
) => {

    return emitSocket(
        "webrtc-ice-candidate",
        payload
    );
};


/* =========================================================
   CALL BUSY
========================================================= */

export const sendCallBusy = (
    payload
) => {

    return emitSocket(
        "call-busy",
        payload
    );
};


/* =========================================================
   CALL MISSED
========================================================= */

export const sendCallMissed = (
    payload
) => {

    return emitSocket(
        "call-missed",
        payload
    );
};


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

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
