import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    FaSearch,
    FaPaperPlane,
    FaSmile,
    FaPaperclip,
    FaEllipsisH,
    FaPhone,
    FaVideo,
    FaInfoCircle,
    FaArrowLeft,
    FaCheck,
    FaCheckDouble,
    FaCircle,
    FaUserCircle,
    FaTimes,
    FaImage,
    FaPalette
} from "react-icons/fa";

import api from "../services/api";

import socket, {
    connectSocket
} from "../services/socket";

import {
    createPeerConnection,
    getUserMedia,
    addLocalTracks,
    closePeerConnection,
    stopMediaStream
} from "../services/webrtc";

import {
    requestNotificationPermission,
    showMessageNotification,
    showIncomingCallNotification,
    showMissedCallNotification
} from "../services/notification";

import CallModal from "./CallModal";

import "../styles/Messenger.css";


/* =========================================================
   EMOJIS
========================================================= */

const EMOJIS = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
    "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
    "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
    "🤪", "🤨", "🧐", "🤓", "😎", "🥳", "😏", "😒",
    "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖",
    "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡",
    "🤬", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑",
    "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱",
    "😴", "🤗", "🤩", "🥲", "❤️", "🧡", "💛", "💚",
    "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💖",
    "👍", "👎", "👏", "🙌", "🙏", "🔥", "🎉", "💯"
];


/* =========================================================
   CHAT BACKGROUNDS
========================================================= */

const CHAT_BACKGROUNDS = [
    {
        id: "default",
        name: "Classic",
        value: ""
    },
    {
        id: "blue",
        name: "Blue",
        value: "linear-gradient(135deg,#eef5ff,#dbeafe)"
    },
    {
        id: "purple",
        name: "Purple",
        value: "linear-gradient(135deg,#f5f3ff,#ede9fe)"
    },
    {
        id: "green",
        name: "Green",
        value: "linear-gradient(135deg,#ecfdf5,#d1fae5)"
    },
    {
        id: "sunset",
        name: "Sunset",
        value: "linear-gradient(135deg,#fff7ed,#ffedd5)"
    },
    {
        id: "dark",
        name: "Dark",
        value: "linear-gradient(135deg,#111827,#1f2937)"
    }
];


/* =========================================================
   HELPERS
========================================================= */

const getId = (value) => {

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


const getUserName = (target) => {

    if (!target) {
        return "User";
    }

    return (
        target.name ||
        target.username ||
        target.fullName ||
        target.displayName ||
        target.firstName ||
        target.email ||
        "User"
    );
};


const getAvatar = (target) => {

    if (!target) {
        return "";
    }

    return (
        target.profileImage ||
        target.avatar ||
        target.photo ||
        target.image ||
        target.profilePicture ||
        ""
    );
};


const getMessageSenderId = (item) => {

    return getId(
        item?.sender?._id ||
        item?.sender?.id ||
        item?.sender
    );

};


const getMessageReceiverId = (item) => {

    return getId(
        item?.receiver?._id ||
        item?.receiver?.id ||
        item?.receiver
    );

};


const getMessageId = (item) => {

    return (
        item?._id ||
        item?.id ||
        item?.messageId ||
        null
    );

};


/* =========================================================
   COMPONENT
========================================================= */

const Messenger = () => {

    const messagesEndRef =
        useRef(null);

    const typingTimeoutRef =
        useRef(null);

    const fileInputRef =
        useRef(null);

    const currentUserRef =
        useRef(null);

    const selectedUserRef =
        useRef(null);

    const currentRoomRef =
        useRef(null);

    const peerRef =
        useRef(null);

    const localStreamRef =
        useRef(null);

    const remoteStreamRef =
        useRef(null);

    const pendingCandidatesRef =
        useRef([]);

    const callRef =
        useRef(null);


    const [user, setUser] =
        useState(null);

    const [users, setUsers] =
        useState([]);

    const [selectedUser, setSelectedUser] =
        useState(null);

    const [messages, setMessages] =
        useState([]);

    const [message, setMessage] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [chatLoading, setChatLoading] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [typing, setTyping] =
        useState(false);

    const [onlineUsers, setOnlineUsers] =
        useState([]);

    const [unreadUsers, setUnreadUsers] =
        useState({});

    const [mobileChatOpen, setMobileChatOpen] =
        useState(false);

    const [showEmoji, setShowEmoji] =
        useState(false);

    const [showBackgrounds, setShowBackgrounds] =
        useState(false);

    const [showMenu, setShowMenu] =
        useState(false);

    const [background, setBackground] =
        useState(
            () =>
                localStorage.getItem(
                    "jr-chat-background"
                ) || "default"
        );

    const [callState, setCallState] =
        useState(null);

    const [localStream, setLocalStream] =
        useState(null);

    const [remoteStream, setRemoteStream] =
        useState(null);


    /* =====================================================
       REFS
    ===================================================== */

    useEffect(() => {

        currentUserRef.current =
            user;

    }, [user]);


    useEffect(() => {

        selectedUserRef.current =
            selectedUser;

    }, [selectedUser]);


    /* =====================================================
       LOAD USER
    ===================================================== */

    useEffect(() => {

        try {

            const saved =
                localStorage.getItem("user");

            if (saved) {

                setUser(
                    JSON.parse(saved)
                );

            }

        } catch (error) {

            console.error(
                "Messenger user error:",
                error
            );

        }

    }, []);


    const currentUserId =
        useMemo(
            () => getId(user),
            [user]
        );


    /* =====================================================
       ROOM ID
    ===================================================== */

    const getRoomId =
        useCallback(
            (first, second) => {

                const firstId =
                    getId(first);

                const secondId =
                    getId(second);

                if (
                    !firstId ||
                    !secondId
                ) {
                    return null;
                }

                return [
                    firstId,
                    secondId
                ]
                    .sort()
                    .join("_");

            },
            []
        );


    /* =====================================================
       ONLINE
    ===================================================== */

    const isOnline =
        useCallback(
            (target) => {

                const id =
                    getId(target);

                return Boolean(
                    id &&
                    onlineUsers.some(
                        item =>
                            getId(item) === id
                    )
                );

            },
            [onlineUsers]
        );


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    useEffect(() => {

        requestNotificationPermission()
            .catch(() => {});

    }, []);


    /* =====================================================
       SCROLL
    ===================================================== */

    const scrollToBottom =
        useCallback(
            (smooth = true) => {

                setTimeout(
                    () => {

                        messagesEndRef.current
                            ?.scrollIntoView({
                                behavior:
                                    smooth
                                        ? "smooth"
                                        : "auto"
                            });

                    },
                    50
                );

            },
            []
        );


    /* =====================================================
       LOAD USERS
    ===================================================== */

    const loadUsers =
        useCallback(
            async () => {

                if (!user) {
                    return;
                }

                try {

                    setLoading(true);

                    const response =
                        await api.get(
                            "/users/chat-users"
                        );

                    const data =
                        response.data?.users ||
                        response.data?.data ||
                        response.data ||
                        [];

                    const list =
                        Array.isArray(data)
                            ? data.filter(
                                  item =>
                                      getId(item) !==
                                      currentUserId
                              )
                            : [];

                    setUsers(list);

                } catch (error) {

                    console.error(
                        "Chat users error:",
                        error
                    );

                } finally {

                    setLoading(false);

                }

            },
            [
                user,
                currentUserId
            ]
        );


    useEffect(() => {

        loadUsers();

    }, [loadUsers]);


    /* =====================================================
       ADD MESSAGE WITHOUT DUPLICATE
    ===================================================== */

    const appendMessage =
        useCallback(
            (incoming) => {

                if (!incoming) {
                    return;
                }

                setMessages(
                    previous => {

                        const incomingId =
                            getMessageId(
                                incoming
                            );

                        if (
                            incomingId &&
                            previous.some(
                                item =>
                                    getMessageId(
                                        item
                                    ) ===
                                    incomingId
                            )
                        ) {
                            return previous;
                        }

                        const sameMessage =
                            previous.some(
                                item =>
                                    !incomingId &&
                                    item.message ===
                                        incoming.message &&
                                    getMessageSenderId(
                                        item
                                    ) ===
                                        getMessageSenderId(
                                            incoming
                                        ) &&
                                    Math.abs(
                                        new Date(
                                            item.createdAt ||
                                            item.timestamp ||
                                            Date.now()
                                        ).getTime() -
                                        new Date(
                                            incoming.createdAt ||
                                            incoming.timestamp ||
                                            Date.now()
                                        ).getTime()
                                    ) < 5000
                            );

                        if (sameMessage) {
                            return previous;
                        }

                        return [
                            ...previous,
                            incoming
                        ];

                    }
                );

            },
            []
        );


    /* =====================================================
       CLEAN CALL
    ===================================================== */

    const cleanupCall =
        useCallback(
            () => {

                try {

                    if (
                        currentRoomRef.current
                    ) {

                        socket.emit(
                            "leave-room",
                            currentRoomRef.current
                        );

                    }

                } catch (_) {}


                closePeerConnection(
                    peerRef.current
                );

                peerRef.current =
                    null;


                stopMediaStream(
                    localStreamRef.current
                );

                stopMediaStream(
                    remoteStreamRef.current
                );


                localStreamRef.current =
                    null;

                remoteStreamRef.current =
                    null;

                pendingCandidatesRef.current =
                    [];


                setLocalStream(null);

                setRemoteStream(null);

                setCallState(null);

                callRef.current =
                    null;

                currentRoomRef.current =
                    null;

            },
            []
        );


    /* =====================================================
       PEER
    ===================================================== */

    const createPeer =
        useCallback(
            (receiverId) => {

                const peer =
                    createPeerConnection({

                        onIceCandidate:
                            candidate => {

                                socket.emit(
                                    "webrtc-ice-candidate",
                                    {
                                        receiverId,
                                        callerId:
                                            currentUserId,
                                        candidate,
                                        roomId:
                                            currentRoomRef.current
                                    }
                                );

                            },


                        onTrack:
    event => {

        console.log(
            "📡 Remote track received:",
            event.track?.kind
        );


        let stream =
            event.streams?.[0];


        /*
         * Some browsers may not provide
         * event.streams[0].
         *
         * Build a MediaStream manually
         * in that case.
         */

        if (!stream) {

            stream =
                remoteStreamRef.current ||
                new MediaStream();

            if (
                event.track &&
                !stream
                    .getTracks()
                    .some(
                        track =>
                            track.id ===
                            event.track.id
                    )
            ) {

                stream.addTrack(
                    event.track
                );

            }

        }


        if (!stream) {
            return;
        }


        /*
         * If a new track arrives separately,
         * make sure it is added.
         */

        if (
            event.track &&
            !stream
                .getTracks()
                .some(
                    track =>
                        track.id ===
                        event.track.id
                )
        ) {

            stream.addTrack(
                event.track
            );

        }


        console.log(
            "🎧 Remote stream tracks:",
            stream
                .getTracks()
                .map(
                    track =>
                        track.kind
                )
        );


        remoteStreamRef.current =
            stream;


        setRemoteStream(
            stream
        );

    },


                     onConnectionStateChange:
    state => {

        console.log(
            "📞 WebRTC connection state:",
            state
        );

        /*
         * Do NOT end the call immediately when
         * connection becomes disconnected.
         *
         * Mobile networks / Wi-Fi can temporarily
         * disconnect and reconnect.
         */

        if (state === "failed") {

            console.error(
                "❌ WebRTC connection failed"
            );

            setTimeout(
                () => {

                    if (
                        callRef.current &&
                        peerRef.current
                    ) {

                        if (
                            peerRef.current
                                .connectionState ===
                            "failed"
                        ) {

                            endCall();

                        }

                    }

                },
                5000
            );

        }

        /*
         * Ignore temporary:
         * disconnected
         *
         * Ignore:
         * closed
         *
         * cleanupCall() will handle
         * intentional call ending.
         */

    }

                    });


                peerRef.current =
                    peer;


                if (
                    localStreamRef.current
                ) {

                    addLocalTracks(
                        peer,
                        localStreamRef.current
                    );

                }


                return peer;

            },
            [
                currentUserId
            ]
        );


    /* =====================================================
       START CALL
    ===================================================== */

    const startCall =
        useCallback(
            async (type) => {

                const target =
                    selectedUserRef.current;

                const me =
                    currentUserRef.current;

                if (
                    !target ||
                    !me
                ) {
                    return;
                }


                const receiverId =
                    getId(target);

                const callerId =
                    getId(me);

                const roomId =
                    getRoomId(
                        me,
                        target
                    );


                if (
                    !receiverId ||
                    !callerId ||
                    !roomId
                ) {
                    return;
                }


                try {

                    const stream =
                        await getUserMedia({
                            audio: true,
                            video:
                                type ===
                                "video"
                        });


                    localStreamRef.current =
                        stream;

                    setLocalStream(
                        stream
                    );


                    currentRoomRef.current =
                        roomId;


                    callRef.current = {
                        callerId,
                        receiverId,
                        roomId,
                        type
                    };


                    socket.emit(
                        "join-room",
                        roomId
                    );


                    setCallState({
                        mode: "outgoing",
                        type,
                        callerId,
                        receiverId,
                        roomId,
                        callerName:
                            getUserName(me),
                        callerAvatar:
                            getAvatar(me)
                    });


                    socket.emit(
                        "call-user",
                        {
                            roomId,
                            callerId,
                            receiverId,
                            callerName:
                                getUserName(me),
                            callerAvatar:
                                getAvatar(me),
                            type
                        }
                    );

                } catch (error) {

                    console.error(
                        "Call start error:",
                        error
                    );

                    alert(
                        error?.message ||
                        "Microphone/camera permission is required."
                    );

                    cleanupCall();

                }

            },
            [
                cleanupCall,
                getRoomId
            ]
        );


    /* =====================================================
       ACCEPT CALL
    ===================================================== */

    const acceptCall =
        useCallback(
            async () => {

                const call =
                    callRef.current ||
                    callState;

                if (!call) {
                    return;
                }


                try {

                    const stream =
                        await getUserMedia({
                            audio: true,
                            video:
                                call.type ===
                                "video"
                        });


                    localStreamRef.current =
                        stream;

                    setLocalStream(
                        stream
                    );


                    currentRoomRef.current =
                        call.roomId;


                    callRef.current = {
                        ...call,
                        accepted: true
                    };


                    socket.emit(
                        "join-room",
                        call.roomId
                    );


                    socket.emit(
                        "accept-call",
                        {
                            roomId:
                                call.roomId,
                            callerId:
                                call.callerId,
                            receiverId:
                                getId(
                                    currentUserRef.current
                                ),
                            type:
                                call.type
                        }
                    );


                    setCallState({
                        ...call,
                        mode: "accepted"
                    });

                } catch (error) {

                    console.error(
                        "Accept call error:",
                        error
                    );

                    socket.emit(
                        "reject-call",
                        {
                            callerId:
                                call.callerId,
                            receiverId:
                                getId(
                                    currentUserRef.current
                                ),
                            roomId:
                                call.roomId
                        }
                    );

                    cleanupCall();

                }

            },
            [
                callState,
                cleanupCall
            ]
        );


    /* =====================================================
       REJECT CALL
    ===================================================== */

    const rejectCall =
        useCallback(
            () => {

                const call =
                    callRef.current ||
                    callState;

                if (
                    call?.callerId
                ) {

                    socket.emit(
                        "reject-call",
                        {
                            callerId:
                                call.callerId,
                            receiverId:
                                getId(
                                    currentUserRef.current
                                ),
                            roomId:
                                call.roomId
                        }
                    );

                }


                if (
                    call?.mode ===
                    "incoming"
                ) {

                    showMissedCallNotification({
                        callerName:
                            call.callerName ||
                            "User",
                        type:
                            call.type
                    });

                }


                cleanupCall();

            },
            [
                callState,
                cleanupCall
            ]
        );


    /* =====================================================
       END CALL
    ===================================================== */

    const endCall =
        useCallback(
            () => {

                const call =
                    callRef.current ||
                    callState;

                if (
                    call?.roomId
                ) {

                    socket.emit(
                        "end-call",
                        {
                            roomId:
                                call.roomId
                        }
                    );

                }

                cleanupCall();

            },
            [
                callState,
                cleanupCall
            ]
        );


    /* =====================================================
       SOCKET EVENTS
    ===================================================== */

    useEffect(() => {

        if (!user) {
            return undefined;
        }


        const currentId =
            getId(user);


        connectSocket(
            currentId
        );


        const onConnect =
            () => {

                socket.emit(
                    "user-online",
                    currentId
                );

            };


        const onOnlineUsers =
            data => {

                setOnlineUsers(
                    Array.isArray(data)
                        ? data
                        : []
                );

            };


        /* -------------------------------------------------
           MESSAGE RECEIVED
        ------------------------------------------------- */

        const onReceiveMessage =
            incoming => {

                if (!incoming) {
                    return;
                }


                const newMessage =
                    incoming.data &&
                    typeof incoming.data ===
                        "object"
                        ? {
                              ...incoming.data,
                              ...incoming
                          }
                        : incoming;


                const senderId =
                    getMessageSenderId(
                        newMessage
                    );

                const receiverId =
                    getMessageReceiverId(
                        newMessage
                    );


                if (
                    senderId ===
                    currentId
                ) {
                    return;
                }


                const active =
                    selectedUserRef.current;

                const activeId =
                    getId(active);


                const belongs =
                    activeId &&
                    (
                        (
                            senderId ===
                                activeId &&
                            receiverId ===
                                currentId
                        ) ||
                        (
                            senderId ===
                                currentId &&
                            receiverId ===
                                activeId
                        )
                    );


                if (belongs) {

                    appendMessage(
                        newMessage
                    );

                    scrollToBottom();


                    socket.emit(
                        "message-seen",
                        {
                            roomId:
                                currentRoomRef.current,
                            messageId:
                                getMessageId(
                                    newMessage
                                ),
                            senderId,
                            receiverId:
                                currentId
                        }
                    );

                } else {

                    if (senderId) {

                        setUnreadUsers(
                            previous => ({
                                ...previous,
                                [senderId]:
                                    (
                                        previous[
                                            senderId
                                        ] || 0
                                    ) + 1
                            })
                        );

                    }


                    showMessageNotification({
                        senderName:
                            getUserName(
                                newMessage.sender
                            ),
                        message:
                            newMessage.message ||
                            newMessage.text ||
                            "New message"
                    });

                }

            };


        /* -------------------------------------------------
           DIRECT MESSAGE
        ------------------------------------------------- */

        const onDirectMessage =
            onReceiveMessage;


        /* -------------------------------------------------
           TYPING
        ------------------------------------------------- */

        const onTyping =
            data => {

                const activeId =
                    getId(
                        selectedUserRef.current
                    );

                if (
                    activeId &&
                    getId(
                        data?.userId ||
                        data
                    ) ===
                    activeId
                ) {

                    setTyping(true);

                }

            };


        const onStopTyping =
            data => {

                const activeId =
                    getId(
                        selectedUserRef.current
                    );

                if (
                    activeId &&
                    getId(
                        data?.userId ||
                        data
                    ) ===
                    activeId
                ) {

                    setTyping(false);

                }

            };


        /* -------------------------------------------------
           SEEN
        ------------------------------------------------- */

        const onSeen =
            data => {

                setMessages(
                    previous =>
                        previous.map(
                            item => {

                                if (
                                    data?.messageId &&
                                    getMessageId(
                                        item
                                    ) ===
                                    data.messageId
                                ) {

                                    return {
                                        ...item,
                                        seen: true,
                                        isSeen: true
                                    };

                                }

                                return item;

                            }
                        )
                );

            };


        /* -------------------------------------------------
           INCOMING CALL
        ------------------------------------------------- */

        const onIncomingCall =
            data => {

                if (!data) {
                    return;
                }


                const incoming = {
                    ...data,
                    mode:
                        "incoming"
                };


                callRef.current =
                    incoming;

                currentRoomRef.current =
                    data.roomId;


                setCallState(
                    incoming
                );


                showIncomingCallNotification({
                    callerName:
                        data.callerName ||
                        "User",
                    type:
                        data.type
                });

            };


        /* -------------------------------------------------
           CALL RINGING
        ------------------------------------------------- */

        const onCallRinging =
            data => {

                setCallState(
                    previous => ({
                        ...(previous || {}),
                        ...data,
                        mode:
                            "outgoing"
                    })
                );

            };


        /* -------------------------------------------------
           CALL ACCEPTED
        ------------------------------------------------- */

        const onCallAccepted =
            async data => {

                try {

                    const call =
                        callRef.current ||
                        data;


                    const receiverId =
                        getId(
                            call.receiverId ||
                            data.receiverId
                        );


                    if (!receiverId) {
                        return;
                    }


                    currentRoomRef.current =
                        call.roomId ||
                        data.roomId;


                    const peer =
                        createPeer(
                            receiverId
                        );


                    const offer =
                        await peer.createOffer({
                            offerToReceiveAudio:
                                true,
                            offerToReceiveVideo:
                                (
                                    call.type ||
                                    data.type
                                ) === "video"
                        });


                    await peer.setLocalDescription(
                        offer
                    );


                    socket.emit(
                        "webrtc-offer",
                        {
                            receiverId,
                            callerId:
                                currentId,
                            roomId:
                                currentRoomRef.current,
                            type:
                                call.type ||
                                data.type,
                            offer
                        }
                    );


                    setCallState(
                        previous => ({
                            ...(previous || {}),
                            ...call,
                            ...data,
                            mode:
                                "accepted"
                        })
                    );

                } catch (error) {

                    console.error(
                        "Offer error:",
                        error
                    );

                    endCall();

                }

            };


        /* -------------------------------------------------
           WEBRTC OFFER
        ------------------------------------------------- */

        const onOffer =
            async data => {

                try {

                    if (!data?.offer) {
                        return;
                    }


                    currentRoomRef.current =
                        data.roomId;


                    const peer =
                        peerRef.current ||
                        createPeer(
                            getId(
                                data.callerId
                            )
                        );


                    await peer.setRemoteDescription(
                        new RTCSessionDescription(
                            data.offer
                        )
                    );
                    
                    /* Flush ICE candidates received
   before remote description */
const pending =
    pendingCandidatesRef.current;

pendingCandidatesRef.current = [];

for (const candidate of pending) {

    try {

        await peer.addIceCandidate(
            new RTCIceCandidate(
                candidate
            )
        );

    } catch (error) {

        console.error(
            "Pending ICE candidate error:",
            error
        );

    }
}


                    const answer =
                        await peer.createAnswer();


                    await peer.setLocalDescription(
                        answer
                    );


                    socket.emit(
                        "webrtc-answer",
                        {
                            receiverId:
                                getId(
                                    data.callerId
                                ),
                            callerId:
                                currentId,
                            roomId:
                                data.roomId,
                            answer
                        }
                    );


                    setCallState(
                        previous => ({
                            ...(previous || {}),
                            ...data,
                            mode:
                                "accepted"
                        })
                    );

                } catch (error) {

                    console.error(
                        "WebRTC offer error:",
                        error
                    );

                }

            };


        /* -------------------------------------------------
           WEBRTC ANSWER
        ------------------------------------------------- */

        const onAnswer =
            async data => {

                try {

                    if (
                        !data?.answer ||
                        !peerRef.current
                    ) {
                        return;
                    }


                    await peerRef.current
                        .setRemoteDescription(
                            new RTCSessionDescription(
                                data.answer
                            )
                        );
                    /* Flush pending ICE candidates */

const pending =
    pendingCandidatesRef.current;

pendingCandidatesRef.current = [];

for (const candidate of pending) {

    try {

        await peerRef.current.addIceCandidate(
            new RTCIceCandidate(
                candidate
            )
        );

    } catch (error) {

        console.error(
            "Pending ICE candidate error:",
            error
        );

    }

}

                } catch (error) {

                    console.error(
                        "WebRTC answer error:",
                        error
                    );

                }

            };


        /* -------------------------------------------------
           ICE
        ------------------------------------------------- */

        const onIceCandidate =
            async data => {

                if (
                    !data?.candidate
                ) {
                    return;
                }


                const peer =
                    peerRef.current;


                if (!peer) {
                    return;
                }


                try {

                    if (
                        peer.remoteDescription
                    ) {

                        await peer.addIceCandidate(
                            new RTCIceCandidate(
                                data.candidate
                            )
                        );

                    } else {

                        pendingCandidatesRef.current
                            .push(
                                data.candidate
                            );

                    }

                } catch (error) {

                    console.error(
                        "ICE error:",
                        error
                    );

                }

            };


        /* -------------------------------------------------
           REJECTED
        ------------------------------------------------- */

        const onCallRejected =
            () => {

                alert(
                    "Call was declined."
                );

                cleanupCall();

            };


        /* -------------------------------------------------
           ENDED
        ------------------------------------------------- */

        const onCallEnded =
            () => {

                cleanupCall();

            };


        /* -------------------------------------------------
           BUSY
        ------------------------------------------------- */

        const onCallBusy =
            () => {

                alert(
                    "User is busy on another call."
                );

                cleanupCall();

            };


        /* -------------------------------------------------
           MISSED
        ------------------------------------------------- */

        const onCallMissed =
            () => {

                cleanupCall();

            };


        socket.on(
            "connect",
            onConnect
        );

        socket.on(
            "online-users",
            onOnlineUsers
        );

        socket.on(
            "receive-message",
            onReceiveMessage
        );

        socket.on(
            "direct-message",
            onDirectMessage
        );

        socket.on(
            "user-typing",
            onTyping
        );

        socket.on(
            "user-stop-typing",
            onStopTyping
        );

        socket.on(
            "messages-seen",
            onSeen
        );

        socket.on(
            "incoming-call",
            onIncomingCall
        );

        socket.on(
            "call-ringing",
            onCallRinging
        );

        socket.on(
            "call-accepted",
            onCallAccepted
        );

        socket.on(
            "call-rejected",
            onCallRejected
        );

        socket.on(
            "call-ended",
            onCallEnded
        );

        socket.on(
            "call-busy",
            onCallBusy
        );

        socket.on(
            "call-missed",
            onCallMissed
        );

        socket.on(
            "webrtc-offer",
            onOffer
        );

        socket.on(
            "webrtc-answer",
            onAnswer
        );

        socket.on(
            "webrtc-ice-candidate",
            onIceCandidate
        );


        return () => {

            socket.off(
                "connect",
                onConnect
            );

            socket.off(
                "online-users",
                onOnlineUsers
            );

            socket.off(
                "receive-message",
                onReceiveMessage
            );

            socket.off(
                "direct-message",
                onDirectMessage
            );

            socket.off(
                "user-typing",
                onTyping
            );

            socket.off(
                "user-stop-typing",
                onStopTyping
            );

            socket.off(
                "messages-seen",
                onSeen
            );

            socket.off(
                "incoming-call",
                onIncomingCall
            );

            socket.off(
                "call-ringing",
                onCallRinging
            );

            socket.off(
                "call-accepted",
                onCallAccepted
            );

            socket.off(
                "call-rejected",
                onCallRejected
            );

            socket.off(
                "call-ended",
                onCallEnded
            );

            socket.off(
                "call-busy",
                onCallBusy
            );

            socket.off(
                "call-missed",
                onCallMissed
            );

            socket.off(
                "webrtc-offer",
                onOffer
            );

            socket.off(
                "webrtc-answer",
                onAnswer
            );

            socket.off(
                "webrtc-ice-candidate",
                onIceCandidate
            );

        };

    }, [
        user,
        appendMessage,
        cleanupCall,
        createPeer,
        endCall,
        scrollToBottom
    ]);


    /* =====================================================
       SELECT USER
    ===================================================== */

    const selectUser =
        useCallback(
            async target => {

                if (
                    !target ||
                    !user
                ) {
                    return;
                }


                const targetId =
                    getId(target);

                const roomId =
                    getRoomId(
                        user,
                        target
                    );


                currentRoomRef.current =
                    roomId;

                selectedUserRef.current =
                    target;


                setSelectedUser(
                    target
                );

                setMobileChatOpen(
                    true
                );

                setMessages([]);

                setTyping(false);

                setShowEmoji(false);

                setShowBackgrounds(
                    false
                );

                setShowMenu(false);


                setUnreadUsers(
                    previous => {

                        const updated = {
                            ...previous
                        };

                        delete updated[
                            targetId
                        ];

                        return updated;

                    }
                );


                if (roomId) {

                    socket.emit(
                        "join-room",
                        roomId
                    );

                }


                try {

                    setChatLoading(
                        true
                    );


                    const response =
                        await api.get(
                            `/messages/conversation/${targetId}`
                        );


                    const data =
                        response.data?.data ||
                        response.data?.messages ||
                        [];


                    setMessages(
                        Array.isArray(data)
                            ? data
                            : []
                    );


                    try {

                        await api.put(
                            `/messages/seen/${targetId}`
                        );

                    } catch (_) {}


                    scrollToBottom(
                        false
                    );

                } catch (error) {

                    console.error(
                        "Conversation error:",
                        error
                    );

                } finally {

                    setChatLoading(
                        false
                    );

                }

            },
            [
                getRoomId,
                scrollToBottom,
                user
            ]
        );


    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    const sendMessage =
        async event => {

            event.preventDefault();


            const text =
                message.trim();


            if (
                !text ||
                !selectedUser ||
                !user
            ) {
                return;
            }


            const sender =
                getId(user);

            const receiver =
                getId(selectedUser);


            if (
                !sender ||
                !receiver
            ) {
                return;
            }


            const roomId =
                currentRoomRef.current ||
                getRoomId(
                    user,
                    selectedUser
                );


            /*
             * IMPORTANT:
             * Show message immediately.
             */

            const temporaryId =
                `temp-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;


            const optimisticMessage = {
                _id:
                    temporaryId,
                id:
                    temporaryId,
                sender:
                    user,
                receiver:
                    selectedUser,
                message:
                    text,
                createdAt:
                    new Date().toISOString(),
                seen:
                    false,
                optimistic:
                    true
            };


            appendMessage(
                optimisticMessage
            );

            scrollToBottom();

            setMessage("");

            setShowEmoji(false);


            socket.emit(
                "stop-typing",
                {
                    roomId,
                    userId:
                        sender
                }
            );


            try {

                /*
                 * Save to MongoDB.
                 */

                const response =
                    await api.post(
                        "/messages/send",
                        {
                            receiver,
                            message:
                                text
                        }
                    );


                const saved =
                    response.data?.data ||
                    response.data?.message ||
                    null;


                /*
                 * Replace optimistic message.
                 */

                if (saved) {

                    setMessages(
                        previous =>
                            previous.map(
                                item =>
                                    item._id ===
                                    temporaryId
                                        ? saved
                                        : item
                            )
                    );


                    /*
                     * Send saved message through
                     * Socket.IO immediately after DB save.
                     */

                    socket.emit(
                        "send-message",
                        {
                            roomId,
                            sender,
                            receiver,
                            message:
                                saved.message ||
                                text,
                            _id:
                                saved._id ||
                                saved.id,
                            id:
                                saved._id ||
                                saved.id,
                            createdAt:
                                saved.createdAt ||
                                new Date()
                                    .toISOString()
                        }
                    );

                } else {

                    /*
                     * If API returned no object,
                     * still notify receiver.
                     */

                    socket.emit(
                        "send-message",
                        {
                            roomId,
                            sender,
                            receiver,
                            message:
                                text,
                            createdAt:
                                new Date()
                                    .toISOString()
                        }
                    );

                }

            } catch (error) {

                console.error(
                    "Send message error:",
                    error
                );


                /*
                 * Remove failed optimistic message.
                 */

                setMessages(
                    previous =>
                        previous.filter(
                            item =>
                                item._id !==
                                temporaryId
                        )
                );


                alert(
                    error.response?.data
                        ?.message ||
                    "Message could not be sent."
                );

            }

        };


    /* =====================================================
       TYPING
    ===================================================== */

    const handleTyping =
        event => {

            const value =
                event.target.value;

            setMessage(value);


            if (
                !selectedUser ||
                !user
            ) {
                return;
            }


            const roomId =
                currentRoomRef.current ||
                getRoomId(
                    user,
                    selectedUser
                );


            socket.emit(
                "typing",
                {
                    roomId,
                    userId:
                        getId(user)
                }
            );


            clearTimeout(
                typingTimeoutRef.current
            );


            typingTimeoutRef.current =
                setTimeout(
                    () => {

                        socket.emit(
                            "stop-typing",
                            {
                                roomId,
                                userId:
                                    getId(user)
                            }
                        );

                    },
                    1200
                );

        };


    /* =====================================================
       FILE
    ===================================================== */

    const handleFile =
        async event => {

            const file =
                event.target.files?.[0];


            if (!file) {
                return;
            }


            if (
                !selectedUser ||
                !user
            ) {

                event.target.value =
                    "";

                return;

            }


            if (
                file.size >
                10 * 1024 * 1024
            ) {

                alert(
                    "Maximum file size is 10MB."
                );

                event.target.value =
                    "";

                return;

            }


            try {

                const formData =
                    new FormData();


                formData.append(
                    "file",
                    file
                );


                formData.append(
                    "receiver",
                    getId(
                        selectedUser
                    )
                );


                const response =
                    await api.post(
                        "/messages/send",
                        formData,
                        {
                            headers: {
                                "Content-Type":
                                    "multipart/form-data"
                            }
                        }
                    );


                const saved =
                    response.data?.data ||
                    response.data?.message;


                if (saved) {

                    appendMessage(
                        saved
                    );

                    scrollToBottom();

                }

            } catch (error) {

                console.error(
                    "File send error:",
                    error
                );

                alert(
                    error.response?.data
                        ?.message ||
                    "File could not be sent."
                );

            } finally {

                event.target.value =
                    "";

            }

        };


    /* =====================================================
       UI HELPERS
    ===================================================== */

    const addEmoji =
        emoji => {

            setMessage(
                previous =>
                    `${previous}${emoji}`
            );

        };


    const handleBackground =
        id => {

            setBackground(id);

            localStorage.setItem(
                "jr-chat-background",
                id
            );

            setShowBackgrounds(
                false
            );

        };


    const filteredUsers =
        useMemo(
            () => {

                const term =
                    search
                        .trim()
                        .toLowerCase();


                if (!term) {
                    return users;
                }


                return users.filter(
                    target => {

                        const name =
                            getUserName(
                                target
                            ).toLowerCase();

                        const email =
                            (
                                target.email ||
                                ""
                            ).toLowerCase();

                        const username =
                            (
                                target.username ||
                                ""
                            ).toLowerCase();


                        return (
                            name.includes(
                                term
                            ) ||
                            email.includes(
                                term
                            ) ||
                            username.includes(
                                term
                            )
                        );

                    }
                );

            },
            [
                users,
                search
            ]
        );


    const currentBackground =
        useMemo(
            () =>
                CHAT_BACKGROUNDS.find(
                    item =>
                        item.id ===
                        background
                ) ||
                CHAT_BACKGROUNDS[0],
            [background]
        );


    const formatTime =
        value => {

            if (!value) {
                return "";
            }


            const date =
                new Date(value);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return "";
            }


            return date.toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",
                    minute:
                        "2-digit"
                }
            );

        };


    const renderAvatar =
        target => {

            const avatar =
                getAvatar(target);


            if (avatar) {

                return (
                    <img
                        src={avatar}
                        alt=""
                    />
                );

            }


            return (
                <div className="avatar-fallback">

                    {getUserName(
                        target
                    )
                        .charAt(0)
                        .toUpperCase()}

                </div>
            );

        };


    /* =====================================================
       CLEANUP
    ===================================================== */

    useEffect(() => {

        return () => {

            clearTimeout(
                typingTimeoutRef.current
            );

            cleanupCall();

        };

    }, [cleanupCall]);


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (
            <div className="messenger-loading">

                <div className="messenger-loader" />

                <span>
                    Loading Messenger...
                </span>

            </div>
        );

    }


    /* =====================================================
       RENDER
    ===================================================== */

    return (
        <div className="messenger-page">

            <aside
                className={
                    `messenger-sidebar ${
                        mobileChatOpen
                            ? "mobile-hidden"
                            : ""
                    }`
                }
            >

                <div className="messenger-sidebar-header">

                    <div>

                        <h2>
                            Messenger
                        </h2>

                        <span>
                            {users.length} contacts
                        </span>

                    </div>

                </div>


                <div className="messenger-search">

                    <FaSearch />

                    <input
                        value={search}
                        onChange={
                            event =>
                                setSearch(
                                    event.target.value
                                )
                        }
                        placeholder="Search people..."
                    />


                    {search && (
                        <button
                            type="button"
                            onClick={() =>
                                setSearch("")
                            }
                        >
                            <FaTimes />
                        </button>
                    )}

                </div>


                <div className="user-list">

                    {filteredUsers.length ===
                    0 ? (

                        <div className="no-users">

                            <FaUserCircle />

                            <p>
                                No users found
                            </p>

                            <small>
                                Try another name or email
                            </small>

                        </div>

                    ) : (

                        filteredUsers.map(
                            target => {

                                const id =
                                    getId(target);

                                const unread =
                                    unreadUsers[
                                        id
                                    ] || 0;

                                const active =
                                    getId(
                                        selectedUser
                                    ) === id;


                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        className={
                                            `chat-user ${
                                                active
                                                    ? "active"
                                                    : ""
                                            }`
                                        }
                                        onClick={() =>
                                            selectUser(
                                                target
                                            )
                                        }
                                    >

                                        <div className="messenger-avatar">

                                            {renderAvatar(
                                                target
                                            )}


                                            {isOnline(
                                                target
                                            ) && (
                                                <span className="online-dot">

                                                    <FaCircle />

                                                </span>
                                            )}

                                        </div>


                                        <div className="chat-user-content">

                                            <div className="chat-user-top">

                                                <strong>
                                                    {getUserName(
                                                        target
                                                    )}
                                                </strong>

                                            </div>


                                            <div className="chat-user-bottom">

                                                <span>
                                                    {isOnline(
                                                        target
                                                    )
                                                        ? "Active now"
                                                        : "Offline"}
                                                </span>


                                                {unread >
                                                    0 && (
                                                    <span className="unread-badge">

                                                        {unread >
                                                        99
                                                            ? "99+"
                                                            : unread}

                                                    </span>
                                                )}

                                            </div>

                                        </div>

                                    </button>
                                );

                            }
                        )

                    )}

                </div>

            </aside>


            <main
                className={
                    `messenger-chat ${
                        mobileChatOpen
                            ? "mobile-visible"
                            : ""
                    }`
                }
            >

                {!selectedUser ? (

                    <div className="empty-chat">

                        <div className="empty-chat-icon">
                            💬
                        </div>

                        <h2>
                            Your messages
                        </h2>

                        <p>
                            Select someone to start chatting.
                        </p>

                    </div>

                ) : (

                    <>

                        <header className="chat-header">

                            <div className="chat-header-left">

                                <button
                                    type="button"
                                    className="mobile-back-btn"
                                    onClick={() => {

                                        setMobileChatOpen(
                                            false
                                        );

                                        setSelectedUser(
                                            null
                                        );

                                        selectedUserRef.current =
                                            null;

                                    }}
                                >
                                    <FaArrowLeft />
                                </button>


                                <div className="messenger-avatar large">

                                    {renderAvatar(
                                        selectedUser
                                    )}


                                    {isOnline(
                                        selectedUser
                                    ) && (
                                        <span className="online-dot">

                                            <FaCircle />

                                        </span>
                                    )}

                                </div>


                                <div className="chat-header-user">

                                    <h2>
                                        {getUserName(
                                            selectedUser
                                        )}
                                    </h2>


                                    <span>

                                        {typing
                                            ? "typing..."
                                            : isOnline(
                                                  selectedUser
                                              )
                                            ? "Active now"
                                            : "Offline"}

                                    </span>

                                </div>

                            </div>


                            <div className="chat-header-actions">

                                <button
                                    type="button"
                                    title="Voice call"
                                    onClick={() =>
                                        startCall(
                                            "audio"
                                        )
                                    }
                                >
                                    <FaPhone />
                                </button>


                                <button
                                    type="button"
                                    title="Video call"
                                    onClick={() =>
                                        startCall(
                                            "video"
                                        )
                                    }
                                >
                                    <FaVideo />
                                </button>


                                <button
                                    type="button"
                                    title="Chat background"
                                    onClick={() => {

                                        setShowBackgrounds(
                                            value =>
                                                !value
                                        );

                                        setShowMenu(
                                            false
                                        );

                                    }}
                                >
                                    <FaPalette />
                                </button>


                                <button
                                    type="button"
                                    title="More"
                                    onClick={() => {

                                        setShowMenu(
                                            value =>
                                                !value
                                        );

                                        setShowBackgrounds(
                                            false
                                        );

                                    }}
                                >
                                    <FaEllipsisH />
                                </button>

                            </div>


                            {showMenu && (
                                <div className="chat-options-menu">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            requestNotificationPermission()
                                        }
                                    >
                                        <FaInfoCircle />
                                        Notifications
                                    </button>


                                    <button
                                        type="button"
                                        onClick={() => {

                                            setMessages([]);

                                            setShowMenu(
                                                false
                                            );

                                        }}
                                    >
                                        <FaTimes />
                                        Clear local chat
                                    </button>

                                </div>
                            )}


                            {showBackgrounds && (
                                <div className="background-panel">

                                    <div className="background-panel-title">

                                        <strong>
                                            Chat theme
                                        </strong>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowBackgrounds(
                                                    false
                                                )
                                            }
                                        >
                                            <FaTimes />
                                        </button>

                                    </div>


                                    <div className="background-options">

                                        {CHAT_BACKGROUNDS.map(
                                            item => (

                                                <button
                                                    key={
                                                        item.id
                                                    }
                                                    type="button"
                                                    className={
                                                        `theme-option ${
                                                            background ===
                                                            item.id
                                                                ? "selected"
                                                                : ""
                                                        }`
                                                    }
                                                    onClick={() =>
                                                        handleBackground(
                                                            item.id
                                                        )
                                                    }
                                                >

                                                    <span
                                                        style={{
                                                            background:
                                                                item.value ||
                                                                "#ffffff"
                                                        }}
                                                    />

                                                    <small>
                                                        {item.name}
                                                    </small>

                                                </button>

                                            )
                                        )}

                                    </div>

                                </div>
                            )}

                        </header>


                        <section
                            className="messages-container"
                            style={{
                                background:
                                    currentBackground.value ||
                                    undefined
                            }}
                        >

                            {chatLoading ? (

                                <div className="chat-loading">

                                    <div />

                                    Loading messages...

                                </div>

                            ) : messages.length ===
                              0 ? (

                                <div className="no-messages">

                                    <div>
                                        👋
                                    </div>

                                    <p>
                                        Start the conversation
                                    </p>

                                    <small>
                                        Send a message to{" "}
                                        {getUserName(
                                            selectedUser
                                        )}
                                    </small>

                                </div>

                            ) : (

                                messages.map(
                                    (item, index) => {

                                        const senderId =
                                            getMessageSenderId(
                                                item
                                            );

                                        const own =
                                            senderId ===
                                            currentUserId;


                                        const text =
                                            item.message ||
                                            item.text ||
                                            item.content ||
                                            "";


                                        const time =
                                            item.createdAt ||
                                            item.timestamp;


                                        const seen =
                                            item.seen ||
                                            item.isSeen;


                                        return (
                                            <div
                                                key={
                                                    getMessageId(
                                                        item
                                                    ) ||
                                                    index
                                                }
                                                className={
                                                    `message-row ${
                                                        own
                                                            ? "own"
                                                            : ""
                                                    }`
                                                }
                                            >

                                                <div
                                                    className={
                                                        `message-bubble ${
                                                            own
                                                                ? "own"
                                                                : ""
                                                        }`
                                                    }
                                                >

                                                    <p>
                                                        {text}
                                                    </p>


                                                    <div className="message-meta">

                                                        <small>
                                                            {formatTime(
                                                                time
                                                            )}
                                                        </small>


                                                        {own && (
                                                            <span className="message-status">

                                                                {seen ? (
                                                                    <FaCheckDouble />
                                                                ) : (
                                                                    <FaCheck />
                                                                )}

                                                            </span>
                                                        )}

                                                    </div>

                                                </div>

                                            </div>
                                        );

                                    }
                                )

                            )}


                            {typing && (
                                <div className="typing-row">

                                    <div className="typing-bubble">

                                        <span />
                                        <span />
                                        <span />

                                    </div>

                                </div>
                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </section>


                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                            <div className="composer-actions">

                                <button
                                    type="button"
                                    title="Emoji"
                                    onClick={() =>
                                        setShowEmoji(
                                            value =>
                                                !value
                                        )
                                    }
                                >
                                    <FaSmile />
                                </button>


                                <button
                                    type="button"
                                    title="Attach file"
                                    onClick={() =>
                                        fileInputRef
                                            .current
                                            ?.click()
                                    }
                                >
                                    <FaPaperclip />
                                </button>


                                <button
                                    type="button"
                                    title="Image"
                                    onClick={() =>
                                        fileInputRef
                                            .current
                                            ?.click()
                                    }
                                >
                                    <FaImage />
                                </button>


                                <input
                                    ref={
                                        fileInputRef
                                    }
                                    type="file"
                                    hidden
                                    accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                                    onChange={
                                        handleFile
                                    }
                                />

                            </div>


                            <div className="message-input-wrapper">

                                <input
                                    type="text"
                                    value={message}
                                    onChange={
                                        handleTyping
                                    }
                                    placeholder="Write a message..."
                                    autoComplete="off"
                                />

                            </div>


                            <button
                                className="send-message-btn"
                                type="submit"
                                disabled={
                                    !message.trim()
                                }
                                title="Send"
                            >
                                <FaPaperPlane />
                            </button>


                            {showEmoji && (
                                <div className="emoji-picker">

                                    <div className="emoji-header">

                                        <strong>
                                            Emoji
                                        </strong>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowEmoji(
                                                    false
                                                )
                                            }
                                        >
                                            <FaTimes />
                                        </button>

                                    </div>


                                    <div className="emoji-grid">

                                        {EMOJIS.map(
                                            emoji => (

                                                <button
                                                    key={
                                                        emoji
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        addEmoji(
                                                            emoji
                                                        )
                                                    }
                                                >
                                                    {emoji}
                                                </button>

                                            )
                                        )}

                                    </div>

                                </div>
                            )}

                        </form>

                    </>

                )}

            </main>


            <CallModal
                visible={
                    Boolean(callState)
                }
                type={
                    callState?.type ||
                    "audio"
                }
                mode={
                    callState?.mode ||
                    "outgoing"
                }
                callerName={
                    callState?.callerName ||
                    getUserName(
                        selectedUser
                    )
                }
                callerAvatar={
                    callState?.callerAvatar ||
                    getAvatar(
                        selectedUser
                    )
                }
                localStream={
                    localStream
                }
                remoteStream={
                    remoteStream
                }
                onAccept={
                    acceptCall
                }
                onReject={
                    rejectCall
                }
                onEnd={
                    endCall
                }
            />

        </div>
    );
};


export default Messenger;
