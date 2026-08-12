import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import api from "../services/api";

import "../styles/Messenger.css";


// Render backend URL
const SOCKET_URL =
    process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace(
            "/api",
            ""
        )
        : window.location.origin;


const Messenger = () => {

    const socketRef = useRef(null);

    const messagesEndRef =
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

    const [typing, setTyping] =
        useState(false);

    const [loading, setLoading] =
        useState(true);


    // ==========================
    // GET CURRENT USER
    // ==========================

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (storedUser) {

            try {

                setUser(
                    JSON.parse(storedUser)
                );

            } catch (err) {

                console.error(err);

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

                setUsers(
                    response.data?.users ||
                    response.data ||
                    []
                );

            } catch (err) {

                console.error(
                    "Failed to load users:",
                    err
                );

            } finally {

                setLoading(false);

            }

        };


        fetchUsers();

    }, []);


    // ==========================
    // SOCKET CONNECTION
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


        socket.on(
            "connect",
            () => {

                console.log(
                    "Socket connected:",
                    socket.id
                );


                socket.emit(
                    "user-online",
                    user._id || user.id
                );

            }
        );


        socket.on(
            "online-users",
            (users) => {

                setOnlineUsers(
                    users || []
                );

            }
        );


        socket.on(
            "receive-message",
            (newMessage) => {

                setMessages(
                    previous => [
                        ...previous,
                        newMessage
                    ]
                );

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

    }, [user]);


    // ==========================
    // AUTO SCROLL
    // ==========================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages]);


    // ==========================
    // CREATE ROOM ID
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

        setSelectedUser(
            selected
        );

        setMessages([]);

        setTyping(false);


        if (!user || !selected) {
            return;
        }


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


        // Try loading saved messages
        try {

            const selectedId =
                selected._id ||
                selected.id;


            const response =
                await api.get(
                    `/messages/${selectedId}`
                );


            const loadedMessages =
                response.data?.messages ||
                response.data ||
                [];


            if (
                Array.isArray(
                    loadedMessages
                )
            ) {

                setMessages(
                    loadedMessages
                );

            }

        } catch (err) {

            console.log(
                "No previous messages loaded."
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


        const roomId =
            getRoomId(
                user,
                selectedUser
            );


        if (!roomId) {
            return;
        }


        const newMessage = {

            roomId,

            sender:
                user._id ||
                user.id,

            receiver:
                selectedUser._id ||
                selectedUser.id,

            text:
                message.trim(),

            createdAt:
                new Date().toISOString()

        };


        // Send through Socket.io

        if (socketRef.current) {

            socketRef.current.emit(
                "send-message",
                newMessage
            );

        }


        // Save message in database

        try {

            await api.post(
                "/messages",
                {
                    receiver:
                        selectedUser._id ||
                        selectedUser.id,

                    text:
                        message.trim()
                }
            );

        } catch (err) {

            console.error(
                "Failed to save message:",
                err
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

    };


    // ==========================
    // TYPING
    // ==========================

    const handleTyping = (e) => {

        setMessage(
            e.target.value
        );


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


        if (e.target.value.trim()) {

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
    // USER ONLINE CHECK
    // ==========================

    const isUserOnline = (
        selected
    ) => {

        if (!selected) {
            return false;
        }


        const id = (
            selected._id ||
            selected.id
        )?.toString();


        return onlineUsers.includes(
            id
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


            {/* =========================
                USER LIST
            ========================== */}

            <aside className="messenger-sidebar">

                <div className="messenger-sidebar-header">

                    <h2>
                        Messages
                    </h2>

                </div>


                <div className="user-list">

                    {users
                        .filter(
                            item =>
                                (
                                    item._id ||
                                    item.id
                                )?.toString() !==
                                (
                                    user?._id ||
                                    user?.id
                                )?.toString()
                        )
                        .map(
                            item => {

                                const id =
                                    item._id ||
                                    item.id;


                                return (

                                    <button
                                        key={id}
                                        className={
                                            selectedUser &&
                                            (
                                                selectedUser._id ||
                                                selectedUser.id
                                            )?.toString() ===
                                            id?.toString()
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

                                                {isUserOnline(
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


            {/* =========================
                CHAT AREA
            ========================== */}

            <main className="chat-area">


                {!selectedUser ? (

                    <div className="empty-chat">

                        <div>

                            <h2>
                                💬 Welcome to Messenger
                            </h2>

                            <p>
                                Select a user to
                                start chatting.
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

                                    {isUserOnline(
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
                                        Send a message
                                        to start the
                                        conversation.
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
                                                            msg.text
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
