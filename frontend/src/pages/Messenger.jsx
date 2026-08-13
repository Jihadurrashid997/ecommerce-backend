import React, {
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
    FaTimes
} from "react-icons/fa";

import { io } from "socket.io-client";

import api from "../services/api";

import "../styles/Messenger.css";


const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace("/api", "")
        : window.location.origin;


const Messenger = () => {

    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    const typingTimeoutRef = useRef(null);


    // ==========================
    // CURRENT USER
    // ==========================

    const [user, setUser] = useState(null);


    // ==========================
    // USERS
    // ==========================

    const [users, setUsers] = useState([]);

    const [selectedUser, setSelectedUser] =
        useState(null);


    // ==========================
    // MESSAGES
    // ==========================

    const [messages, setMessages] =
        useState([]);

    const [message, setMessage] =
        useState("");


    // ==========================
    // UI STATES
    // ==========================

    const [loading, setLoading] =
        useState(true);

    const [chatLoading, setChatLoading] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [mobileChatOpen, setMobileChatOpen] =
        useState(false);

    const [showInfo, setShowInfo] =
        useState(false);

    const [typing, setTyping] =
        useState(false);

    const [onlineUsers, setOnlineUsers] =
        useState([]);

    const [unreadUsers, setUnreadUsers] =
        useState({});


    // ==========================
    // LOAD CURRENT USER
    // ==========================

    useEffect(() => {

        try {

            const savedUser =
                localStorage.getItem("user");

            if (savedUser) {

                setUser(
                    JSON.parse(savedUser)
                );

            }

        } catch (error) {

            console.error(
                "User loading error:",
                error
            );

        }

    }, []);


    // ==========================
    // LOAD USERS
    // ==========================

    useEffect(() => {

        if (!user) {
            return;
        }


        const loadUsers = async () => {

            try {

                setLoading(true);


                const response =
                    await api.get("/users");


                const data =
                    response.data?.users ||
                    response.data?.data ||
                    response.data ||
                    [];


                const currentUserId =
                    (
                        user._id ||
                        user.id
                    )?.toString();


                const filtered =
                    Array.isArray(data)
                        ? data.filter(item => {

                            const id =
                                (
                                    item._id ||
                                    item.id
                                )?.toString();

                            return (
                                id &&
                                id !== currentUserId
                            );

                        })
                        : [];


                setUsers(filtered);


            } catch (error) {

                console.error(
                    "Failed to load users:",
                    error
                );

            } finally {

                setLoading(false);

            }

        };


        loadUsers();

    }, [user]);


    // ==========================
    // SOCKET.IO
    // ==========================

    useEffect(() => {

        if (!user) {
            return;
        }


        const socket =
            io(SOCKET_URL, {
                transports: [
                    "websocket",
                    "polling"
                ]
            });


        socketRef.current =
            socket;


        const currentUserId =
            (
                user._id ||
                user.id
            )?.toString();


        socket.on(
            "connect",
            () => {

                console.log(
                    "Messenger socket connected:",
                    socket.id
                );


                socket.emit(
                    "user-online",
                    currentUserId
                );

            }
        );


        socket.on(
            "online-users",
            online => {

                setOnlineUsers(
                    Array.isArray(online)
                        ? online
                        : []
                );

            }
        );


        // ==========================
        // RECEIVE MESSAGE
        // ==========================

        socket.on(
            "receive-message",
            newMessage => {

                const senderId =
                    (
                        newMessage.sender?._id ||
                        newMessage.sender
                    )?.toString();


                const receiverId =
                    (
                        newMessage.receiver?._id ||
                        newMessage.receiver
                    )?.toString();


                const selectedId =
                    (
                        selectedUser?._id ||
                        selectedUser?.id
                    )?.toString();


                const belongsToCurrentChat =
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


                if (
                    belongsToCurrentChat
                ) {

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


                    return;
                }


                // ==========================
                // UNREAD MESSAGE
                // ==========================

                if (
                    senderId &&
                    senderId !== currentUserId
                ) {

                    setUnreadUsers(
                        previous => ({
                            ...previous,
                            [senderId]:
                                (
                                    previous[senderId] ||
                                    0
                                ) + 1
                        })
                    );

                }

            }
        );


        // ==========================
        // TYPING
        // ==========================

        socket.on(
            "user-typing",
            data => {

                const selectedId =
                    (
                        selectedUser?._id ||
                        selectedUser?.id
                    )?.toString();


                const typingUserId =
                    (
                        data?.userId ||
                        data
                    )?.toString();


                if (
                    selectedId &&
                    typingUserId === selectedId
                ) {

                    setTyping(true);

                }

            }
        );


        socket.on(
            "user-stop-typing",
            data => {

                const selectedId =
                    (
                        selectedUser?._id ||
                        selectedUser?.id
                    )?.toString();


                const typingUserId =
                    (
                        data?.userId ||
                        data
                    )?.toString();


                if (
                    selectedId &&
                    typingUserId === selectedId
                ) {

                    setTyping(false);

                }

            }
        );


        return () => {

            socket.disconnect();

            socketRef.current =
                null;

        };

    }, [user, selectedUser]);


    // ==========================
    // AUTO SCROLL
    // ==========================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, typing]);


    // ==========================
    // ROOM ID
    // ==========================

    const getRoomId = (
        firstUser,
        secondUser
    ) => {

        const first =
            (
                firstUser?._id ||
                firstUser?.id
            )?.toString();


        const second =
            (
                secondUser?._id ||
                secondUser?.id
            )?.toString();


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


    // ==========================
    // USER ONLINE
    // ==========================

    const isUserOnline = (
        targetUser
    ) => {

        if (!targetUser) {
            return false;
        }


        const id =
            (
                targetUser._id ||
                targetUser.id
            )?.toString();


        return onlineUsers.some(
            onlineId =>
                onlineId?.toString() === id
        );

    };


    // ==========================
    // SELECT USER
    // ==========================

    const selectUser = async (
        targetUser
    ) => {

        if (!targetUser) {
            return;
        }


        setSelectedUser(
            targetUser
        );


        setMobileChatOpen(
            true
        );


        setMessages([]);

        setTyping(false);


        const currentUserId =
            user?._id ||
            user?.id;


        const targetUserId =
            targetUser._id ||
            targetUser.id;


        const roomId =
            getRoomId(
                user,
                targetUser
            );


        // Clear unread

        setUnreadUsers(
            previous => {

                const updated = {
                    ...previous
                };

                delete updated[
                    targetUserId
                ];

                return updated;

            }
        );


        // Join room

        if (
            socketRef.current &&
            roomId
        ) {

            socketRef.current.emit(
                "join-room",
                roomId
            );

        }


        try {

            setChatLoading(true);


            const response =
                await api.get(
                    `/messages/conversation/${targetUserId}`
                );


            setMessages(
                response.data?.data || []
            );


            // Mark seen

            await api.put(
                `/messages/seen/${targetUserId}`
            );


        } catch (error) {

            console.error(
                "Conversation error:",
                error
            );

        } finally {

            setChatLoading(false);

        }

    };


    // ==========================
    // SEND MESSAGE
    // ==========================

    const sendMessage = async (
        e
    ) => {

        e.preventDefault();


        const text =
            message.trim();


        if (
            !text ||
            !selectedUser ||
            !user
        ) {
            return;
        }


        const receiver =
            selectedUser._id ||
            selectedUser.id;


        const roomId =
            getRoomId(
                user,
                selectedUser
            );


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
                response.data?.data;


            // Add locally immediately

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


            // Socket broadcast

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


            socketRef.current?.emit(
                "stop-typing",
                {
                    roomId,
                    userId:
                        user._id ||
                        user.id
                }
            );


        } catch (error) {

            console.error(
                "Send message error:",
                error
            );


            alert(
                error.response?.data?.message ||
                "Failed to send message"
            );

        }

    };


    // ==========================
    // TYPING
    // ==========================

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


        const userId =
            user._id ||
            user.id;


        if (
            !roomId
        ) {
            return;
        }


        socketRef.current.emit(
            "typing",
            {
                roomId,
                userId
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
                            userId
                        }
                    );

                },
                1000
            );

    };


    // ==========================
    // FILTER USERS
    // ==========================

    const filteredUsers =
        useMemo(() => {

            const query =
                search.trim().toLowerCase();


            if (!query) {
                return users;
            }


            return users.filter(
                item =>
                    (
                        item.name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(query)
                    ||
                    (
                        item.email ||
                        ""
                    )
                        .toLowerCase()
                        .includes(query)
            );

        }, [
            users,
            search
        ]);


    // ==========================
    // AVATAR
    // ==========================

    const Avatar = ({
        person,
        large = false
    }) => {

        const image =
            person?.profileImage ||
            person?.avatar ||
            person?.image;


        return (

            <div
                className={
                    large
                        ? "messenger-avatar large"
                        : "messenger-avatar"
                }
            >

                {image ? (

                    <img
                        src={image}
                        alt={
                            person?.name ||
                            "User"
                        }
                    />

                ) : (

                    <FaUserCircle />

                )}


                {isUserOnline(person) && (

                    <span className="online-dot">
                        <FaCircle />
                    </span>

                )}

            </div>

        );

    };


    // ==========================
    // MESSAGE TIME
    // ==========================

    const formatTime = (
        date
    ) => {

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


    // ==========================
    // MESSAGE STATUS
    // ==========================

    const MessageStatus = ({
        msg
    }) => {

        const senderId =
            (
                msg.sender?._id ||
                msg.sender
            )?.toString();


        const currentUserId =
            (
                user?._id ||
                user?.id
            )?.toString();


        if (
            senderId !==
            currentUserId
        ) {
            return null;
        }


        return (

            <span className="message-status">

                {msg.isSeen ? (

                    <FaCheckDouble />

                ) : (

                    <FaCheck />

                )}

            </span>

        );

    };


    // ==========================
    // LOADING
    // ==========================

    if (loading) {

        return (

            <div className="messenger-page">

                <div className="messenger-loading">

                    <div className="messenger-loader-circle" />

                    <p>
                        Loading Messenger...
                    </p>

                </div>

            </div>

        );

    }


    return (

        <div className="messenger-page">


            {/* =================================
                SIDEBAR
            ================================== */}

            <aside
                className={
                    mobileChatOpen
                        ? "messenger-sidebar mobile-hidden"
                        : "messenger-sidebar"
                }
            >


                {/* SIDEBAR HEADER */}

                <div className="messenger-sidebar-header">

                    <div>

                        <h1>
                            Chats
                        </h1>

                        <span>
                            {users.length} people
                        </span>

                    </div>

                    <button
                        className="header-icon-btn"
                        title="More"
                    >
                        <FaEllipsisH />
                    </button>

                </div>


                {/* SEARCH */}

                <div className="messenger-search">

                    <FaSearch />

                    <input
                        type="search"
                        placeholder="Search Messenger"
                        value={search}
                        onChange={
                            e =>
                                setSearch(
                                    e.target.value
                                )
                        }
                    />


                    {search && (

                        <button
                            onClick={() =>
                                setSearch("")
                            }
                            className="clear-search-btn"
                            type="button"
                        >
                            <FaTimes />
                        </button>

                    )}

                </div>


                {/* FILTER */}

                <div className="chat-filter-row">

                    <button
                        className="active"
                        type="button"
                    >
                        All
                    </button>

                    <button
                        type="button"
                    >
                        Online
                    </button>

                    <button
                        type="button"
                    >
                        Unread
                    </button>

                </div>


                {/* USER LIST */}

                <div className="user-list">

                    {filteredUsers.map(
                        person => {

                            const id =
                                person._id ||
                                person.id;


                            const selected =
                                (
                                    selectedUser?._id ||
                                    selectedUser?.id
                                )?.toString() ===
                                id?.toString();


                            const unread =
                                unreadUsers[
                                    id
                                ] || 0;


                            return (

                                <button
                                    key={id}
                                    type="button"
                                    className={
                                        selected
                                            ? "chat-user active"
                                            : "chat-user"
                                    }
                                    onClick={() =>
                                        selectUser(
                                            person
                                        )
                                    }
                                >

                                    <Avatar
                                        person={
                                            person
                                        }
                                    />


                                    <div className="chat-user-content">

                                        <div className="chat-user-top">

                                            <strong>
                                                {
                                                    person.name ||
                                                    "User"
                                                }
                                            </strong>

                                            <span className="chat-time">
                                                --
                                            </span>

                                        </div>


                                        <div className="chat-user-bottom">

                                            <span>

                                                {isUserOnline(
                                                    person
                                                )
                                                    ? "Active now"
                                                    : "Offline"}

                                            </span>


                                            {unread > 0 && (

                                                <b className="unread-badge">

                                                    {unread}

                                                </b>

                                            )}

                                        </div>

                                    </div>

                                </button>

                            );

                        }
                    )}


                    {filteredUsers.length === 0 && (

                        <div className="no-users">

                            <FaSearch />

                            <p>
                                No people found
                            </p>

                            <small>
                                Try another name or email.
                            </small>

                        </div>

                    )}

                </div>

            </aside>


            {/* =================================
                CHAT AREA
            ================================== */}

            <main
                className={
                    mobileChatOpen
                        ? "messenger-chat mobile-visible"
                        : "messenger-chat"
                }
            >


                {!selectedUser ? (

                    <div className="empty-chat">

                        <div className="empty-chat-icon">

                            <FaCommentsIcon />

                        </div>

                        <h2>
                            Your messages
                        </h2>

                        <p>
                            Select someone from your
                            chats to start a conversation.
                        </p>

                    </div>

                ) : (

                    <>


                        {/* ==========================
                            CHAT HEADER
                        =========================== */}

                        <header className="chat-header">

                            <div className="chat-header-left">

                                <button
                                    type="button"
                                    className="mobile-back-btn"
                                    onClick={() => {
                                        setMobileChatOpen(
                                            false
                                        );
                                    }}
                                >

                                    <FaArrowLeft />

                                </button>


                                <Avatar
                                    person={
                                        selectedUser
                                    }
                                    large
                                />


                                <div className="chat-header-user">

                                    <h2>
                                        {
                                            selectedUser.name ||
                                            "User"
                                        }
                                    </h2>


                                    <span>

                                        {typing
                                            ? "Typing..."
                                            : isUserOnline(
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
                                >
                                    <FaPhone />
                                </button>


                                <button
                                    type="button"
                                    title="Video call"
                                >
                                    <FaVideo />
                                </button>


                                <button
                                    type="button"
                                    title="Conversation info"
                                    onClick={() =>
                                        setShowInfo(
                                            !showInfo
                                        )
                                    }
                                >
                                    <FaInfoCircle />
                                </button>

                            </div>

                        </header>


                        {/* ==========================
                            CHAT BODY
                        =========================== */}

                        <div className="messages-container">


                            {chatLoading ? (

                                <div className="chat-loading">

                                    <div />

                                    <span>
                                        Loading conversation...
                                    </span>

                                </div>

                            ) : messages.length === 0 ? (

                                <div className="conversation-start">

                                    <Avatar
                                        person={
                                            selectedUser
                                        }
                                        large
                                    />

                                    <h3>
                                        {
                                            selectedUser.name
                                        }
                                    </h3>

                                    <p>
                                        You're connected on
                                        Marketplace.
                                    </p>

                                    <span>
                                        Say hello 👋
                                    </span>

                                </div>

                            ) : (

                                messages.map(
                                    (
                                        msg,
                                        index
                                    ) => {

                                        const senderId =
                                            (
                                                msg.sender?._id ||
                                                msg.sender
                                            )?.toString();


                                        const currentUserId =
                                            (
                                                user?._id ||
                                                user?.id
                                            )?.toString();


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

                                                {!own && (

                                                    <Avatar
                                                        person={
                                                            selectedUser
                                                        }
                                                    />

                                                )}


                                                <div
                                                    className={
                                                        own
                                                            ? "message-wrapper own"
                                                            : "message-wrapper"
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

                                                    </div>


                                                    <div
                                                        className={
                                                            own
                                                                ? "message-meta own"
                                                                : "message-meta"
                                                        }
                                                    >

                                                        <span>
                                                            {
                                                                formatTime(
                                                                    msg.createdAt
                                                                )
                                                            }
                                                        </span>


                                                        {own && (

                                                            <MessageStatus
                                                                msg={
                                                                    msg
                                                                }
                                                            />

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

                        </div>


                        {/* ==========================
                            MESSAGE COMPOSER
                        =========================== */}

                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                            <button
                                type="button"
                                title="Attach file"
                                className="composer-icon"
                            >
                                <FaPaperclip />
                            </button>


                            <div className="message-input-wrapper">

                                <input
                                    type="text"
                                    placeholder="Aa"
                                    value={
                                        message
                                    }
                                    onChange={
                                        handleTyping
                                    }
                                />


                                <button
                                    type="button"
                                    className="emoji-btn"
                                    title="Emoji"
                                >
                                    <FaSmile />
                                </button>

                            </div>


                            <button
                                type="submit"
                                className="send-btn"
                                disabled={
                                    !message.trim()
                                }
                                title="Send"
                            >

                                <FaPaperPlane />

                            </button>

                        </form>

                    </>

                )}

            </main>


            {/* =================================
                INFO PANEL
            ================================== */}

            {showInfo &&
                selectedUser && (

                    <aside className="chat-info-panel">

                        <div className="info-panel-header">

                            <h3>
                                Chat Info
                            </h3>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowInfo(
                                        false
                                    )
                                }
                            >
                                <FaTimes />
                            </button>

                        </div>


                        <div className="info-profile">

                            <Avatar
                                person={
                                    selectedUser
                                }
                                large
                            />

                            <h2>
                                {
                                    selectedUser.name
                                }
                            </h2>

                            <span>
                                {
                                    selectedUser.email ||
                                    "Marketplace User"
                                }
                            </span>

                        </div>


                        <div className="info-section">

                            <p>
                                Account type
                            </p>

                            <strong>
                                {
                                    selectedUser.role ||
                                    "customer"
                                }
                            </strong>

                        </div>


                        {selectedUser.bio && (

                            <div className="info-section">

                                <p>
                                    Bio
                                </p>

                                <strong>
                                    {
                                        selectedUser.bio
                                    }
                                </strong>

                            </div>

                        )}


                        {selectedUser.location && (

                            <div className="info-section">

                                <p>
                                    Location
                                </p>

                                <strong>
                                    {
                                        selectedUser.location
                                    }
                                </strong>

                            </div>

                        )}

                    </aside>

                )}

        </div>

    );

};


// Small helper icon for empty state

const FaCommentsIcon = () => (

    <div className="empty-message-icon">
        💬
    </div>

);


export default Messenger;
