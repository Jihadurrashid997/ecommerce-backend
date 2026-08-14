import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import {
    FaArrowLeft,
    FaPaperPlane,
    FaCircle
} from "react-icons/fa";

import { io } from "socket.io-client";

import api from "../services/api";

import "../styles/Messenger.css";


const SOCKET_URL = (
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, "")
        : "https://ecommerce-api-9wc9.onrender.com"
).replace(/\/+$/, "");


const Messenger = () => {

    const socketRef = useRef(null);

    const messagesEndRef = useRef(null);

    const typingTimerRef = useRef(null);


    const [user, setUser] = useState(null);

    const [users, setUsers] = useState([]);

    const [selectedUser, setSelectedUser] =
        useState(null);

    const [messages, setMessages] =
        useState([]);

    const [message, setMessage] =
        useState("");

    const [onlineUsers, setOnlineUsers] =
        useState([]);

    const [typingUser, setTypingUser] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [conversationLoading, setConversationLoading] =
        useState(false);

    const [sending, setSending] =
        useState(false);

    const [mobileChatOpen, setMobileChatOpen] =
        useState(false);

    const [error, setError] =
        useState("");



    // ======================================================
    // CURRENT USER
    // ======================================================

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (!storedUser) {
            return;
        }

        try {

            const parsedUser =
                JSON.parse(storedUser);

            setUser(parsedUser);

        } catch (err) {

            console.error(
                "User parse error:",
                err
            );

        }

    }, []);



    // ======================================================
    // USER ID HELPER
    // ======================================================

    const getUserId = useCallback((item) => {

        if (!item) {
            return null;
        }

        const id =
            item._id ||
            item.id ||
            item.userId;

        return id
            ? id.toString()
            : null;

    }, []);



    // ======================================================
    // ROOM ID
    // ======================================================

    const getRoomId = useCallback(
        (firstUser, secondUser) => {

            const first =
                getUserId(firstUser);

            const second =
                getUserId(secondUser);

            if (!first || !second) {
                return null;
            }

            return [first, second]
                .sort()
                .join("_");

        },
        [getUserId]
    );



    // ======================================================
    // LOAD CHAT USERS
    // ======================================================

    useEffect(() => {

        let mounted = true;

        const fetchUsers = async () => {

            try {

                setLoading(true);
                setError("");

                const response =
                    await api.get(
                        "/users/chat-users"
                    );

                const data =
                    response.data?.users ||
                    response.data?.data ||
                    [];

                if (mounted) {

                    setUsers(
                        Array.isArray(data)
                            ? data
                            : []
                    );
                }

            } catch (err) {

                console.error(
                    "Failed to load chat users:",
                    err
                );

                if (mounted) {

                    setUsers([]);

                    setError(
                        err.response?.data?.message ||
                        "Unable to load users."
                    );
                }

            } finally {

                if (mounted) {
                    setLoading(false);
                }

            }

        };

        if (user) {
            fetchUsers();
        }

        return () => {
            mounted = false;
        };

    }, [user]);



    // ======================================================
    // SOCKET.IO
    // ======================================================

    useEffect(() => {

        if (!user) {
            return undefined;
        }

        const currentUserId =
            getUserId(user);

        if (!currentUserId) {
            return undefined;
        }


        const socket = io(
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


        // --------------------------------------------------
        // CONNECT
        // --------------------------------------------------

        socket.on(
            "connect",
            () => {

                console.log(
                    "Socket connected:",
                    socket.id
                );

                socket.emit(
                    "user-online",
                    currentUserId
                );


                if (selectedUser) {

                    const roomId =
                        getRoomId(
                            user,
                            selectedUser
                        );

                    if (roomId) {

                        socket.emit(
                            "join-room",
                            roomId
                        );
                    }
                }

            }
        );


        // --------------------------------------------------
        // ONLINE USERS
        // --------------------------------------------------

        socket.on(
            "online-users",
            (online) => {

                setOnlineUsers(
                    Array.isArray(online)
                        ? online.map(
                            id => id.toString()
                        )
                        : []
                );

            }
        );


        // --------------------------------------------------
        // RECEIVE MESSAGE
        // --------------------------------------------------

        socket.on(
            "receive-message",
            (incoming) => {

                if (!incoming) {
                    return;
                }


                const senderId =
                    getUserId(
                        incoming.sender
                    ) ||
                    (
                        incoming.sender
                            ? incoming.sender.toString()
                            : null
                    );


                const receiverId =
                    getUserId(
                        incoming.receiver
                    ) ||
                    (
                        incoming.receiver
                            ? incoming.receiver.toString()
                            : null
                    );


                const selectedId =
                    getUserId(
                        selectedUser
                    );


                const belongsToChat =
                    selectedId &&
                    (
                        (
                            senderId === selectedId &&
                            receiverId === currentUserId
                        ) ||
                        (
                            senderId === currentUserId &&
                            receiverId === selectedId
                        )
                    );


                if (!belongsToChat) {
                    return;
                }


                setMessages(
                    previous => {

                        const incomingId =
                            incoming._id
                                ? incoming._id.toString()
                                : null;


                        const exists =
                            incomingId &&
                            previous.some(
                                item =>
                                    item._id &&
                                    item._id.toString() ===
                                    incomingId
                            );


                        if (exists) {
                            return previous;
                        }


                        return [
                            ...previous,
                            incoming
                        ];

                    }
                );


                setTypingUser(false);

            }
        );


        // --------------------------------------------------
        // TYPING
        // --------------------------------------------------

        socket.on(
            "user-typing",
            (data) => {

                if (
                    data?.userId &&
                    data.userId.toString() !==
                    currentUserId
                ) {

                    setTypingUser(true);
                }

            }
        );


        // --------------------------------------------------
        // STOP TYPING
        // --------------------------------------------------

        socket.on(
            "user-stop-typing",
            (data) => {

                if (
                    !data?.userId ||
                    data.userId.toString() !==
                    currentUserId
                ) {

                    setTypingUser(false);
                }

            }
        );


        // --------------------------------------------------
        // DISCONNECT
        // --------------------------------------------------

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Socket disconnected"
                );

            }
        );


        return () => {

            clearTimeout(
                typingTimerRef.current
            );

            socket.removeAllListeners();

            socket.disconnect();

            socketRef.current = null;

        };

    }, [
        user,
        selectedUser,
        getRoomId,
        getUserId
    ]);



    // ======================================================
    // AUTO SCROLL
    // ======================================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [
        messages,
        typingUser
    ]);



    // ======================================================
    // ONLINE CHECK
    // ======================================================

    const isUserOnline = useCallback(
        (selected) => {

            const id =
                getUserId(selected);

            if (!id) {
                return false;
            }

            return onlineUsers.some(
                onlineId =>
                    onlineId.toString() ===
                    id.toString()
            );

        },
        [
            onlineUsers,
            getUserId
        ]
    );



    // ======================================================
    // SELECT USER
    // ======================================================

    const selectUser = async (selected) => {

        if (!selected || !user) {
            return;
        }


        setSelectedUser(selected);

        setMessages([]);

        setTypingUser(false);

        setError("");

        setMobileChatOpen(true);

        setConversationLoading(true);


        const selectedId =
            getUserId(selected);


        const roomId =
            getRoomId(
                user,
                selected
            );


        // Join private room

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
                    `/messages/conversation/${selectedId}`
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


            // Mark received messages as seen

            await api.put(
                `/messages/seen/${selectedId}`
            );


        } catch (err) {

            console.error(
                "Conversation loading error:",
                err
            );

            setMessages([]);

            setError(
                err.response?.data?.message ||
                "Unable to load conversation."
            );

        } finally {

            setConversationLoading(
                false
            );

        }

    };



    // ======================================================
    // SEND MESSAGE
    // ======================================================

    const sendMessage = async (event) => {

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


        const roomId =
            getRoomId(
                user,
                selectedUser
            );


        if (!receiver) {
            return;
        }


        setSending(true);

        setError("");


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


            if (savedMessage) {

                setMessages(
                    previous => {

                        const savedId =
                            savedMessage._id
                                ? savedMessage._id.toString()
                                : null;


                        const exists =
                            savedId &&
                            previous.some(
                                item =>
                                    item._id &&
                                    item._id.toString() ===
                                    savedId
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


                // Real-time delivery

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

            }


            setMessage("");


            if (
                socketRef.current &&
                roomId
            ) {

                socketRef.current.emit(
                    "stop-typing",
                    {
                        roomId,
                        userId:
                            getUserId(user)
                    }
                );

            }

        } catch (err) {

            console.error(
                "Send message error:",
                err
            );

            setError(
                err.response?.data?.message ||
                "Message could not be sent."
            );

        } finally {

            setSending(false);

        }

    };



    // ======================================================
    // TYPING
    // ======================================================

    const handleTyping = (event) => {

        const value =
            event.target.value;


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


        clearTimeout(
            typingTimerRef.current
        );


        if (value.trim()) {

            socketRef.current.emit(
                "typing",
                {
                    roomId,
                    userId:
                        getUserId(user)
                }
            );


            typingTimerRef.current =
                setTimeout(
                    () => {

                        socketRef.current?.emit(
                            "stop-typing",
                            {
                                roomId,
                                userId:
                                    getUserId(user)
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
                        getUserId(user)
                }
            );

        }

    };



    // ======================================================
    // KEYBOARD
    // ======================================================

    const handleKeyDown = (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage(event);

        }

    };



    // ======================================================
    // BACK TO USERS
    // ======================================================

    const backToUsers = () => {

        setMobileChatOpen(false);

    };



    // ======================================================
    // MESSAGE TIME
    // ======================================================

    const formatTime = (date) => {

        if (!date) {
            return "";
        }


        const parsed =
            new Date(date);


        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {

            return "";
        }


        return parsed.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    };



    // ======================================================
    // LOADING
    // ======================================================

    if (loading) {

        return (
            <div className="messenger-page">

                <div className="messenger-loading">

                    <div>
                        Loading Messenger...
                    </div>

                </div>

            </div>
        );

    }



    // ======================================================
    // RENDER
    // ======================================================

    return (

        <div
            className={
                mobileChatOpen
                    ? "messenger-page mobile-chat-open"
                    : "messenger-page"
            }
        >

            {/* ==================================================
                SIDEBAR
            ================================================== */}

            <aside className="messenger-sidebar">

                <div className="messenger-sidebar-header">

                    <div>

                        <h2>
                            Messages
                        </h2>

                        <span>
                            {users.length} people
                        </span>

                    </div>

                </div>


                {error && !selectedUser && (

                    <div className="messenger-error">
                        {error}
                    </div>

                )}


                <div className="user-list">

                    {users.map((item) => {

                        const id =
                            getUserId(item);


                        const selectedId =
                            getUserId(
                                selectedUser
                            );


                        const active =
                            id &&
                            selectedId &&
                            id === selectedId;


                        return (

                            <button
                                type="button"
                                key={id}
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
                                        item.profileImage ||
                                        item.avatar ||
                                        item.image
                                    ? (

                                        <img
                                            src={
                                                item.profileImage ||
                                                item.avatar ||
                                                item.image
                                            }
                                            alt={
                                                item.name ||
                                                "User"
                                            }
                                        />

                                    ) : (

                                        (
                                            item.name ||
                                            "U"
                                        )
                                            .charAt(0)
                                            .toUpperCase()

                                    )}

                                    {isUserOnline(item) && (

                                        <span className="online-dot">
                                            <FaCircle />
                                        </span>

                                    )}

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
                                            isUserOnline(item)
                                                ? "Active now"
                                                : "Offline"
                                        }

                                    </span>

                                </div>

                            </button>

                        );

                    })}


                    {users.length === 0 && (

                        <div className="no-users">

                            <p>
                                No users available.
                            </p>

                        </div>

                    )}

                </div>

            </aside>



            {/* ==================================================
                CHAT AREA
            ================================================== */}

            <main className="chat-area">

                {!selectedUser ? (

                    <div className="empty-chat">

                        <div>

                            <div className="empty-chat-icon">
                                💬
                            </div>

                            <h2>
                                Your Messages
                            </h2>

                            <p>
                                Select someone to start
                                a conversation.
                            </p>

                        </div>

                    </div>

                ) : (

                    <>

                        {/* ==================================================
                            CHAT HEADER
                        ================================================== */}

                        <div className="chat-header">

                            <button
                                type="button"
                                className="mobile-back-btn"
                                onClick={backToUsers}
                            >
                                <FaArrowLeft />
                            </button>


                            <div className="chat-user-avatar">

                                {
                                    selectedUser.profileImage ||
                                    selectedUser.avatar ||
                                    selectedUser.image
                                ? (

                                    <img
                                        src={
                                            selectedUser.profileImage ||
                                            selectedUser.avatar ||
                                            selectedUser.image
                                        }
                                        alt={
                                            selectedUser.name ||
                                            "User"
                                        }
                                    />

                                ) : (

                                    (
                                        selectedUser.name ||
                                        "U"
                                    )
                                        .charAt(0)
                                        .toUpperCase()

                                )}

                                {isUserOnline(selectedUser) && (

                                    <span className="online-dot">
                                        <FaCircle />
                                    </span>

                                )}

                            </div>


                            <div className="chat-header-info">

                                <h3>
                                    {
                                        selectedUser.name ||
                                        "User"
                                    }
                                </h3>


                                <span>

                                    {typingUser
                                        ? "Typing..."
                                        : isUserOnline(
                                            selectedUser
                                        )
                                            ? "Active now"
                                            : "Offline"
                                    }

                                </span>

                            </div>

                        </div>



                        {/* ==================================================
                            ERROR
                        ================================================== */}

                        {error && (

                            <div className="messenger-error chat-error">
                                {error}
                            </div>

                        )}



                        {/* ==================================================
                            MESSAGES
                        ================================================== */}

                        <div className="messages-container">

                            {conversationLoading ? (

                                <div className="no-messages">

                                    <p>
                                        Loading conversation...
                                    </p>

                                </div>

                            ) : messages.length === 0 ? (

                                <div className="no-messages">

                                    <div className="empty-chat-icon">
                                        👋
                                    </div>

                                    <p>
                                        No messages yet.
                                    </p>

                                    <small>
                                        Start the conversation.
                                    </small>

                                </div>

                            ) : (

                                messages.map(
                                    (msg, index) => {

                                        const senderId =
                                            getUserId(
                                                msg.sender
                                            ) ||
                                            (
                                                msg.sender
                                                    ? msg.sender.toString()
                                                    : null
                                            );


                                        const currentUserId =
                                            getUserId(user);


                                        const ownMessage =
                                            senderId ===
                                            currentUserId;


                                        const messageKey =
                                            msg._id ||
                                            `${senderId}-${msg.createdAt}-${index}`;


                                        return (

                                            <div
                                                key={messageKey}
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
                                                                formatTime(
                                                                    msg.createdAt
                                                                )
                                                            }
                                                        </small>


                                                        {ownMessage && (

                                                            <small
                                                                className={
                                                                    msg.isSeen
                                                                        ? "message-seen"
                                                                        : ""
                                                                }
                                                            >
                                                                {
                                                                    msg.isSeen
                                                                        ? "Seen"
                                                                        : "Sent"
                                                                }
                                                            </small>

                                                        )}

                                                    </div>

                                                </div>

                                            </div>

                                        );

                                    }
                                )

                            )}


                            {typingUser && (

                                <div className="typing-indicator">

                                    <span />
                                    <span />
                                    <span />

                                    <small>
                                        Typing...
                                    </small>

                                </div>

                            )}


                            <div
                                ref={messagesEndRef}
                            />

                        </div>



                        {/* ==================================================
                            MESSAGE FORM
                        ================================================== */}

                        <form
                            className="message-form"
                            onSubmit={sendMessage}
                        >

                            <textarea
                                rows="1"
                                value={message}
                                onChange={handleTyping}
                                onKeyDown={handleKeyDown}
                                placeholder="Write a message..."
                                disabled={sending}
                            />


                            <button
                                type="submit"
                                disabled={
                                    !message.trim() ||
                                    sending
                                }
                                aria-label="Send message"
                            >

                                {sending ? (
                                    "..."
                                ) : (
                                    <FaPaperPlane />
                                )}

                            </button>

                        </form>

                    </>

                )}

            </main>

        </div>

    );

};


export default Messenger;
