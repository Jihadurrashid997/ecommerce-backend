```javascript
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    useSearchParams
} from "react-router-dom";

import {
    FaCheck,
    FaCheckDouble,
    FaCircle,
    FaPaperPlane,
    FaSearch,
    FaTimes,
    FaComments
} from "react-icons/fa";

import { io } from "socket.io-client";

import api from "../services/api";

import "../styles/Messenger.css";


const SOCKET_URL =
    "https://ecommerce-api-9wc9.onrender.com";


const Messenger = () => {

    const [searchParams] =
        useSearchParams();


    const socketRef =
        useRef(null);

    const messagesEndRef =
        useRef(null);

    const typingTimerRef =
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

    const [onlineUsers, setOnlineUsers] =
        useState([]);

    const [typingUserId, setTypingUserId] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [conversationLoading, setConversationLoading] =
        useState(false);

    const [sending, setSending] =
        useState(false);

    const [userSearch, setUserSearch] =
        useState("");

    const [socketConnected, setSocketConnected] =
        useState(false);


    // =====================================================
    // CURRENT USER
    // =====================================================

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (!storedUser) {
            return;
        }

        try {

            setUser(
                JSON.parse(
                    storedUser
                )
            );

        } catch (error) {

            console.error(
                "User data error:",
                error
            );

        }

    }, []);


    const currentUserId =
        (
            user?._id ||
            user?.id
        )?.toString();


    // =====================================================
    // HELPERS
    // =====================================================

    const getUserId =
        useCallback(
            value => {

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
                        ""
                    ) || null;

                }

                return String(value);

            },
            []
        );


    const getRoomId =
        useCallback(
            (
                first,
                second
            ) => {

                const firstId =
                    getUserId(first);

                const secondId =
                    getUserId(second);

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
            [getUserId]
        );


    const getAvatar =
        useCallback(
            person => {

                const image =
                    person?.profileImage ||
                    person?.avatar ||
                    person?.image;

                if (!image) {
                    return null;
                }

                if (
                    image.startsWith(
                        "http://"
                    ) ||
                    image.startsWith(
                        "https://"
                    )
                ) {
                    return image;
                }

                const base =
                    api.defaults
                        .baseURL
                        ?.replace(
                            "/api",
                            ""
                        ) || "";

                return `${base}${
                    image.startsWith("/")
                        ? ""
                        : "/"
                }${image}`;

            },
            []
        );


    // =====================================================
    // LOAD USERS
    // =====================================================

    useEffect(() => {

        if (!currentUserId) {
            return;
        }

        let cancelled = false;

        const loadUsers =
            async () => {

                try {

                    const response =
                        await api.get(
                            "/users/chat-users"
                        );

                    if (cancelled) {
                        return;
                    }

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

                } catch (error) {

                    console.error(
                        "Chat users error:",
                        error
                    );

                    setUsers([]);

                } finally {

                    if (!cancelled) {
                        setLoading(false);
                    }

                }

            };

        loadUsers();

        return () => {
            cancelled = true;
        };

    }, [currentUserId]);


    // =====================================================
    // HANDLE INCOMING MESSAGE
    // =====================================================

    const handleIncomingMessage =
        useCallback(
            incoming => {

                if (!incoming) {
                    return;
                }

                const senderId =
                    getUserId(
                        incoming.sender
                    );

                const receiverId =
                    getUserId(
                        incoming.receiver
                    );

                const selectedId =
                    getUserId(
                        selectedUser
                    );


                if (
                    !selectedId ||
                    !currentUserId
                ) {
                    return;
                }


                const belongs =
                    (
                        senderId ===
                            selectedId &&
                        receiverId ===
                            currentUserId
                    ) ||
                    (
                        senderId ===
                            currentUserId &&
                        receiverId ===
                            selectedId
                    );


                if (!belongs) {
                    return;
                }


                setMessages(
                    previous => {

                        const duplicate =
                            previous.some(
                                item =>
                                    incoming._id &&
                                    item._id &&
                                    String(
                                        item._id
                                    ) ===
                                    String(
                                        incoming._id
                                    )
                            );

                        if (duplicate) {
                            return previous;
                        }

                        return [
                            ...previous,
                            incoming
                        ];

                    }
                );


                // If incoming message is from
                // selected user, mark it seen.
                if (
                    senderId ===
                    selectedId &&
                    receiverId ===
                    currentUserId
                ) {

                    api.put(
                        `/messages/seen/${selectedId}`
                    ).catch(() => {});


                    const roomId =
                        getRoomId(
                            currentUserId,
                            selectedId
                        );

                    socketRef.current?.emit(
                        "message-seen",
                        {
                            roomId,
                            senderId,
                            receiverId:
                                currentUserId
                        }
                    );

                }

            },
            [
                currentUserId,
                getRoomId,
                getUserId,
                selectedUser
            ]
        );


    // =====================================================
    // SOCKET — CONNECT ONCE
    // =====================================================

    useEffect(() => {

        if (!currentUserId) {
            return;
        }


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
                    reconnectionDelay: 1000,
                    timeout: 10000
                }
            );


        socketRef.current =
            socket;


        socket.on(
            "connect",
            () => {

                setSocketConnected(true);

                socket.emit(
                    "user-online",
                    currentUserId
                );

            }
        );


        socket.on(
            "disconnect",
            () => {

                setSocketConnected(false);

            }
        );


        socket.on(
            "connect_error",
            error => {

                console.error(
                    "Messenger socket error:",
                    error.message
                );

                setSocketConnected(false);

            }
        );


        socket.on(
            "online-users",
            list => {

                setOnlineUsers(
                    Array.isArray(list)
                        ? list
                        : []
                );

            }
        );


        socket.on(
            "receive-message",
            handleIncomingMessage
        );


        socket.on(
            "direct-message",
            handleIncomingMessage
        );


        socket.on(
            "user-typing",
            ({ userId }) => {

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


        socket.on(
            "user-stop-typing",
            ({ userId }) => {

                if (
                    !userId ||
                    userId.toString() ===
                        typingUserId
                ) {

                    setTypingUserId(
                        null
                    );

                }

            }
        );


        socket.on(
            "messages-seen",
            ({ senderId }) => {

                if (
                    senderId?.toString() ===
                    currentUserId
                ) {

                    setMessages(
                        previous =>
                            previous.map(
                                item => ({
                                    ...item,
                                    isSeen: true
                                })
                            )
                    );

                }

            }
        );


        return () => {

            clearTimeout(
                typingTimerRef.current
            );

            socket.off(
                "receive-message",
                handleIncomingMessage
            );

            socket.off(
                "direct-message",
                handleIncomingMessage
            );

            socket.disconnect();

            socketRef.current =
                null;

        };

    }, [
        currentUserId,
        handleIncomingMessage
    ]);


    // =====================================================
    // JOIN SELECTED ROOM
    // =====================================================

    useEffect(() => {

        if (
            !socketRef.current ||
            !selectedUser ||
            !currentUserId
        ) {
            return;
        }

        const roomId =
            getRoomId(
                currentUserId,
                selectedUser
            );

        if (roomId) {

            socketRef.current.emit(
                "join-room",
                roomId
            );

        }

    }, [
        selectedUser,
        currentUserId,
        getRoomId,
        socketConnected
    ]);


    // =====================================================
    // AUTO SCROLL
    // =====================================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [
        messages,
        typingUserId
    ]);


    // =====================================================
    // SELECT USER
    // =====================================================

    const selectUser =
        async selected => {

            if (!selected) {
                return;
            }

            setSelectedUser(
                selected
            );

            setMessages([]);

            setTypingUserId(
                null
            );


            const selectedId =
                getUserId(selected);

            if (!selectedId) {
                return;
            }


            const roomId =
                getRoomId(
                    currentUserId,
                    selectedId
                );


            if (
                socketRef.current &&
                roomId
            ) {

                socketRef.current.emit(
                    "join-room",
                    roomId
                );

            }


            setConversationLoading(
                true
            );


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


                await api.put(
                    `/messages/seen/${selectedId}`
                );


                if (
                    socketRef.current &&
                    roomId
                ) {

                    socketRef.current.emit(
                        "message-seen",
                        {
                            roomId,
                            senderId:
                                selectedId,
                            receiverId:
                                currentUserId
                        }
                    );

                }

            } catch (error) {

                console.error(
                    "Conversation error:",
                    error
                );

            } finally {

                setConversationLoading(
                    false
                );

            }

        };


    // =====================================================
    // URL -> OPEN USER
    // =====================================================

    useEffect(() => {

        const targetId =
            searchParams.get(
                "user"
            );

        if (
            !targetId ||
            users.length === 0
        ) {
            return;
        }


        const target =
            users.find(
                person =>
                    getUserId(person) ===
                    targetId
            );


        if (target) {

            selectUser(
                target
            );

        }

    }, [
        searchParams,
        users,
        getUserId
    ]);


    // =====================================================
    // SEND MESSAGE
    // =====================================================

    const sendMessage =
        async e => {

            e.preventDefault();


            const text =
                message.trim();


            if (
                !text ||
                !selectedUser ||
                !currentUserId ||
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
                    currentUserId,
                    receiver
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


                const saved =
                    response.data?.data;


                if (!saved) {
                    throw new Error(
                        "Server did not return the saved message."
                    );
                }


                // Show immediately to sender
                setMessages(
                    previous => {

                        const exists =
                            previous.some(
                                item =>
                                    item._id &&
                                    saved._id &&
                                    String(
                                        item._id
                                    ) ===
                                    String(
                                        saved._id
                                    )
                            );

                        if (exists) {
                            return previous;
                        }

                        return [
                            ...previous,
                            saved
                        ];

                    }
                );


                // Send to receiver
                if (
                    socketRef.current &&
                    socketRef.current.connected &&
                    roomId
                ) {

                    socketRef.current.emit(
                        "send-message",
                        {
                            ...saved,
                            roomId
                        }
                    );

                }


                setMessage("");


                socketRef.current?.emit(
                    "stop-typing",
                    {
                        roomId,
                        userId:
                            currentUserId
                    }
                );


            } catch (error) {

                console.error(
                    "Send message error:",
                    error
                );


                alert(
                    error.response?.data?.message ||
                    error.message ||
                    "Message could not be sent."
                );

            } finally {

                setSending(false);

            }

        };


    // =====================================================
    // TYPING
    // =====================================================

    const handleTyping =
        e => {

            const value =
                e.target.value;

            setMessage(value);


            if (
                !selectedUser ||
                !currentUserId ||
                !socketRef.current
            ) {
                return;
            }


            const roomId =
                getRoomId(
                    currentUserId,
                    selectedUser
                );


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


                clearTimeout(
                    typingTimerRef.current
                );


                typingTimerRef.current =
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


    // =====================================================
    // ONLINE
    // =====================================================

    const isOnline =
        person => {

            const id =
                getUserId(person);

            return onlineUsers.some(
                onlineId =>
                    onlineId?.toString() ===
                    id
            );

        };


    // =====================================================
    // FILTER
    // =====================================================

    const visibleUsers =
        useMemo(
            () => {

                const search =
                    userSearch
                        .trim()
                        .toLowerCase();


                return users
                    .filter(
                        person =>
                            getUserId(person) !==
                            currentUserId
                    )
                    .filter(
                        person => {

                            if (!search) {
                                return true;
                            }

                            return (
                                String(
                                    person.name ||
                                    ""
                                )
                                    .toLowerCase()
                                    .includes(search) ||

                                String(
                                    person.email ||
                                    ""
                                )
                                    .toLowerCase()
                                    .includes(search)
                            );

                        }
                    );

            },
            [
                users,
                userSearch,
                currentUserId,
                getUserId
            ]
        );


    // =====================================================
    // TIME
    // =====================================================

    const formatTime =
        value => {

            if (!value) {
                return "";
            }

            return new Date(
                value
            ).toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        };


    // =====================================================
    // LOADING
    // =====================================================

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

        <div
            className="messenger-page"
            style={{
                display: "flex",
                minHeight: "calc(100vh - 80px)"
            }}
        >

            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside
                className="messenger-sidebar"
            >

                <div
                    className="messenger-sidebar-header"
                >

                    <div>

                        <h2>
                            Messages
                        </h2>

                        <span>
                            {onlineUsers.length}
                            {" "}online
                        </span>

                    </div>

                    <FaComments />

                </div>


                <div
                    className="messenger-user-search"
                >

                    <FaSearch />

                    <input
                        type="search"
                        placeholder="Search people..."
                        value={
                            userSearch
                        }
                        onChange={
                            e =>
                                setUserSearch(
                                    e.target.value
                                )
                        }
                    />

                    {userSearch && (

                        <button
                            type="button"
                            onClick={() =>
                                setUserSearch("")
                            }
                        >
                            <FaTimes />
                        </button>

                    )}

                </div>


                <div className="user-list">

                    {visibleUsers.map(
                        person => {

                            const id =
                                getUserId(
                                    person
                                );

                            const active =
                                selectedUser &&
                                getUserId(
                                    selectedUser
                                ) === id;


                            const avatar =
                                getAvatar(
                                    person
                                );


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
                                            person
                                        )
                                    }
                                >

                                    <div
                                        className="user-avatar"
                                        style={{
                                            position:
                                                "relative"
                                        }}
                                    >

                                        {avatar ? (

                                            <img
                                                src={avatar}
                                                alt={
                                                    person.name ||
                                                    "User"
                                                }
                                            />

                                        ) : (

                                            person.name
                                                ?.charAt(0)
                                                ?.toUpperCase() ||
                                            "U"

                                        )}


                                        {isOnline(
                                            person
                                        ) && (

                                            <span
                                                style={{
                                                    position:
                                                        "absolute",
                                                    right:
                                                        "-1px",
                                                    bottom:
                                                        "-1px",
                                                    width:
                                                        "12px",
                                                    height:
                                                        "12px",
                                                    borderRadius:
                                                        "50%",
                                                    background:
                                                        "#22c55e",
                                                    border:
                                                        "2px solid white"
                                                }}
                                            />

                                        )}

                                    </div>


                                    <div
                                        className="user-info"
                                    >

                                        <strong>
                                            {
                                                person.name ||
                                                "User"
                                            }
                                        </strong>

                                        <span>
                                            {isOnline(
                                                person
                                            )
                                                ? "Online"
                                                : "Offline"}
                                        </span>

                                    </div>

                                </button>

                            );

                        }
                    )}


                    {visibleUsers.length === 0 && (

                        <div className="no-users">
                            No people found.
                        </div>

                    )}

                </div>

            </aside>


            {/* =================================================
                CHAT
            ================================================= */}

            <main
                className="chat-area"
            >

                {!selectedUser ? (

                    <div
                        className="empty-chat"
                    >

                        <FaComments />

                        <h2>
                            Your Messages
                        </h2>

                        <p>
                            Select someone and start a conversation.
                        </p>

                        <small>
                            {socketConnected
                                ? "🟢 Messenger connected"
                                : "🟡 Connecting..."}
                        </small>

                    </div>

                ) : (

                    <>

                        {/* HEADER */}

                        <div
                            className="chat-header"
                        >

                            <div
                                className="chat-user-avatar"
                            >

                                {getAvatar(
                                    selectedUser
                                ) ? (

                                    <img
                                        src={getAvatar(
                                            selectedUser
                                        )}
                                        alt={
                                            selectedUser.name
                                        }
                                    />

                                ) : (

                                    selectedUser.name
                                        ?.charAt(0)
                                        ?.toUpperCase() ||
                                    "U"

                                )}

                            </div>


                            <div>

                                <h3>
                                    {
                                        selectedUser.name ||
                                        "User"
                                    }
                                </h3>

                                <span>

                                    {typingUserId ===
                                    getUserId(
                                        selectedUser
                                    )
                                        ? "typing..."
                                        : isOnline(
                                            selectedUser
                                        )
                                            ? "🟢 Active now"
                                            : "Offline"}

                                </span>

                            </div>

                        </div>


                        {/* MESSAGES */}

                        <div
                            className="messages-container"
                        >

                            {conversationLoading ? (

                                <div className="no-messages">
                                    Loading conversation...
                                </div>

                            ) : messages.length === 0 ? (

                                <div
                                    className="no-messages"
                                >

                                    <FaComments />

                                    <p>
                                        No messages yet.
                                    </p>

                                    <small>
                                        Say hello 👋
                                    </small>

                                </div>

                            ) : (

                                messages.map(
                                    (
                                        msg,
                                        index
                                    ) => {

                                        const senderId =
                                            getUserId(
                                                msg.sender
                                            );

                                        const own =
                                            senderId ===
                                            currentUserId;


                                        return (

                                            <div
                                                key={
                                                    msg._id ||
                                                    `message-${index}`
                                                }
                                                className={
                                                    own
                                                        ? "message-row own"
                                                        : "message-row"
                                                }
                                            >

                                                <div
                                                    className={
                                                        own
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


                                                    <small
                                                        style={{
                                                            display:
                                                                "flex",
                                                            justifyContent:
                                                                "flex-end",
                                                            alignItems:
                                                                "center",
                                                            gap:
                                                                "5px"
                                                        }}
                                                    >

                                                        {formatTime(
                                                            msg.createdAt
                                                        )}

                                                        {own && (

                                                            msg.isSeen
                                                                ? (
                                                                    <FaCheckDouble
                                                                        title="Seen"
                                                                    />
                                                                )
                                                                : (
                                                                    <FaCheck
                                                                        title="Sent"
                                                                    />
                                                                )

                                                        )}

                                                    </small>

                                                </div>

                                            </div>

                                        );

                                    }
                                )

                            )}


                            {typingUserId ===
                                getUserId(
                                    selectedUser
                                ) && (

                                <div
                                    className="typing-indicator"
                                >
                                    <FaCircle />
                                    <FaCircle />
                                    <FaCircle />
                                    <span>
                                        typing...
                                    </span>
                                </div>

                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>


                        {/* INPUT */}

                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                            <input
                                type="text"
                                value={
                                    message
                                }
                                onChange={
                                    handleTyping
                                }
                                placeholder="Write a message..."
                                autoComplete="off"
                            />


                            <button
                                type="submit"
                                disabled={
                                    !message.trim() ||
                                    sending
                                }
                            >

                                <FaPaperPlane />

                                <span>
                                    {sending
                                        ? "Sending..."
                                        : "Send"}
                                </span>

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
