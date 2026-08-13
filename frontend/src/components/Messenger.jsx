import React, {
    useEffect,
    useRef,
    useState
} from "react";

import {
    io
} from "socket.io-client";

import {
    FaCheck,
    FaCheckDouble,
    FaPaperPlane,
    FaCircle
} from "react-icons/fa";

import api from "../services/api";

import "../styles/Messenger.css";


const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace(
            "/api",
            ""
        )
        : window.location.origin;


const Messenger = () => {

    const socketRef =
        useRef(null);

    const messagesEndRef =
        useRef(null);

    const typingTimeoutRef =
        useRef(null);


    const [
        user,
        setUser
    ] = useState(null);


    const [
        users,
        setUsers
    ] = useState([]);


    const [
        selectedUser,
        setSelectedUser
    ] = useState(null);


    const [
        messages,
        setMessages
    ] = useState([]);


    const [
        message,
        setMessage
    ] = useState("");


    const [
        onlineUsers,
        setOnlineUsers
    ] = useState([]);


    const [
        typingUserId,
        setTypingUserId
    ] = useState(null);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        sending,
        setSending
    ] = useState(false);


    // ==========================
    // CURRENT USER
    // ==========================

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


    // ==========================
    // CURRENT USER ID
    // ==========================

    const currentUserId =
        (
            user?._id ||
            user?.id
        )?.toString();


    // ==========================
    // USER ID
    // ==========================

    const getUserId = (
        item
    ) => {

        return (
            item?._id ||
            item?.id ||
            item
        )?.toString();

    };


    // ==========================
    // ROOM ID
    // ==========================

    const getRoomId = (
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

    };


    // ==========================
    // LOAD USERS
    // ==========================

    useEffect(() => {

        if (!user) {
            return;
        }


        const fetchUsers =
            async () => {

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


                } catch (error) {

                    console.error(
                        "Failed to load chat users:",
                        error
                    );


                    // fallback
                    // admin route থাকলে

                    try {

                        const fallback =
                            await api.get(
                                "/users"
                            );


                        const data =
                            fallback.data?.users ||
                            fallback.data?.data ||
                            fallback.data ||
                            [];


                        setUsers(
                            Array.isArray(data)
                                ? data
                                : []
                        );

                    } catch (
                        fallbackError
                    ) {

                        console.error(
                            fallbackError
                        );

                        setUsers([]);

                    }

                } finally {

                    setLoading(false);

                }

            };


        fetchUsers();

    }, [user]);


    // ==========================
    // SOCKET CONNECTION
    // ==========================

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
                    ]
                }
            );


        socketRef.current =
            socket;


        // ==========================
        // CONNECT
        // ==========================

        socket.on(
            "connect",
            () => {

                console.log(
                    "🟢 Messenger socket connected:",
                    socket.id
                );


                socket.emit(
                    "user-online",
                    currentUserId
                );


                setTimeout(() => {

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

                }, 100);

            }
        );


        // ==========================
        // ONLINE USERS
        // ==========================

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

                handleIncomingMessage(
                    newMessage
                );

            }
        );


        // ==========================
        // DIRECT MESSAGE
        // ==========================

        socket.on(
            "direct-message",
            newMessage => {

                handleIncomingMessage(
                    newMessage
                );

            }
        );


        // ==========================
        // TYPING
        // ==========================

        socket.on(
            "user-typing",
            ({
                userId
            }) => {

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


        // ==========================
        // STOP TYPING
        // ==========================

        socket.on(
            "user-stop-typing",
            ({
                userId
            }) => {

                if (
                    userId?.toString() ===
                    typingUserId
                ) {

                    setTypingUserId(null);

                }

            }
        );


        // ==========================
        // SEEN
        // ==========================

        socket.on(
            "messages-seen",
            ({
                senderId
            }) => {

                if (
                    senderId?.toString() ===
                    currentUserId
                ) {

                    setMessages(
                        previous =>
                            previous.map(
                                item => ({
                                    ...item,
                                    isSeen:
                                        true
                                })
                            )
                    );

                }

            }
        );


        // ==========================
        // CLEANUP
        // ==========================

        return () => {

            socket.off(
                "connect"
            );

            socket.off(
                "online-users"
            );

            socket.off(
                "receive-message"
            );

            socket.off(
                "direct-message"
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
        currentUserId
    ]);


    // ==========================
    // INCOMING MESSAGE
    // ==========================

    const handleIncomingMessage = (
        newMessage
    ) => {

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


        if (!belongsToCurrentChat) {
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


        // incoming message seen
        // if current chat is open

        if (
            senderId === selectedId &&
            receiverId === currentUserId
        ) {

            markConversationSeen(
                selectedId
            );

        }

    };


    // ==========================
    // AUTO SCROLL
    // ==========================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [
        messages,
        typingUserId
    ]);


    // ==========================
    // SELECT USER
    // ==========================

    const selectUser = async (
        selected
    ) => {

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


        // Leave old room

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


        // Join new room

        if (
            newRoom &&
            socketRef.current
        ) {

            socketRef.current.emit(
                "join-room",
                newRoom
            );

        }


        try {

            const selectedId =
                getUserId(
                    selected
                );


            const response =
                await api.get(
                    `/messages/conversation/${selectedId}`
                );


            setMessages(
                response.data?.data || []
            );


            await markConversationSeen(
                selectedId
            );


        } catch (error) {

            console.error(
                "Failed to load conversation:",
                error
            );

        }

    };


    // ==========================
    // MARK SEEN
    // ==========================

    const markConversationSeen =
        async (
            selectedId
        ) => {

            if (!selectedId) {
                return;
            }


            try {

                await api.put(
                    `/messages/seen/${selectedId}`
                );


                setMessages(
                    previous =>
                        previous.map(
                            item => {

                                const senderId =
                                    getUserId(
                                        item.sender
                                    );

                                const receiverId =
                                    getUserId(
                                        item.receiver
                                    );


                                if (
                                    senderId ===
                                        selectedId &&
                                    receiverId ===
                                        currentUserId
                                ) {

                                    return {
                                        ...item,
                                        isSeen:
                                            true
                                    };

                                }


                                return item;

                            }
                        )
                );


                const roomId =
                    getRoomId(
                        user,
                        selectedUser
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
                    "Mark seen error:",
                    error
                );

            }

        };


    // ==========================
    // SEND MESSAGE
    // ==========================

    const sendMessage =
        async e => {

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
                getUserId(
                    selectedUser
                );


            const roomId =
                getRoomId(
                    user,
                    selectedUser
                );


            try {

                setSending(true);


                // ==========================
                // SAVE TO DATABASE
                // ==========================

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
                        "Message was not saved"
                    );

                }


                // ==========================
                // INSTANT UI
                // ==========================

                setMessages(
                    previous => {

                        const exists =
                            previous.some(
                                item =>
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


                // ==========================
                // REAL TIME SOCKET
                // ==========================

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


                // stop typing

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
                    "Failed to send message:",
                    error
                );


                alert(
                    error.response?.data?.message ||
                    "Failed to send message"
                );

            } finally {

                setSending(false);

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


        setMessage(
            value
        );


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


        socketRef.current.emit(
            "typing",
            {
                roomId,
                userId:
                    currentUserId
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
                                currentUserId
                        }
                    );

                },
                1000
            );

    };


    // ==========================
    // ONLINE CHECK
    // ==========================

    const isUserOnline = (
        selected
    ) => {

        const id =
            getUserId(
                selected
            );


        return onlineUsers.some(
            onlineId =>
                onlineId?.toString() ===
                id
        );

    };


    // ==========================
    // AVATAR
    // ==========================

    const getAvatar = (
        item
    ) => {

        const image =
            item?.profileImage ||
            item?.avatar ||
            item?.image;


        if (image) {

            const baseURL =
                process.env.REACT_APP_API_URL
                    ? process.env.REACT_APP_API_URL.replace(
                        "/api",
                        ""
                    )
                    : window.location.origin;


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


            return `${baseURL}${image.startsWith("/") ? "" : "/"}${image}`;

        }


        return null;

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
    // LOADING
    // ==========================

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


            {/* ==========================
                SIDEBAR
            ========================== */}

            <aside
                className="messenger-sidebar"
            >

                <div
                    className="messenger-sidebar-header"
                >

                    <h2>
                        Messages
                    </h2>

                    <span>
                        {
                            onlineUsers.length
                        } online
                    </span>

                </div>


                <div
                    className="user-list"
                >

                    {users
                        .filter(
                            item =>
                                getUserId(
                                    item
                                ) !==
                                currentUserId
                        )
                        .map(
                            item => {

                                const id =
                                    getUserId(
                                        item
                                    );


                                const active =
                                    selectedUser &&
                                    getUserId(
                                        selectedUser
                                    ) === id;


                                const online =
                                    isUserOnline(
                                        item
                                    );


                                const avatar =
                                    getAvatar(
                                        item
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
                                                item
                                            )
                                        }
                                    >

                                        <div
                                            className="user-avatar"
                                        >

                                            {avatar ? (

                                                <img
                                                    src={
                                                        avatar
                                                    }
                                                    alt={
                                                        item.name
                                                    }
                                                />

                                            ) : (

                                                item.name
                                                    ?.charAt(
                                                        0
                                                    )
                                                    ?.toUpperCase() ||
                                                "U"

                                            )}


                                            {online && (

                                                <span
                                                    className="online-dot"
                                                />

                                            )}

                                        </div>


                                        <div
                                            className="user-info"
                                        >

                                            <strong>

                                                {
                                                    item.name ||
                                                    "User"
                                                }

                                            </strong>


                                            <span>

                                                {online
                                                    ? "Online"
                                                    : "Offline"}

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


            {/* ==========================
                CHAT
            ========================== */}

            <main
                className="chat-area"
            >

                {!selectedUser ? (

                    <div
                        className="empty-chat"
                    >

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


                        {/* ==========================
                            HEADER
                        ========================== */}

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

                                    <FaCircle
                                        style={{
                                            fontSize:
                                                "7px"
                                        }}
                                    />

                                    {" "}

                                    {isUserOnline(
                                        selectedUser
                                    )
                                        ? "Active now"
                                        : "Offline"}

                                </span>

                            </div>

                        </div>


                        {/* ==========================
                            MESSAGES
                        ========================== */}

                        <div
                            className="messages-container"
                        >

                            {messages.length === 0 ? (

                                <div
                                    className="no-messages"
                                >

                                    <p>
                                        No messages yet.
                                    </p>

                                    <small>
                                        Send a message to start the conversation.
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


                                                    <div
                                                        className="message-meta"
                                                    >

                                                        <small>

                                                            {
                                                                formatTime(
                                                                    msg.createdAt
                                                                )
                                                            }

                                                        </small>


                                                        {ownMessage && (

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


                            {/* ==========================
                                TYPING
                            ========================== */}

                            {typingUserId ===
                                getUserId(
                                    selectedUser
                                ) && (

                                <div
                                    className="typing-indicator"
                                >

                                    <span>
                                        {
                                            selectedUser.name
                                        } is typing...
                                    </span>

                                </div>

                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>


                        {/* ==========================
                            MESSAGE FORM
                        ========================== */}

                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                            <input
                                type="text"
                                placeholder="Write a message..."
                                value={
                                    message
                                }
                                onChange={
                                    handleTyping
                                }
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
                                    {
                                        sending
                                            ? "Sending..."
                                            : "Send"
                                    }
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
