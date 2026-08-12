import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import api from "../services/api";
import "../styles/Messenger.css";

const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace("/api", "")
        : window.location.origin;

const Messenger = () => {

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typing, setTyping] = useState(false);
    const [loading, setLoading] = useState(true);


    // ==========================
    // CURRENT USER
    // ==========================

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (storedUser) {

            try {
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error(
                    "User data error:",
                    error
                );
            }

        }

    }, []);


    // ==========================
    // LOAD USERS
    // ==========================

    useEffect(() => {

        const fetchUsers = async () => {

            try {

                const response =
                    await api.get("/users");

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
                    "Failed to load users:",
                    error
                );

            } finally {

                setLoading(false);

            }

        };

        fetchUsers();

    }, []);


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

        socketRef.current = socket;


        socket.on("connect", () => {

            console.log(
                "Socket connected:",
                socket.id
            );

            socket.emit(
                "user-online",
                user._id || user.id
            );

        });


        socket.on(
            "online-users",
            (online) => {

                setOnlineUsers(
                    online || []
                );

            }
        );


        socket.on(
            "receive-message",
            (newMessage) => {

                const currentUserId =
                    (
                        user._id ||
                        user.id
                    )?.toString();

                const selectedUserId =
                    (
                        selectedUser?._id ||
                        selectedUser?.id
                    )?.toString();

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


                const belongsToCurrentChat =
                    selectedUserId &&
                    (
                        (
                            senderId === selectedUserId &&
                            receiverId === currentUserId
                        ) ||
                        (
                            senderId === currentUserId &&
                            receiverId === selectedUserId
                        )
                    );


                if (belongsToCurrentChat) {

                    setMessages(
                        previous => {

                            const alreadyExists =
                                previous.some(
                                    item =>
                                        item._id &&
                                        newMessage._id &&
                                        item._id ===
                                        newMessage._id
                                );

                            if (alreadyExists) {
                                return previous;
                            }

                            return [
                                ...previous,
                                newMessage
                            ];

                        }
                    );

                }

            }
        );


        socket.on(
            "user-typing",
            () => {

                setTyping(true);

            }
        );


        socket.on(
            "user-stop-typing",
            () => {

                setTyping(false);

            }
        );


        return () => {

            socket.disconnect();
            socketRef.current = null;

        };

    }, [user, selectedUser]);


    // ==========================
    // AUTO SCROLL
    // ==========================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


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

        if (!first || !second) {
            return null;
        }

        return [first, second]
            .sort()
            .join("_");

    };


    // ==========================
    // SELECT USER
    // ==========================

    const selectUser = async (
        selected
    ) => {

        setSelectedUser(selected);
        setMessages([]);
        setTyping(false);


        if (!user || !selected) {
            return;
        }


        const currentUserId =
            user._id || user.id;

        const selectedUserId =
            selected._id || selected.id;


        const roomId =
            getRoomId(
                user,
                selected
            );


        // Join socket room

        if (
            roomId &&
            socketRef.current
        ) {

            socketRef.current.emit(
                "join-room",
                roomId
            );

        }


        // Load conversation

        try {

            const response =
                await api.get(
                    `/messages/conversation/${selectedUserId}`
                );


            setMessages(
                response.data?.data || []
            );


            // Mark messages as seen

            await api.put(
                `/messages/seen/${selectedUserId}`
            );

        } catch (error) {

            console.error(
                "Failed to load conversation:",
                error
            );

        }

    };


    // ==========================
    // SEND MESSAGE
    // ==========================

    const sendMessage = async (e) => {

        e.preventDefault();


        if (
            !message.trim() ||
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

            // Save message in MongoDB

            const response =
                await api.post(
                    "/messages/send",
                    {
                        receiver,
                        message:
                            message.trim()
                    }
                );


            const savedMessage =
                response.data?.data;


            // Send real-time message

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
                "Failed to send message:",
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

    const handleTyping = (e) => {

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


        if (value.trim()) {

            socketRef.current.emit(
                "typing",
                {
                    roomId,
                    userId:
                        user._id ||
                        user.id
                }
            );

        } else {

            socketRef.current.emit(
                "stop-typing",
                {
                    roomId,
                    userId:
                        user._id ||
                        user.id
                }
            );

        }

    };


    // ==========================
    // ONLINE CHECK
    // ==========================

    const isUserOnline = (
        selected
    ) => {

        if (!selected) {
            return false;
        }


        const id =
            (
                selected._id ||
                selected.id
            )?.toString();


        return onlineUsers.some(
            onlineId =>
                onlineId?.toString() === id
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
            =========================== */}

            <aside className="messenger-sidebar">

                <div className="messenger-sidebar-header">

                    <h2>
                        Messages
                    </h2>

                </div>


                <div className="user-list">

                    {users
                        .filter(item => {

                            const currentId =
                                (
                                    user?._id ||
                                    user?.id
                                )?.toString();

                            const itemId =
                                (
                                    item._id ||
                                    item.id
                                )?.toString();

                            return (
                                itemId &&
                                itemId !== currentId
                            );

                        })
                        .map(item => {

                            const id =
                                item._id ||
                                item.id;


                            const active =
                                selectedUser &&
                                (
                                    selectedUser._id ||
                                    selectedUser.id
                                )?.toString() ===
                                id?.toString();


                            return (

                                <button
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
                                            item.name
                                                ?.charAt(0)
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
                                                isUserOnline(item)
                                                    ? "🟢 Online"
                                                    : "Offline"
                                            }

                                        </span>

                                    </div>

                                </button>

                            );

                        })
                    }


                    {users.length === 0 && (

                        <p className="no-users">
                            No users available.
                        </p>

                    )}

                </div>

            </aside>


            {/* ==========================
                CHAT AREA
            =========================== */}

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


                        {/* CHAT HEADER */}

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


                        {/* MESSAGES */}

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


                            {typing && (

                                <div className="typing-indicator">

                                    <span>
                                        Typing...
                                    </span>

                                </div>

                            )}


                            <div
                                ref={messagesEndRef}
                            />

                        </div>


                        {/* MESSAGE INPUT */}

                        <form
                            className="message-form"
                            onSubmit={sendMessage}
                        >

                            <input
                                type="text"
                                placeholder="Write a message..."
                                value={message}
                                onChange={
                                    handleTyping
                                }
                            />


                            <button
                                type="submit"
                                disabled={
                                    !message.trim()
                                }
                            >
                                Send
                            </button>

                        </form>

                    </>

                )}

            </main>

        </div>

    );

};

export default Messenger;
