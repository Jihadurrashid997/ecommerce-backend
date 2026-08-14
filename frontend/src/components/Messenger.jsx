import React, {
    useCallback,
    useEffect,
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

    const [sending, setSending] =
        useState(false);

    const [userSearch, setUserSearch] =
        useState("");

    const [conversationLoading, setConversationLoading] =
        useState(false);


    // =====================================================
    // CURRENT USER
    // =====================================================

    useEffect(() => {

        const stored =
            localStorage.getItem("user");


        if (!stored) {
            return;
        }


        try {

            setUser(
                JSON.parse(stored)
            );

        } catch (error) {

            console.error(
                "User parse error:",
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

    const getUserId = useCallback(
        item => {

            return (
                item?._id ||
                item?.id ||
                item
            )?.toString();

        },
        []
    );


    const getRoomId = useCallback(
        (first, second) => {

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


    const getAvatar = item => {

        const image =
            item?.profileImage ||
            item?.avatar ||
            item?.image;


        if (!image) {
            return null;
        }


        if (
            image.startsWith("http://") ||
            image.startsWith("https://")
        ) {
            return image;
        }


        const baseURL =
            api.defaults.baseURL
                ?.replace("/api", "") || "";


        return `${baseURL}${
            image.startsWith("/")
                ? ""
                : "/"
        }${image}`;

    };


    // =====================================================
    // LOAD CHAT USERS
    // =====================================================

    useEffect(() => {

        if (!currentUserId) {
            return;
        }


        let cancelled = false;


        const loadUsers = async () => {

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
    // SOCKET
    // =====================================================

    const handleIncomingMessage =
        useCallback(
            newMessage => {

                if (!newMessage) {
                    return;
                }


                const senderId =
                    getUserId(
                        newMessage.sender
                    );

                const receiverId =
                    getUserId(
                        newMessage.receiver
                    );


                const selectedId =
                    getUserId(
                        selectedUser
                    );


                const belongs =
                    selectedId &&
                    (
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
                        )
                    );


                if (!belongs) {
                    return;
                }


                setMessages(
                    previous => {

                        const exists =
                            previous.some(
                                item =>
                                    item._id &&
                                    newMessage._id &&
                                    item._id ===
                                    newMessage._id
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


                // Incoming message is automatically seen
                // when this conversation is open.

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
                            user,
                            selectedUser
                        );


                    socketRef.current?.emit(
                        "message-seen",
                        {
                            roomId,
                            senderId,
                            receiverId
                        }
                    );

                }

            },
            [
                currentUserId,
                getRoomId,
                getUserId,
                selectedUser,
                user
            ]
        );


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
                    reconnectionDelay: 1000
                }
            );


        socketRef.current =
            socket;


        socket.on(
            "connect",
            () => {

                console.log(
                    "Messenger connected:",
                    socket.id
                );


                socket.emit(
                    "user-online",
                    currentUserId
                );


                if (selectedUser) {

                    const roomId =
                        getRoomId(
                            currentUserId,
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
                    userId?.toString() !==
                    currentUserId
                ) {

                    setTypingUserId(
                        userId?.toString()
                    );

                }

            }
        );


        socket.on(
            "user-stop-typing",
            ({ userId }) => {

                if (
                    userId?.toString() ===
                    typingUserId
                ) {

                    setTypingUserId(null);

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
                "connect"
            );

            socket.off(
                "online-users"
            );

            socket.off(
                "receive-message",
                handleIncomingMessage
            );

            socket.off(
                "direct-message",
                handleIncomingMessage
            );

            socket.off(
                "user-typing"
            );

            socket.off(
                "user-stop-typing"
            );

            socket.off(
                "messages-seen"
            );


            socket.disconnect();


            socketRef.current =
                null;

        };

    }, [
        currentUserId,
        getRoomId,
        handleIncomingMessage,
        selectedUser,
        typingUserId
    ]);


    // =====================================================
    // AUTO SCROLL
    // =====================================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, typingUserId]);


    // =====================================================
    // LOAD CONVERSATION
    // =====================================================

    const selectUser =
        useCallback(
            async selected => {

                if (!selected) {
                    return;
                }


                const oldRoom =
                    selectedUser
                        ? getRoomId(
                            user,
                            selectedUser
                        )
                        : null;


                const newRoom =
                    getRoomId(
                        user,
                        selected
                    );


                if (
                    oldRoom &&
                    socketRef.current
                ) {

                    socketRef.current.emit(
                        "leave-room",
                        oldRoom
                    );

                }


                setSelectedUser(
                    selected
                );

                setMessages([]);

                setTypingUserId(null);


                if (
                    newRoom &&
                    socketRef.current
                ) {

                    socketRef.current.emit(
                        "join-room",
                        newRoom
                    );

                }


                const selectedId =
                    getUserId(
                        selected
                    );


                if (!selectedId) {
                    return;
                }


                setConversationLoading(true);


                try {

                    const response =
                        await api.get(
                            `/messages/conversation/${selectedId}`
                        );


                    setMessages(
                        response.data?.data ||
                        []
                    );


                    await api.put(
                        `/messages/seen/${selectedId}`
                    );


                    if (
                        socketRef.current &&
                        newRoom
                    ) {

                        socketRef.current.emit(
                            "message-seen",
                            {
                                roomId: newRoom,
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

            },
            [
                currentUserId,
                getRoomId,
                getUserId,
                selectedUser,
                user
            ]
        );


    // =====================================================
    // OPEN PROFILE MESSAGE LINK
    // =====================================================

    useEffect(() => {

        const targetId =
            searchParams.get("user");


        if (
            !targetId ||
            users.length === 0
        ) {
            return;
        }


        const target =
            users.find(
                item =>
                    getUserId(item) ===
                    targetId
            );


        if (target) {

            selectUser(target);

        }

    }, [
        searchParams,
        users,
        getUserId,
        selectUser
    ]);


    // =====================================================
    // SEND MESSAGE
    // =====================================================

    const sendMessage = async e => {

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


            const saved =
                response.data?.data;


            if (!saved) {
                throw new Error(
                    "Message was not saved."
                );
            }


            // Instant sender UI

            setMessages(
                previous => {

                    const exists =
                        previous.some(
                            item =>
                                item._id ===
                                saved._id
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


            // Realtime receiver

            if (
                socketRef.current &&
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
                "Message could not be sent."
            );

        } finally {

            setSending(false);

        }

    };


    // =====================================================
    // TYPING
    // =====================================================

    const handleTyping = e => {

        const value =
            e.target.value;


        setMessage(value);


        if (
            !selectedUser ||
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
                    1000
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

    const isOnline = item => {

        const id =
            getUserId(item);


        return onlineUsers.some(
            onlineId =>
                onlineId?.toString() ===
                id
        );

    };


    // =====================================================
    // TIME
    // =====================================================

    const formatTime = date => {

        if (!date) {
            return "";
        }


        return new Date(
            date
        ).toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    };


    // =====================================================
    // FILTER USERS
    // =====================================================

    const visibleUsers =
        users
            .filter(
                item =>
                    getUserId(item) !==
                    currentUserId
            )
            .filter(item => {

                const search =
                    userSearch
                        .trim()
                        .toLowerCase();


                if (!search) {
                    return true;
                }


                return (
                    String(
                        item.name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        item.email ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search)
                );

            });


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

        <div className="messenger-page">


            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside className="messenger-sidebar">

                <div className="messenger-sidebar-header">

                    <h2>
                        Messages
                    </h2>

                    <span>
                        {onlineUsers.length}
                        {" "}
                        online
                    </span>

                </div>


                {/* CHAT SEARCH */}

                <div
                    className="messenger-user-search"
                >

                    <FaSearch />

                    <input
                        type="search"
                        value={userSearch}
                        onChange={e =>
                            setUserSearch(
                                e.target.value
                            )
                        }
                        placeholder="Search people..."
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

                    {visibleUsers.map(item => {

                        const id =
                            getUserId(item);


                        const active =
                            selectedUser &&
                            getUserId(
                                selectedUser
                            ) === id;


                        const online =
                            isOnline(item);


                        const avatar =
                            getAvatar(item);


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

                                    {avatar ? (

                                        <img
                                            src={avatar}
                                            alt={
                                                item.name ||
                                                "User"
                                            }
                                        />

                                    ) : (

                                        item.name
                                            ?.charAt(0)
                                            ?.toUpperCase() ||
                                        "U"

                                    )}


                                    {online && (

                                        <span className="online-dot" />

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
                                            online
                                                ? "Active now"
                                                : "Offline"
                                        }
                                    </span>

                                </div>

                            </button>

                        );

                    })}


                    {visibleUsers.length === 0 && (

                        <p className="no-users">

                            No people found.

                        </p>

                    )}

                </div>

            </aside>


            {/* =================================================
                CHAT
            ================================================= */}

            <main className="chat-area">

                {!selectedUser ? (

                    <div className="empty-chat">

                        <div>

                            <FaComments />

                            <h2>
                                Welcome to Messenger
                            </h2>

                            <p>
                                Select someone to start
                                a conversation.
                            </p>

                        </div>

                    </div>

                ) : (

                    <>

                        {/* CHAT HEADER */}

                        <div className="chat-header">

                            <div className="chat-user-avatar">

                                {getAvatar(
                                    selectedUser
                                ) ? (

                                    <img
                                        src={
                                            getAvatar(
                                                selectedUser
                                            )
                                        }
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

                                    <FaCircle
                                        style={{
                                            fontSize:
                                                "7px"
                                        }}
                                    />

                                    {" "}

                                    {
                                        isOnline(
                                            selectedUser
                                        )
                                            ? "Active now"
                                            : "Offline"
                                    }

                                </span>

                            </div>

                        </div>


                        {/* MESSAGES */}

                        <div className="messages-container">

                            {conversationLoading ? (

                                <div className="no-messages">

                                    Loading conversation...

                                </div>

                            ) : messages.length === 0 ? (

                                <div className="no-messages">

                                    <p>
                                        No messages yet.
                                    </p>

                                    <small>
                                        Say hello 👋
                                    </small>

                                </div>

                            ) : (

                                messages.map(
                                    (msg, index) => {

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
                                                    index
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


                                                    <div className="message-meta">

                                                        <small>
                                                            {
                                                                formatTime(
                                                                    msg.createdAt
                                                                )
                                                            }
                                                        </small>


                                                        {own && (

                                                            msg.isSeen ? (

                                                                <FaCheckDouble
                                                                    className="message-seen"
                                                                />

                                                            ) : (

                                                                <FaCheck />

                                                            )

                                                        )}

                                                    </div>

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

                                <div className="typing-indicator">

                                    <span>
                                        {
                                            selectedUser.name
                                        }
                                        {" "}
                                        is typing...
                                    </span>

                                </div>

                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>


                        {/* MESSAGE FORM */}

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
                                disabled={
                                    sending
                                }
                            />


                            <button
                                type="submit"
                                disabled={
                                    !message.trim() ||
                                    sending
                                }
                            >

                                <FaPaperPlane />

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
