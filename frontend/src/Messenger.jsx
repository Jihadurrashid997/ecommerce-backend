import React, { useEffect, useRef, useState } from "react";
import "./Messenger.css";
import {
  FaPaperPlane,
  FaCircle,
  FaSearch
} from "react-icons/fa";

const Messenger = () => {

  const [users] = useState([
    {
      id: 1,
      name: "Rahim",
      online: true
    },
    {
      id: 2,
      name: "Karim",
      online: false
    },
    {
      id: 3,
      name: "Seller",
      online: true
    }
  ]);

  const [messages, setMessages] = useState([
    {
      sender: "Rahim",
      text: "Hello 👋"
    }
  ]);

  const [text, setText] = useState("");

  const bottomRef = useRef();

  useEffect(() => {

    bottomRef.current?.scrollIntoView({
      behavior: "smooth"
    });

  }, [messages]);

  const sendMessage = () => {

    if (!text.trim()) return;

    setMessages([
      ...messages,
      {
        sender: "Me",
        text
      }
    ]);

    setText("");

  };

  return (

    <div className="messenger">

      <div className="chat-users">

        <div className="chat-search">

          <FaSearch />

          <input
            placeholder="Search user..."
          />

        </div>

        {users.map((user) => (

          <div
            className="chat-user"
            key={user.id}
          >

            <div className="avatar">

              {user.name.charAt(0)}

            </div>

            <div>

              <h4>{user.name}</h4>

              <span>

                <FaCircle
                  color={
                    user.online
                      ? "#22c55e"
                      : "#64748b"
                  }
                />

                {user.online
                  ? " Online"
                  : " Offline"}

              </span>

            </div>

          </div>

        ))}

      </div>

      <div className="chat-box">

        <div className="chat-header">

          <h2>Messenger</h2>

        </div>

        <div className="chat-body">

          {messages.map((msg, index) => (

            <div
              key={index}
              className={
                msg.sender === "Me"
                  ? "my-message"
                  : "other-message"
              }
            >

              <p>{msg.text}</p>

            </div>

          ))}

          <div ref={bottomRef}></div>

        </div>

        <div className="chat-input">

          <input
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            placeholder="Write message..."
          />

          <button onClick={sendMessage}>

            <FaPaperPlane />

          </button>

        </div>

      </div>

    </div>

  );

};

export default Messenger;
