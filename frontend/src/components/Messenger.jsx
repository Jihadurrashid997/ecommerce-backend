```jsx
import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import { io } from "socket.io-client";

import api from "../services/api";

import "../styles/Messenger.css";


/* =========================================================
   SOCKET SERVER URL
========================================================= */

const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL
            .replace(/\/api\/?$/, "")
        : window.location.origin;


/* =========================================================
   HELPERS
========================================================= */

const getUserId = (user) => {
    if (!user) {
        return null;
    }

    return (
        user._id ||
        user.id ||
        null
    )?.toString();
};


const getMessageUserId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === "object") {
        return (
            value._id ||
            value.id ||
            null
        )?.toString();
    }

    return value.toString();
};


const getRoomId = (
    firstUser,
    secondUser
) => {

    const firstId =
        getUserId(firstUser);

    const secondId =
        getUserId(secondUser);

    if (!firstId || !secondId) {
        return null;
    }

    return [
        firstId,
        secondId
    ]
        .sort()
        .join("_");
};


/* =========================================================
   COMPONENT
========================================================= */

const Messenger = () => {

    const socketRef =
        useRef(null);

    const messagesEndRef =
        useRef(null);

    const typingTimeoutRef =
        useRef(null);


    /* =====================================================
       STATE
    ===================================================== */

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

    const [onlineUsers, setOnlineUsers] =
        useState([]);

    const [typingUserId, setTypingUserId] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [sending, setSending] =
        useState(false);

    const [error, setError] =
        useState("");


    /* =====================================================
       CURRENT USER
    ===================================================== */

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (!storedUser) {
            setLoading(false);
            return;
        }

        try {

            const parsedUser =
                JSON.parse(storedUser);

            setUser(parsedUser);

        } catch (err) {

            console.error(
                "User data error:",
                err
            );

            localStorage.removeItem("user");

        }

    }, []);


    /* =====================================================
       LOAD CHAT USERS
    ===================================================== */

    useEffect(() => {

        if (!user) {
            return;
        }

        const fetchUsers = async () => {

            try {

                setLoading(true);
                setError("");

                /*
                 * IMPORTANT:
                 * /chat-users returns:
                 * { success: true, users: [...] }
                 */

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

            } catch (err) {

                console.error(
                    "Failed to load chat users:",
                    err
                );

                setError(
                    err.response?.data?.message ||
                    "Failed to load users"
                );

                setUsers([]);

            } finally {

                setLoading(false);

            }

        };


        fetchUsers();

    }, [user]);


    /* =====================================================
       SOCKET.IO CONNECTION
    ===================================================== */

    useEffect(() => {

        if (!user) {
            return;
        }


        const currentUserId =
            getUserId(user);

        if (!currentUserId) {
            return;
        }


        const socket =
            io(SOCKET_URL, {
                transports: [
                    "websocket",
                    "polling"
                ],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000
            });


        socketRef.current =
            socket;


        /* ==========================
           CONNECT
        ========================== */

        socket.on(
            "connect",
            () => {

                console.log(
                    "🟢 Messenger connected:",
                    socket.id
                );

                socket.emit(
                    "user-online",
                    currentUserId
                );

            }
        );


        /* ==========================
           ONLINE USERS
        ========================== */

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


        /* ==========================
           RECEIVE MESSAGE
        ========================== */

        socket.on(
            "receive-message",
            (newMessage) => {

                if (!newMessage) {
                    return;
                }


                const senderId =
                    getMessageUserId(
                        newMessage.sender
                    );

                const receiverId =
                    getMessageUserId(
                        newMessage.receiver
                    );


                /*
                 * If backend sends a message
                 * that belongs to this user,
                 * update the active conversation.
                 */

                const otherUserId =
                    getUserId(
                        selectedUser
                    );


                const belongsToCurrentChat =
                    otherUserId &&
                    (
                        (
                            senderId ===
                                otherUserId &&
                            receiverId ===
                                currentUserId
                        ) ||
                        (
                            senderId ===
                                currentUserId &&
                            receiverId ===
                                otherUserId
                        )
                    );


                if (!belongsToCurrentChat) {
                    return;
                }


                setMessages(
                    (previousMessages) => {

                        const messageId =
                            newMessage._id;


                        /*
                         * Prevent duplicate messages.
                         */

                        if (
                            messageId &&
                            previousMessages.some(
                                (item) =>
                                    item._id ===
                                    messageId
                            )
                        ) {

                            return previousMessages;

                        }


                        /*
                         * Prevent duplicate
                         * temporary/server messages
                         * when possible.
                         */

                        const duplicateByContent =
                            previousMessages.some(
                                (item) => {

                                    const itemSender =
                                        getMessageUserId(
                                            item.sender
                                        );

                                    return (
                                        itemSender ===
                                            senderId &&
                                        item.message ===
                                            newMessage.message &&
                                        item.createdAt ===
                                            newMessage.createdAt
                                    );

                                }
                            );


                        if (
                            duplicateByContent
                        ) {
                            return previousMessages;
                        }


                        return [
                            ...previousMessages,
                            newMessage
                        ];

                    }
                );

            }
        );


        /* ==========================
           TYPING
        ========================== */

        socket.on(
            "user-typing",
            ({
                userId
            } = {}) => {

                if (
                    userId &&
                    userId.toString() !==
                        currentUserId
                ) {

                    setTypingUserId(
                        userId.toString()
                    );

                }

            }
        );


        /* ==========================
           STOP TYPING
        ========================== */

        socket.on(
            "user-stop-typing",
            ({
                userId
            } = {}) => {

                if (
                    !userId ||
                    userId.toString() ===
                        typingUserId
                ) {

                    setTypingUserId(null);

                }

            }
        );


        /* ==========================
           DISCONNECT
        ========================== */

        socket.on(
            "disconnect",
            (reason) => {

                console.log(
                    "🔴 Messenger disconnected:",
                    reason
                );

            }
        );


        /* ==========================
           CONNECTION ERROR
        ========================== */

        socket.on(
            "connect_error",
            (err) => {

                console.error(
                    "Socket connection error:",
                    err.message
                );

            }
        );


        return () => {

            if (
                typingTimeoutRef.current
            ) {

                clearTimeout(
                    typingTimeoutRef.current
                );

            }


            socket.disconnect();

            socketRef.current =
                null;

        };

    }, [user, selectedUser, typingUserId]);


    /* =====================================================
       AUTO SCROLL
    ===================================================== */

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, typingUserId]);


    /* =====================================================
       SELECT USER
    ===================================================== */

    const selectUser =
        useCallback(
            async (selected) => {

                if (!selected) {
                    return;
                }


                setSelectedUser(
                    selected
                );

                setMessages([]);

                setTypingUserId(null);

                setError("");


                if (!user) {
                    return;
                }


                const selectedUserId =
                    getUserId(selected);


                const roomId =
                    getRoomId(
                        user,
                        selected
                    );


                /*
                 * Join private Socket.IO room.
                 */

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

                    /*
                     * Load previous messages.
                     */

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


                    /*
                     * Mark received messages
                     * as seen.
                     */

                    await api.put(
                        `/messages/seen/${selectedUserId}`
                    );

                } catch (err) {

                    console.error(
                        "Failed to load conversation:",
                        err
                    );

                    setError(
                        err.response?.data?.message ||
                        "Failed to load conversation"
                    );

                }

            },
            [user]
        );


    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    const sendMessage =
        async (event) => {

            event.preventDefault();


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
                getUserId(
                    selectedUser
                );


            const currentUserId =
                getUserId(user);


            const roomId =
                getRoomId(
                    user,
                    selectedUser
                );


            if (
                !receiver ||
                !currentUserId
            ) {
                return;
            }


            try {

                setSending(true);
                setError("");


                /*
                 * Save message in MongoDB.
                 */

                const response =
                    await api.post(
                        "/messages/send",
                        {
                            receiver,
                            message: text
                        }
                    );


                const savedMessage =
                    response.data?.data;


                if (!savedMessage) {

                    throw new Error(
                        "Server did not return the saved message."
                    );

                }


                /*
                 * Immediately show the sent message.
                 *
                 * This makes the chat feel instant
                 * even before Socket.IO echoes it back.
                 */

                setMessages(
                    (previousMessages) => {

                        if (
                            savedMessage._id &&
                            previousMessages.some(
                                (item) =>
                                    item._id ===
                                    savedMessage._id
                            )
                        ) {

                            return previousMessages;

                        }


                        return [
                            ...previousMessages,
                            savedMessage
                        ];

                    }
                );


                /*
                 * Broadcast through Socket.IO
                 * so the other user receives it
                 * instantly.
                 */

                if (
                    socketRef.current &&
                    socketRef.current.connected &&
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


                /*
                 * Stop typing indicator.
                 */

                if (
                    socketRef.current &&
                    roomId
                ) {

                    socketRef.current.emit(
                        "stop-typing",
                        {
                            roomId,
                            userId:
                                currentUserId
                        }
                    );

                }

            } catch (err) {

                console.error(
                    "Failed to send message:",
                    err
                );

                setError(
                    err.response?.data?.message ||
                    err.message ||
                    "Failed to send message"
                );

            } finally {

                setSending(false);

            }

        };


    /* =====================================================
       TYPING
    ===================================================== */

    const handleTyping =
        (event) => {

            const value =
                event.target.value;


            setMessage(value);


            if (
                typingTimeoutRef.current
            ) {

                clearTimeout(
                    typingTimeoutRef.current
                );

            }


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


            const currentUserId =
                getUserId(user);


            if (!roomId) {
                return;
            }


            if (value.trim()) {

                socketRef.current.emit(
                    "typing",
                    {
                        roomId,
                        userId:
                            currentUserId
                    }
                );


                /*
                 * Automatically stop typing
                 * after the user stops typing.
                 */

                typingTimeoutRef.current =
                    setTimeout(
                        () => {

                            socketRef.current?.emit(
                                "stop-typing",
                                {
                                    roomId,
                                    userId:
                                        currentUserId
                                }
                            );

                        },
                        1200
                    );

            } else {

                socketRef.current.emit(
                    "stop-typing",
                    {
                        roomId,
                        userId:
                            currentUserId
                    }
                );

            }

        };


    /* =====================================================
       ONLINE CHECK
    ===================================================== */

    const isUserOnline =
        (selected) => {

            const id =
                getUserId(selected);


            if (!id) {
                return false;
            }


            return onlineUsers.some(
                (onlineId) =>
                    onlineId?.toString() ===
                    id
            );

        };


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (

            <div className="messenger-page">

                <div className="messenger-loading">

                    Loading Messenger...

                </div>

            </div>

        );

    }


    /* =====================================================
       MAIN UI
    ===================================================== */

    return (

        <div className="messenger-page">


            {/* =================================================
               SIDEBAR
            ================================================= */}

            <aside className="messenger-sidebar">

                <div className="messenger-sidebar-header">

                    <h2>
                        Messages
                    </h2>

                </div>


                <div className="user-list">

                    {users
                        .filter(
                            (item) => {

                                const currentId =
                                    getUserId(user);

                                const itemId =
                                    getUserId(item);

                                return (
                                    itemId &&
                                    itemId !==
                                        currentId
                                );

                            }
                        )
                        .map(
                            (item) => {

                                const id =
                                    getUserId(item);


                                const active =
                                    selectedUser &&
                                    getUserId(
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
                                            selectUser(item)
                                        }
                                    >

                                        <div className="user-avatar">

                                            {
                                                item.name
                                                    ?.charAt(
                                                        0
                                                    )
                                                    ?.toUpperCase() ||
                                                "U"
                                            }

                                        </div>


                                        <div className="user-info">

                                            <strong>
                                                {
                                                    item.name ||
                                                    "User"
                                                }
                                            </strong>


                                            <span>

                                                {
                                                    isUserOnline(
                                                        item
                                                    )
                                                        ? "🟢 Online"
                                                        : "Offline"
                                                }

                                            </span>

                                        </div>

                                    </button>

                                );

                            }
                        )
                    }


                    {users.length === 0 && (

                        <p className="no-users">

                            No users available.

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
                                Select a user to start chatting.
                            </p>

                        </div>

                    </div>

                ) : (

                    <>


                        {/* =================================================
                           CHAT HEADER
                        ================================================= */}

                        <div className="chat-header">

                            <div className="chat-user-avatar">

                                {
                                    selectedUser.name
                                        ?.charAt(0)
                                        ?.toUpperCase() ||
                                    "U"
                                }

                            </div>


                            <div>

                                <h3>
                                    {
                                        selectedUser.name ||
                                        "User"
                                    }
                                </h3>


                                <span>

                                    {
                                        isUserOnline(
                                            selectedUser
                                        )
                                            ? "🟢 Online"
                                            : "Offline"
                                    }

                                </span>

                            </div>

                        </div>


                        {/* =================================================
                           ERROR
                        ================================================= */}

                        {error && (

                            <div className="messenger-error">

                                {error}

                            </div>

                        )}


                        {/* =================================================
                           MESSAGES
                        ================================================= */}

                        <div className="messages-container">

                            {messages.length === 0 ? (

                                <div className="no-messages">

                                    <p>
                                        No messages yet.
                                    </p>

                                    <small>
                                        Send a message to start
                                        the conversation.
                                    </small>

                                </div>

                            ) : (

                                messages.map(
                                    (msg, index) => {

                                        const senderId =
                                            getMessageUserId(
                                                msg.sender
                                            );


                                        const currentUserId =
                                            getUserId(user);


                                        const ownMessage =
                                            senderId ===
                                            currentUserId;


                                        return (

                                            <div
                                                key={
                                                    msg._id ||
                                                    `message-${index}`
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

                                                </div>

                                            </div>

                                        );

                                    }
                                )

                            )}


                            {/* =================================================
                               TYPING INDICATOR
                            ================================================= */}

                            {typingUserId && (

                                <div className="typing-indicator">

                                    <span>
                                        Typing...
                                    </span>

                                </div>

                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>


                        {/* =================================================
                           MESSAGE FORM
                        ================================================= */}

                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                            <input
                                type="text"
                                value={message}
                                onChange={
                                    handleTyping
                                }
                                placeholder="Write a message..."
                                autoComplete="off"
                                disabled={sending}
                            />


                            <button
                                type="submit"
                                disabled={
                                    !message.trim() ||
                                    sending
                                }
                            >

                                {sending
                                    ? "Sending..."
                                    : "Send"}

                            </button>

                        </form>

                    </>

                )}

            </main>

        </div>

    );

};


export default Messenger;
```
