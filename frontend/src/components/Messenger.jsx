import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import {
    FaPhone,
    FaVideo,
    FaSmile,
    FaPaperclip,
    FaMicrophone,
    FaPaperPlane,
    FaTimes,
    FaCheck,
    FaCheckDouble,
    FaImage,
    FaPalette,
    FaVolumeUp,
    FaVolumeMute
} from "react-icons/fa";

import api from "../services/api";
import "../styles/Messenger.css";

const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL
            .replace(/\/api\/?$/, "")
        : window.location.origin;

const getId = (item) => {
    if (!item) return null;

    if (typeof item === "string") {
        return item.toString();
    }

    return (
        item._id ||
        item.id ||
        item.userId ||
        null
    )?.toString();
};

const getUserName = (item) =>
    item?.name ||
    item?.username ||
    item?.email?.split("@")[0] ||
    "User";

const getInitial = (item) =>
    getUserName(item)
        .charAt(0)
        .toUpperCase();

const Messenger = () => {

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const notificationSoundRef = useRef(null);
    const fileInputRef = useRef(null);
    const callTimeoutRef = useRef(null);

    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");

    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typing, setTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const [showEmoji, setShowEmoji] = useState(false);
    const [showBackgrounds, setShowBackgrounds] = useState(false);

    const [chatBackground, setChatBackground] =
        useState("default");

    const [soundEnabled, setSoundEnabled] =
        useState(true);

    const [notificationPermission, setNotificationPermission] =
        useState(
            typeof Notification !== "undefined"
                ? Notification.permission
                : "denied"
        );

    const [incomingCall, setIncomingCall] =
        useState(null);

    const [activeCall, setActiveCall] =
        useState(null);

    const [callType, setCallType] =
        useState(null);

    const [callStatus, setCallStatus] =
        useState("");

    const [searchUsers, setSearchUsers] =
        useState("");

    const [selectedFile, setSelectedFile] =
        useState(null);


    /* ======================================================
       CURRENT USER
    ====================================================== */

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (!storedUser) {
            return;
        }

        try {

            const parsed =
                JSON.parse(storedUser);

            setUser(parsed);

        } catch (error) {

            console.error(
                "User data error:",
                error
            );

        }

    }, []);


    /* ======================================================
       NOTIFICATION PERMISSION
    ====================================================== */

    useEffect(() => {

        if (
            typeof Notification === "undefined"
        ) {
            return;
        }

        setNotificationPermission(
            Notification.permission
        );

    }, []);


    const requestNotifications = async () => {

        if (
            typeof Notification === "undefined"
        ) {
            return;
        }

        if (
            Notification.permission === "default"
        ) {

            try {

                const permission =
                    await Notification.requestPermission();

                setNotificationPermission(
                    permission
                );

            } catch (error) {

                console.error(
                    "Notification permission error:",
                    error
                );

            }

        }

    };


    const showNotification = (
        title,
        body
    ) => {

        if (
            typeof Notification === "undefined"
        ) {
            return;
        }

        if (
            Notification.permission !==
            "granted"
        ) {
            return;
        }

        if (
            document.visibilityState ===
            "visible"
        ) {
            return;
        }

        try {

            new Notification(
                title,
                {
                    body,
                    icon: "/favicon.ico"
                }
            );

        } catch (error) {

            console.error(
                "Notification error:",
                error
            );

        }

    };


    /* ======================================================
       LOAD USERS
    ====================================================== */

    useEffect(() => {

        const fetchUsers = async () => {

            try {

                const response =
                    await api.get(
                        "/users/chat-users"
                    );

                const data =
                    response.data?.users ||
                    response.data?.data ||
                    response.data ||
                    [];

                setUsers(
                    Array.isArray(data)
                        ? data
                        : []
                );

            } catch (firstError) {

                console.warn(
                    "chat-users endpoint failed:",
                    firstError
                );

                try {

                    const response =
                        await api.get(
                            "/users"
                        );

                    const data =
                        response.data?.users ||
                        response.data?.data ||
                        response.data ||
                        [];

                    setUsers(
                        Array.isArray(data)
                            ? data
                            : []
                    );

                } catch (secondError) {

                    console.error(
                        "Failed to load users:",
                        secondError
                    );

                    setUsers([]);

                }

            } finally {

                setLoading(false);

            }

        };

        fetchUsers();

    }, []);


    /* ======================================================
       SOCKET.IO
    ====================================================== */

    useEffect(() => {

        if (!user) {
            return;
        }

        requestNotifications();

        const socket =
            io(
                SOCKET_URL,
                {
                    transports: [
                        "websocket",
                        "polling"
                    ],
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000
                }
            );

        socketRef.current = socket;


        socket.on(
            "connect",
            () => {

                console.log(
                    "Socket connected:",
                    socket.id
                );

                const currentUserId =
                    getId(user);

                socket.emit(
                    "user-online",
                    currentUserId
                );

            }
        );


        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Socket disconnected"
                );

            }
        );


        socket.on(
            "connect_error",
            (error) => {

                console.error(
                    "Socket connection error:",
                    error
                );

            }
        );


        socket.on(
            "online-users",
            (online) => {

                setOnlineUsers(
                    Array.isArray(online)
                        ? online
                        : []
                );

            }
        );


        /* ==================================================
           RECEIVE MESSAGE
        ================================================== */

        socket.on(
            "receive-message",
            (newMessage) => {

                if (!newMessage) {
                    return;
                }

                const currentUserId =
                    getId(user);

                const senderId =
                    getId(
                        newMessage.sender
                    );

                const receiverId =
                    getId(
                        newMessage.receiver
                    );

                const selectedUserId =
                    getId(selectedUser);


                const isForCurrentUser =
                    senderId ===
                        currentUserId ||
                    receiverId ===
                        currentUserId;


                if (!isForCurrentUser) {
                    return;
                }


                const belongsToCurrentChat =
                    selectedUserId &&
                    (
                        (
                            senderId ===
                            selectedUserId &&
                            receiverId ===
                            currentUserId
                        ) ||
                        (
                            senderId ===
                            currentUserId &&
                            receiverId ===
                            selectedUserId
                        )
                    );


                if (
                    belongsToCurrentChat
                ) {

                    setMessages(
                        previous => {

                            const exists =
                                previous.some(
                                    item => {

                                        if (
                                            item._id &&
                                            newMessage._id
                                        ) {
                                            return (
                                                item._id ===
                                                newMessage._id
                                            );
                                        }

                                        return false;

                                    }
                                );


                            if (exists) {
                                return previous;
                            }


                            return [
                                ...previous,
                                newMessage
                            ];

                        }
                    );


                    if (
                        senderId !==
                        currentUserId
                    ) {

                        setTimeout(
                            () => {

                                api.put(
                                    `/messages/seen/${senderId}`
                                ).catch(
                                    () => {}
                                );

                            },
                            300
                        );

                    }

                }


                if (
                    senderId !==
                    currentUserId
                ) {

                    if (
                        soundEnabled &&
                        notificationSoundRef.current
                    ) {

                        notificationSoundRef.current
                            .play()
                            .catch(
                                () => {}
                            );

                    }


                    const senderName =
                        newMessage.sender?.name ||
                        "New message";


                    showNotification(
                        senderName,
                        newMessage.message ||
                        "You received a new message"
                    );

                }

            }
        );


        /* ==================================================
           TYPING
        ================================================== */

        socket.on(
            "user-typing",
            (data) => {

                const typingUserId =
                    getId(
                        data?.userId
                    );

                if (
                    typingUserId &&
                    typingUserId ===
                    getId(selectedUser)
                ) {

                    setTyping(true);

                }

            }
        );


        socket.on(
            "user-stop-typing",
            (data) => {

                const typingUserId =
                    getId(
                        data?.userId
                    );

                if (
                    !typingUserId ||
                    typingUserId ===
                    getId(selectedUser)
                ) {

                    setTyping(false);

                }

            }
        );


        /* ==================================================
           CALL EVENTS
        ================================================== */

        socket.on(
            "incoming-call",
            (data) => {

                if (!data) {
                    return;
                }

                setIncomingCall(data);

                setCallStatus(
                    "Incoming call..."
                );


                if (
                    soundEnabled &&
                    notificationSoundRef.current
                ) {

                    notificationSoundRef.current
                        .play()
                        .catch(
                            () => {}
                        );

                }


                showNotification(
                    "Incoming call",
                    `${data.callerName || "Someone"} is calling you`
                );

            }
        );


        socket.on(
            "call-accepted",
            (data) => {

                setCallStatus(
                    "Call accepted"
                );

                setActiveCall(
                    previous => ({
                        ...(previous || {}),
                        ...(data || {})
                    })
                );

            }
        );


        socket.on(
            "call-rejected",
            () => {

                clearCallState();

                alert(
                    "Call was declined."
                );

            }
        );


        socket.on(
            "call-ended",
            () => {

                clearCallState();

            }
        );


        return () => {

            socket.off(
                "receive-message"
            );

            socket.off(
                "online-users"
            );

            socket.off(
                "user-typing"
            );

            socket.off(
                "user-stop-typing"
            );

            socket.off(
                "incoming-call"
            );

            socket.off(
                "call-accepted"
            );

            socket.off(
                "call-rejected"
            );

            socket.off(
                "call-ended"
            );

            socket.disconnect();

            socketRef.current = null;

        };

    }, [
        user,
        selectedUser,
        soundEnabled
    ]);


    /* ======================================================
       AUTO SCROLL
    ====================================================== */

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, typing]);


    /* ======================================================
       ROOM ID
    ====================================================== */

    const getRoomId = (
        firstUser,
        secondUser
    ) => {

        const first =
            getId(firstUser);

        const second =
            getId(secondUser);

        if (
            !first ||
            !second
        ) {
            return null;
        }

        return [
            first,
            second
        ]
            .sort()
            .join("_");

    };


    /* ======================================================
       SELECT USER
    ====================================================== */

    const selectUser = async (
        selected
    ) => {

        setSelectedUser(
            selected
        );

        setMessages([]);
        setTyping(false);
        setShowEmoji(false);
        setShowBackgrounds(false);
        setSelectedFile(null);


        if (
            !user ||
            !selected
        ) {
            return;
        }


        const selectedUserId =
            getId(selected);

        const roomId =
            getRoomId(
                user,
                selected
            );


        if (
            roomId &&
            socketRef.current
        ) {

            socketRef.current.emit(
                "join-room",
                roomId
            );

        }


        try {

            const response =
                await api.get(
                    `/messages/conversation/${selectedUserId}`
                );


            const conversation =
                response.data?.data ||
                response.data?.messages ||
                [];


            setMessages(
                Array.isArray(
                    conversation
                )
                    ? conversation
                    : []
            );


            await api.put(
                `/messages/seen/${selectedUserId}`
            );


        } catch (error) {

            console.error(
                "Failed to load conversation:",
                error
            );

            setMessages([]);

        }

    };


    /* ======================================================
       SEND MESSAGE
    ====================================================== */

    const sendMessage = async (
        e
    ) => {

        e.preventDefault();


        const text =
            message.trim();


        if (
            !text ||
            !selectedUser ||
            !user ||
            sending
        ) {
            return;
        }


        const receiver =
            getId(selectedUser);


        const roomId =
            getRoomId(
                user,
                selectedUser
            );


        if (!receiver) {
            return;
        }


        setSending(true);


        try {

            const response =
                await api.post(
                    "/messages/send",
                    {
                        receiver,
                        message: text
                    }
                );


            const savedMessage =
                response.data?.data ||
                response.data?.message;


            /*
             * Immediately display our own message.
             * This prevents waiting for socket echo.
             */

            if (savedMessage) {

                setMessages(
                    previous => {

                        const exists =
                            previous.some(
                                item =>
                                    item._id &&
                                    savedMessage._id &&
                                    item._id ===
                                    savedMessage._id
                            );

                        if (exists) {
                            return previous;
                        }

                        return [
                            ...previous,
                            savedMessage
                        ];

                    }
                );

            }


            /*
             * Real-time socket delivery
             */

            if (
                socketRef.current &&
                roomId
            ) {

                socketRef.current.emit(
                    "send-message",
                    {
                        ...savedMessage,
                        roomId
                    }
                );

            }


            setMessage("");
            setSelectedFile(null);
            setShowEmoji(false);


            socketRef.current?.emit(
                "stop-typing",
                {
                    roomId,
                    userId:
                        getId(user)
                }
            );


        } catch (error) {

            console.error(
                "Failed to send message:",
                error
            );

            alert(
                error.response?.data?.message ||
                "Message could not be sent."
            );

        } finally {

            setSending(false);

        }

    };


    /* ======================================================
       TYPING
    ====================================================== */

    const handleTyping = (
        e
    ) => {

        const value =
            e.target.value;

        setMessage(value);


        if (
            !selectedUser ||
            !user ||
            !socketRef.current
        ) {
            return;
        }


        const roomId =
            getRoomId(
                user,
                selectedUser
            );


        if (!roomId) {
            return;
        }


        socketRef.current.emit(
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

                    socketRef.current?.emit(
                        "stop-typing",
                        {
                            roomId,
                            userId:
                                getId(user)
                        }
                    );

                },
                900
            );

    };


    /* ======================================================
       ONLINE
    ====================================================== */

    const isUserOnline = (
        selected
    ) => {

        const id =
            getId(selected);

        if (!id) {
            return false;
        }

        return onlineUsers.some(
            onlineId =>
                onlineId?.toString() ===
                id
        );

    };


    /* ======================================================
       EMOJI
    ====================================================== */

    const emojis = [
        "😀",
        "😂",
        "😍",
        "🥰",
        "😘",
        "😎",
        "🤔",
        "😭",
        "😡",
        "👍",
        "❤️",
        "🔥",
        "🎉",
        "👏",
        "🙏",
        "💯",
        "🤣",
        "😊",
        "😢",
        "😉",
        "🥳",
        "🤝",
        "💔",
        "✨"
    ];


    const addEmoji = (
        emoji
    ) => {

        setMessage(
            previous =>
                previous + emoji
        );

    };


    /* ======================================================
       BACKGROUNDS
    ====================================================== */

    const backgrounds = [
        {
            id: "default",
            label: "Default",
            value: ""
        },
        {
            id: "light",
            label: "Light",
            value:
                "linear-gradient(135deg,#f5f7fa,#c3cfe2)"
        },
        {
            id: "blue",
            label: "Blue",
            value:
                "linear-gradient(135deg,#dbeafe,#93c5fd)"
        },
        {
            id: "purple",
            label: "Purple",
            value:
                "linear-gradient(135deg,#ede9fe,#c4b5fd)"
        },
        {
            id: "sunset",
            label: "Sunset",
            value:
                "linear-gradient(135deg,#fed7aa,#fbcfe8)"
        },
        {
            id: "green",
            label: "Green",
            value:
                "linear-gradient(135deg,#d1fae5,#a7f3d0)"
        }
    ];


    const activeBackground =
        backgrounds.find(
            item =>
                item.id ===
                chatBackground
        );


    /* ======================================================
       FILE
    ====================================================== */

    const handleFileChange = (
        e
    ) => {

        const file =
            e.target.files?.[0];

        if (!file) {
            return;
        }

        setSelectedFile(file);

    };


    /* ======================================================
       CALL
    ====================================================== */

    const startCall = (
        type
    ) => {

        if (
            !selectedUser ||
            !socketRef.current ||
            !user
        ) {
            return;
        }


        const roomId =
            getRoomId(
                user,
                selectedUser
            );


        const callerId =
            getId(user);

        const receiverId =
            getId(selectedUser);


        const callData = {

            roomId,

            callerId,

            receiverId,

            callerName:
                getUserName(user),

            receiverName:
                getUserName(
                    selectedUser
                ),

            callType:
                type

        };


        setCallType(type);

        setActiveCall(
            callData
        );

        setCallStatus(
            `Calling ${getUserName(
                selectedUser
            )}...`
        );


        socketRef.current.emit(
            "call-user",
            callData
        );


        callTimeoutRef.current =
            setTimeout(
                () => {

                    if (
                        socketRef.current
                    ) {

                        socketRef.current.emit(
                            "end-call",
                            callData
                        );

                    }

                    clearCallState();

                },
                45000
            );

    };


    const acceptCall = () => {

        if (
            !incomingCall ||
            !socketRef.current
        ) {
            return;
        }


        socketRef.current.emit(
            "accept-call",
            incomingCall
        );


        setActiveCall(
            incomingCall
        );

        setCallType(
            incomingCall.callType
        );

        setCallStatus(
            "Call connected"
        );

        setIncomingCall(null);

    };


    const rejectCall = () => {

        if (
            !incomingCall ||
            !socketRef.current
        ) {
            return;
        }


        socketRef.current.emit(
            "reject-call",
            incomingCall
        );


        clearCallState();

    };


    const endCall = () => {

        if (
            socketRef.current &&
            activeCall
        ) {

            socketRef.current.emit(
                "end-call",
                activeCall
            );

        }

        clearCallState();

    };


    const clearCallState = () => {

        clearTimeout(
            callTimeoutRef.current
        );

        setIncomingCall(null);
        setActiveCall(null);
        setCallType(null);
        setCallStatus("");

    };


    /* ======================================================
       FILE PREVIEW
    ====================================================== */

    const filePreview =
        selectedFile
            ? URL.createObjectURL(
                selectedFile
            )
            : null;


    useEffect(() => {

        return () => {

            if (filePreview) {

                URL.revokeObjectURL(
                    filePreview
                );

            }

        };

    }, [filePreview]);


    /* ======================================================
       FILTER USERS
    ====================================================== */

    const filteredUsers =
        users.filter(
            item => {

                const currentId =
                    getId(user);

                const itemId =
                    getId(item);

                if (
                    !itemId ||
                    itemId === currentId
                ) {
                    return false;
                }


                const search =
                    searchUsers
                        .trim()
                        .toLowerCase();


                if (!search) {
                    return true;
                }


                return (
                    getUserName(item)
                        .toLowerCase()
                        .includes(search) ||
                    item.email
                        ?.toLowerCase()
                        .includes(search)
                );

            }
        );


    /* ======================================================
       LOADING
    ====================================================== */

    if (loading) {

        return (

            <div className="messenger-page">

                <div className="messenger-loading">

                    Loading Messenger...

                </div>

            </div>

        );

    }


    return (

        <div className="messenger-page">


            {/* =================================================
               NOTIFICATION SOUND
            ================================================= */}

            <audio
                ref={
                    notificationSoundRef
                }
                preload="auto"
            >
                <source
                    src="/notification.mp3"
                    type="audio/mpeg"
                />
            </audio>


            {/* =================================================
               SIDEBAR
            ================================================= */}

            <aside className="messenger-sidebar">

                <div className="messenger-sidebar-header">

                    <div>

                        <h2>
                            Messages
                        </h2>

                        <small>
                            {users.length} users
                        </small>

                    </div>


                    <button
                        type="button"
                        className="sound-toggle"
                        onClick={() =>
                            setSoundEnabled(
                                previous =>
                                    !previous
                            )
                        }
                        title={
                            soundEnabled
                                ? "Mute notifications"
                                : "Enable notifications"
                        }
                    >

                        {soundEnabled
                            ? <FaVolumeUp />
                            : <FaVolumeMute />
                        }

                    </button>

                </div>


                <div className="messenger-user-search">

                    <input
                        type="search"
                        placeholder="Search people..."
                        value={searchUsers}
                        onChange={
                            e =>
                                setSearchUsers(
                                    e.target.value
                                )
                        }
                    />

                </div>


                <div className="user-list">

                    {filteredUsers.map(
                        item => {

                            const id =
                                getId(item);

                            const active =
                                getId(
                                    selectedUser
                                ) === id;


                            return (

                                <button
                                    key={id}
                                    type="button"
                                    className={
                                        active
                                            ? "chat-user active"
                                            : "chat-user"
                                    }
                                    onClick={() =>
                                        selectUser(
                                            item
                                        )
                                    }
                                >

                                    <div className="user-avatar">

                                        {getInitial(
                                            item
                                        )}

                                        {isUserOnline(
                                            item
                                        ) && (

                                            <span className="online-dot" />

                                        )}

                                    </div>


                                    <div className="user-info">

                                        <strong>
                                            {
                                                getUserName(
                                                    item
                                                )
                                            }
                                        </strong>

                                        <span>

                                            {
                                                isUserOnline(
                                                    item
                                                )
                                                    ? "Online"
                                                    : "Offline"
                                            }

                                        </span>

                                    </div>

                                </button>

                            );

                        }
                    )}


                    {filteredUsers.length === 0 && (

                        <p className="no-users">
                            No users found.
                        </p>

                    )}

                </div>

            </aside>


            {/* =================================================
               CHAT AREA
            ================================================= */}

            <main className="chat-area">

                {!selectedUser ? (

                    <div className="empty-chat">

                        <div>

                            <h2>
                                💬 Welcome to Messenger
                            </h2>

                            <p>
                                Select a person to start chatting.
                            </p>

                            <button
                                type="button"
                                onClick={
                                    requestNotifications
                                }
                            >
                                Enable Notifications
                            </button>

                        </div>

                    </div>

                ) : (

                    <>

                        {/* ======================================
                           CHAT HEADER
                        ====================================== */}

                        <div className="chat-header">

                            <div className="chat-user-avatar">

                                {getInitial(
                                    selectedUser
                                )}

                                {isUserOnline(
                                    selectedUser
                                ) && (

                                    <span className="online-dot" />

                                )}

                            </div>


                            <div className="chat-header-info">

                                <h3>
                                    {
                                        getUserName(
                                            selectedUser
                                        )
                                    }
                                </h3>


                                <span>

                                    {typing
                                        ? "Typing..."
                                        : isUserOnline(
                                            selectedUser
                                        )
                                            ? "Active now"
                                            : "Offline"
                                    }

                                </span>

                            </div>


                            <div className="chat-actions">

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
                                    onClick={() =>
                                        setShowBackgrounds(
                                            previous =>
                                                !previous
                                        )
                                    }
                                >
                                    <FaPalette />
                                </button>

                            </div>

                        </div>


                        {/* ======================================
                           BACKGROUND PICKER
                        ====================================== */}

                        {showBackgrounds && (

                            <div className="chat-background-picker">

                                <strong>
                                    Chat Background
                                </strong>


                                <div>

                                    {backgrounds.map(
                                        background => (

                                            <button
                                                key={
                                                    background.id
                                                }
                                                type="button"
                                                title={
                                                    background.label
                                                }
                                                className={
                                                    chatBackground ===
                                                    background.id
                                                        ? "background-option active"
                                                        : "background-option"
                                                }
                                                style={{
                                                    background:
                                                        background.value ||
                                                        undefined
                                                }}
                                                onClick={() => {

                                                    setChatBackground(
                                                        background.id
                                                    );

                                                    setShowBackgrounds(
                                                        false
                                                    );

                                                }}
                                            />

                                        )
                                    )}

                                </div>

                            </div>

                        )}


                        {/* ======================================
                           MESSAGES
                        ====================================== */}

                        <div
                            className="messages-container"
                            style={{
                                background:
                                    activeBackground?.value ||
                                    undefined
                            }}
                        >

                            {messages.length === 0 ? (

                                <div className="no-messages">

                                    <div className="empty-chat-avatar">

                                        {getInitial(
                                            selectedUser
                                        )}

                                    </div>

                                    <p>
                                        You are connected with{" "}
                                        <strong>
                                            {
                                                getUserName(
                                                    selectedUser
                                                )
                                            }
                                        </strong>
                                    </p>

                                    <small>
                                        Send a message to start
                                        the conversation.
                                    </small>

                                </div>

                            ) : (

                                messages.map(
                                    (
                                        msg,
                                        index
                                    ) => {

                                        const senderId =
                                            getId(
                                                msg.sender
                                            );

                                        const currentUserId =
                                            getId(user);

                                        const ownMessage =
                                            senderId ===
                                            currentUserId;


                                        return (

                                            <div
                                                key={
                                                    msg._id ||
                                                    `${senderId}-${index}`
                                                }
                                                className={
                                                    ownMessage
                                                        ? "message-row own"
                                                        : "message-row"
                                                }
                                            >

                                                <div
                                                    className={
                                                        ownMessage
                                                            ? "message-bubble own"
                                                            : "message-bubble"
                                                    }
                                                >

                                                    <p>
                                                        {
                                                            msg.message ||
                                                            msg.text ||
                                                            ""
                                                        }
                                                    </p>


                                                    <div className="message-meta">

                                                        <small>

                                                            {
                                                                msg.createdAt
                                                                    ? new Date(
                                                                        msg.createdAt
                                                                    ).toLocaleTimeString(
                                                                        [],
                                                                        {
                                                                            hour:
                                                                                "2-digit",
                                                                            minute:
                                                                                "2-digit"
                                                                        }
                                                                    )
                                                                    : ""
                                                            }

                                                        </small>


                                                        {ownMessage && (

                                                            <span className="message-status">

                                                                {msg.isSeen
                                                                    ? <FaCheckDouble />
                                                                    : <FaCheck />
                                                                }

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

                                <div className="typing-indicator">

                                    <span>
                                        •
                                    </span>

                                    <span>
                                        •
                                    </span>

                                    <span>
                                        •
                                    </span>

                                    <em>
                                        Typing...
                                    </em>

                                </div>

                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>


                        {/* ======================================
                           FILE PREVIEW
                        ====================================== */}

                        {selectedFile && (

                            <div className="attachment-preview">

                                <div>

                                    <FaImage />

                                    <span>
                                        {
                                            selectedFile.name
                                        }
                                    </span>

                                </div>


                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedFile(
                                            null
                                        )
                                    }
                                >
                                    <FaTimes />
                                </button>

                            </div>

                        )}


                        {/* ======================================
                           EMOJI
                        ====================================== */}

                        {showEmoji && (

                            <div className="emoji-panel">

                                {emojis.map(
                                    emoji => (

                                        <button
                                            key={emoji}
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

                        )}


                        {/* ======================================
                           MESSAGE FORM
                        ====================================== */}

                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                            <button
                                type="button"
                                className="message-tool"
                                title="Emoji"
                                onClick={() =>
                                    setShowEmoji(
                                        previous =>
                                            !previous
                                    )
                                }
                            >
                                <FaSmile />
                            </button>


                            <button
                                type="button"
                                className="message-tool"
                                title="Attach file"
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                            >
                                <FaPaperclip />
                            </button>


                            <input
                                ref={
                                    fileInputRef
                                }
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                hidden
                                onChange={
                                    handleFileChange
                                }
                            />


                            <input
                                type="text"
                                placeholder={
                                    `Message ${getUserName(
                                        selectedUser
                                    )}...`
                                }
                                value={message}
                                onChange={
                                    handleTyping
                                }
                                onFocus={
                                    requestNotifications
                                }
                                autoComplete="off"
                            />


                            <button
                                type="button"
                                className="message-tool"
                                title="Voice message"
                            >
                                <FaMicrophone />
                            </button>


                            <button
                                type="submit"
                                className="send-message-btn"
                                disabled={
                                    !message.trim() ||
                                    sending
                                }
                                title="Send message"
                            >

                                <FaPaperPlane />

                            </button>

                        </form>

                    </>

                )}

            </main>


            {/* =================================================
               INCOMING CALL
            ================================================= */}

            {incomingCall && (

                <div className="call-overlay">

                    <div className="incoming-call-card">

                        <div className="call-avatar">

                            {(
                                incomingCall
                                    .callerName ||
                                "U"
                            )
                                .charAt(0)
                                .toUpperCase()}

                        </div>


                        <h2>
                            {
                                incomingCall.callerName ||
                                "Someone"
                            }
                        </h2>


                        <p>
                            Incoming{" "}
                            {
                                incomingCall.callType ===
                                "video"
                                    ? "video"
                                    : "voice"
                            }{" "}
                            call
                        </p>


                        <div className="call-buttons">

                            <button
                                type="button"
                                className="accept-call"
                                onClick={
                                    acceptCall
                                }
                            >
                                <FaPhone />
                                Accept
                            </button>


                            <button
                                type="button"
                                className="reject-call"
                                onClick={
                                    rejectCall
                                }
                            >
                                <FaTimes />
                                Decline
                            </button>

                        </div>

                    </div>

                </div>

            )}


            {/* =================================================
               ACTIVE CALL
            ================================================= */}

            {activeCall && (

                <div className="call-overlay">

                    <div className="active-call-card">

                        <div className="call-avatar">

                            {getInitial(
                                selectedUser
                            )}

                        </div>


                        <h2>

                            {
                                selectedUser
                                    ? getUserName(
                                        selectedUser
                                    )
                                    : activeCall.receiverName ||
                                    activeCall.callerName ||
                                    "Call"
                            }

                        </h2>


                        <p>
                            {
                                callStatus ||
                                (
                                    callType ===
                                    "video"
                                        ? "Video call"
                                        : "Voice call"
                                )
                            }
                        </p>


                        <div className="call-status">

                            {callType ===
                            "video"
                                ? <FaVideo />
                                : <FaPhone />
                            }

                        </div>


                        <button
                            type="button"
                            className="end-call-btn"
                            onClick={
                                endCall
                            }
                        >
                            <FaTimes />
                            End Call
                        </button>

                    </div>

                </div>

            )}

        </div>

    );

};


export default Messenger;
