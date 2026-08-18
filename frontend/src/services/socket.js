// frontend/src/services/socket.js

import { io } from "socket.io-client";


const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";


let socket = null;

let currentUserId = null;


/*
======================================================
NORMALIZE USER ID
======================================================
*/

const normalizeUserId = (
    value
) => {

    if (!value) {
        return null;
    }


    if (
        typeof value ===
        "object"
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


/*
======================================================
CREATE SOCKET
======================================================
*/

const createSocket = (
    userId
) => {

    const normalizedId =
        normalizeUserId(
            userId
        );


    if (!normalizedId) {
        return null;
    }


    currentUserId =
        normalizedId;


    socket =
        io(
            SOCKET_URL,
            {

                transports: [
                    "websocket",
                    "polling"
                ],

                auth: {
                    userId:
                        normalizedId
                },

                reconnection:
                    true,

                reconnectionAttempts:
                    Infinity,

                reconnectionDelay:
                    1000,

                reconnectionDelayMax:
                    5000,

                timeout:
                    20000,

                autoConnect:
                    true

            }
        );


    socket.on(
        "connect",
        () => {

            console.log(
                "🟢 Socket connected:",
                socket.id,
                "User:",
                currentUserId
            );


            if (
                currentUserId
            ) {

                socket.emit(
                    "user-online",
                    currentUserId
                );

            }

        }
    );


    socket.on(
        "disconnect",
        reason => {

            console.log(
                "🔴 Socket disconnected:",
                reason
            );

        }
    );


    socket.on(
        "connect_error",
        error => {

            console.error(
                "❌ Socket connection error:",
                error?.message ||
                error
            );

        }
    );


    return socket;

};


/*
======================================================
CONNECT SOCKET
======================================================
*/

const connectSocket = (
    userId
) => {

    const normalizedId =
        normalizeUserId(
            userId
        );


    if (!normalizedId) {
        return null;
    }


    /*
    If socket belongs to another user,
    completely destroy it first.
    */

    if (
        socket &&
        currentUserId &&
        currentUserId !==
            normalizedId
    ) {

        console.log(
            "🔄 Switching socket user:",
            currentUserId,
            "→",
            normalizedId
        );


        disconnectSocket();

    }


    /*
    Existing socket for same user
    */

    if (
        socket &&
        currentUserId ===
            normalizedId
    ) {

        if (
            socket.connected
        ) {

            socket.emit(
                "user-online",
                normalizedId
            );

        } else {

            socket.auth = {
                userId:
                    normalizedId
            };


            socket.connect();

        }


        return socket;

    }


    return createSocket(
        normalizedId
    );

};


/*
======================================================
GET SOCKET
======================================================
*/

const getSocket = () =>
    socket;


/*
======================================================
CONNECTED?
======================================================
*/

const isSocketConnected =
    () =>
        Boolean(
            socket?.connected
        );


/*
======================================================
DISCONNECT SOCKET
======================================================
*/

const disconnectSocket = () => {

    if (!socket) {

        currentUserId =
            null;

        return;

    }


    try {

        /*
        Remove every listener
        */

        socket.removeAllListeners();


        /*
        Disconnect completely
        */

        socket.disconnect();

    } catch (
        error
    ) {

        console.error(
            "Socket disconnect error:",
            error
        );

    }


    socket =
        null;


    currentUserId =
        null;

};


/*
======================================================
EMIT
======================================================
*/

const emitSocket = (
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


/*
======================================================
ON
======================================================
*/

const onSocket = (
    event,
    callback
) => {

    if (
        !socket ||
        typeof callback !==
            "function"
    ) {

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


/*
======================================================
ONCE
======================================================
*/

const onceSocket = (
    event,
    callback
) => {

    if (
        !socket ||
        typeof callback !==
            "function"
    ) {

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


/*
======================================================
OFF
======================================================
*/

const offSocket = (
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


/*
======================================================
ROOM
======================================================
*/

const joinRoom = (
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


const leaveRoom = (
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


/*
======================================================
MESSAGES
======================================================
*/

const sendSocketMessage = (
    payload
) =>
    emitSocket(
        "send-message",
        payload
    );


const startTyping = (
    payload
) =>
    emitSocket(
        "typing",
        payload
    );


const stopTyping = (
    payload
) =>
    emitSocket(
        "stop-typing",
        payload
    );


const markMessagesSeen = (
    payload
) =>
    emitSocket(
        "message-seen",
        payload
    );


/*
======================================================
CALL
======================================================
*/

const callUser = (
    payload
) =>
    emitSocket(
        "call-user",
        payload
    );


const acceptCall = (
    payload
) =>
    emitSocket(
        "accept-call",
        payload
    );


const rejectCall = (
    payload
) =>
    emitSocket(
        "reject-call",
        payload
    );


const endCall = (
    payload
) =>
    emitSocket(
        "end-call",
        payload
    );


/*
======================================================
WEBRTC
======================================================
*/

const sendWebRTCOffer = (
    payload
) =>
    emitSocket(
        "webrtc-offer",
        payload
    );


const sendWebRTCAnswer = (
    payload
) =>
    emitSocket(
        "webrtc-answer",
        payload
    );


const sendICECandidate = (
    payload
) =>
    emitSocket(
        "webrtc-ice-candidate",
        payload
    );


/*
======================================================
CALL STATUS
======================================================
*/

const sendCallBusy = (
    payload
) =>
    emitSocket(
        "call-busy",
        payload
    );


const sendCallMissed = (
    payload
) =>
    emitSocket(
        "call-missed",
        payload
    );


/*
======================================================
EXPORTS
======================================================
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


/*
======================================================
DEFAULT EXPORT
======================================================
*/

export default {

    on: (
        ...args
    ) =>
        socket?.on(
            ...args
        ),


    off: (
        ...args
    ) =>
        socket?.off(
            ...args
        ),


    once: (
        ...args
    ) =>
        socket?.once(
            ...args
        ),


    emit: (
        ...args
    ) =>
        socket?.emit(
            ...args
        ),


    connect: () =>
        socket?.connect(),


    disconnect: () =>
        disconnectSocket(),


    get connected() {

        return Boolean(
            socket?.connected
        );

    },


    get id() {

        return socket?.id;

    },


    get userId() {

        return currentUserId;

    }

};
