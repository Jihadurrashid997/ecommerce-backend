import React, { useEffect, useState } from "react";
import api from "../services/api";
import "./Messenger.css";

const Messenger = () => {

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");

    useEffect(() => {

        loadUsers();

    }, []);

    const loadUsers = async () => {

        try {

            const res = await api.get("/admin/users");

            setUsers(res.data);

        } catch (err) {

            console.log(err);

        }

    };

    const sendMessage = () => {

        if (!text.trim()) return;

        setMessages((prev) => [
            ...prev,
            {
                text,
                sender: "me",
                time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            },
        ]);

        setText("");

    };

    return (

        <div className="messenger">

            <div className="chat-list">

                <h2>Chats</h2>

                {users.map((user) => (

                    <div
                        key={user._id}
                        className={`chat-user ${
                            selectedUser?._id === user._id ? "active" : ""
                        }`}
                        onClick={() => setSelectedUser(user)}
                    >
                        <div className="avatar">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>

                        <div>

                            <h4>{user.name}</h4>

                            <small>{user.email}</small>

                        </div>

                    </div>

                ))}

            </div>

            <div className="chat-box">

                {selectedUser ? (

                    <>

                        <div className="chat-header">

                            <h3>{selectedUser.name}</h3>

                        </div>

                        <div className="chat-body">

                            {messages.map((msg, index) => (

                                <div
                                    key={index}
                                    className={`message ${msg.sender}`}
                                >

                                    <p>{msg.text}</p>

                                    <span>{msg.time}</span>

                                </div>

                            ))}

                        </div>

                        <div className="chat-input">

                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        sendMessage();
                                    }
                                }}
                            />

                            <button onClick={sendMessage}>
                                Send
                            </button>

                        </div>

                    </>

                ) : (

                    <div className="empty-chat">

                        <h2>Select a chat</h2>

                    </div>

                )}

            </div>

        </div>

    );

};

export default Messenger;
