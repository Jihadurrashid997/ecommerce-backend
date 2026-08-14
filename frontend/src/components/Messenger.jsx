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
    FaTimes,
    FaImage,
    FaPalette
} from "react-icons/fa";

import { io } from "socket.io-client";

import api from "../services/api";

import "../styles/Messenger.css";


const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, "")
        : window.location.origin;


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


const CHAT_BACKGROUNDS = [
    {
        id: "default",
        name: "Classic",
        value: ""
    },
    {
        id: "blue",
        name: "Blue",
        value: "linear-gradient(135deg, #eef5ff, #dbeafe)"
    },
    {
        id: "purple",
        name: "Purple",
        value: "linear-gradient(135deg, #f5f3ff, #ede9fe)"
    },
    {
        id: "green",
        name: "Green",
        value: "linear-gradient(135deg, #ecfdf5, #d1fae5)"
    },
    {
        id: "sunset",
        name: "Sunset",
        value: "linear-gradient(135deg, #fff7ed, #ffedd5)"
    },
    {
        id: "dark",
        name: "Dark",
        value: "linear-gradient(135deg, #111827, #1f2937)"
    }
];


const Messenger = () => {

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    const [user, setUser] = useState(null);

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);

    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");

    const [loading, setLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);

    const [search, setSearch] = useState("");

    const [typing, setTyping] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);

    const [unreadUsers, setUnreadUsers] = useState({});

    const [mobileChatOpen, setMobileChatOpen] = useState(false);

    const [showEmoji, setShowEmoji] = useState(false);
    const [showBackgrounds, setShowBackgrounds] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const [background, setBackground] = useState(
        () => localStorage.getItem("jr-chat-background") || "default"
    );

    const [callState, setCallState] = useState(null);


    // =====================================================
    // CURRENT USER
    // =====================================================

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


    // =====================================================
    // LOAD USERS
    // =====================================================

    useEffect(() => {

        if (!user) {
            return;
        }

        const loadUsers = async () => {

            try {

                setLoading(true);

                const response =
                    await api.get("/users/chat-users");

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
                    "Failed to load chat users:",
                    error
                );

            } finally {

                setLoading(false);

            }

        };

        loadUsers();

    }, [user]);


    // =====================================================
    // SOCKET.IO
    // =====================================================

    useEffect(() => {

        if (!user) {
            return;
        }

        const socket =
            io(SOCKET_URL, {
                transports: [
                    "websocket",
                    "polling"
                ],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000
            });

        socketRef.current = socket;

        const currentUserId =
            (
                user._id ||
                user.id
            )?.toString();


        socket.on(
            "connect",
            () => {

                console.log(
                    "JR Messenger connected:",
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


        // =================================================
        // RECEIVE MESSAGE
        // =================================================

        socket.on(
            "receive-message",
            newMessage => {

                if (!newMessage) {
                    return;
                }

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


                if (belongsToCurrentChat) {

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

                    setUnreadUsers(
                        previous => {

                            const updated = {
                                ...previous
                            };

                            delete updated[
                                senderId
                            ];

                            return updated;

                        }
                    );

                    return;

                }


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


        // =================================================
        // TYPING
        // =================================================

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


        // =================================================
        // CALL SIGNALING
        // =================================================

        socket.on(
            "incoming-call",
            data => {

                if (!data) {
                    return;
                }

                setCallState({
                    type: "incoming",
                    ...data
                });

            }
        );


        socket.on(
            "call-accepted",
            data => {

                setCallState(
                    previous => ({
                        ...(previous || {}),
                        type: "accepted",
                        ...data
                    })
                );

            }
        );


        socket.on(
            "call-rejected",
            () => {

                setCallState(null);

                alert(
                    "Call was declined."
                );

            }
        );


        socket.on(
            "call-ended",
            () => {

                setCallState(null);

            }
        );


        return () => {

            clearTimeout(
                typingTimeoutRef.current
            );

            socket.disconnect();

            socketRef.current = null;

        };

    }, [user, selectedUser]);


    // =====================================================
    // AUTO SCROLL
    // =====================================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, typing]);


    // =====================================================
    // ROOM ID
    // =====================================================

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


    // =====================================================
    // ONLINE
    // =====================================================

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


    // =====================================================
    // SELECT USER
    // =====================================================

    const selectUser = async (
        targetUser
    ) => {

        if (!targetUser) {
            return;
        }

        setSelectedUser(targetUser);

        setMobileChatOpen(true);

        setMessages([]);

        setTyping(false);

        setShowEmoji(false);

        setShowBackgrounds(false);

        setShowMenu(false);


        const targetUserId =
            targetUser._id ||
            targetUser.id;


        const roomId =
            getRoomId(
                user,
                targetUser
            );


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


    // =====================================================
    // SEND MESSAGE
    // =====================================================

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


            if (
                socketRef.current &&
                roomId &&
                savedMessage
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

            setShowEmoji(false);


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


    // =====================================================
    // TYPING
    // =====================================================

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


        const userId =
            user._id ||
            user.id;


        if (value.trim()) {

            socketRef.current.emit(
                "typing",
                {
                    roomId,
                    userId
                }
            );

        } else {

            socketRef.current.emit(
                "stop-typing",
                {
                    roomId,
                    userId
                }
            );

        }


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


    // =====================================================
    // EMOJI
    // =====================================================

    const addEmoji = (
        emoji
    ) => {

        setMessage(
            previous =>
                previous + emoji
        );

    };


    // =====================================================
    // BACKGROUND
    // =====================================================

    const changeBackground = (
        backgroundId
    ) => {

        setBackground(
            backgroundId
        );

        localStorage.setItem(
            "jr-chat-background",
            backgroundId
        );

        setShowBackgrounds(false);

    };


    const currentBackground =
        CHAT_BACKGROUNDS.find(
            item =>
                item.id === background
        ) || CHAT_BACKGROUNDS[0];


    // =====================================================
    // CALL
    // =====================================================

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
            user._id ||
            user.id;


        const receiverId =
            selectedUser._id ||
            selectedUser.id;


        socketRef.current.emit(
            "call-user",
            {
                roomId,
                callerId,
                receiverId,
                callerName:
                    user.name ||
                    "User",
                type
            }
        );


        setCallState({
            type: "outgoing",
            callType: type,
            receiverName:
                selectedUser.name ||
                "User"
        });

    };


    const acceptCall = () => {

        if (
            !socketRef.current ||
            !callState
        ) {

            return;

        }


        socketRef.current.emit(
            "accept-call",
            {
                roomId:
                    callState.roomId,
                callerId:
                    callState.callerId,
                receiverId:
                    user?._id ||
                    user?.id
            }
        );


        setCallState(
            previous => ({
                ...(previous || {}),
                type: "accepted"
            })
        );

    };


    const rejectCall = () => {

        if (
            socketRef.current &&
            callState
        ) {

            socketRef.current.emit(
                "reject-call",
                {
                    roomId:
                        callState.roomId,
                    callerId:
                        callState.callerId
                }
            );

        }

        setCallState(null);

    };


    const endCall = () => {

        if (
            socketRef.current &&
            callState
        ) {

            socketRef.current.emit(
                "end-call",
                {
                    roomId:
                        callState.roomId
                }
            );

        }

        setCallState(null);

    };


    // =====================================================
    // FILE PICKER
    // =====================================================

    const handleAttachment = (
        e
    ) => {

        const file =
            e.target.files?.[0];

        if (!file) {
            return;
        }


        alert(
            `Selected file: ${file.name}\nAttachment upload can be connected to your storage API next.`
        );


        e.target.value = "";

    };


    // =====================================================
    // FILTER USERS
    // =====================================================

    const filteredUsers =
        useMemo(() => {

            const query =
                search
                    .trim()
                    .toLowerCase();

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


    // =====================================================
    // AVATAR
    // =====================================================

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

                    <div className="avatar-fallback">

                        {person?.name
                            ?.charAt(0)
                            ?.toUpperCase() || "U"}

                    </div>

                )}


                {isUserOnline(person) && (

                    <span className="online-dot">
                        <FaCircle />
                    </span>

                )}

            </div>

        );

    };


    // =====================================================
    // TIME
    // =====================================================

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


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (

            <div className="messenger-page">

                <div className="messenger-loading">

                    <div className="messenger-loader" />

                    <span>
                        Loading Messenger...
                    </span>

                </div>

            </div>

        );

    }


    return (

        <div className="messenger-page">


            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside
                className={
                    mobileChatOpen
                        ? "messenger-sidebar mobile-hidden"
                        : "messenger-sidebar"
                }
            >

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


                <div className="messenger-search">

                    <FaSearch />

                    <input
                        type="search"
                        value={search}
                        onChange={
                            e =>
                                setSearch(
                                    e.target.value
                                )
                        }
                        placeholder="Search Messenger"
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

                    {filteredUsers.map(
                        person => {

                            const id =
                                person._id ||
                                person.id;

                            const selectedId =
                                selectedUser?._id ||
                                selectedUser?.id;


                            const active =
                                selectedId
                                    ?.toString() ===
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

                                    <Avatar
                                        person={person}
                                    />


                                    <div className="chat-user-content">

                                        <div className="chat-user-top">

                                            <strong>
                                                {
                                                    person.name ||
                                                    "User"
                                                }
                                            </strong>

                                        </div>


                                        <div className="chat-user-bottom">

                                            <span>

                                                {
                                                    isUserOnline(
                                                        person
                                                    )
                                                        ? "Active now"
                                                        : "Offline"
                                                }

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


            {/* =================================================
                CHAT
            ================================================= */}

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
                            💬
                        </div>

                        <h2>
                            Your messages
                        </h2>

                        <p>
                            Select someone from your chats
                            to start a conversation.
                        </p>

                    </div>

                ) : (

                    <>

                        {/* =====================================
                            HEADER
                        ===================================== */}

                        <header className="chat-header">

                            <div className="chat-header-left">

                                <button
                                    type="button"
                                    className="mobile-back-btn"
                                    onClick={() =>
                                        setMobileChatOpen(
                                            false
                                        )
                                    }
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
                                    title="Chat info"
                                    onClick={() =>
                                        setShowMenu(
                                            previous =>
                                                !previous
                                        )
                                    }
                                >
                                    <FaEllipsisH />
                                </button>

                            </div>


                            {showMenu && (

                                <div className="chat-options-menu">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowBackgrounds(
                                                previous =>
                                                    !previous
                                            )
                                        }
                                    >
                                        <FaPalette />
                                        Chat Theme
                                    </button>


                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowMenu(
                                                false
                                            )
                                        }
                                    >
                                        <FaInfoCircle />
                                        Conversation Info
                                    </button>

                                </div>

                            )}

                        </header>


                        {/* =====================================
                            BACKGROUND PANEL
                        ===================================== */}

                        {showBackgrounds && (

                            <div className="background-panel">

                                <div className="background-panel-title">

                                    <strong>
                                        Chat Theme
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
                                        theme => (

                                            <button
                                                key={
                                                    theme.id
                                                }
                                                type="button"
                                                className={
                                                    background ===
                                                    theme.id
                                                        ? "theme-option selected"
                                                        : "theme-option"
                                                }
                                                onClick={() =>
                                                    changeBackground(
                                                        theme.id
                                                    )
                                                }
                                            >

                                                <span
                                                    style={{
                                                        background:
                                                            theme.value ||
                                                            "#f0f2f5"
                                                    }}
                                                />

                                                <small>
                                                    {
                                                        theme.name
                                                    }
                                                </small>

                                            </button>

                                        )
                                    )}

                                </div>

                            </div>

                        )}


                        {/* =====================================
                            CALL PANEL
                        ===================================== */}

                        {callState && (

                            <div className="call-overlay">

                                <div className="call-card">

                                    <Avatar
                                        person={
                                            selectedUser
                                        }
                                        large
                                    />


                                    <h3>

                                        {callState.type ===
                                        "incoming"
                                            ? `${callState.callerName || "Someone"} is calling`
                                            : callState.type ===
                                              "outgoing"
                                                ? `Calling ${callState.receiverName || "User"}...`
                                                : `${callState.callType === "video" ? "Video" : "Voice"} call`}

                                    </h3>


                                    {callState.type ===
                                        "incoming" && (

                                        <div className="call-actions">

                                            <button
                                                type="button"
                                                className="call-reject"
                                                onClick={
                                                    rejectCall
                                                }
                                            >
                                                Decline
                                            </button>


                                            <button
                                                type="button"
                                                className="call-accept"
                                                onClick={
                                                    acceptCall
                                                }
                                            >
                                                Accept
                                            </button>

                                        </div>

                                    )}


                                    {(
                                        callState.type ===
                                            "outgoing" ||
                                        callState.type ===
                                            "accepted"
                                    ) && (

                                        <button
                                            type="button"
                                            className="call-end"
                                            onClick={
                                                endCall
                                            }
                                        >
                                            End Call
                                        </button>

                                    )}

                                </div>

                            </div>

                        )}


                        {/* =====================================
                            MESSAGES
                        ===================================== */}

                        <div
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

                                    <span>
                                        Loading conversation...
                                    </span>

                                </div>

                            ) : messages.length === 0 ? (

                                <div className="no-messages">

                                    <div>
                                        💬
                                    </div>

                                    <p>
                                        No messages yet
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
                                            (
                                                msg.sender?._id ||
                                                msg.sender
                                            )?.toString();

                                        const currentUserId =
                                            (
                                                user?._id ||
                                                user?.id
                                            )?.toString();

                                        const ownMessage =
                                            senderId ===
                                            currentUserId;


                                        return (

                                            <div
                                                key={
                                                    msg._id ||
                                                    index
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
                                                                formatTime(
                                                                    msg.createdAt
                                                                )
                                                            }
                                                        </small>


                                                        {ownMessage && (

                                                            <span className="message-status">

                                                                {msg.isSeen ? (
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

                        </div>


                        {/* =====================================
                            EMOJI PICKER
                        ===================================== */}

                        {showEmoji && (

                            <div className="emoji-picker">

                                <div className="emoji-header">

                                    <strong>
                                        Emojis
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
                                        (emoji, index) => (

                                            <button
                                                type="button"
                                                key={
                                                    `${emoji}-${index}`
                                                }
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


                        {/* =====================================
                            COMPOSER
                        ===================================== */}

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
                                    onClick={() => {

                                        setShowEmoji(
                                            previous =>
                                                !previous
                                        );

                                        setShowBackgrounds(
                                            false
                                        );

                                    }}
                                >
                                    <FaSmile />
                                </button>


                                <button
                                    type="button"
                                    title="Attachment"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    <FaPaperclip />
                                </button>


                                <button
                                    type="button"
                                    title="Photo"
                                    onClick={() =>
                                        fileInputRef.current?.click()
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
                                    accept="image/*,.pdf,.doc,.docx,.txt"
                                    onChange={
                                        handleAttachment
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
                                    spellCheck="true"
                                />

                            </div>


                            <button
                                type="submit"
                                className="send-message-btn"
                                disabled={
                                    !message.trim()
                                }
                                title="Send message"
                            >

                                <FaPaperPlane />

                            </button>

                        </form>

                    </>

                )}

            </main>

        </div>

    );

};


export default Messenger;
