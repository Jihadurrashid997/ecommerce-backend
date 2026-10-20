import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    useSearchParams
} from "react-router-dom";

import {
    FaSearch,
    FaPaperPlane,
    FaSmile,
    FaPaperclip,
    FaEllipsisH,
    FaBell,
    FaPhone,
    FaVideo,
    FaArrowLeft,
    FaCheck,
    FaCheckDouble,
    FaExclamationCircle,
    FaCircle,
    FaUserCircle,
    FaTimes,
    FaImage,
    FaPalette,
    FaCog,
    FaBan,
    FaThumbtack,
    FaArchive,
    FaVolumeMute,
    FaLock,
    FaMicrophone,
    FaTrash,
    FaShare,
    FaCheckCircle,
    FaUsers,
    FaPlus,
    FaUserPlus,
    FaMapMarkerAlt
} from "react-icons/fa";

import api, {
    getMessages,
    getUploadUrl
} from "../services/api";

import {
    deriveConversationCipher,
    decryptMessageRecord,
    encryptMessageText,
    encryptGroupMessageText,
    ensureMessengerIdentity,
    createMessengerKeyBackup,
    getConversationEncryptionId,
    getGroupSafetyCode,
    getPeerEncryptionKey,
    getSafetyCode,
    isEncryptedMessage,
    isEncryptedGroupMessage,
    decryptGroupMessageRecord,
    restoreMessengerIdentity,
    encryptMessengerMediaFile,
    decryptMessengerMediaFile,
    getEncryptedMediaMetadata
} from "../services/messengerEncryption";
import {
    createLocationMessage,
    parseLocationMessage
} from "../services/messengerLocation";
import {
    finishVoiceRecording,
    startVoiceRecording
} from "../services/voiceRecorder";

import socket, {
    connectSocket
} from "../services/socket";

import {
    createPeerConnection,
    getUserMedia,
    addLocalTracks,
    closePeerConnection,
    stopMediaStream
} from "../services/webrtc";

import {
    requestNotificationPermission,
    showMessageNotification,
    showIncomingCallNotification,
    showMissedCallNotification,
    stopCallRingtone
} from "../services/notification";

import CallModal from "./CallModal";
import GroupCallModal from "./GroupCallModal";
import CallLogMessage from "./CallLogMessage";
import VerifiedBadge from "./VerifiedBadge";
import VoiceMessagePlayer, {
    formatDuration
} from "./VoiceMessagePlayer";

import "../styles/Messenger.css";
import "../styles/VerifiedBadge.css";


/* =========================================================
   EMOJIS
========================================================= */

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


/* =========================================================
   CHAT BACKGROUNDS
========================================================= */

const CHAT_BACKGROUNDS = [
    {
        id: "default",
        name: "Classic",
        value: ""
    },
    {
        id: "blue",
        name: "Blue",
        value: "linear-gradient(135deg,#eef5ff,#dbeafe)"
    },
    {
        id: "purple",
        name: "Purple",
        value: "linear-gradient(135deg,#f5f3ff,#ede9fe)"
    },
    {
        id: "green",
        name: "Green",
        value: "linear-gradient(135deg,#ecfdf5,#d1fae5)"
    },
    {
        id: "sunset",
        name: "Sunset",
        value: "linear-gradient(135deg,#fff7ed,#ffedd5)"
    },
    {
        id: "dark",
        name: "Dark",
        value: "linear-gradient(135deg,#111827,#1f2937)"
    }
];


/* =========================================================
   HELPERS
========================================================= */

const getId = (value) => {

    if (!value) {
        return null;
    }

    if (typeof value === "object") {

        return String(
            value._id ||
            value.id ||
            value.userId ||
            ""
        ) || null;

    }

    return String(value);
};

const attachDecryptedMediaMetadata = message => {
    if (!message || typeof message !== "object") {
        return message;
    }

    const media = getEncryptedMediaMetadata(message?.message);
    const nested = {};

    for (const field of ["replyTo", "forwardedFrom"]) {
        if (message[field] && typeof message[field] === "object") {
            nested[field] = attachDecryptedMediaMetadata(message[field]);
        }
    }

    if (!message?.fileUrl || !message?.isEncrypted || !media) {
        return { ...message, ...nested };
    }

    return {
        ...message,
        ...nested,
        message: media.caption,
        fileName: media.fileName,
        fileType: media.fileType,
        encryptedMedia: media
    };
};


const getUserName = (target) => {

    if (!target) {
        return "User";
    }

    return (
        target.name ||
        target.username ||
        target.fullName ||
        target.displayName ||
        target.firstName ||
        target.email ||
        "User"
    );
};


const getAvatar = (target) => {

    if (!target) {
        return "";
    }

    return (
        target.profileImage ||
        target.avatar ||
        target.photo ||
        target.image ||
        target.profilePicture ||
        ""
    );
};


const getMessageSenderId = (item) => {

    return getId(
        item?.sender?._id ||
        item?.sender?.id ||
        item?.sender
    );

};


const getMessageReceiverId = (item) => {

    return getId(
        item?.receiver?._id ||
        item?.receiver?.id ||
        item?.receiver
    );

};


const getMessageId = (item) => {

    return (
        item?._id ||
        item?.id ||
        item?.messageId ||
        null
    );

};


const EncryptedMediaAttachment = ({ url, media, own }) => {
    const [objectUrl, setObjectUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => () => {
        if (objectUrl) {
            window.URL.revokeObjectURL(objectUrl);
        }
    }, [objectUrl]);

    const decryptAttachment = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("The encrypted attachment could not be loaded.");
            }
            const encryptedBytes = await response.arrayBuffer();
            const plaintext = await decryptMessengerMediaFile(
                encryptedBytes,
                media
            );
            const blob = new Blob([plaintext], { type: media.fileType });
            setObjectUrl(window.URL.createObjectURL(blob));
        } catch (loadError) {
            console.error("Encrypted Messenger attachment error:", loadError);
            setError("Could not decrypt this attachment on this device.");
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return <span className="encrypted-media-error" role="status">{error}</span>;
    }

    if (!objectUrl) {
        return (
            <button
                type="button"
                className="message-attachment-file encrypted-media-load"
                disabled={loading}
                onClick={decryptAttachment}
            >
                <FaLock />
                <span>{loading ? "Decrypting attachment..." : "Decrypt attachment"}</span>
            </button>
        );
    }

    if (media.fileType.startsWith("audio/")) {
        return <VoiceMessagePlayer url={objectUrl} own={own} />;
    }

    if (media.fileType.startsWith("image/")) {
        return (
            <a
                href={objectUrl}
                target="_blank"
                rel="noreferrer"
                title="Open decrypted image"
            >
                <img
                    src={objectUrl}
                    alt={media.fileName}
                    className="message-attachment-image"
                />
            </a>
        );
    }

    return (
        <a
            href={objectUrl}
            download={media.fileName}
            className="message-attachment-file"
        >
            <FaPaperclip />
            <span>{media.fileName}</span>
        </a>
    );
};


/* =========================================================
   COMPONENT
========================================================= */

const ConversationStateIcons = ({ preference = {} }) => (
    <span className="conversation-state-icons" aria-label="Conversation status">
        {preference.pinned && (
            <FaThumbtack title="Pinned chat" aria-label="Pinned chat" />
        )}
        {preference.muted && (
            <FaVolumeMute title="Notifications muted" aria-label="Notifications muted" />
        )}
    </span>
);

const createCallId = () => {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const Messenger = ({ isActive = true }) => {

    /*
     * Reads ?user=<id> from the URL - this is how
     * UserProfile.jsx's "Message" button and
     * SearchResults.jsx's message icon navigate here
     * (e.g. /messenger?user=64f...). See the effect
     * further below (after selectUser is defined) that
     * actually opens this conversation.
     */
    const [searchParams, setSearchParams] =
        useSearchParams();

    const messagesEndRef =
        useRef(null);

    const messagesContainerRef =
        useRef(null);

    const messageHistoryRef =
        useRef({
            page: 1,
            hasMore: false,
            loading: false
        });

    const conversationLoadRef =
        useRef(0);

    const pendingHistoryScrollRef =
        useRef(null);

    const typingTimeoutRef =
        useRef(null);

    const fileInputRef =
        useRef(null);

    const messageInputRef =
        useRef(null);

    const currentUserRef =
        useRef(null);

    const selectedUserRef =
        useRef(null);

    const currentRoomRef =
        useRef(null);

    const peerRef =
        useRef(null);

    const localStreamRef =
        useRef(null);

    const remoteStreamRef =
        useRef(null);

    const remoteTracksRef =
        useRef([]);

    const pendingCandidatesRef =
        useRef([]);

    const callRef =
        useRef(null);

    /*
     * NOTE: endCallRef always points to the latest
     * version of endCall (whatever callState/cleanupCall
     * it was built with). Anything that needs to call
     * endCall() from inside a *stable* (rarely-recreated)
     * callback (e.g. the WebRTC connection-state handler
     * inside createPeer, or the socket-events effect)
     * MUST go through this ref instead of closing over
     * the endCall variable directly, otherwise it will
     * silently keep calling an old, stale copy.
     */
    const endCallRef =
        useRef(() => {});


    const [user, setUser] =
        useState(null);

    const [users, setUsers] =
        useState([]);

    const [groups, setGroups] =
        useState([]);

    const [chatPreferences, setChatPreferences] =
        useState({});

    const [chatPreferencesOwner, setChatPreferencesOwner] =
        useState(null);

    const [chatListView, setChatListView] =
        useState("chats");

    const [encryptionIdentity, setEncryptionIdentity] =
        useState(null);

    const encryptionIdentityRef =
        useRef(null);

    const [encryptionError, setEncryptionError] =
        useState("");

    const [keyBackupPassphrase, setKeyBackupPassphrase] =
        useState("");

    const [keyBackupConfirmation, setKeyBackupConfirmation] =
        useState("");

    const [keyRestorePassphrase, setKeyRestorePassphrase] =
        useState("");

    const [keyBackupBusy, setKeyBackupBusy] =
        useState(false);

    const [keyBackupMessage, setKeyBackupMessage] =
        useState("");

    const [encryptionSafetyCode, setEncryptionSafetyCode] =
        useState("");

    const [encryptionSafetyPeerId, setEncryptionSafetyPeerId] =
        useState("");

    const [selectedUser, setSelectedUser] =
        useState(null);

    const [messages, setMessages] =
        useState([]);

    const [message, setMessage] =
        useState("");

    useEffect(() => {
        if (!isActive) {
            return undefined;
        }

        const visualViewport = window.visualViewport;
        const updateViewportHeight = () => {
            const height =
                visualViewport?.height ||
                window.innerHeight;

            document.documentElement.style.setProperty(
                "--messenger-viewport-height",
                `${Math.round(height)}px`
            );
        };

        updateViewportHeight();
        visualViewport?.addEventListener("resize", updateViewportHeight);
        window.addEventListener("resize", updateViewportHeight);

        return () => {
            visualViewport?.removeEventListener("resize", updateViewportHeight);
            window.removeEventListener("resize", updateViewportHeight);
            document.documentElement.style.removeProperty(
                "--messenger-viewport-height"
            );
        };
    }, [isActive]);

    useEffect(() => {
        const input = messageInputRef.current;
        if (!input) {
            return;
        }

        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
        input.style.overflowY =
            input.scrollHeight > 120
                ? "auto"
                : "hidden";
    }, [message]);

    const [loading, setLoading] =
        useState(true);

    const [chatLoading, setChatLoading] =
        useState(false);

    const [hasMoreMessages, setHasMoreMessages] =
        useState(false);

    const [loadingOlderMessages, setLoadingOlderMessages] =
        useState(false);

    const [olderMessagesError, setOlderMessagesError] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [showGroupCreator, setShowGroupCreator] =
        useState(false);

    const [groupName, setGroupName] =
        useState("");

    const [groupMemberIds, setGroupMemberIds] =
        useState([]);

    const [showGroupDetails, setShowGroupDetails] =
        useState(false);

    const [groupMemberSelection, setGroupMemberSelection] =
        useState([]);

    const [groupEncryptionBusy, setGroupEncryptionBusy] =
        useState(false);

    const [groupEncryptionMessage, setGroupEncryptionMessage] =
        useState("");

    const [groupEncryptionSafetyCode, setGroupEncryptionSafetyCode] =
        useState("");

    const [groupEncryptionSafetyError, setGroupEncryptionSafetyError] =
        useState("");

    const [typing, setTyping] =
        useState(false);

    const [onlineUsers, setOnlineUsers] =
        useState([]);

    /*
     * userId -> ms timestamp of when that user was last
     * seen online. Seeded per-user from the "lastSeen"
     * field already returned by /users/chat-users, then
     * kept fresh via the "user-last-seen" socket event
     * fired the moment someone disconnects.
     */
    const [lastSeenMap, setLastSeenMap] =
        useState({});

    /*
     * Ticks every 30s purely to force a re-render so
     * "Last seen 3 minutes ago" keeps advancing on screen
     * without needing a page refresh.
     */
    const [presenceTick, setPresenceTick] =
        useState(0);

    useEffect(() => {

        const interval =
            setInterval(
                () => {

                    setPresenceTick(
                        value =>
                            value + 1
                    );

                },
                30000
            );

        return () => {

            clearInterval(
                interval
            );

        };

    }, []);

    const [unreadUsers, setUnreadUsers] =
        useState({});

    const chatPreferencesRef =
        useRef({});

    const updateChatPreference =
        (conversationId, key, value) => {
            const id = getId(conversationId);

            if (!id) {
                return;
            }

            setChatPreferences(previous => ({
                ...previous,
                [id]: {
                    ...previous[id],
                    [key]: value
                }
            }));
        };

    const getChatPreference =
        conversationId =>
            chatPreferences[getId(conversationId)] || {};

    const isChatMuted =
        conversationId =>
            Boolean(
                chatPreferencesRef.current[getId(conversationId)]?.muted
            );

    useEffect(() => {
        encryptionIdentityRef.current = encryptionIdentity;
    }, [encryptionIdentity]);

    useEffect(() => {
        let cancelled = false;
        const userId = getId(user);

        if (!userId) {
            setEncryptionIdentity(null);
            encryptionIdentityRef.current = null;
            setEncryptionError("");
            return undefined;
        }

        setEncryptionIdentity(null);
        encryptionIdentityRef.current = null;
        setEncryptionError("");

        ensureMessengerIdentity(api, userId)
            .then(identity => {
                if (!cancelled) {
                    setEncryptionIdentity(identity);
                    encryptionIdentityRef.current = identity;
                }
            })
            .catch(error => {
                console.error("Messenger encryption setup error:", error);
                if (!cancelled) {
                    setEncryptionError(error.message);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user]);

    const getConversationCipher =
        useCallback(
            async target => {
                const userId = getId(user);
                const peerId = getId(target);

                if (!userId || !peerId || target?.isGroup) {
                    throw new Error("Encryption is only available in one-to-one chats.");
                }

                const identity =
                    encryptionIdentityRef.current ||
                    await ensureMessengerIdentity(api, userId);

                encryptionIdentityRef.current = identity;
                setEncryptionIdentity(identity);

                const peerPublicKey =
                    await getPeerEncryptionKey(api, peerId);

                return {
                    cipher: await deriveConversationCipher(
                        identity.privateKey,
                        peerPublicKey,
                        getConversationEncryptionId(userId, peerId)
                    ),
                    peerPublicKey
                };
            },
            [user]
        );

    const decryptMessagesForTarget =
        useCallback(
            async (items, target) => {
                if (!Array.isArray(items)) {
                    return items;
                }

                if (target?.isGroup) {
                    const encryptedGroupMessages = items.filter(item =>
                        item?.isEncrypted ||
                        isEncryptedGroupMessage(item?.message)
                    );

                    if (!encryptedGroupMessages.length) {
                        return items;
                    }

                    try {
                        const userId = getId(user);
                        const identity =
                            encryptionIdentityRef.current ||
                            await ensureMessengerIdentity(api, userId);
                        const keyPromises = new Map();
                        const resolvePublicKey = peerId => {
                            const normalizedId = String(peerId);

                            if (!keyPromises.has(normalizedId)) {
                                keyPromises.set(
                                    normalizedId,
                                    getPeerEncryptionKey(api, normalizedId)
                                );
                            }

                            return keyPromises.get(normalizedId);
                        };

                        encryptionIdentityRef.current = identity;
                        setEncryptionIdentity(identity);
                        const decryptedItems = await Promise.all(
                            items.map(item => {
                                if (
                                    item?.isEncrypted &&
                                    !isEncryptedGroupMessage(item?.message)
                                ) {
                                    return {
                                        ...item,
                                        message:
                                            "Unable to decrypt this message on this device.",
                                        decryptionFailed: true
                                    };
                                }

                                return isEncryptedGroupMessage(item?.message)
                                    ? decryptGroupMessageRecord(
                                          api,
                                          item,
                                          getId(target),
                                          userId,
                                          identity,
                                          resolvePublicKey
                                      )
                                    : item
                            })
                        );
                        return decryptedItems.map(attachDecryptedMediaMetadata);
                    } catch (error) {
                        console.error(
                            "Messenger group message decryption setup error:",
                            error
                        );
                        return items.map(item =>
                            isEncryptedGroupMessage(item?.message)
                                ? {
                                      ...item,
                                      message:
                                          "Unable to decrypt this message on this device.",
                                      isEncrypted: true,
                                      decryptionFailed: true
                                  }
                                : item
                        );
                    }
                }

                if (
                    !items.some(item =>
                        item?.isEncrypted ||
                        isEncryptedMessage(item?.message)
                    )
                ) {
                    return items;
                }

                try {
                    const { cipher } =
                        await getConversationCipher(target);
                    const conversationId = getConversationEncryptionId(
                        getId(user),
                        getId(target)
                    );

                    const decryptedItems = await Promise.all(
                        items.map(item =>
                            decryptMessageRecord(
                                item,
                                cipher,
                                conversationId
                            )
                        )
                    );
                    return decryptedItems.map(attachDecryptedMediaMetadata);
                } catch (error) {
                    console.error("Messenger message decryption setup error:", error);
                    return items.map(item =>
                        item?.isEncrypted || isEncryptedMessage(item?.message)
                            ? {
                                  ...item,
                                  message: "Unable to decrypt this message on this device.",
                                  isEncrypted: true,
                                  decryptionFailed: true
                              }
                            : item
                    );
                }
            },
            [getConversationCipher, user]
        );

    useEffect(() => {
        const peerId = getId(selectedUser);

        if (
            !peerId ||
            selectedUser?.isGroup ||
            !chatPreferences[peerId]?.encrypted
        ) {
            setEncryptionSafetyCode("");
            setEncryptionSafetyPeerId("");
            return undefined;
        }

        let cancelled = false;

        Promise.all([
            ensureMessengerIdentity(api, getId(user)),
            getPeerEncryptionKey(api, peerId)
        ])
            .then(async ([identity, peerPublicKey]) => ({
                code: await getSafetyCode(identity.publicKey, peerPublicKey),
                identity
            }))
            .then(({ code, identity }) => {
                if (!cancelled) {
                    encryptionIdentityRef.current = identity;
                    setEncryptionIdentity(identity);
                    setEncryptionSafetyCode(code);
                    setEncryptionSafetyPeerId(peerId);
                }
            })
            .catch(error => {
                console.error("Encryption safety code load error:", error);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedUser, chatPreferences, user]);

    useEffect(() => {
        if (
            !showGroupDetails ||
            !selectedUser?.isGroup ||
            !selectedUser.isEncrypted ||
            !Array.isArray(selectedUser.participants)
        ) {
            setGroupEncryptionSafetyCode("");
            setGroupEncryptionSafetyError("");
            return undefined;
        }

        let cancelled = false;
        setGroupEncryptionSafetyCode("");
        setGroupEncryptionSafetyError("");

        (async () => {
            try {
                const identity =
                    encryptionIdentityRef.current ||
                    await ensureMessengerIdentity(api, getId(user));
                const participants = selectedUser.participants;
                const memberKeys = [];

                for (let index = 0; index < participants.length; index += 8) {
                    const batch = participants.slice(index, index + 8);
                    const batchKeys = await Promise.all(
                        batch.map(async participant => {
                            const memberId = getId(participant);
                            return {
                                userId: memberId,
                                publicKey:
                                    memberId === getId(user)
                                        ? identity.publicKey
                                        : await getPeerEncryptionKey(api, memberId)
                            };
                        })
                    );
                    memberKeys.push(...batchKeys);
                }

                const safetyCode = await getGroupSafetyCode(memberKeys);

                if (!cancelled) {
                    setGroupEncryptionSafetyCode(safetyCode);
                }
            } catch (error) {
                console.error("Load group encryption verification code error:", error);
                if (!cancelled) {
                    setGroupEncryptionSafetyError(
                        "Could not verify all group encryption keys."
                    );
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [showGroupDetails, selectedUser, user]);

    useEffect(() => {
        const userId = getId(user);

        if (!userId) {
            setChatPreferences({});
            setChatPreferencesOwner(null);
            return;
        }

        try {
            const savedPreferences = localStorage.getItem(
                `jr-messenger-chat-preferences-${userId}`
            );
            const parsedPreferences = savedPreferences
                ? JSON.parse(savedPreferences)
                : {};

            setChatPreferences(
                parsedPreferences &&
                typeof parsedPreferences === "object" &&
                !Array.isArray(parsedPreferences)
                    ? parsedPreferences
                    : {}
            );
        } catch (error) {
            console.error("Messenger chat preferences load error:", error);
            setChatPreferences({});
        }

        setChatPreferencesOwner(userId);
    }, [user]);

    useEffect(() => {
        chatPreferencesRef.current = chatPreferences;
    }, [chatPreferences]);

    useEffect(() => {
        const userId = getId(user);

        if (!userId || chatPreferencesOwner !== userId) {
            return;
        }

        try {
            localStorage.setItem(
                `jr-messenger-chat-preferences-${userId}`,
                JSON.stringify(chatPreferences)
            );
        } catch (error) {
            console.error("Messenger chat preferences save error:", error);
        }
    }, [chatPreferences, chatPreferencesOwner, user]);

    /*
     * Maps userId -> ms timestamp of the most recent
     * message exchanged with that user (sent OR
     * received). Drives the "most recent chat on top"
     * ordering of the sidebar. Seeded from
     * GET /messages/recent on load, then kept up to
     * date locally whenever a message is sent or a
     * new one arrives over the socket.
     */
    const [recentTimestamps, setRecentTimestamps] =
        useState({});

    const bumpRecent =
        useCallback(
            (userId, when) => {

                const id =
                    getId(userId);

                if (!id) {
                    return;
                }

                const time =
                    when
                        ? new Date(when).getTime()
                        : Date.now();

                if (
                    Number.isNaN(time)
                ) {
                    return;
                }

                setRecentTimestamps(
                    previous => {

                        if (
                            (previous[id] || 0) >=
                            time
                        ) {

                            return previous;

                        }

                        return {
                            ...previous,
                            [id]: time
                        };

                    }
                );

            },
            []
        );

    const updateGroupPreview =
        useCallback(
            (groupId, messageItem) => {
                const id = getId(groupId);

                if (!id) {
                    return;
                }

                setGroups(previous =>
                    previous
                        .map(group =>
                            getId(group) === id
                                ? {
                                      ...group,
                                      lastMessage: {
                                          message:
                                              messageItem.isDeleted
                                                  ? "Message deleted"
                                                  : messageItem.isEncrypted
                                                  ? "🔒 Encrypted message"
                                                  : messageItem.message ||
                                                    (messageItem.fileUrl
                                                        ? "Attachment"
                                                        : ""),
                                          sender: messageItem.sender,
                                          createdAt: messageItem.createdAt
                                      },
                                      updatedAt: messageItem.createdAt
                                  }
                                : group
                        )
                        .sort(
                            (a, b) =>
                                new Date(b.updatedAt || 0).getTime() -
                                new Date(a.updatedAt || 0).getTime()
                        )
                );
            },
            []
        );

    const [mobileChatOpen, setMobileChatOpen] =
        useState(false);

    const [showEmoji, setShowEmoji] =
        useState(false);

    const [showBackgrounds, setShowBackgrounds] =
        useState(false);

    const [showMenu, setShowMenu] =
        useState(false);

    const [notificationPermission, setNotificationPermission] =
        useState(
            typeof Notification === "undefined"
                ? "unsupported"
                : Notification.permission
        );

    /*
     * In-conversation message search ("premium" feature):
     * lets the user find old messages inside the currently
     * open chat instead of only searching the contact list.
     */
    const [showConvSearch, setShowConvSearch] =
        useState(false);

    const [convSearchTerm, setConvSearchTerm] =
        useState("");

    const [activeMatchIndex, setActiveMatchIndex] =
        useState(0);

    const [replyingTo, setReplyingTo] =
        useState(null);

    const [forwardingMessage, setForwardingMessage] =
        useState(null);

    const [forwardSearch, setForwardSearch] =
        useState("");

    const [forwardSentTo, setForwardSentTo] =
        useState(
            () => new Set()
        );

    const [forwardSending, setForwardSending] =
        useState(false);

    const [messageDeleteFor, setMessageDeleteFor] =
        useState(null);

    const [messageMenuFor, setMessageMenuFor] =
        useState(null);

    const [swipeReplyProgress, setSwipeReplyProgress] =
        useState(null);

    const messageGestureRef = useRef(null);

    const [deleteConfirmation, setDeleteConfirmation] =
        useState(null);

    const [deletingMessage, setDeletingMessage] =
        useState(false);

    const [reactionPickerFor, setReactionPickerFor] =
        useState(null);

    const [editingMessage, setEditingMessage] =
        useState(null);

    const [editText, setEditText] =
        useState("");

    const REACTION_EMOJIS =
        ["👍", "❤️", "😂", "😮", "😢", "🙏"];

    const startMessageGesture = (event, item) => {
        if (
            event.button !== 0 ||
            item.isDeleted ||
            event.target.closest(
                "button, a, input, textarea, [role='button'], [role='slider']"
            )
        ) {
            return;
        }

        const messageId = getMessageId(item);
        if (!messageId) {
            return;
        }

        if (messageGestureRef.current?.timer) {
            clearTimeout(messageGestureRef.current.timer);
        }

        const gesture = {
            item,
            messageId,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            longPressed: false,
            timer: null
        };
        gesture.timer = setTimeout(() => {
            if (messageGestureRef.current === gesture && !gesture.moved) {
                gesture.longPressed = true;
                setMessageMenuFor(null);
                setMessageDeleteFor(null);
                setReactionPickerFor(messageId);
            }
        }, 500);
        messageGestureRef.current = gesture;

        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    };

    const moveMessageGesture = event => {
        const gesture = messageGestureRef.current;
        if (!gesture || gesture.longPressed) {
            return;
        }

        const offsetX = event.clientX - gesture.startX;
        const offsetY = event.clientY - gesture.startY;
        if (Math.abs(offsetY) > Math.abs(offsetX) + 8) {
            clearTimeout(gesture.timer);
            messageGestureRef.current = null;
            setSwipeReplyProgress(null);
            return;
        }

        if (Math.abs(offsetX) > 10) {
            gesture.moved = true;
            clearTimeout(gesture.timer);
        }

        if (offsetX > 0) {
            setSwipeReplyProgress({
                messageId: gesture.messageId,
                offset: Math.min(64, offsetX * 0.55)
            });
        }
    };

    const finishMessageGesture = event => {
        const gesture = messageGestureRef.current;
        if (!gesture) {
            return;
        }

        clearTimeout(gesture.timer);
        const offsetX = event.clientX - gesture.startX;
        const offsetY = event.clientY - gesture.startY;
        if (
            !gesture.longPressed &&
            offsetX >= 60 &&
            Math.abs(offsetX) > Math.abs(offsetY)
        ) {
            setReplyingTo(gesture.item);
            setMessageMenuFor(null);
            setReactionPickerFor(null);
        }

        messageGestureRef.current = null;
        setSwipeReplyProgress(null);
    };

    const cancelMessageGesture = () => {
        if (messageGestureRef.current?.timer) {
            clearTimeout(messageGestureRef.current.timer);
        }
        messageGestureRef.current = null;
        setSwipeReplyProgress(null);
    };

    useEffect(() => {
        const closeMessageActions = event => {
            if (!event.target.closest(".message-meta")) {
                setMessageMenuFor(null);
                setMessageDeleteFor(null);
                setReactionPickerFor(null);
            }
        };

        document.addEventListener("pointerdown", closeMessageActions);
        return () =>
            document.removeEventListener("pointerdown", closeMessageActions);
    }, []);

    useEffect(
        () => () => {
            if (messageGestureRef.current?.timer) {
                clearTimeout(messageGestureRef.current.timer);
            }
        },
        []
    );

    const [background, setBackground] =
        useState(
            () =>
                localStorage.getItem(
                    "jr-chat-background"
                ) || "default"
        );

    /*
     * MESSENGER SETTINGS
     * Persisted locally (device-level, like most chat
     * apps' "notification"/"data usage" prefs) rather
     * than on the server.
     */
    const DEFAULT_SETTINGS = {

        soundEnabled: true,

        readReceiptsEnabled: true,

        enterToSend: true,

        autoDownloadMedia: true

    };

    const [settings, setSettings] =
        useState(
            () => {

                try {

                    const saved =
                        JSON.parse(
                            localStorage.getItem(
                                "jr-messenger-settings"
                            ) ||
                            "{}"
                        );

                    return {
                        ...DEFAULT_SETTINGS,
                        ...saved
                    };

                } catch (_) {

                    return DEFAULT_SETTINGS;

                }

            }
        );

    const [showSettings, setShowSettings] =
        useState(false);

    /*
     * When settings.autoDownloadMedia is off, images show
     * a "Tap to load" placeholder first (saves data on a
     * slow/metered connection) - this tracks which ones
     * the person has explicitly chosen to load.
     */
    const [revealedMedia, setRevealedMedia] =
        useState(
            () => new Set()
        );

    const settingsRef =
        useRef(DEFAULT_SETTINGS);

    useEffect(() => {

        settingsRef.current =
            settings;

    }, [settings]);

    /*
     * VOICE MESSAGE RECORDING
     */
    const [isRecording, setIsRecording] =
        useState(false);

    const [recordingSeconds, setRecordingSeconds] =
        useState(0);

    const [sendingVoice, setSendingVoice] =
        useState(false);

    const [startingVoiceRecording, setStartingVoiceRecording] =
        useState(false);

    const [messengerToast, setMessengerToast] =
        useState(null);

    const messengerToastTimerRef =
        useRef(null);

    const dismissMessengerToast =
        useCallback(() => {
            clearTimeout(messengerToastTimerRef.current);
            messengerToastTimerRef.current = null;
            setMessengerToast(null);
        }, []);

    const showMessengerToast =
        useCallback((message, type = "error") => {
            clearTimeout(messengerToastTimerRef.current);
            setMessengerToast({
                id: Date.now(),
                message,
                type
            });
            messengerToastTimerRef.current = setTimeout(
                () => setMessengerToast(null),
                4800
            );
        }, []);

    useEffect(() => () => {
        clearTimeout(messengerToastTimerRef.current);
    }, []);

    const mediaRecorderRef =
        useRef(null);

    const recordedChunksRef =
        useRef([]);

    const recordingStreamRef =
        useRef(null);

    const recordingTimerRef =
        useRef(null);

    const recordingStartRef =
        useRef(false);

    const finishingVoiceRef =
        useRef(false);

    const updateSetting =
        (key, value) => {

            setSettings(
                previous => {

                    const next = {
                        ...previous,
                        [key]: value
                    };

                    try {

                        localStorage.setItem(
                            "jr-messenger-settings",
                            JSON.stringify(next)
                        );

                    } catch (_) {}

                    return next;

                }
            );

        };

    const [callState, setCallState] =
        useState(null);

    const callStateRef =
        useRef(callState);

    callStateRef.current =
        callState;

    const [activeGroupCall, setActiveGroupCall] =
        useState(null);

    const [incomingGroupCall, setIncomingGroupCall] =
        useState(null);

    const [callDuration, setCallDuration] =
        useState(0);

    const [localStream, setLocalStream] =
        useState(null);

    const [remoteStream, setRemoteStream] =
        useState(null);

const [cameraFacing, setCameraFacing] =
    useState("user");

   /* =====================================================
   REFS
===================================================== */

useEffect(() => {

    currentUserRef.current =
        user;

}, [user]);


useEffect(() => {

    selectedUserRef.current =
        selectedUser;

}, [selectedUser]);


/* =====================================================
   LOAD USER
===================================================== */

useEffect(() => {

    try {

        const saved =
            localStorage.getItem("user");

        if (saved) {

            setUser(
                JSON.parse(saved)
            );

        }

    } catch (error) {

        console.error(
            "Messenger user error:",
            error
        );

    }

}, []);


const currentUserId =
    useMemo(
        () => getId(user),
        [user]
    );


/* =====================================================
   CALL TIMER
   Starts only after call is connected
===================================================== */

const callConnectedAt =
    callState?.connectedAt;

useEffect(() => {

    if (callState?.status !== "connected") {

        setCallDuration(0);

        return undefined;

    }


    const callStartedAt =
        callConnectedAt ||
        Date.now();


    const updateTimer = () => {

        const elapsed =
            Math.floor(
                (
                    Date.now() -
                    callStartedAt
                ) / 1000
            );


        setCallDuration(
            Math.max(
                0,
                elapsed
            )
        );

    };


    updateTimer();


    const timer =
        setInterval(
            updateTimer,
            1000
        );


    return () => {

        clearInterval(
            timer
        );

    };

}, [
    callState?.status,
    callConnectedAt
]);


    /* =====================================================
       ROOM ID
    ===================================================== */

    const getRoomId =
        useCallback(
            (first, second) => {

                const firstId =
                    getId(first);

                const secondId =
                    getId(second);

                if (
                    !secondId
                ) {
                    return null;
                }

                if (second?.isGroup) {
                    return `group:${secondId}`;
                }

                if (!firstId) {
                    return null;
                }

                return [
                    firstId,
                    secondId
                ]
                    .sort()
                    .join("_");

            },
            []
        );


    /* =====================================================
       ONLINE
    ===================================================== */

    const isOnline =
        useCallback(
            (target) => {

                const id =
                    getId(target);

                return Boolean(
                    id &&
                    onlineUsers.some(
                        item =>
                            getId(item) === id
                    )
                );

            },
            [onlineUsers]
        );


    /* =====================================================
       NOTIFICATION
    ===================================================== */

    const enableNotifications = async () => {
        const permission =
            await requestNotificationPermission();

        setNotificationPermission(permission);
        setShowMenu(false);
    };


    /* =====================================================
       SCROLL
    ===================================================== */

    const scrollToBottom =
        useCallback(
            (smooth = true) => {

                setTimeout(
                    () => {

                        messagesEndRef.current
                            ?.scrollIntoView({
                                behavior:
                                    smooth
                                        ? "smooth"
                                        : "auto"
                            });

                    },
                    50
                );

            },
            []
        );


    /* =====================================================
       LOAD USERS
    ===================================================== */

    const loadUsers =
        useCallback(
            async () => {

                if (!user) {
                    return;
                }

                try {

                    setLoading(true);

                    const response =
                        await api.get(
                            "/users/chat-users"
                        );

                    const data =
                        response.data?.users ||
                        response.data?.data ||
                        response.data ||
                        [];

                    const list =
                        Array.isArray(data)
                            ? data.filter(
                                  item =>
                                      getId(item) !==
                                      currentUserId
                              )
                            : [];

                    setUsers(list);

                    try {
                        const groupResponse = await api.get("/groups");
                        const groupList =
                            groupResponse.data?.data ||
                            groupResponse.data?.groups ||
                            [];

                        setGroups(
                            Array.isArray(groupList)
                                ? groupList.map(group => ({
                                      ...group,
                                      isGroup: true
                                  }))
                                : []
                        );
                        if (Array.isArray(groupList)) {
                            setUnreadUsers(previous => {
                                const next = { ...previous };
                                groupList.forEach(group => {
                                    next[getId(group)] = group.unreadCount || 0;
                                });
                                return next;
                            });
                        }
                    } catch (groupError) {
                        console.error(
                            "Chat groups error:",
                            groupError
                        );
                        setGroups([]);
                    }

                    setLastSeenMap(
                        previous => {

                            const next = {
                                ...previous
                            };

                            list.forEach(
                                item => {

                                    const id =
                                        getId(item);

                                    const when =
                                        item.lastSeen;

                                    const time =
                                        when
                                            ? new Date(when).getTime()
                                            : null;

                                    if (
                                        id &&
                                        time &&
                                        !Number.isNaN(time)
                                    ) {

                                        next[id] =
                                            Math.max(
                                                next[id] || 0,
                                                time
                                            );

                                    }

                                }
                            );

                            return next;

                        }
                    );

                } catch (error) {

                    console.error(
                        "Chat users error:",
                        error
                    );

                } finally {

                    setLoading(false);

                }

            },
            [
                user,
                currentUserId
            ]
        );


    useEffect(() => {

        loadUsers();

    }, [loadUsers]);


    /* =====================================================
       LOAD RECENT CONVERSATIONS + UNREAD COUNTS

       These were previously only ever built up live from
       socket events, which meant refreshing the page (or
       just never having received a socket event yet for
       an old unread message) reset the sidebar to no
       ordering and no unread badges. Both endpoints
       already existed on the backend
       (/messages/recent, /messages/unread/by-user) but
       weren't being called from here.
    ===================================================== */

    useEffect(() => {

        if (!user) {
            return;
        }

        let cancelled =
            false;

        (async () => {

            try {

                const response =
                    await api.get(
                        "/messages/recent"
                    );

                const list =
                    response.data?.data ||
                    response.data ||
                    [];

                if (
                    cancelled ||
                    !Array.isArray(list)
                ) {
                    return;
                }

                setRecentTimestamps(
                    previous => {

                        const next = {
                            ...previous
                        };

                        list.forEach(
                            item => {

                                const id =
                                    getId(
                                        item.userId ||
                                        item.user
                                    );

                                const lastMessage =
                                    item.lastMessage ||
                                    item;

                                const when =
                                    lastMessage?.createdAt ||
                                    lastMessage?.timestamp;

                                const time =
                                    when
                                        ? new Date(when).getTime()
                                        : null;

                                if (
                                    id &&
                                    time &&
                                    !Number.isNaN(time)
                                ) {

                                    next[id] =
                                        Math.max(
                                            next[id] || 0,
                                            time
                                        );

                                }

                            }
                        );

                        return next;

                    }
                );

            } catch (error) {

                console.error(
                    "Recent conversations error:",
                    error
                );

            }

        })();

        (async () => {

            try {

                const response =
                    await api.get(
                        "/messages/unread/by-user"
                    );

                const unread =
                    response.data?.unread ||
                    response.data?.data ||
                    {};

                if (
                    cancelled ||
                    !unread ||
                    typeof unread !==
                        "object"
                ) {
                    return;
                }

                setUnreadUsers(
                    previous => {

                        const merged = {
                            ...unread
                        };

                        Object.keys(previous).forEach(
                            id => {

                                merged[id] =
                                    Math.max(
                                        merged[id] || 0,
                                        previous[id] || 0
                                    );

                            }
                        );

                        return merged;

                    }
                );

            } catch (error) {

                console.error(
                    "Unread by user error:",
                    error
                );

            }

        })();

        return () => {

            cancelled =
                true;

        };

    }, [user]);


    /* =====================================================
       ADD MESSAGE WITHOUT DUPLICATE
       Returns true when the message was actually appended,
       false when it was recognised as a duplicate. Callers
       use this to avoid firing notifications / "seen"
       events twice for the same message (e.g. when both
       "receive-message" and "direct-message" are emitted
       by the server for the same event).
    ===================================================== */

    const appendMessage =
    useCallback(
        (incoming) => {

            if (!incoming) {
                return false;
            }


            /*
            ==========================================
            MISSED / CALL MESSAGE NORMALIZATION
            ==========================================
            */

            const normalizedMessage = {

                ...incoming,

                message:
                    incoming.message ||
                    (
                        incoming.type ===
                        "missed-call"

                            ? `📞 Missed ${
                                  incoming.callType ===
                                  "video"
                                      ? "video"
                                      : "voice"
                              } call`
                            : incoming.message
                    ),

                createdAt:
                    incoming.createdAt ||
                    incoming.timestamp ||
                    new Date().toISOString()

            };


            let wasAppended =
                false;


            setMessages(
                previous => {

                    /*
                    ==================================
                    MESSAGE ID DUPLICATE CHECK
                    ==================================
                    */

                    const incomingId =
                        getMessageId(
                            normalizedMessage
                        );


                    if (
                        incomingId &&
                        previous.some(
                            item =>
                                getMessageId(
                                    item
                                ) ===
                                incomingId
                        )
                    ) {

                        return previous;

                    }


                    /*
                    ==================================
                    SAME MESSAGE DUPLICATE CHECK
                    ==================================
                    */

                    const sameMessage =
                        previous.some(
                            item =>

                                !incomingId &&

                                item.message ===
                                    normalizedMessage.message &&

                                getMessageSenderId(
                                    item
                                ) ===
                                    getMessageSenderId(
                                        normalizedMessage
                                    ) &&

                                Math.abs(

                                    new Date(
                                        item.createdAt ||
                                        item.timestamp ||
                                        Date.now()
                                    ).getTime()

                                    -

                                    new Date(
                                        normalizedMessage.createdAt ||
                                        normalizedMessage.timestamp ||
                                        Date.now()
                                    ).getTime()

                                ) < 5000
                        );


                    if (sameMessage) {

                        return previous;

                    }


                    /*
                    ==================================
                    APPEND
                    ==================================
                    */

                    wasAppended =
                        true;


                    return [

                        ...previous,

                        normalizedMessage

                    ];

                }
            );

            return wasAppended;

        },
        []
    );

    /* =====================================================
       CLEAN CALL
    ===================================================== */

    const cleanupCall =
        useCallback(
            () => {
                stopCallRingtone();

                try {

                    if (
                        currentRoomRef.current
                    ) {

                        socket.emit(
                            "leave-room",
                            currentRoomRef.current
                        );

                    }

                } catch (_) {}


                closePeerConnection(
                    peerRef.current
                );

                peerRef.current =
                    null;


                stopMediaStream(
                    localStreamRef.current
                );

                stopMediaStream(
                    remoteStreamRef.current
                );


                localStreamRef.current =
                    null;

                remoteStreamRef.current =
                    null;

                remoteTracksRef.current =
                    [];

                pendingCandidatesRef.current =
                    [];


                setLocalStream(null);

                setRemoteStream(null);

                setCallState(null);

                callRef.current =
                    null;

                currentRoomRef.current =
                    null;

            },
            []
        );


    /* =====================================================
       PEER
    ===================================================== */

    const createPeer =
        useCallback(
            (receiverId) => {

                const peer =
                    createPeerConnection({

                        onIceCandidate:
                            candidate => {

                                socket.emit(
                                    "webrtc-ice-candidate",
                                    {
                                        receiverId,
                                        callerId:
                                            currentUserId,
                                        candidate,
                                        roomId:
                                            currentRoomRef.current
                                    }
                                );

                            },



onTrack:
    event => {

        console.log(
            "📡 Remote track:",
            event.track?.kind
        );


        /*
         * Keep the raw list of tracks in a ref (not a
         * MediaStream), and build a FRESH MediaStream
         * object every time a track is added. Mutating
         * and re-passing the same MediaStream instance
         * to setRemoteStream() is a same-reference no-op
         * as far as React is concerned, so the second
         * track to arrive (often video, after audio)
         * could end up never actually triggering the
         * effect that attaches the stream to the
         * <video>/<audio> element.
         */

        const existingTracks =
            remoteTracksRef.current ||
            [];

        const alreadyHasTrack =
            event.track &&
            existingTracks.some(
                track =>
                    track.id ===
                    event.track.id
            );

        const updatedTracks =
            event.track &&
            !alreadyHasTrack
                ? [
                      ...existingTracks,
                      event.track
                  ]
                : existingTracks;

        remoteTracksRef.current =
            updatedTracks;

        const freshStream =
            new MediaStream(
                updatedTracks
            );

        remoteStreamRef.current =
            freshStream;


        setRemoteStream(
            freshStream
        );


        console.log(
            "📡 REMOTE MEDIA RECEIVED:",
            updatedTracks.map(
                track =>
                    `${track.kind}:${track.readyState}`
            ),
            {
                audioTracks:
                    freshStream.getAudioTracks().length,
                videoTracks:
                    freshStream.getVideoTracks().length
            }
        );

    },
                        
        onConnectionStateChange:
            state => {

                console.log(
                    "📞 WebRTC connection state:",
                    state
                );

                if (
                    state === "connected"
                ) {

                    const connectedAt =
                        callRef.current?.connectedAt ||
                        Date.now();

                    const connectedCall = {

                        ...(callRef.current || {}),

                        status:
                            "connected",

                        mode:
                            "connected",

                        connectedAt

                    };

                    callRef.current =
                        connectedCall;

                    setCallState(
                        connectedCall
                    );

                    return;
                }

                if (
                    state === "disconnected"
                ) {

                    console.warn(
                        "⚠️ WebRTC temporarily disconnected"
                    );

                    return;
                }

                if (
                    state === "failed"
                ) {

                    console.error(
                        "❌ WebRTC connection failed"
                    );

                    setTimeout(
                        () => {

                            if (
                                peerRef.current &&
                                peerRef.current
                                    .connectionState ===
                                "failed"
                            ) {

                                /*
                                 * Always call through the ref so we
                                 * run the CURRENT endCall (current
                                 * callState / cleanupCall), not a
                                 * stale copy captured when this
                                 * peer connection was first created.
                                 */

                                endCallRef.current?.();

                            }

                        },
                        5000
                    );

                    return;
                }

                if (
                    state === "closed"
                ) {

                    console.log(
                        "📞 WebRTC connection closed"
                    );

                }

            },

        onIceConnectionStateChange:
            state => {
                console.log(
                    "🧊 WebRTC ICE connection state:",
                    state
                );

                if (state === "failed") {
                    console.error(
                        "WebRTC could not find a network path. A dedicated TURN relay may be required."
                    );
                }
            }

        });

        peerRef.current =
            peer;

        console.log(
            "📞 WebRTC peer ready:",
            {
                iceConnectionState:
                    peer.iceConnectionState,
                connectionState:
                    peer.connectionState,
                signalingState:
                    peer.signalingState,
                localTracks:
                    peer.getSenders().map(
                        sender =>
                            sender.track?.kind
                    )
            }
        );

        if (
            localStreamRef.current
        ) {

            addLocalTracks(
                peer,
                localStreamRef.current
            );

        }

        console.log(
            "🔗 Peer created:",
            {
                receiverId,
                roomId: currentRoomRef.current,
                localTracks: peer.getSenders().map(
                    sender => sender.track?.kind
                )
            }
        );

        return peer;

    },
    [
        currentUserId
    ]
);

/* =====================================================
   START CALL
===================================================== */

const startCall =
    useCallback(
        async (type) => {

            if (activeGroupCall) {
                alert("Leave the group call before starting a one-to-one call.");
                return;
            }

            const target =
                selectedUserRef.current;

            const me =
                currentUserRef.current;

            if (
                !target ||
                !me
            ) {
                return;
            }

            const receiverId =
                getId(target);

            const callerId =
                getId(me);

            const roomId =
                getRoomId(
                    me,
                    target
                );

            if (
                !receiverId ||
                !callerId ||
                !roomId
            ) {
                return;
            }

            const receiverName =
                getUserName(target);

            const receiverAvatar =
                getUploadUrl(
                    getAvatar(target)
                );

            const callerName =
                getUserName(me);

            const callerAvatar =
                getUploadUrl(
                    getAvatar(me)
                );

            try {

                const stream =
                    await getUserMedia({
                        audio: true,
                        video:
                            type === "video",
                        facingMode:
                            "user"
                    });

                localStreamRef.current =
                    stream;

                setLocalStream(
                    stream
                );

                currentRoomRef.current =
                    roomId;

                callRef.current = {

                    callerId,

                    receiverId,

                    roomId,

                    type,

                    callerName,

                    callerAvatar,

                    receiverName,

                    receiverAvatar,

                    accepted: false

                };

                socket.emit(
                    "join-room",
                    roomId
                );

                setCallState({

                    mode:
                        "outgoing",

                    status:
                        "calling",

                    type,

                    callerId,

                    receiverId,

                    roomId,

                    callerName:
                        receiverName,

                    callerAvatar:
                        receiverAvatar,

                    receiverName,

                    receiverAvatar

                });

                socket.emit(
                    "call-user",
                    {

                        roomId,

                        callerId,

                        receiverId,

                        callerName,

                        callerAvatar,

                        receiverName,

                        receiverAvatar,

                        type,

                        status:
                            "calling"

                    }
                );

            } catch (error) {

                console.error(
                    "Call start error:",
                    error
                );

                alert(
                    error?.message ||
                    "Microphone/camera permission is required."
                );

                cleanupCall();

            }

        },
        [
            activeGroupCall,
            cleanupCall,
            getRoomId
        ]
    );


/* =====================================================
   SWITCH CAMERA
===================================================== */

const switchCamera =
    useCallback(
        async () => {

            try {

                const currentStream =
                    localStreamRef.current;

                if (!currentStream) {
                    console.warn(
                        "No local stream available"
                    );
                    return;
                }

                const currentVideoTrack =
                    currentStream
                        .getVideoTracks()[0];

                if (!currentVideoTrack) {
                    console.warn(
                        "No video track available"
                    );
                    return;
                }

                const nextFacing =
                    cameraFacing === "user"
                        ? "environment"
                        : "user";

                console.log(
                    "📷 Switching camera:",
                    cameraFacing,
                    "→",
                    nextFacing
                );

                /*
                 * Stop the CURRENT camera first. Many
                 * mobile browsers (especially Android)
                 * cannot have two camera streams open at
                 * once, so requesting the new facing mode
                 * while the old track is still live can
                 * silently fail or just hand back the same
                 * (front) camera again - which looks
                 * exactly like "the back camera never
                 * opens".
                 */

                currentVideoTrack.stop();

                /*
                 * Get new camera
                 */

                let newStream;

                try {

                    newStream =
                        await navigator.mediaDevices.getUserMedia({

                            audio: false,

                            video: {
                                facingMode: {
                                    exact:
                                        nextFacing
                                }
                            }

                        });

                } catch (exactError) {

                    console.warn(
                        "Exact facingMode failed, falling back to ideal:",
                        exactError
                    );

                    // Some devices/browsers reject an
                    // "exact" constraint they can't fully
                    // guarantee even when the camera does
                    // exist - retry with "ideal" as a
                    // best-effort fallback instead of
                    // giving up entirely.
                    newStream =
                        await navigator.mediaDevices.getUserMedia({

                            audio: false,

                            video: {
                                facingMode: {
                                    ideal:
                                        nextFacing
                                }
                            }

                        });

                }

                const newVideoTrack =
                    newStream
                        .getVideoTracks()[0];

                if (!newVideoTrack) {

                    console.error(
                        "❌ New camera track not found"
                    );

                    newStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    return;
                }

                /*
                 * Replace WebRTC video track
                 */

                const peer =
                    peerRef.current;

                if (peer) {

                    const sender =
                        peer
                            .getSenders()
                            .find(
                                item =>
                                    item.track &&
                                    item.track.kind ===
                                    "video"
                            );

                    if (sender) {

                        await sender.replaceTrack(
                            newVideoTrack
                        );

                        console.log(
                            "✅ WebRTC video track replaced"
                        );

                    } else {

                        console.warn(
                            "⚠️ Video sender not found"
                        );

                    }

                }

                /*
                 * Keep existing audio track
                 */

                const audioTracks =
                    currentStream
                        .getAudioTracks();

                const updatedStream =
                    new MediaStream([
                        ...audioTracks,
                        newVideoTrack
                    ]);

                /*
                 * Update refs + React state
                 */

                localStreamRef.current =
                    updatedStream;

                setLocalStream(
                    updatedStream
                );

                setCameraFacing(
                    nextFacing
                );

                console.log(
                    "📷 Camera switched successfully:",
                    nextFacing
                );

            } catch (error) {

                console.error(
                    "❌ Camera switch error:",
                    error
                );

                /*
                 * Some devices/browsers don't support
                 * facingMode switching.
                 */

                alert(
                    "Back camera could not be opened. Please check camera permission or device camera support."
                );

            }

        },
        [
            cameraFacing
        ]
    );

/* =====================================================
   ACCEPT CALL
===================================================== */

const acceptCall =
    useCallback(
        async () => {

            stopCallRingtone();

            const call =
                callRef.current ||
                callState;

            if (!call) {
                return;
            }

            try {

                const stream =
                    await getUserMedia({
                        audio: true,
                        video:
                            call.type === "video",
                        facingMode: "user"
                    });

                localStreamRef.current =
                    stream;

                setLocalStream(
                    stream
                );

                currentRoomRef.current =
                    call.roomId;

                callRef.current = {
                    ...call,
                    mode: "accepted",
                    status: "accepted",
                    accepted: true
                };

                setCallState({
                    ...call,
                    mode: "accepted",
                    status: "accepted",
                    accepted: true
                });

                socket.emit(
                    "join-room",
                    call.roomId
                );

                /*
                 * Prepare the receiver peer BEFORE telling the
                 * server that the call was accepted. This removes
                 * a race where the caller can send the SDP offer
                 * immediately after receiving call-accepted while
                 * the receiver has not created its RTCPeerConnection
                 * yet.
                 */
                const receiverPeer =
                    peerRef.current &&
                    peerRef.current.signalingState !== "closed"
                        ? peerRef.current
                        : createPeer(
                              getId(call.callerId)
                          );

                if (localStreamRef.current) {
                    addLocalTracks(
                        receiverPeer,
                        localStreamRef.current
                    );
                }

                socket.emit(
                    "accept-call",
                    {
                        roomId:
                            call.roomId,

                        callerId:
                            call.callerId,

                        receiverId:
                            getId(
                                currentUserRef.current
                            ),

                        type:
                            call.type,

                        status:
                            "accepted"
                    }
                );

            } catch (error) {

                console.error(
                    "Accept call error:",
                    error
                );

                socket.emit(
                    "reject-call",
                    {
                        callerId:
                            call.callerId,

                        receiverId:
                            getId(
                                currentUserRef.current
                            ),

                        roomId:
                            call.roomId
                    }
                );

                cleanupCall();

            }

        },
        [
            callState,
            cleanupCall,
            createPeer
        ]
    );
    
    /* =====================================================
       REJECT CALL
    ===================================================== */

   const rejectCall =
    useCallback(
        () => {

            stopCallRingtone();

            const call =
                callRef.current ||
                callState;

                if (
                    call?.callerId
                ) {

                    socket.emit(
                        "reject-call",
                        {
                            callerId:
                                call.callerId,
                            receiverId:
                                getId(
                                    currentUserRef.current
                                ),
                            roomId:
                                call.roomId
                        }
                    );

                }


                if (
                    call?.mode ===
                    "incoming"
                ) {

                    showMissedCallNotification({
                        callerName:
                            call.callerName ||
                            "User",
                        type:
                            call.type
                    });

                }


                cleanupCall();

            },
            [
                callState,
                cleanupCall
            ]
        );


    /* =====================================================
       END CALL
    ===================================================== */

    const endCall =
    useCallback(
        () => {

            stopCallRingtone();

            const call =
                callRef.current ||
                callState;
                if (
                    call?.roomId
                ) {

                    socket.emit(
                        "end-call",
                        {
                            roomId:
                                call.roomId
                        }
                    );

                }

                cleanupCall();

            },
            [
                callState,
                cleanupCall
            ]
        );


    /*
     * Keep endCallRef pointed at the latest endCall on
     * every render, so stable callbacks created earlier
     * (createPeer's connection-state handler, the socket
     * events effect, etc.) always trigger the up-to-date
     * version instead of a stale closure.
     */

    useEffect(() => {

        endCallRef.current =
            endCall;

    }, [endCall]);


    /* =====================================================
       SOCKET EVENTS
    ===================================================== */

    useEffect(() => {

        if (!user) {
            return undefined;
        }


        const currentId =
            getId(user);


        connectSocket(
            currentId
        );


        const onConnect =
            () => {

                socket.emit(
                    "user-online",
                    currentId
                );

            };


        const onOnlineUsers =
            data => {

                setOnlineUsers(
                    Array.isArray(data)
                        ? data
                        : []
                );

            };


        const onUserLastSeen =
            data => {

                const id =
                    getId(
                        data?.userId
                    );

                if (
                    !id ||
                    !data?.lastSeen
                ) {
                    return;
                }

                setLastSeenMap(
                    previous => ({
                        ...previous,
                        [id]:
                            data.lastSeen
                    })
                );

            };


       /* -------------------------------------------------
   MESSAGE RECEIVED
------------------------------------------------- */

const onReceiveMessage =
    async incoming => {

        if (!incoming) {
            return;
        }


        let newMessage =
            incoming.data &&
            typeof incoming.data ===
                "object"

                ? {
                      ...incoming.data,
                      ...incoming
                  }

                : incoming;

        if (isEncryptedGroupMessage(newMessage.message)) {
            const activeConversation = selectedUserRef.current;
            const incomingGroupId = getId(newMessage.groupId);

            if (
                activeConversation?.isGroup &&
                getId(activeConversation) === incomingGroupId
            ) {
                [newMessage] = await decryptMessagesForTarget(
                    [newMessage],
                    activeConversation
                );
            }
        } else if (
            newMessage.isEncrypted ||
            isEncryptedMessage(newMessage.message)
        ) {
            const senderId = getMessageSenderId(newMessage);
            const encryptionPeer =
                newMessage.sender && typeof newMessage.sender === "object"
                    ? newMessage.sender
                    : { id: senderId };

            try {
                [newMessage] = await decryptMessagesForTarget(
                    [newMessage],
                    encryptionPeer
                );
            } catch (error) {
                console.error("Incoming encrypted message decryption error:", error);
                newMessage = {
                    ...newMessage,
                    message: "Unable to decrypt this message on this device.",
                    isEncrypted: true,
                    decryptionFailed: true
                };
            }
        }

        const senderId =
            getMessageSenderId(
                newMessage
            );


        const receiverId =
            getMessageReceiverId(
                newMessage
            );


        /*
        ==========================================
        IGNORE OWN MESSAGE
        ==========================================
        */

        if (
            senderId ===
            currentId
        ) {

            return;

        }


        /*
         * Whoever just messaged us should float to the
         * top of the sidebar, whether or not their chat
         * is currently open.
         */

        bumpRecent(
            senderId,
            newMessage.createdAt ||
                newMessage.timestamp
        );


        const active =
            selectedUserRef.current;


        const activeId =
            getId(active);


        const belongs =
            activeId &&
            (
                (
                    senderId ===
                        activeId &&

                    receiverId ===
                        currentId
                )

                ||

                (
                    senderId ===
                        currentId &&

                    receiverId ===
                        activeId
                )
            );


        /*
        ==========================================
        MESSAGE IS OPEN
        ==========================================
        */

        if (belongs) {

            /*
             * appendMessage tells us whether this
             * message was genuinely new. Both
             * "receive-message" and "direct-message"
             * can fire for the same event, so without
             * this check the user would get the "seen"
             * emit and the notification/sound twice
             * for a single incoming message.
             */

            const isNew =
                appendMessage(
                    newMessage
                );


            if (!isNew) {

                return;

            }


            scrollToBottom();


            /*
            --------------------------------------
            MARK AS SEEN
            --------------------------------------
            */

            if (settingsRef.current.readReceiptsEnabled) {

                socket.emit(
                    "message-seen",
                    {

                        roomId:
                            currentRoomRef.current,

                        messageId:
                            getMessageId(
                                newMessage
                            ),

                        senderId,

                        receiverId:
                            currentId

                    }
                );

            }


            /*
            --------------------------------------
            MESSAGE SOUND
            --------------------------------------
            */

            if (
                settingsRef.current.soundEnabled &&
                !isChatMuted(senderId)
            ) {

                showMessageNotification({

                    senderName:
                        getUserName(
                            newMessage.sender
                        ),

                    message:
                        newMessage.message ||
                        newMessage.text ||
                        "New message"

                });

            }

        }

        /*
        ==========================================
        MESSAGE IS NOT OPEN
        ==========================================
        */

        else {

            if (senderId) {

                setUnreadUsers(
                    previous => ({

                        ...previous,

                        [senderId]:
                            (
                                previous[
                                    senderId
                                ] || 0
                            ) + 1

                    })
                );

            }


            /*
            --------------------------------------
            MESSAGE SOUND + BROWSER NOTIFICATION
            --------------------------------------
            */

            if (
                settingsRef.current.soundEnabled &&
                !isChatMuted(senderId)
            ) {

                showMessageNotification({

                    senderName:
                        getUserName(
                            newMessage.sender
                        ) ||
                        "New message",

                    message:
                        newMessage.message ||
                        newMessage.text ||
                        "New message"

                });

            }

        }

    };

        /* -------------------------------------------------
           DIRECT MESSAGE
        ------------------------------------------------- */

        const onDirectMessage =
            onReceiveMessage;

        const onGroupMessage =
            async incoming => {
                const active = selectedUserRef.current;
                const groupId = getId(incoming?.groupId);

                if (
                    !groupId ||
                    !active?.isGroup ||
                    getId(active) !== groupId ||
                    getMessageSenderId(incoming) === currentId
                ) {
                    return;
                }

                const [visibleMessage] = await decryptMessagesForTarget(
                    [incoming],
                    active
                );
                appendMessage(visibleMessage);
                scrollToBottom();
            };

        const onGroupMessageNotification =
            async incoming => {
                const active = selectedUserRef.current;
                const groupId = getId(incoming?.groupId);
                const senderId = getMessageSenderId(incoming);

                if (!groupId || senderId === currentId) {
                    return;
                }

                bumpRecent(
                    groupId,
                    incoming.createdAt || incoming.timestamp
                );

                updateGroupPreview(groupId, incoming);

                if (active?.isGroup && getId(active) === groupId) {
                    const [visibleMessage] = await decryptMessagesForTarget(
                        [incoming],
                        active
                    );
                    appendMessage(visibleMessage);
                    scrollToBottom();
                    if (settingsRef.current.readReceiptsEnabled) {
                        api.put(`/groups/${groupId}/seen`).catch(error => {
                            console.error("Mark group messages seen error:", error);
                        });
                    }
                    return;
                }

                setUnreadUsers(previous => ({
                    ...previous,
                    [groupId]: (previous[groupId] || 0) + 1
                }));

                if (
                    settingsRef.current.soundEnabled &&
                    !isChatMuted(groupId)
                ) {
                    showMessageNotification({
                        senderName:
                            incoming.senderName ||
                            getUserName(incoming.sender) ||
                            "Group message",
                        message:
                            isEncryptedGroupMessage(incoming.message)
                                ? "🔒 Encrypted message"
                                : incoming.message ||
                                  "Shared an attachment"
                    });
                }
            };

        const onGroupUpdated =
            async () => {
                try {
                    const response = await api.get("/groups");
                    const groupList =
                        response.data?.data ||
                        response.data?.groups ||
                        [];
                    const nextGroups = Array.isArray(groupList)
                        ? groupList.map(group => ({
                              ...group,
                              isGroup: true
                          }))
                        : [];

                    setGroups(nextGroups);
                    setUnreadUsers(previous => {
                        const next = { ...previous };
                        nextGroups.forEach(group => {
                            next[getId(group)] = group.unreadCount || 0;
                        });
                        return next;
                    });

                    const active = selectedUserRef.current;
                    if (
                        active?.isGroup &&
                        !nextGroups.some(group => getId(group) === getId(active))
                    ) {
                        setSelectedUser(null);
                        selectedUserRef.current = null;
                        setMessages([]);
                        setMobileChatOpen(false);
                    } else if (active?.isGroup) {
                        const refreshed = nextGroups.find(
                            group => getId(group) === getId(active)
                        );
                        if (refreshed) {
                            setSelectedUser(refreshed);
                            selectedUserRef.current = refreshed;
                        }
                    }
                } catch (error) {
                    console.error("Refresh groups error:", error);
                }
            };

        const onGroupCallIncoming =
            invitation => {
                if (
                    !invitation?.groupId ||
                    getId(invitation.callerId) === currentId
                ) {
                    return;
                }

                setIncomingGroupCall(invitation);
            };


        /* -------------------------------------------------
           TYPING
        ------------------------------------------------- */

        const onTyping =
            data => {

                const activeId =
                    getId(
                        selectedUserRef.current
                    );

                if (
                    activeId &&
                    (
                        selectedUserRef.current?.isGroup
                            ? getId(data?.groupId) === activeId
                            : getId(data?.userId || data) === activeId
                    )
                ) {

                    setTyping(true);

                }

            };


        const onStopTyping =
            data => {

                const activeId =
                    getId(
                        selectedUserRef.current
                    );

                if (
                    activeId &&
                    (
                        selectedUserRef.current?.isGroup
                            ? getId(data?.groupId) === activeId
                            : getId(data?.userId || data) === activeId
                    )
                ) {

                    setTyping(false);

                }

            };


        /* -------------------------------------------------
           SEEN
        ------------------------------------------------- */

        const onSeen =
            data => {
                const messageIds = new Set(
                    data?.messageIds ||
                    (data?.messageId ? [data.messageId] : [])
                );

                if (!messageIds.size) {
                    return;
                }

                setMessages(
                    previous =>
                        previous.map(
                            item => {

                                if (
                                    messageIds.has(
                                        getMessageId(item)
                                    )
                                ) {

                                    return {
                                        ...item,
                                        seen: true,
                                        isSeen: true
                                    };

                                }

                                return item;

                            }
                        )
                );

            };


        /* -------------------------------------------------
           DELIVERED
           Fired when the receiver's device has actively
           received the message over the socket (they're
           online), before they've necessarily opened the
           chat. Distinct from "seen".
        ------------------------------------------------- */

        const onDelivered =
            data => {

                if (!data?.messageId) {
                    return;
                }

                setMessages(
                    previous =>
                        previous.map(
                            item => {

                                if (
                                    getMessageId(
                                        item
                                    ) ===
                                    data.messageId
                                ) {

                                    return {
                                        ...item,
                                        delivered: true,
                                        isDelivered: true
                                    };

                                }

                                return item;

                            }
                        )
                );

            };


        const applyIncomingMessageUpdate =
            async incoming => {
                const active = selectedUserRef.current;
                const messageId = getMessageId(incoming);
                const groupId = getId(incoming.groupId);

                if (!messageId || !incoming) {
                    return;
                }

                if (groupId && incoming.isDeleted) {
                    updateGroupPreview(groupId, incoming);
                }

                if (!active) {
                    return;
                }

                const activeId = getId(active);
                const senderId =
                    getId(incoming.sender) ||
                    getId(incoming.senderId);
                const receiverId =
                    getId(incoming.receiver) ||
                    getId(incoming.receiverId);
                const belongsToActiveConversation =
                    active.isGroup
                        ? groupId === activeId
                        : !groupId &&
                          [senderId, receiverId].includes(currentId) &&
                          [senderId, receiverId].includes(activeId);

                if (!belongsToActiveConversation) {
                    return;
                }

                const [updated] = incoming.isDeleted
                    ? [incoming]
                    : await decryptMessagesForTarget([incoming], active);

                if (
                    (updated.deletedFor || []).some(
                        deletedUser => getId(deletedUser) === currentId
                    )
                ) {
                    setMessages(previous =>
                        previous.filter(
                            item =>
                                getMessageId(item) !== messageId
                        )
                    );
                    return;
                }

                setMessages(previous =>
                    previous.map(item =>
                        getMessageId(item) === messageId
                            ? updated
                            : item
                    )
                );
            };

        const onMessageReaction =
            data => {
                void applyIncomingMessageUpdate(data?.message);
            };

        const onMessageUpdated =
            data => {
                void applyIncomingMessageUpdate(data?.message);
            };


/* =================================================
   INCOMING CALL
================================================= */

const onIncomingCall =
    data => {

        if (!data) {
            return;
        }

        const incoming = {

            ...data,

            mode:
                "incoming",

            status:
                "ringing"

        };

        callRef.current =
            incoming;

        currentRoomRef.current =
            data.roomId;

        setCallState(
            incoming
        );

        showIncomingCallNotification({

            callerName:
                data.callerName ||
                "User",

            type:
                data.type ||
                "audio"

        });

    };
        
/* =================================================
   CALL RINGING
================================================= */

const onCallRinging =
    data => {

        if (!data) {
            return;
        }

        const current =
            callRef.current || {};

        const ringingCall = {

            ...current,

            ...data,

            mode:
                "outgoing",

            status:
                "ringing"

        };

        callRef.current =
            ringingCall;

        currentRoomRef.current =
            data.roomId ||
            currentRoomRef.current;

        setCallState(
            ringingCall
        );

    };

        
/* -------------------------------------------------
   CALL ACCEPTED
------------------------------------------------- */

const onCallAccepted =
    async data => {

        try {

            const call =
                callRef.current ||
                data;

            if (!call) {
                return;
            }

            const receiverId =
                getId(
                    call.receiverId ||
                    data?.receiverId
                );

            const roomId =
                call.roomId ||
                data?.roomId;

            if (
                !receiverId ||
                !roomId
            ) {
                return;
            }

            currentRoomRef.current =
                roomId;

            /*
             * Caller is the ONLY side
             * that creates the offer.
             */

            const peer =
                peerRef.current ||
                createPeer(
                    receiverId
                );

            /*
             * Make sure local tracks
             * are attached.
             */

            if (
                localStreamRef.current
            ) {

                addLocalTracks(
                    peer,
                    localStreamRef.current
                );

            }

            const offer =
                await peer.createOffer({
                    offerToReceiveAudio: true,

                    offerToReceiveVideo:
                        (
                            call.type ||
                            data?.type
                        ) === "video"
                });

            await peer.setLocalDescription(
                offer
            );

            socket.emit(
                "webrtc-offer",
                {

                    receiverId,

                    callerId:
                        currentUserId,

                    roomId,

                    type:
                        call.type ||
                        data?.type ||
                        "audio",

                    offer

                }
            );

            const acceptedCall = {

                ...call,

                ...data,

                mode:
                    "accepted",

                status:
                    "accepted",

                accepted:
                    true

            };

            callRef.current =
                acceptedCall;

            setCallState(
                acceptedCall
            );

        } catch (error) {

            console.error(
                "Offer error:",
                error
            );

            endCallRef.current?.();

        }

    };

/* -------------------------------------------------
   WEBRTC OFFER
------------------------------------------------- */

const onOffer =
    async data => {

        try {

            if (
                !data?.offer ||
                !data?.roomId
            ) {
                return;
            }

            currentRoomRef.current =
                data.roomId;

            const callerId =
                getId(
                    data.callerId
                );

            if (!callerId) {
                return;
            }

            /*
             * Receiver creates peer only
             * after receiving caller's offer.
             */

            const peer =
                peerRef.current &&
                peerRef.current.signalingState !== "closed"
                    ? peerRef.current
                    : createPeer(
                          callerId
                      );

            /*
             * The receiver MUST have its microphone/camera
             * tracks on the peer before creating the answer.
             * createPeer normally does this, but keeping this
             * explicit makes the offer/answer path safe even if
             * the peer was created before getUserMedia finished.
             */
            if (localStreamRef.current) {
                addLocalTracks(
                    peer,
                    localStreamRef.current
                );
            }

            /*
             * Set remote offer first.
             */

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    data.offer
                )
            );

            /*
             * Add ICE candidates that
             * arrived before the offer.
             */

            const pending =
                pendingCandidatesRef.current || [];

            pendingCandidatesRef.current = [];

            for (
                const candidate of pending
            ) {

                try {

                    await peer.addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );

                } catch (error) {

                    console.error(
                        "Pending ICE error:",
                        error
                    );

                }

            }

            /*
             * Receiver creates answer.
             */

            const answer =
                await peer.createAnswer();

            await peer.setLocalDescription(
                answer
            );

            /*
             * SERVER CONTRACT:
             * receiverId = the user who RECEIVED the offer (this browser)
             * callerId   = the original caller who SENT the offer
             *
             * The old code sent these IDs reversed. server.js rejects
             * that answer, leaving the caller before the media connection.
             */
            socket.emit(
                "webrtc-answer",
                {

                    receiverId:
                        currentUserId,

                    callerId:
                        callerId,

                    roomId:
                        data.roomId,

                    answer

                }
            );

            const acceptedCall = {

                ...(callRef.current || {}),
                ...data,

                mode:
                    "accepted",

                status:
                    "accepted",

                accepted:
                    true

            };

            callRef.current =
                acceptedCall;

            setCallState(
                acceptedCall
            );

        } catch (error) {

            console.error(
                "WebRTC offer error:",
                error
            );

        }

    };
        
/* -------------------------------------------------
   WEBRTC ANSWER
------------------------------------------------- */

const onAnswer =
    async data => {

        try {

            if (
                !data?.answer ||
                !peerRef.current
            ) {
                return;
            }

            const peer =
                peerRef.current;

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    data.answer
                )
            );

            console.log(
                "✅ Remote SDP answer applied. ICE state:",
                peer.iceConnectionState,
                "connection state:",
                peer.connectionState
            );

            /*
             * Flush ICE candidates
             * received before answer.
             */

            const pending =
                pendingCandidatesRef.current || [];

            pendingCandidatesRef.current = [];

            for (
                const candidate of pending
            ) {

                try {

                    await peer.addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );

                } catch (error) {

                    console.error(
                        "Pending ICE candidate error:",
                        error
                    );

                }

            }

        } catch (error) {

            console.error(
                "WebRTC answer error:",
                error
            );

        }

    };

/* -------------------------------------------------
   ICE
------------------------------------------------- */

const onIceCandidate =
    async data => {

        if (
            !data?.candidate
        ) {
            return;
        }

        const peer =
            peerRef.current;

        /*
         * Peer not ready yet.
         * Store candidate.
         */

        if (!peer) {

            pendingCandidatesRef.current.push(
                data.candidate
            );

            return;
        }

        /*
         * Remote description not ready.
         * Store candidate until SDP is ready.
         */

        if (
            !peer.remoteDescription ||
            !peer.remoteDescription.type
        ) {

            pendingCandidatesRef.current.push(
                data.candidate
            );

            return;
        }

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    data.candidate
                )
            );

            console.log(
                "🧊 Remote ICE candidate added:",
                data.candidate?.candidate || data.candidate
            );

        } catch (error) {

            console.error(
                "ICE candidate error:",
                error
            );

        }

    };
        
        const persistCallLog = async (call, status, duration = 0) => {
            const callerId = getId(call?.callerId);
            const receiverId = getId(call?.receiverId);
            const otherUserId =
                callerId === currentUserId ? receiverId : callerId;

            if (
                !call?.callId ||
                !callerId ||
                !receiverId ||
                !otherUserId
            ) {
                console.error("Call log is missing server call details.", call);
                return;
            }

            try {
                const response = await api.post("/messages/call-log", {
                    callId: call.callId,
                    callerId,
                    otherUserId,
                    callType: call.type === "video" ? "video" : "voice",
                    status,
                    duration: Math.max(
                        0,
                        Math.floor(Number(duration) || 0)
                    )
                });
                const saved = response.data?.data;
                if (!saved) {
                    throw new Error("The server did not save the call details.");
                }

                if (
                    getId(selectedUserRef.current) === otherUserId
                ) {
                    appendMessage(saved);
                }
            } catch (error) {
                console.error("Save call details error:", error);
                showMessengerToast(
                    error.response?.data?.message ||
                        error.message ||
                        "Call details could not be saved."
                );
            }
        };

        /* -------------------------------------------------
           REJECTED
        ------------------------------------------------- */

        const onCallRejected =
            data => {

                stopCallRingtone();

                const call = {
                    ...(callRef.current || {}),
                    ...(callStateRef.current || {}),
                    ...(data || {})
                };
                void persistCallLog(call, "declined");

                cleanupCall();

            };


        /* -------------------------------------------------
           ENDED
        ------------------------------------------------- */

        const onCallEnded =
            data => {

                stopCallRingtone();

                const call = {
                    ...(callRef.current || {}),
                    ...(callStateRef.current || {}),
                    ...(data || {})
                };


                if (!call) {

                    cleanupCall();

                    return;

                }


                const duration =
                    Number(data?.duration ?? call?.duration ?? 0);
                void persistCallLog(call, "ended", duration);

                cleanupCall();

            };


        /* -------------------------------------------------
           BUSY
        ------------------------------------------------- */

        const onCallBusy =
            data => {

                stopCallRingtone();


                const call = {
                    ...(callRef.current || {}),
                    ...(callStateRef.current || {}),
                    ...(data || {})
                };
                void persistCallLog(call, "busy");

                cleanupCall();

            };



/* -------------------------------------------------
   MISSED CALL
------------------------------------------------- */

const onCallMissed =
    data => {

        const call = {
            ...(callRef.current || {}),
            ...(callStateRef.current || {}),
            ...(data || {})
        };
        void persistCallLog(call, "missed");


        /*
        ==========================================
        CLEANUP CALL
        ==========================================
        */

        cleanupCall();

    };

        socket.on(
            "connect",
            onConnect
        );

        socket.on(
            "online-users",
            onOnlineUsers
        );

        socket.on(
            "user-last-seen",
            onUserLastSeen
        );

        socket.on(
            "receive-message",
            onReceiveMessage
        );

        socket.on(
            "direct-message",
            onDirectMessage
        );

        socket.on(
            "group-message",
            onGroupMessage
        );

        socket.on(
            "group-message-notification",
            onGroupMessageNotification
        );

        socket.on(
            "group-updated",
            onGroupUpdated
        );

        socket.on(
            "group-call-incoming",
            onGroupCallIncoming
        );

        socket.on(
            "user-typing",
            onTyping
        );

        socket.on(
            "user-stop-typing",
            onStopTyping
        );

        socket.on(
            "messages-seen",
            onSeen
        );

        socket.on(
            "message-delivered",
            onDelivered
        );

        socket.on(
            "message-reaction",
            onMessageReaction
        );

        socket.on(
            "message-updated",
            onMessageUpdated
        );

        socket.on(
            "incoming-call",
            onIncomingCall
        );

        socket.on(
            "call-ringing",
            onCallRinging
        );

        socket.on(
            "call-accepted",
            onCallAccepted
        );

        socket.on(
            "call-rejected",
            onCallRejected
        );

        socket.on(
            "call-ended",
            onCallEnded
        );

        socket.on(
            "call-busy",
            onCallBusy
        );

        socket.on(
            "call-missed",
            onCallMissed
        );

        socket.on(
            "webrtc-offer",
            onOffer
        );

        socket.on(
            "webrtc-answer",
            onAnswer
        );

        socket.on(
            "webrtc-ice-candidate",
            onIceCandidate
        );


        return () => {

            socket.off(
                "connect",
                onConnect
            );

            socket.off(
                "online-users",
                onOnlineUsers
            );

            socket.off(
                "user-last-seen",
                onUserLastSeen
            );

            socket.off(
                "receive-message",
                onReceiveMessage
            );

            socket.off(
                "direct-message",
                onDirectMessage
            );

            socket.off(
                "group-message",
                onGroupMessage
            );

            socket.off(
                "group-message-notification",
                onGroupMessageNotification
            );

            socket.off(
                "group-updated",
                onGroupUpdated
            );

            socket.off(
                "group-call-incoming",
                onGroupCallIncoming
            );

            socket.off(
                "user-typing",
                onTyping
            );

            socket.off(
                "user-stop-typing",
                onStopTyping
            );

            socket.off(
                "messages-seen",
                onSeen
            );

            socket.off(
                "message-delivered",
                onDelivered
            );

            socket.off(
                "message-reaction",
                onMessageReaction
            );

            socket.off(
                "message-updated",
                onMessageUpdated
            );

            socket.off(
                "incoming-call",
                onIncomingCall
            );

            socket.off(
                "call-ringing",
                onCallRinging
            );

            socket.off(
                "call-accepted",
                onCallAccepted
            );

            socket.off(
                "call-rejected",
                onCallRejected
            );

            socket.off(
                "call-ended",
                onCallEnded
            );

            socket.off(
                "call-busy",
                onCallBusy
            );

            socket.off(
                "call-missed",
                onCallMissed
            );

            socket.off(
                "webrtc-offer",
                onOffer
            );

            socket.off(
                "webrtc-answer",
                onAnswer
            );

            socket.off(
                "webrtc-ice-candidate",
                onIceCandidate
            );

        };

    }, [
        user,
        appendMessage,
        bumpRecent,
        decryptMessagesForTarget,
        updateGroupPreview,
        cleanupCall,
        createPeer,
        scrollToBottom,
        currentUserId,
        showMessengerToast
    ]);


    /* =====================================================
       SELECT USER
    ===================================================== */

    const selectUser =
        useCallback(
            async target => {

                if (
                    !target ||
                    !user
                ) {
                    return;
                }


                const targetId =
                    getId(target);

                const loadId =
                    ++conversationLoadRef.current;

                const roomId =
                    target.isGroup
                        ? `group:${targetId}`
                        : getRoomId(
                              user,
                              target
                          );


                /*
                 * Leave whichever conversation room we
                 * were previously in before joining the
                 * new one, otherwise we keep accumulating
                 * memberships in every room we've ever
                 * opened.
                 */

                if (
                    currentRoomRef.current &&
                    currentRoomRef.current !==
                        roomId
                ) {

                    socket.emit(
                        "leave-room",
                        currentRoomRef.current
                    );

                }


                currentRoomRef.current =
                    roomId;

                selectedUserRef.current =
                    target;


                setSelectedUser(
                    target
                );

                setMobileChatOpen(
                    true
                );

                setMessages([]);
                setHasMoreMessages(false);
                setLoadingOlderMessages(false);
                setOlderMessagesError("");
                pendingHistoryScrollRef.current = null;
                messageHistoryRef.current = {
                    page: 1,
                    hasMore: false,
                    loading: false
                };

                setTyping(false);

                setShowEmoji(false);

                setShowBackgrounds(
                    false
                );

                setShowMenu(false);

                setShowConvSearch(false);

                setConvSearchTerm("");


                setUnreadUsers(
                    previous => {

                        const updated = {
                            ...previous
                        };

                        delete updated[
                            targetId
                        ];

                        return updated;

                    }
                );


                if (roomId) {

                    socket.emit(
                        "join-room",
                        roomId
                    );

                }


                try {

                    setChatLoading(
                        true
                    );

                    const response = target.isGroup
                        ? await api.get(
                              `/groups/${targetId}/messages`,
                              { params: { page: 1, limit: 50 } }
                          )
                        : await getMessages({
                              receiverId: targetId,
                              page: 1,
                              limit: 50
                          });


                    const data =
                        response.data?.data ||
                        response.data?.messages ||
                        [];

                    if (
                        loadId !== conversationLoadRef.current ||
                        String(getId(selectedUserRef.current)) !==
                        String(targetId)
                    ) {
                        return;
                    }

                    const visibleMessages =
                        await decryptMessagesForTarget(
                            Array.isArray(data) ? data : [],
                            target
                        );

                    if (
                        loadId !== conversationLoadRef.current ||
                        String(getId(selectedUserRef.current)) !==
                        String(targetId)
                    ) {
                        return;
                    }

                    const hasMore =
                        typeof response.data?.hasMore === "boolean"
                            ? response.data.hasMore
                            : data.length >= 50;

                    setMessages(visibleMessages);
                    setHasMoreMessages(hasMore);
                    messageHistoryRef.current = {
                        page: 1,
                        hasMore,
                        loading: false
                    };


                    if (
                        !target.isGroup &&
                        settingsRef.current
                            .readReceiptsEnabled
                    ) {

                        try {

                            await api.put(
                                `/messages/seen/${targetId}`
                            );

                        } catch (_) {}

                    }


                    scrollToBottom(
                        false
                    );

                } catch (error) {

                    console.error(
                        "Conversation error:",
                        error
                    );

                } finally {

                    if (
                        loadId === conversationLoadRef.current &&
                        String(getId(selectedUserRef.current)) ===
                        String(targetId)
                    ) {
                        setChatLoading(false);
                    }

                }

            },
            [
                decryptMessagesForTarget,
                getRoomId,
                scrollToBottom,
                user
            ]
        );

    const loadOlderMessages =
        useCallback(
            async () => {
                const target = selectedUserRef.current;
                const targetId = getId(target);
                const history = messageHistoryRef.current;
                const container = messagesContainerRef.current;

                if (
                    !target ||
                    !targetId ||
                    !history.hasMore ||
                    history.loading ||
                    !container
                ) {
                    return;
                }

                history.loading = true;
                setLoadingOlderMessages(true);
                setOlderMessagesError("");
                pendingHistoryScrollRef.current = {
                    height: container.scrollHeight,
                    top: container.scrollTop
                };

                const page = history.page + 1;

                try {
                    const response = target.isGroup
                        ? await api.get(
                              `/groups/${targetId}/messages`,
                              { params: { page, limit: 50 } }
                          )
                        : await getMessages({
                              receiverId: targetId,
                              page,
                              limit: 50
                          });

                    if (
                        messageHistoryRef.current !== history ||
                        String(getId(selectedUserRef.current)) !==
                        String(targetId)
                    ) {
                        pendingHistoryScrollRef.current = null;
                        return;
                    }

                    const data =
                        response.data?.data ||
                        response.data?.messages ||
                        [];
                    const visibleMessages =
                        await decryptMessagesForTarget(
                            Array.isArray(data) ? data : [],
                            target
                        );

                    if (
                        messageHistoryRef.current !== history ||
                        String(getId(selectedUserRef.current)) !==
                        String(targetId)
                    ) {
                        pendingHistoryScrollRef.current = null;
                        return;
                    }

                    const existingIds = new Set(
                        messages.map(item => String(getId(item)))
                    );
                    const olderMessages = visibleMessages.filter(
                        item => !existingIds.has(String(getId(item)))
                    );
                    const hasMore =
                        typeof response.data?.hasMore === "boolean"
                            ? response.data.hasMore
                            : data.length >= 50;

                    setMessages(previous => [
                        ...olderMessages.filter(
                            item =>
                                !previous.some(
                                    current =>
                                        String(getId(current)) ===
                                        String(getId(item))
                                )
                        ),
                        ...previous
                    ]);
                    history.page = page;
                    history.hasMore = hasMore;
                    setHasMoreMessages(hasMore);
                } catch (error) {
                    pendingHistoryScrollRef.current = null;
                    if (
                        messageHistoryRef.current === history &&
                        String(getId(selectedUserRef.current)) ===
                        String(targetId)
                    ) {
                        console.error("Load older messages error:", error);
                        setOlderMessagesError(
                            error.response?.data?.message ||
                            "Could not load older messages. Please try again."
                        );
                    }
                } finally {
                    history.loading = false;
                    if (messageHistoryRef.current === history) {
                        setLoadingOlderMessages(false);
                    }
                }
            },
            [decryptMessagesForTarget, messages]
        );

    useLayoutEffect(() => {
        const pending = pendingHistoryScrollRef.current;
        const container = messagesContainerRef.current;

        if (pending && container) {
            container.scrollTop =
                pending.top +
                (container.scrollHeight - pending.height);
            pendingHistoryScrollRef.current = null;
        }
    }, [messages]);

    const startGroupCall =
        type => {
            if (!selectedUser?.isGroup || activeGroupCall) {
                return;
            }

            if (callState) {
                alert("End your current one-to-one call before joining a group call.");
                return;
            }

            setActiveGroupCall({
                group: selectedUser,
                type,
                inviteOthers: true,
                callId: createCallId(),
                isInitiator: true
            });
        };

    const acceptGroupCall =
        async () => {
            if (callState || activeGroupCall || !incomingGroupCall) {
                return;
            }

            const group = groups.find(
                item => getId(item) === getId(incomingGroupCall.groupId)
            );

            if (!group) {
                setIncomingGroupCall(null);
                alert("You are no longer a member of this group.");
                return;
            }

            const invitation = incomingGroupCall;
            const target = {
                ...group,
                isGroup: true
            };

            setIncomingGroupCall(null);
            await selectUser(target);
            setActiveGroupCall({
                group: target,
                type: invitation.type === "video" ? "video" : "audio",
                inviteOthers: false,
                callId: invitation.callId,
                isInitiator: false
            });
        };

    const announceGroupCall =
        () => {
            if (!activeGroupCall?.inviteOthers) {
                return;
            }

            socket.emit("group-call-invite", {
                groupId: getId(activeGroupCall.group),
                type: activeGroupCall.type,
                callId: activeGroupCall.callId
            });

            setActiveGroupCall(current =>
                current
                    ? {
                          ...current,
                          inviteOthers: false
                      }
                    : current
            );
        };

    const closeGroupCall =
        callSummary => {
            const closingCall = activeGroupCall;
            setActiveGroupCall(null);

            if (
                !closingCall?.isInitiator ||
                !callSummary?.callId ||
                callSummary.callId !== closingCall.callId
            ) {
                return;
            }

            const groupId = getId(closingCall.group);
            void api.post(`/groups/${groupId}/call-log`, {
                callId: closingCall.callId,
                callType:
                    closingCall.type === "video" ? "video" : "voice",
                duration: callSummary.duration,
                participantCount: callSummary.participantCount
            }).then(response => {
                const saved = response.data?.data;
                if (!saved) {
                    throw new Error("The server did not save the group call details.");
                }

                updateGroupPreview(groupId, saved);
                bumpRecent(
                    groupId,
                    saved.createdAt || saved.timestamp
                );
                if (
                    selectedUserRef.current?.isGroup &&
                    getId(selectedUserRef.current) === groupId
                ) {
                    appendMessage(saved);
                }
            }).catch(error => {
                console.error("Save group call details error:", error);
                showMessengerToast(
                    error.response?.data?.message ||
                        error.message ||
                        "Group call details could not be saved."
                );
            });
        };

    const toggleEncryptedChat =
        async () => {
            if (!selectedUser || selectedUser.isGroup) {
                return;
            }

            if (getChatPreference(selectedUser).encrypted) {
                const confirmed = window.confirm(
                    "Turn off encryption for future messages? Existing encrypted messages will stay encrypted."
                );

                if (confirmed) {
                    updateChatPreference(selectedUser, "encrypted", false);
                }

                setShowMenu(false);
                return;
            }

            setEncryptionError("");

            try {
                const { peerPublicKey } =
                    await getConversationCipher(selectedUser);
                const safetyCode =
                    await getSafetyCode(
                        encryptionIdentityRef.current.publicKey,
                        peerPublicKey
                    );

                setEncryptionSafetyCode(safetyCode);
                setEncryptionSafetyPeerId(getId(selectedUser));
                updateChatPreference(selectedUser, "encrypted", true);
                setShowMenu(false);
            } catch (error) {
                console.error("Enable encrypted chat error:", error);
                setEncryptionError(
                    error?.response?.data?.message ||
                    error.message ||
                    "Could not enable encryption."
                );
            }
        };

    const saveEncryptionKeyBackup =
        async event => {
            event.preventDefault();

            if (keyBackupPassphrase !== keyBackupConfirmation) {
                setKeyBackupMessage("The recovery passphrases do not match.");
                return;
            }

            setKeyBackupBusy(true);
            setKeyBackupMessage("");

            try {
                const userId = getId(user);
                const identity = await ensureMessengerIdentity(api, userId);
                const backup = await createMessengerKeyBackup(
                    identity,
                    userId,
                    keyBackupPassphrase
                );

                await api.put("/messages/encryption-key-backup", { backup });
                setEncryptionIdentity(identity);
                encryptionIdentityRef.current = identity;
                setKeyBackupMessage(
                    "Encrypted recovery backup saved. Keep the passphrase somewhere safe."
                );
                setKeyBackupPassphrase("");
                setKeyBackupConfirmation("");
                setKeyRestorePassphrase("");
            } catch (error) {
                console.error("Save Messenger key backup error:", error);
                setKeyBackupMessage(
                    error?.response?.data?.message ||
                    error.message ||
                    "Could not save the encrypted recovery backup."
                );
            } finally {
                setKeyBackupBusy(false);
            }
        };

    const restoreEncryptionKeyBackup =
        async event => {
            event.preventDefault();
            setKeyBackupBusy(true);
            setKeyBackupMessage("");

            try {
                const identity = await restoreMessengerIdentity(
                    api,
                    getId(user),
                    keyRestorePassphrase
                );

                encryptionIdentityRef.current = identity;
                setEncryptionIdentity(identity);
                setEncryptionError("");
                setKeyBackupMessage(
                    "Encryption key restored on this device."
                );
                setKeyBackupPassphrase("");
                setKeyBackupConfirmation("");
                setKeyRestorePassphrase("");

                if (selectedUserRef.current) {
                    try {
                        await selectUser(selectedUserRef.current);
                    } catch (error) {
                        console.error(
                            "Reload Messenger history after key restore error:",
                            error
                        );
                        setKeyBackupMessage(
                            "The key was restored, but this conversation could not be reloaded."
                        );
                    }
                }
            } catch (error) {
                console.error("Restore Messenger key backup error:", error);
                setKeyBackupMessage(
                    error?.response?.data?.message ||
                    error.message ||
                    "Could not restore the encrypted recovery backup."
                );
            } finally {
                setKeyBackupBusy(false);
            }
        };


    const createGroup =
        async event => {
            event.preventDefault();
            const name = groupName.trim();

            if (!name || !groupMemberIds.length) {
                alert("Add a group name and at least one member.");
                return;
            }

            try {
                const response = await api.post("/groups", {
                    name,
                    memberIds: groupMemberIds
                });
                const group = {
                    ...(response.data?.data || {}),
                    isGroup: true
                };

                if (!getId(group)) {
                    throw new Error("The group was created but could not be loaded.");
                }

                setGroups(previous => [
                    group,
                    ...previous.filter(item => getId(item) !== getId(group))
                ]);
                setGroupName("");
                setGroupMemberIds([]);
                setShowGroupCreator(false);
                await selectUser(group);
            } catch (error) {
                console.error("Create group error:", error);
                alert(
                    error.response?.data?.message ||
                    error.message ||
                    "Could not create the group."
                );
            }
        };

    const toggleGroupEncryption =
        async () => {
            if (!selectedUser?.isGroup || groupEncryptionBusy) {
                return;
            }

            const enable = !selectedUser.isEncrypted;

            if (
                !enable &&
                !window.confirm(
                    "Turn off encryption for future group messages? Existing encrypted messages will stay encrypted."
                )
            ) {
                return;
            }

            setGroupEncryptionBusy(true);
            setGroupEncryptionMessage("");

            try {
                if (enable) {
                    const identity =
                        encryptionIdentityRef.current ||
                        await ensureMessengerIdentity(api, getId(user));
                    encryptionIdentityRef.current = identity;
                    setEncryptionIdentity(identity);
                }

                const response = await api.put(
                    `/groups/${getId(selectedUser)}/encryption`,
                    { isEncrypted: enable }
                );
                const updated = {
                    ...(response.data?.data || {}),
                    isGroup: true
                };

                setGroups(previous =>
                    previous.map(group =>
                        getId(group) === getId(updated) ? updated : group
                    )
                );
                setSelectedUser(updated);
                selectedUserRef.current = updated;
                setGroupEncryptionMessage(
                    enable
                        ? "Group text encryption is enabled."
                        : "Group text encryption is disabled for new messages."
                );
            } catch (error) {
                console.error("Update group encryption error:", error);
                setGroupEncryptionMessage(
                    error.response?.data?.message ||
                    error.message ||
                    "Could not update group encryption."
                );
            } finally {
                setGroupEncryptionBusy(false);
            }
        };


    const updateGroupDetails =
        async () => {
            if (!selectedUser?.isGroup || !groupMemberSelection.length) {
                return;
            }

            try {
                const response = await api.post(
                    `/groups/${getId(selectedUser)}/members`,
                    { memberIds: groupMemberSelection }
                );
                const updated = {
                    ...(response.data?.data || {}),
                    isGroup: true
                };

                setGroups(previous =>
                    previous.map(group =>
                        getId(group) === getId(updated) ? updated : group
                    )
                );
                setSelectedUser(updated);
                selectedUserRef.current = updated;
                setGroupMemberSelection([]);
            } catch (error) {
                console.error("Add group members error:", error);
                alert(
                    error.response?.data?.message ||
                    "Could not add members to the group."
                );
            }
        };

    const removeGroupMember =
        async memberId => {
            try {
                const response = await api.delete(
                    `/groups/${getId(selectedUser)}/members/${memberId}`
                );
                const updated = response.data?.data
                    ? { ...response.data.data, isGroup: true }
                    : null;

                if (!updated) {
                    setGroups(previous =>
                        previous.filter(group => getId(group) !== getId(selectedUser))
                    );
                    setSelectedUser(null);
                    selectedUserRef.current = null;
                    setMessages([]);
                    setShowGroupDetails(false);
                    return;
                }

                setGroups(previous =>
                    previous.map(group =>
                        getId(group) === getId(updated) ? updated : group
                    )
                );
                setSelectedUser(updated);
                selectedUserRef.current = updated;
            } catch (error) {
                console.error("Remove group member error:", error);
                alert(
                    error.response?.data?.message ||
                    "Could not remove the group member."
                );
            }
        };

    const leaveGroup =
        async () => {
            if (!selectedUser?.isGroup) {
                return;
            }

            if (!window.confirm(`Leave ${getUserName(selectedUser)}?`)) {
                return;
            }

            try {
                await api.delete(
                    `/groups/${getId(selectedUser)}/leave`
                );
                setGroups(previous =>
                    previous.filter(group => getId(group) !== getId(selectedUser))
                );
                setSelectedUser(null);
                selectedUserRef.current = null;
                setMessages([]);
                setShowGroupDetails(false);
                setMobileChatOpen(false);
            } catch (error) {
                console.error("Leave group error:", error);
                alert(
                    error.response?.data?.message ||
                    "Could not leave the group."
                );
            }
        };


    /* =====================================================
       OPEN CONVERSATION FROM ?user=<id> IN THE URL

       UserProfile.jsx's "Message" button and
       SearchResults.jsx's message icon both navigate to
       /messenger?user=<id>, but nothing here ever read
       that param - so landing on Messenger this way just
       showed the normal empty "select someone to chat"
       screen, with no way to actually message that person.
    ===================================================== */

    useEffect(() => {

        if (!user) {
            return;
        }

        const targetId =
            searchParams.get("user");

        if (!targetId) {
            return;
        }

        // Already viewing this conversation - nothing to do.
        if (
            getId(selectedUserRef.current) ===
            targetId
        ) {
            return;
        }

        let cancelled =
            false;

        (async () => {

            // Prefer the already-loaded contact list -
            // avoids an extra request in the common case.
            let target =
                users.find(
                    item =>
                        getId(item) === targetId
                );

            if (!target) {

                try {

                    const response =
                        await api.get(
                            `/users/public/${targetId}`
                        );

                    target =
                        response.data?.user ||
                        response.data?.data ||
                        null;

                } catch (error) {

                    console.error(
                        "Load profile from URL error:",
                        error
                    );

                }

            }

            if (
                cancelled ||
                !target
            ) {
                return;
            }

            setSearch("");

            await selectUser(
                target
            );

            if (!cancelled) {

                // Clean the URL up (/messenger) now that
                // the conversation is open, so refreshing
                // the page or navigating back and forth
                // doesn't keep re-triggering this.
                setSearchParams(
                    {},
                    { replace: true }
                );

            }

        })();

        return () => {

            cancelled =
                true;

        };

    }, [
        user,
        users,
        searchParams,
        selectUser,
        setSearchParams
    ]);


    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    const sendMessage =
        async (event, messageOverride = message) => {

            event?.preventDefault?.();


            const text =
                String(messageOverride || "").trim();


            if (
                !text ||
                !selectedUser ||
                !user
            ) {
                return;
            }


            const sender =
                getId(user);

            const receiver =
                getId(selectedUser);


            if (
                !sender ||
                !receiver
            ) {
                return;
            }

            const encryptedChat =
                selectedUser.isGroup
                    ? selectedUser.isEncrypted
                    : getChatPreference(selectedUser).encrypted;

            let storedText = text;

            if (encryptedChat) {
                try {
                    if (selectedUser.isGroup) {
                        const identity =
                            encryptionIdentityRef.current ||
                            await ensureMessengerIdentity(api, sender);
                        encryptionIdentityRef.current = identity;
                        setEncryptionIdentity(identity);
                        storedText = await encryptGroupMessageText({
                            api,
                            text,
                            groupId: receiver,
                            senderId: sender,
                            identity,
                            participants: selectedUser.participants
                        });
                    } else {
                        const { cipher } =
                            await getConversationCipher(selectedUser);
                        storedText = await encryptMessageText(
                            text,
                            cipher,
                            getConversationEncryptionId(sender, receiver)
                        );
                    }

                    if (
                        storedText.length >
                        (selectedUser.isGroup ? 128000 : 5000)
                    ) {
                        throw new Error(
                            "This message is too long to encrypt. Shorten it and try again."
                        );
                    }
                } catch (error) {
                    setEncryptionError(error.message);
                    alert(error.message);
                    return;
                }
            }


            const roomId =
                currentRoomRef.current ||
                getRoomId(
                    user,
                    selectedUser
                );


            bumpRecent(
                receiver
            );


            /*
             * IMPORTANT:
             * Show message immediately.
             */

            const temporaryId =
                `temp-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;


            const optimisticMessage = {
                _id:
                    temporaryId,
                id:
                    temporaryId,
                sender:
                    user,
                receiver:
                    selectedUser.isGroup
                        ? null
                        : selectedUser,
                groupId:
                    selectedUser.isGroup
                        ? receiver
                        : undefined,
                message:
                    text,
                isEncrypted: encryptedChat,
                createdAt:
                    new Date().toISOString(),
                seen:
                    false,
                optimistic:
                    true,
                replyTo:
                    replyingTo ||
                    undefined
            };

            const replySnapshot =
                replyingTo;


            appendMessage(
                optimisticMessage
            );

            scrollToBottom();

            setMessage("");

            setShowEmoji(false);

            setReplyingTo(null);


            socket.emit(
                "stop-typing",
                {
                    roomId,
                    userId:
                        sender
                }
            );


            try {

                /*
                 * Save to MongoDB.
                 */

                const response =
                    await api.post(
                        "/messages/send",
                        selectedUser.isGroup
                            ? {
                                  groupId: receiver,
                                  message: storedText,
                                  isEncrypted: encryptedChat,
                                  replyTo:
                                      getMessageId(replySnapshot) ||
                                      undefined
                              }
                            : {
                                  receiver,
                                  message: storedText,
                                  isEncrypted: encryptedChat,
                                  replyTo:
                                      getMessageId(replySnapshot) ||
                                      undefined
                              }
                    );


                const saved =
                    response.data?.data ||
                    response.data?.message ||
                    null;

                if (!saved) {
                    throw new Error(
                        "The server did not confirm that the message was saved."
                    );
                }

                /*
                 * Replace optimistic message.
                 */

                const [visibleSaved] = encryptedChat
                    ? await decryptMessagesForTarget([saved], selectedUser)
                    : [saved];

                if (selectedUser.isGroup) {
                    updateGroupPreview(receiver, saved);
                }

                setMessages(
                    previous =>
                        previous.map(
                            item =>
                                item._id ===
                                temporaryId
                                    ? visibleSaved
                                    : item
                        )
                );


                /*
                 * Send saved message through
                 * Socket.IO immediately after DB save.
                 */

                socket.emit(
                    "send-message",
                    {
                        roomId,
                        sender,
                        ...(selectedUser.isGroup
                            ? {
                                  groupId: receiver,
                                  senderName: getUserName(user)
                              }
                            : { receiver }),
                        message:
                            saved.message ||
                            storedText,
                        isEncrypted: encryptedChat,
                        replyTo:
                            saved.replyTo ||
                            undefined,
                        _id:
                            saved._id ||
                            saved.id,
                        id:
                            saved._id ||
                            saved.id,
                        createdAt:
                            saved.createdAt ||
                            new Date()
                                .toISOString()
                    }
                );

            } catch (error) {

                console.error(
                    "Send message error:",
                    error
                );


                /*
                 * Remove failed optimistic message.
                 */

                setMessages(
                    previous =>
                        previous.filter(
                            item =>
                                item._id !==
                                temporaryId
                        )
                );


                alert(
                    error.response?.data
                        ?.message ||
                    "Message could not be sent."
                );

            }

        };

    const shareCurrentLocation =
        async () => {
            if (!selectedUser || isConversationBlocked) {
                return;
            }

            if (!navigator.geolocation) {
                alert("This browser does not support location sharing.");
                return;
            }

            const audience = selectedUser.isGroup
                ? `all ${selectedUser.participants?.length || "group"} members`
                : getUserName(selectedUser);

            if (!window.confirm(
                `Share your approximate current location with ${audience}? This sends a one-time pin in the chat; it does not track you.`
            )) {
                return;
            }

            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        resolve,
                        reject,
                        {
                            enableHighAccuracy: false,
                            maximumAge: 0,
                            timeout: 12000
                        }
                    );
                });
                await sendMessage(null, createLocationMessage(
                    position.coords.latitude,
                    position.coords.longitude
                ));
            } catch (error) {
                const messageByCode = {
                    1: "Location permission was denied. Allow location access in your browser to share a pin.",
                    2: "Your current location is unavailable. Try again when your device can determine its location.",
                    3: "Location lookup timed out. Please try again."
                };

                console.error("Messenger location sharing error:", error);
                alert(messageByCode[error.code] || error.message || "Unable to share your location.");
            }
        };


    /* =====================================================
       TYPING
    ===================================================== */

    const handleTyping =
        event => {

            const value =
                event.target.value;

            setMessage(value);


            if (
                !selectedUser ||
                !user
            ) {
                return;
            }


            const roomId =
                currentRoomRef.current ||
                getRoomId(
                    user,
                    selectedUser
                );


            socket.emit(
                "typing",
                {
                    roomId,
                    userId:
                        getId(user)
                }
            );


            clearTimeout(
                typingTimeoutRef.current
            );


            typingTimeoutRef.current =
                setTimeout(
                    () => {

                        socket.emit(
                            "stop-typing",
                            {
                                roomId,
                                userId:
                                    getId(user)
                            }
                        );

                    },
                    1200
                );

        };


    /* =====================================================
       FILE
    ===================================================== */

    const sendAttachmentFile = async file => {
        if (!selectedUser || !user) {
            throw new Error("Choose a conversation before sending an attachment.");
        }
        if (file.size > 10 * 1024 * 1024) {
            throw new Error("Files must be 10MB or smaller.");
        }

        const target = selectedUser;
        const recipientId = getId(target);
        const senderId = getId(user);
        if (!recipientId || !senderId) {
            throw new Error("Choose a valid conversation before sending an attachment.");
        }

        const encryptedChat = target.isGroup
            ? target.isEncrypted
            : getChatPreference(target).encrypted;
        let uploadFile = file;
        let storedMessage = "";
        let mediaMetadata = null;

        if (encryptedChat) {
            const encrypted = await encryptMessengerMediaFile(file);
            mediaMetadata = encrypted.metadata;
            const metadataText = JSON.stringify(mediaMetadata);

            if (target.isGroup) {
                const identity =
                    encryptionIdentityRef.current ||
                    await ensureMessengerIdentity(api, senderId);
                encryptionIdentityRef.current = identity;
                setEncryptionIdentity(identity);
                storedMessage = await encryptGroupMessageText({
                    api,
                    text: metadataText,
                    groupId: recipientId,
                    senderId,
                    identity,
                    participants: target.participants
                });
            } else {
                const { cipher } = await getConversationCipher(target);
                storedMessage = await encryptMessageText(
                    metadataText,
                    cipher,
                    getConversationEncryptionId(senderId, recipientId)
                );
            }

            uploadFile = new File(
                [encrypted.ciphertext],
                "encrypted-media.bin",
                { type: "application/octet-stream" }
            );
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append(target.isGroup ? "groupId" : "receiver", recipientId);
        if (encryptedChat) {
            formData.append("message", storedMessage);
            formData.append("isEncrypted", "true");
        }

        const response = await api.post("/messages/send", formData);
        const saved =
            response.data?.data ||
            response.data?.message;
        if (!saved) {
            throw new Error("The server did not confirm the attachment.");
        }

        const visibleMessage = encryptedChat
            ? {
                  ...saved,
                  message: mediaMetadata.caption,
                  fileName: mediaMetadata.fileName,
                  fileType: mediaMetadata.fileType,
                  encryptedMedia: mediaMetadata,
                  isEncrypted: true
              }
            : saved;
        appendMessage(visibleMessage);

        if (target.isGroup) {
            updateGroupPreview(recipientId, saved);
        }

        scrollToBottom();
        bumpRecent(recipientId);

        const roomId =
            currentRoomRef.current ||
            getRoomId(user, target);
        socket.emit("send-message", {
            roomId,
            sender: senderId,
            ...(target.isGroup
                ? {
                      groupId: recipientId,
                      senderName: getUserName(user)
                  }
                : { receiver: recipientId }),
            message: saved.message || "",
            fileUrl: saved.fileUrl || "",
            fileName: saved.fileName || "",
            fileType: saved.fileType || "",
            isEncrypted: Boolean(encryptedChat),
            _id: saved._id || saved.id,
            id: saved._id || saved.id,
            createdAt: saved.createdAt || new Date().toISOString()
        });
    };

    const handleFile = async event => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            await sendAttachmentFile(file);
        } catch (error) {
            console.error("File send error:", error);
            showMessengerToast(
                error.response?.data?.message ||
                    error.message ||
                    "Attachment could not be sent."
            );
        } finally {
            event.target.value = "";
        }
    };


    /* =====================================================
       VOICE MESSAGE
    ===================================================== */

    const uploadVoiceMessage =
        async blob => {

            if (
                !selectedUser ||
                !user
            ) {
                return;
            }

            try {

                const mimeType =
                    (blob.type || "audio/webm")
                        .split(";")[0]
                        .trim()
                        .toLowerCase();

                const extension =
                    mimeType.includes("mp4")
                        ? "m4a"
                        : mimeType.includes("aac")
                        ? "aac"
                        : mimeType.includes("ogg")
                        ? "ogg"
                        : mimeType.includes("mpeg") ||
                          mimeType.includes("mp3")
                        ? "mp3"
                        : mimeType.includes("wav")
                        ? "wav"
                        : "webm";

                const file =
                    new File(
                        [blob],
                        `voice-${Date.now()}.${extension}`,
                        {
                            type: mimeType
                        }
                    );

                await sendAttachmentFile(file);

                showMessengerToast("Voice note sent successfully.", "success");

            } catch (error) {

                console.error(
                    "Voice message send error:",
                    error
                );

                showMessengerToast(
                    error.response?.data?.message ||
                        error.message ||
                        "Voice note could not be sent."
                );

            }

        };


    const stopRecordingTracks =
        () => {

            clearInterval(
                recordingTimerRef.current
            );

            recordingTimerRef.current = null;

            recordingStreamRef.current
                ?.getTracks()
                .forEach(track => track.stop());

            recordingStreamRef.current = null;

            mediaRecorderRef.current = null;

            setIsRecording(false);

            setRecordingSeconds(0);

        };


    const startRecording =
        async () => {

            if (
                !selectedUser ||
                isConversationBlocked ||
                recordingStreamRef.current ||
                recordingStartRef.current
            ) {
                return;
            }

            recordingStartRef.current = true;
            setStartingVoiceRecording(true);
            try {

                const recording = await startVoiceRecording({
                    getUserMedia:
                        navigator.mediaDevices?.getUserMedia?.bind(
                            navigator.mediaDevices
                        ),
                    MediaRecorderClass: window.MediaRecorder
                });
                recordingStreamRef.current = recording.stream;
                recordedChunksRef.current = recording.chunks;
                const recorder = recording.recorder;
                mediaRecorderRef.current = recorder;

                setIsRecording(true);

                setRecordingSeconds(0);

                recordingTimerRef.current =
                    setInterval(
                        () => {

                            setRecordingSeconds(
                                value => value + 1
                            );

                        },
                        1000
                    );

            } catch (error) {

                stopRecordingTracks();

                console.error(
                    "Start recording error:",
                    error
                );

                showMessengerToast(
                    error.name === "NotSupportedError"
                        ? error.message
                        : "Allow microphone access to record a voice note."
                );

            } finally {

                recordingStartRef.current = false;
                setStartingVoiceRecording(false);

            }

        };


    const finishRecording = () =>
        finishVoiceRecording(
            mediaRecorderRef.current,
            recordedChunksRef.current
        );


    const stopAndSendRecording =
        async () => {

            if (finishingVoiceRef.current) {
                return;
            }

            finishingVoiceRef.current = true;
            setSendingVoice(true);
            try {
                const blob = await finishRecording();
                stopRecordingTracks();
                if (blob?.size > 0) {
                    await uploadVoiceMessage(blob);
                }
            } catch (error) {
                stopRecordingTracks();
                console.error("Finish voice recording error:", error);
                showMessengerToast(
                    error.message || "Voice note could not be sent."
                );
            } finally {
                recordedChunksRef.current = [];
                setSendingVoice(false);
                finishingVoiceRef.current = false;
            }

        };


    const cancelRecording =
        () => {

            const recorder =
                mediaRecorderRef.current;

            if (recorder) {

                recorder.onstop = null;

                try {

                    recorder.stop();

                } catch (_) {}

            }

            recordedChunksRef.current = [];

            stopRecordingTracks();

        };



    /* =====================================================
       UI HELPERS
    ===================================================== */

    const addEmoji =
        emoji => {

            setMessage(
                previous =>
                    `${previous}${emoji}`
            );

        };


    const handleBackground =
        id => {

            setBackground(id);

            localStorage.setItem(
                "jr-chat-background",
                id
            );

            setShowBackgrounds(
                false
            );

        };


    const handleBlockToggle =
        async () => {

            if (!selectedUser) {
                return;
            }

            const targetId =
                getId(selectedUser);

            const currentlyBlocked =
                Boolean(
                    selectedUser.isBlockedByMe
                );

            const confirmed =
                window.confirm(
                    currentlyBlocked
                        ? `Unblock ${getUserName(selectedUser)}?`
                        : `Block ${getUserName(selectedUser)}? They won't be able to message you.`
                );

            if (!confirmed) {
                return;
            }

            try {

                await api.post(
                    `/users/${
                        currentlyBlocked
                            ? "unblock"
                            : "block"
                    }/${targetId}`
                );

                const applyFlag =
                    user =>
                        getId(user) === targetId
                            ? {
                                  ...user,
                                  isBlockedByMe:
                                      !currentlyBlocked
                              }
                            : user;

                setUsers(
                    previous =>
                        previous.map(
                            applyFlag
                        )
                );

                setSelectedUser(
                    previous =>
                        previous
                            ? applyFlag(previous)
                            : previous
                );

                setShowMenu(false);

            } catch (error) {

                console.error(
                    "Block/unblock error:",
                    error
                );

                alert(
                    error.response?.data
                        ?.message ||
                    "Something went wrong."
                );

            }

        };


    const handleForwardSend =
        async targetUser => {

            if (
                !forwardingMessage ||
                !targetUser
            ) {
                return;
            }

            const targetId =
                getId(targetUser);

            try {

                setForwardSending(true);

                const encryptedDestination =
                    getChatPreference(targetUser).encrypted;
                const sourceMessageId =
                    getMessageId(forwardingMessage);
                let forwardPayload = {
                    receiver: targetId,
                    forwardedFrom: sourceMessageId
                };

                if (forwardingMessage.isDeleted) {
                    throw new Error("Deleted messages cannot be forwarded.");
                }
                if (forwardingMessage.decryptionFailed) {
                    throw new Error(
                        "This message could not be decrypted, so it cannot be forwarded."
                    );
                }

                if (encryptedDestination) {
                    if (forwardingMessage.fileUrl) {
                        throw new Error(
                            "Attachments cannot be forwarded to an encrypted chat."
                        );
                    }

                    const { cipher } =
                        await getConversationCipher(targetUser);
                    const encryptedText =
                        await encryptMessageText(
                            String(forwardingMessage.message || "").trim(),
                            cipher,
                            getConversationEncryptionId(
                                getId(user),
                                targetId
                            )
                        );

                    if (!encryptedText || encryptedText.length > 5000) {
                        throw new Error(
                            "This message is too long to forward securely."
                        );
                    }

                    forwardPayload = {
                        receiver: targetId,
                        message: encryptedText,
                        isEncrypted: true,
                        isForwarded: true
                    };
                } else if (forwardingMessage.isEncrypted) {
                    forwardPayload.message =
                        String(forwardingMessage.message || "").trim();
                }

                const response =
                    await api.post(
                        "/messages/send",
                        forwardPayload
                    );

                const saved =
                    response.data?.data;
                const [visibleSaved] = saved && encryptedDestination
                    ? await decryptMessagesForTarget([saved], targetUser)
                    : [saved];

                const roomId =
                    getRoomId(
                        user,
                        targetUser
                    );

                if (saved) {

                    socket.emit(
                        "send-message",
                        {
                            roomId,
                            sender:
                                getId(user),
                            receiver:
                                targetId,
                            message: saved.message || "",
                            isEncrypted: saved.isEncrypted || false,
                            isForwarded: saved.isForwarded || false,
                            fileUrl:
                                saved.fileUrl ||
                                "",
                            fileName:
                                saved.fileName ||
                                "",
                            fileType:
                                saved.fileType ||
                                "",
                            forwardedFrom:
                                saved.forwardedFrom ||
                                undefined,
                            _id:
                                saved._id,
                            id:
                                saved._id,
                            createdAt:
                                saved.createdAt ||
                                new Date().toISOString()
                        }
                    );

                    // If we happen to have this contact's
                    // chat open already, show it there too.
                    if (
                        getId(
                            selectedUserRef.current
                        ) === targetId
                    ) {

                        appendMessage(
                            visibleSaved
                        );

                        scrollToBottom();

                    }

                    bumpRecent(
                        targetId
                    );

                }

                setForwardSentTo(
                    previous => {

                        const next =
                            new Set(previous);

                        next.add(targetId);

                        return next;

                    }
                );

            } catch (error) {

                console.error(
                    "Forward error:",
                    error
                );

                showMessengerToast(
                    error.response?.data
                        ?.message ||
                    error.message ||
                    "Could not forward this message."
                );

            } finally {

                setForwardSending(false);

            }

        };


    const handleReact =
        async (item, emoji) => {

            const messageId =
                getMessageId(item);

            if (!messageId) {
                return;
            }

            setReactionPickerFor(null);

            try {

                const response =
                    await api.put(
                        `/messages/${messageId}/react`,
                        { emoji }
                    );

                const updated =
                    response.data?.data;

                if (updated) {
                    const [visibleUpdated] =
                        await decryptMessagesForTarget(
                            [updated],
                            selectedUser
                        );

                    setMessages(
                        previous =>
                            previous.map(
                                msg =>
                                    getMessageId(msg) ===
                                    messageId
                                        ? visibleUpdated
                                        : msg
                            )
                    );

                    const roomId =
                        currentRoomRef.current;

                    socket.emit(
                        "message-reaction",
                        {
                            roomId,
                            receiverId:
                                getId(selectedUser),
                            message:
                                updated
                        }
                    );

                }

            } catch (error) {

                console.error(
                    "React error:",
                    error
                );
                showMessengerToast(
                    error.response?.data?.message ||
                    "Could not update this reaction."
                );

            }

        };


    const handleEditSave =
        async () => {

            const messageId =
                getMessageId(editingMessage);

            const text =
                editText.trim();

            if (
                !messageId ||
                !text
            ) {
                setEditingMessage(null);
                return;
            }

            try {
                const encryptedEdit =
                    selectedUser?.isGroup
                        ? editingMessage.isEncrypted || selectedUser.isEncrypted
                        : editingMessage.isEncrypted ||
                          getChatPreference(selectedUser).encrypted;
                let storedText = text;

                if (encryptedEdit) {
                    if (selectedUser.isGroup) {
                        const senderId = getId(user);
                        const identity =
                            encryptionIdentityRef.current ||
                            await ensureMessengerIdentity(api, senderId);
                        encryptionIdentityRef.current = identity;
                        setEncryptionIdentity(identity);
                        storedText = await encryptGroupMessageText({
                            api,
                            text,
                            groupId: getId(selectedUser),
                            senderId,
                            identity,
                            participants: selectedUser.participants
                        });
                    } else {
                        const { cipher } =
                            await getConversationCipher(selectedUser);
                        storedText = await encryptMessageText(
                            text,
                            cipher,
                            getConversationEncryptionId(
                                getId(user),
                                getId(selectedUser)
                            )
                        );
                    }

                    if (
                        storedText.length >
                        (selectedUser.isGroup ? 128000 : 5000)
                    ) {
                        throw new Error(
                            "This message is too long to encrypt. Shorten it and try again."
                        );
                    }
                }

                const response =
                    await api.put(
                        `/messages/${messageId}`,
                        {
                            message: storedText,
                            isEncrypted: encryptedEdit
                        }
                    );

                let updated =
                    response.data?.data;

                if (updated && encryptedEdit) {
                    [updated] = await decryptMessagesForTarget(
                        [updated],
                        selectedUser
                    );
                }

                if (updated) {

                    setMessages(
                        previous =>
                            previous.map(
                                msg =>
                                    getMessageId(msg) ===
                                    messageId
                                        ? updated
                                        : msg
                            )
                    );

                }

            } catch (error) {

                console.error(
                    "Edit error:",
                    error
                );

                alert(
                    error.response?.data
                        ?.message ||
                    "Could not edit this message."
                );

            } finally {

                setEditingMessage(null);

                setEditText("");

            }

        };


    const handleDeleteMessage =
        async (item, deleteFor) => {

            const messageId =
                getMessageId(item);

            if (!messageId) {
                return;
            }

            setDeletingMessage(true);
            try {

                const response =
                    await api.delete(
                        `/messages/${messageId}`,
                        { data: { deleteFor } }
                    );

                const updated =
                    response.data?.data;

                if (deleteFor === "me") {
                    setMessages(previous =>
                        previous.filter(msg =>
                            getMessageId(msg) !== messageId
                        )
                    );
                } else if (updated) {

                    setMessages(
                        previous =>
                            previous.map(
                                msg =>
                                    getMessageId(msg) ===
                                    messageId
                                        ? updated
                                        : msg
                            )
                    );

                }

                setMessageDeleteFor(null);
                setDeleteConfirmation(null);

            } catch (error) {

                console.error(
                    "Delete error:",
                    error
                );

                showMessengerToast(
                    error.response?.data
                        ?.message ||
                    "Unable to delete message.",
                    "error"
                );

            } finally {

                setDeletingMessage(false);

            }

        };


    /*
     * Users with a conversation are shown most-recent
     * first; users with no messages yet keep their
     * original (name-sorted, from the API) order and
     * sit below everyone with an active conversation.
     */
    const sortedUsers =
        useMemo(
            () => {

                return [...users].sort(
                    (a, b) => {
                        const pinnedA =
                            chatPreferences[getId(a)]?.pinned ? 1 : 0;
                        const pinnedB =
                            chatPreferences[getId(b)]?.pinned ? 1 : 0;

                        if (pinnedA !== pinnedB) {
                            return pinnedB - pinnedA;
                        }

                        const timeA =
                            recentTimestamps[
                                getId(a)
                            ] || 0;

                        const timeB =
                            recentTimestamps[
                                getId(b)
                            ] || 0;

                        return timeB - timeA;

                    }
                );

            },
            [
                users,
                recentTimestamps,
                chatPreferences
            ]
        );


    const filteredUsers =
        useMemo(
            () => {

                const term =
                    search
                        .trim()
                        .toLowerCase();


                return sortedUsers.filter(
                    target => {
                        const archived =
                            Boolean(chatPreferences[getId(target)]?.archived);

                        if (archived !== (chatListView === "archived")) {
                            return false;
                        }

                        if (!term) {
                            return true;
                        }

                        const name =
                            getUserName(
                                target
                            ).toLowerCase();

                        const email =
                            (
                                target.email ||
                                ""
                            ).toLowerCase();

                        const username =
                            (
                                target.username ||
                                ""
                            ).toLowerCase();


                        return (
                            name.includes(
                                term
                            ) ||
                            email.includes(
                                term
                            ) ||
                            username.includes(
                                term
                            )
                        );

                    }
                );

            },
            [
                sortedUsers,
                search,
                chatPreferences,
                chatListView
            ]
        );

    const filteredGroups =
        useMemo(
            () => {
                const term =
                    search.trim().toLowerCase();

                return groups
                    .filter(group => {
                        const archived =
                            Boolean(chatPreferences[getId(group)]?.archived);

                        return (
                            archived === (chatListView === "archived") &&
                            (!term ||
                                getUserName(group)
                                    .toLowerCase()
                                    .includes(term))
                        );
                    })
                    .sort((a, b) => {
                        const pinnedA =
                            chatPreferences[getId(a)]?.pinned ? 1 : 0;
                        const pinnedB =
                            chatPreferences[getId(b)]?.pinned ? 1 : 0;

                        return pinnedB - pinnedA;
                    });
            },
            [
                groups,
                search,
                chatPreferences,
                chatListView
            ]
        );


    const currentBackground =
        useMemo(
            () =>
                CHAT_BACKGROUNDS.find(
                    item =>
                        item.id ===
                        background
                ) ||
                CHAT_BACKGROUNDS[0],
            [background]
        );


    const iBlockedThem =
        Boolean(
            selectedUser?.isBlockedByMe
        );

    const theyBlockedMe =
        Boolean(
            selectedUser?.hasBlockedMe
        );

    const isConversationBlocked =
        iBlockedThem ||
        theyBlockedMe;


    const formatTime =
        value => {

            if (!value) {
                return "";
            }


            const date =
                new Date(value);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return "";
            }


            return date.toLocaleTimeString(
                [],
                {
                    hour:
                        "2-digit",
                    minute:
                        "2-digit"
                }
            );

        };


    /*
     * "Today" / "Yesterday" / full date - used for the
     * date separators between groups of messages.
     */
    const formatDateLabel =
        value => {

            if (!value) {
                return "";
            }

            const date =
                new Date(value);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return "";
            }

            const startOfDay =
                d =>
                    new Date(
                        d.getFullYear(),
                        d.getMonth(),
                        d.getDate()
                    ).getTime();

            const today =
                startOfDay(
                    new Date()
                );

            const yesterday =
                today -
                24 * 60 * 60 * 1000;

            const day =
                startOfDay(date);

            if (day === today) {
                return "Today";
            }

            if (day === yesterday) {
                return "Yesterday";
            }

            return date.toLocaleDateString(
                [],
                {
                    day: "numeric",
                    month: "long",
                    year:
                        date.getFullYear() !==
                        new Date().getFullYear()
                            ? "numeric"
                            : undefined
                }
            );

        };


    const getMessageText =
        item =>

            item?.message ||
            item?.text ||
            item?.content ||
            "";


    const handleAttachmentDownload =
        async (event, url, filename) => {

            event.preventDefault();

            try {

                const response =
                    await fetch(url);

                const blob =
                    await response.blob();

                const blobUrl =
                    window.URL.createObjectURL(
                        blob
                    );

                const link =
                    document.createElement(
                        "a"
                    );

                link.href =
                    blobUrl;

                link.download =
                    filename ||
                    "download";

                document.body.appendChild(
                    link
                );

                link.click();

                link.remove();

                window.URL.revokeObjectURL(
                    blobUrl
                );

            } catch (error) {

                console.error(
                    "Attachment download error:",
                    error
                );

                // Fall back to just opening it - the
                // person can still save it manually
                // (long-press / right-click "Save as").
                window.open(
                    url,
                    "_blank",
                    "noopener,noreferrer"
                );

            }

        };


    /*
     * "Last seen just now" / "5 minutes ago" / "Yesterday
     * at 3:45 PM" / a full date for anything older. Reads
     * `presenceTick` purely so it re-evaluates every 30s
     * without needing a page refresh.
     */
    const formatLastSeen =
        userId => {

            void presenceTick;

            const id =
                getId(userId);

            const when =
                id && lastSeenMap[id];

            if (!when) {
                return "Offline";
            }

            const date =
                new Date(when);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return "Offline";
            }

            const diffMs =
                Date.now() -
                date.getTime();

            const diffMinutes =
                Math.floor(
                    diffMs / 60000
                );

            if (diffMinutes < 1) {
                return "Last seen just now";
            }

            if (diffMinutes < 60) {
                return `Last seen ${diffMinutes} minute${
                    diffMinutes === 1 ? "" : "s"
                } ago`;
            }

            const diffHours =
                Math.floor(
                    diffMinutes / 60
                );

            if (diffHours < 24) {
                return `Last seen ${diffHours} hour${
                    diffHours === 1 ? "" : "s"
                } ago`;
            }

            const diffDays =
                Math.floor(
                    diffHours / 24
                );

            if (diffDays === 1) {

                return `Last seen yesterday at ${formatTime(
                    when
                )}`;

            }

            if (diffDays < 7) {
                return `Last seen ${diffDays} days ago`;
            }

            return `Last seen ${date.toLocaleDateString(
                [],
                {
                    day: "numeric",
                    month: "short",
                    year:
                        date.getFullYear() !==
                        new Date().getFullYear()
                            ? "numeric"
                            : undefined
                }
            )}`;

        };


    /*
     * Interleaves date-separator entries between groups of
     * messages sent on different calendar days, so the
     * thread reads like "Today" / "Yesterday" / "3 March"
     * the way most chat apps do.
     */
    const messagesWithSeparators =
        useMemo(
            () => {

                const result = [];

                let lastDayKey =
                    null;

                messages.forEach(
                    (item, index) => {

                        const when =
                            item.createdAt ||
                            item.timestamp;

                        const date =
                            when
                                ? new Date(when)
                                : null;

                        const dayKey =
                            date &&
                            !Number.isNaN(
                                date.getTime()
                            )
                                ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                                : null;

                        if (
                            dayKey &&
                            dayKey !== lastDayKey
                        ) {

                            result.push({
                                type: "separator",
                                key: `sep-${dayKey}`,
                                label:
                                    formatDateLabel(when)
                            });

                            lastDayKey =
                                dayKey;

                        }

                        result.push({
                            type: "message",
                            key:
                                getMessageId(item) ||
                                `msg-${index}`,
                            item,
                            index
                        });

                    }
                );

                return result;

            },
            [messages]
        );


    /*
     * Indices (into `messages`) of every message whose text
     * matches the in-conversation search box, for the
     * search bar's "3/12" counter and jump-to-match buttons.
     */
    const searchMatchIndices =
        useMemo(
            () => {

                const term =
                    convSearchTerm
                        .trim()
                        .toLowerCase();

                if (!term) {
                    return [];
                }

                const indices = [];

                messages.forEach(
                    (item, index) => {

                        if (
                            getMessageText(item)
                                .toLowerCase()
                                .includes(term)
                        ) {

                            indices.push(index);

                        }

                    }
                );

                return indices;

            },
            [
                messages,
                convSearchTerm
            ]
        );


    useEffect(() => {

        setActiveMatchIndex(0);

    }, [
        convSearchTerm,
        selectedUser
    ]);


    useEffect(() => {

        if (
            !showConvSearch ||
            searchMatchIndices.length ===
                0
        ) {
            return;
        }

        const targetIndex =
            searchMatchIndices[
                activeMatchIndex %
                    searchMatchIndices.length
            ];

        const targetItem =
            messages[targetIndex];

        const targetId =
            targetItem &&
            (
                getMessageId(targetItem) ||
                `msg-${targetIndex}`
            );

        if (!targetId) {
            return;
        }

        const element =
            document.getElementById(
                `chat-message-${targetId}`
            );

        element?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }, [
        activeMatchIndex,
        searchMatchIndices,
        showConvSearch,
        messages
    ]);


    const goToMatch =
        direction => {

            if (
                searchMatchIndices.length ===
                0
            ) {
                return;
            }

            setActiveMatchIndex(
                previous => {

                    const total =
                        searchMatchIndices.length;

                    return (
                        (previous + direction + total) %
                        total
                    );

                }
            );

        };


    const closeConvSearch =
        () => {

            setShowConvSearch(false);

            setConvSearchTerm("");

            setActiveMatchIndex(0);

        };


    const renderAvatar =
        target => {

            if (target?.isGroup) {
                return (
                    <div className="avatar-fallback group-avatar-fallback">
                        <FaUsers />
                    </div>
                );
            }

            const avatar =
                getUploadUrl(
                    getAvatar(target)
                );


            if (avatar) {

                return (
                    <img
                        src={avatar}
                        alt=""
                    />
                );

            }


            return (
                <div className="avatar-fallback">

                    {getUserName(
                        target
                    )
                        .charAt(0)
                        .toUpperCase()}

                </div>
            );

        };


    /* =====================================================
       CLEANUP
    ===================================================== */

    useEffect(() => {

        return () => {

            clearTimeout(
                typingTimeoutRef.current
            );

            cleanupCall();

        };

    }, [cleanupCall]);


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        if (!isActive) {
            return null;
        }

        return (
            <div className="messenger-loading">

                <div className="messenger-loader" />

                <span>
                    Loading Messenger...
                </span>

            </div>
        );

    }


    /* =====================================================
       RENDER
    ===================================================== */

    return (
        <div className={`messenger-page ${isActive ? "" : "messenger-persistent-background"}`}>

            {messengerToast && (
                <div
                    key={messengerToast.id}
                    className={`messenger-toast messenger-toast-${messengerToast.type}`}
                    role={messengerToast.type === "error" ? "alert" : "status"}
                    aria-live={messengerToast.type === "error" ? "assertive" : "polite"}
                >
                    <span className="messenger-toast-icon" aria-hidden="true">
                        {messengerToast.type === "success"
                            ? <FaCheckCircle />
                            : <FaExclamationCircle />}
                    </span>
                    <div className="messenger-toast-copy">
                        <small>MESSENGER · VOICE NOTE</small>
                        <p>{messengerToast.message}</p>
                    </div>
                    <button
                        type="button"
                        className="messenger-toast-close"
                        aria-label="Dismiss notification"
                        onClick={dismissMessengerToast}
                    >
                        <FaTimes />
                    </button>
                    <span className="messenger-toast-progress" aria-hidden="true" />
                </div>
            )}

            <aside
                className={
                    `messenger-sidebar ${
                        mobileChatOpen
                            ? "mobile-hidden"
                            : ""
                    }`
                }
            >

                <div className="messenger-sidebar-header">

                    <div>

                        <h2>
                            Messenger
                        </h2>

                        <span>
                            {users.length} contacts
                        </span>

                    </div>


                    <button
                        type="button"
                        className="messenger-settings-btn"
                        title="Messenger settings"
                        onClick={() =>
                            setShowSettings(
                                value =>
                                    !value
                            )
                        }
                    >
                        <FaCog />
                    </button>

                    <button
                        type="button"
                        className="messenger-settings-btn"
                        title="Create a group"
                        onClick={() => setShowGroupCreator(true)}
                    >
                        <FaPlus />
                    </button>

                </div>


                {showSettings && (

                    <div className="messenger-settings-panel">

                        <div className="settings-panel-title">

                            <strong>
                                Settings
                            </strong>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowSettings(
                                        false
                                    )
                                }
                            >
                                <FaTimes />
                            </button>

                        </div>


                        <label className="settings-row">

                            <span>
                                Notification sound
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    settings.soundEnabled
                                }
                                onChange={
                                    event =>
                                        updateSetting(
                                            "soundEnabled",
                                            event.target.checked
                                        )
                                }
                            />

                        </label>


                        <label className="settings-row">

                            <span>
                                Read receipts (seen status)
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    settings.readReceiptsEnabled
                                }
                                onChange={
                                    event =>
                                        updateSetting(
                                            "readReceiptsEnabled",
                                            event.target.checked
                                        )
                                }
                            />

                        </label>


                        <label className="settings-row">

                            <span>
                                Send message with Enter
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    settings.enterToSend
                                }
                                onChange={
                                    event =>
                                        updateSetting(
                                            "enterToSend",
                                            event.target.checked
                                        )
                                }
                            />

                        </label>


                        <label className="settings-row">

                            <span>
                                Auto-download photos
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    settings.autoDownloadMedia
                                }
                                onChange={
                                    event =>
                                        updateSetting(
                                            "autoDownloadMedia",
                                            event.target.checked
                                        )
                                }
                            />

                        </label>


                        <section className="encryption-backup-settings">
                            <strong>Encryption key recovery</strong>
                            <p>
                                Save a passphrase-protected copy so you can restore
                                encrypted chats on another device. The server stores
                                only encrypted backup data; it cannot read your key.
                            </p>
                            {encryptionError && (
                                <p
                                    className="encryption-backup-error"
                                    role="alert"
                                >
                                    {encryptionError}
                                </p>
                            )}

                            <form onSubmit={saveEncryptionKeyBackup}>
                                <label>
                                    New recovery passphrase
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={keyBackupPassphrase}
                                        onChange={event =>
                                            setKeyBackupPassphrase(event.target.value)
                                        }
                                        minLength={12}
                                        maxLength={256}
                                        required
                                    />
                                </label>
                                <label>
                                    Confirm recovery passphrase
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={keyBackupConfirmation}
                                        onChange={event =>
                                            setKeyBackupConfirmation(event.target.value)
                                        }
                                        minLength={12}
                                        maxLength={256}
                                        required
                                    />
                                </label>
                                <button
                                    type="submit"
                                    disabled={keyBackupBusy || !encryptionIdentity}
                                >
                                    Save encrypted backup
                                </button>
                            </form>

                            <form onSubmit={restoreEncryptionKeyBackup}>
                                <label>
                                    Restore with recovery passphrase
                                    <input
                                        type="password"
                                        autoComplete="current-password"
                                        value={keyRestorePassphrase}
                                        onChange={event =>
                                            setKeyRestorePassphrase(event.target.value)
                                        }
                                        minLength={12}
                                        maxLength={256}
                                        required
                                    />
                                </label>
                                <button
                                    type="submit"
                                    disabled={keyBackupBusy}
                                >
                                    Restore this device
                                </button>
                            </form>

                            {keyBackupMessage && (
                                <p className="encryption-backup-status" role="status">
                                    {keyBackupMessage}
                                </p>
                            )}
                            <p className="settings-note">
                                Keep the passphrase safe. If it is lost, no one can
                                decrypt this backup. These preferences are also saved
                                on this device only.
                            </p>
                        </section>

                    </div>

                )}


                <div className="messenger-search">

                    <FaSearch />

                    <input
                        value={search}
                        onChange={
                            event =>
                                setSearch(
                                    event.target.value
                                )
                        }
                        placeholder="Search people..."
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

                <div className="messenger-chat-filters" aria-label="Conversation list">
                    <button
                        type="button"
                        aria-pressed={chatListView === "chats"}
                        className={chatListView === "chats" ? "active" : ""}
                        onClick={() => setChatListView("chats")}
                    >
                        Chats
                    </button>
                    <button
                        type="button"
                        aria-pressed={chatListView === "archived"}
                        className={chatListView === "archived" ? "active" : ""}
                        onClick={() => setChatListView("archived")}
                    >
                        Archived
                    </button>
                </div>

                <div className="user-list">

                    {filteredGroups.length > 0 && (
                        <section className="messenger-group-list">
                            <div className="messenger-list-heading">
                                <span>Groups</span>
                                <button
                                    type="button"
                                    title="Create a group"
                                    onClick={() => setShowGroupCreator(true)}
                                >
                                    <FaPlus />
                                </button>
                            </div>
                            {filteredGroups.map(group => {
                                const groupId = getId(group);
                                const unread = unreadUsers[groupId] || 0;
                                const active =
                                    selectedUser?.isGroup &&
                                    getId(selectedUser) === groupId;

                                return (
                                    <button
                                        key={groupId}
                                        type="button"
                                        className={`chat-user ${active ? "active" : ""}`}
                                        onClick={() => selectUser(group)}
                                    >
                                        <div className="messenger-avatar">
                                            {renderAvatar(group)}
                                        </div>
                                        <div className="chat-user-content">
                                            <div className="chat-user-top">
                                                <strong>{getUserName(group)}</strong>
                                                <ConversationStateIcons
                                                    preference={getChatPreference(groupId)}
                                                />
                                            </div>
                                            <div className="chat-user-bottom">
                                                <span>
                                                    {group.lastMessage?.message ||
                                                        `${group.participants?.length || 0} members`}
                                                </span>
                                                {unread > 0 && (
                                                    <span className="unread-badge">
                                                        {unread > 99 ? "99+" : unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </section>
                    )}

                    {filteredUsers.length === 0 &&
                    filteredGroups.length === 0 ? (

                        <div className="no-users">

                            <FaUserCircle />

                            <p>
                                {chatListView === "archived"
                                    ? "No archived chats"
                                    : "No conversations found"}
                            </p>

                            <small>
                                {chatListView === "archived"
                                    ? "Chats you archive will appear here."
                                    : "Try another name or email"}
                            </small>

                        </div>

                    ) : (

                        filteredUsers.map(
                            target => {

                                const id =
                                    getId(target);

                                const unread =
                                    unreadUsers[
                                        id
                                    ] || 0;

                                const active =
                                    getId(
                                        selectedUser
                                    ) === id;


                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        className={
                                            `chat-user ${
                                                active
                                                    ? "active"
                                                    : ""
                                            }`
                                        }
                                        onClick={() =>
                                            selectUser(
                                                target
                                            )
                                        }
                                    >

                                        <div className="messenger-avatar">

                                            {renderAvatar(
                                                target
                                            )}


                                            {isOnline(
                                                target
                                            ) && (
                                                <span className="online-dot">

                                                    <FaCircle />

                                                </span>
                                            )}

                                        </div>


                                        <div className="chat-user-content">

                                            <div className="chat-user-top">

                                                <strong>
                                                    {getUserName(
                                                        target
                                                    )}
                                                    {target.isVerified && (
                                                        <VerifiedBadge className="verified-badge-small" />
                                                    )}
                                                </strong>
                                                <ConversationStateIcons
                                                    preference={getChatPreference(id)}
                                                />

                                            </div>


                                            <div className="chat-user-bottom">

                                                <span>
                                                    {isOnline(
                                                        target
                                                    )
                                                        ? "Active now"
                                                        : formatLastSeen(
                                                              target
                                                          )}
                                                </span>


                                                {unread >
                                                    0 && (
                                                    <span className="unread-badge">

                                                        {unread >
                                                        99
                                                            ? "99+"
                                                            : unread}

                                                    </span>
                                                )}

                                            </div>

                                        </div>

                                    </button>
                                );

                            }
                        )

                    )}

                </div>

            </aside>


            <main
                className={
                    `messenger-chat ${
                        mobileChatOpen
                            ? "mobile-visible"
                            : ""
                    }`
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
                            Select someone to start chatting.
                        </p>

                    </div>

                ) : (

                    <>

                        <header className="chat-header">

                            <div className="chat-header-left">

                                <button
                                    type="button"
                                    aria-label="Back to conversations"
                                    className="mobile-back-btn"
                                    onClick={() => {
                                        const conversationRoom =
                                            selectedUser?.isGroup
                                                ? `group:${getId(selectedUser)}`
                                                : getRoomId(
                                                      user,
                                                      selectedUser
                                                  );

                                        if (
                                            !callStateRef.current &&
                                            !activeGroupCall &&
                                            conversationRoom &&
                                            currentRoomRef.current ===
                                                conversationRoom
                                        ) {
                                            socket.emit(
                                                "leave-room",
                                                conversationRoom
                                            );
                                            currentRoomRef.current =
                                                null;
                                        }

                                        setMobileChatOpen(
                                            false
                                        );

                                        setSelectedUser(
                                            null
                                        );

                                        selectedUserRef.current =
                                            null;

                                    }}
                                >
                                    <FaArrowLeft />
                                </button>


                                <div className="messenger-avatar large">

                                    {renderAvatar(
                                        selectedUser
                                    )}


                                    {!selectedUser.isGroup && isOnline(
                                        selectedUser
                                    ) && (
                                        <span className="online-dot">

                                            <FaCircle />

                                        </span>
                                    )}

                                </div>


                                <div className="chat-header-user">

                                    <h2>
                                        {getUserName(
                                            selectedUser
                                        )}
                                        {selectedUser.isGroup &&
                                            selectedUser.isEncrypted && (
                                                <FaLock
                                                    className="encrypted-chat-lock"
                                                    title="Group messages are end-to-end encrypted; calls are not"
                                                    aria-label="Group messages are end-to-end encrypted"
                                                />
                                            )}
                                        {!selectedUser.isGroup &&
                                            getChatPreference(selectedUser).encrypted && (
                                                <FaLock
                                                    className="encrypted-chat-lock"
                                                    title="End-to-end encrypted text chat"
                                                    aria-label="End-to-end encrypted text chat"
                                                />
                                            )}
                                        {!selectedUser.isGroup &&
                                            selectedUser.isVerified && (
                                                <VerifiedBadge />
                                            )}
                                    </h2>


                                    <span>
                                        {selectedUser.isGroup
                                            ? `${selectedUser.participants?.length || 0} members`
                                            : typing
                                            ? "typing..."
                                            : isOnline(selectedUser)
                                            ? "Active now"
                                            : formatLastSeen(selectedUser)}
                                    </span>

                                </div>

                            </div>


                            <div className="chat-header-actions">

                                {selectedUser.isGroup ? (
                                    <>
                                        <button
                                            type="button"
                                            className="mobile-group-members-button"
                                            title="Group members"
                                            aria-label="Group members"
                                            onClick={() => {
                                                setGroupMemberSelection([]);
                                                setGroupEncryptionMessage("");
                                                setShowGroupDetails(true);
                                                setShowMenu(false);
                                            }}
                                        >
                                            <FaUsers />
                                            Group members
                                        </button>
                                        <button
                                            type="button"
                                            title="Start group voice call"
                                            aria-label="Start group voice call"
                                            onClick={() => startGroupCall("audio")}
                                        >
                                            <FaPhone />
                                        </button>
                                        <button
                                            type="button"
                                            title="Start group video call"
                                            aria-label="Start group video call"
                                            onClick={() => startGroupCall("video")}
                                        >
                                            <FaVideo />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                <button
                                    type="button"
                                    title="Voice call"
                                    aria-label="Start voice call"
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
                                    aria-label="Start video call"
                                    onClick={() =>
                                        startCall(
                                            "video"
                                        )
                                    }
                                >
                                    <FaVideo />
                                </button>
                                    </>
                                )}


                                <button
                                    type="button"
                                    className="chat-search-button"
                                    title="Search in conversation"
                                    aria-label="Search in conversation"
                                    aria-expanded={showConvSearch}
                                    onClick={() => {

                                        setShowConvSearch(
                                            value =>
                                                !value
                                        );

                                        setShowMenu(
                                            false
                                        );

                                        setShowBackgrounds(
                                            false
                                        );

                                    }}
                                >
                                    <FaSearch />
                                </button>


                                <button
                                    type="button"
                                    className="chat-background-button"
                                    title="Chat background"
                                    aria-label="Chat background"
                                    aria-expanded={showBackgrounds}
                                    onClick={() => {

                                        setShowBackgrounds(
                                            value =>
                                                !value
                                        );

                                        setShowMenu(
                                            false
                                        );

                                    }}
                                >
                                    <FaPalette />
                                </button>


                                <button
                                    type="button"
                                    disabled={notificationPermission === "unsupported"}
                                    className={`chat-notifications-button ${
                                        notificationPermission === "granted"
                                            ? "notification-enabled"
                                            : notificationPermission === "denied"
                                                ? "notification-denied"
                                                : ""
                                    }`}
                                    aria-label={
                                        notificationPermission === "granted"
                                            ? "Notifications are enabled"
                                            : "Enable message and call notifications"
                                    }
                                    aria-pressed={notificationPermission === "granted"}
                                    title={
                                        notificationPermission === "unsupported"
                                            ? "Notifications are not supported in this browser"
                                            : notificationPermission === "granted"
                                                ? "Notifications are enabled"
                                                : notificationPermission === "denied"
                                                    ? "Allow notifications in your browser settings"
                                                    : "Enable message and call notifications"
                                    }
                                    onClick={enableNotifications}
                                >
                                    <FaBell />
                                </button>


                                <button
                                    type="button"
                                    title="More"
                                    aria-label="More conversation options"
                                    aria-expanded={showMenu}
                                    onClick={() => {

                                        setShowMenu(
                                            value =>
                                                !value
                                        );

                                        setShowBackgrounds(
                                            false
                                        );

                                    }}
                                >
                                    <FaEllipsisH />
                                </button>

                            </div>


                            {showMenu && (
                                <div className="chat-options-menu">

                                    <button
                                        type="button"
                                        className="mobile-toolbar-option"
                                        onClick={() => {
                                            setShowConvSearch(value => !value);
                                            setShowBackgrounds(false);
                                            setShowMenu(false);
                                        }}
                                    >
                                        <FaSearch />
                                        Search in conversation
                                    </button>

                                    <button
                                        type="button"
                                        className="mobile-toolbar-option"
                                        onClick={() => {
                                            setShowBackgrounds(value => !value);
                                            setShowConvSearch(false);
                                            setShowMenu(false);
                                        }}
                                    >
                                        <FaPalette />
                                        Chat theme
                                    </button>

                                    {selectedUser?.isGroup && (
                                        <button
                                            type="button"
                                            className="mobile-toolbar-option"
                                            onClick={() => {
                                                setGroupMemberSelection([]);
                                                setShowGroupDetails(true);
                                                setShowMenu(false);
                                            }}
                                        >
                                            <FaUsers />
                                        </button>
                                    )}

                                    {!selectedUser?.isGroup && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={toggleEncryptedChat}
                                            >
                                                <FaLock />
                                                {getChatPreference(selectedUser).encrypted
                                                    ? "Turn off encryption"
                                                    : "Start encrypted chat"}
                                            </button>

                                            {getChatPreference(selectedUser).encrypted &&
                                                encryptionSafetyCode &&
                                                encryptionSafetyPeerId === getId(selectedUser) && (
                                                    <div className="messenger-encryption-safety-code">
                                                        <strong>Safety code</strong>
                                                        <span>{encryptionSafetyCode}</span>
                                                        <small>
                                                            Compare this code with the other person out of band.
                                                            Encryption is for text messages only.
                                                        </small>
                                                    </div>
                                                )}

                                            {encryptionError && (
                                                <p className="messenger-encryption-error" role="alert">
                                                    {encryptionError}
                                                </p>
                                            )}
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateChatPreference(
                                                selectedUser,
                                                "pinned",
                                                !getChatPreference(selectedUser).pinned
                                            );
                                            setShowMenu(false);
                                        }}
                                    >
                                        <FaThumbtack />
                                        {getChatPreference(selectedUser).pinned
                                            ? "Unpin chat"
                                            : "Pin chat"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const shouldArchive =
                                                !getChatPreference(selectedUser).archived;

                                            updateChatPreference(
                                                selectedUser,
                                                "archived",
                                                shouldArchive
                                            );

                                            if (!shouldArchive) {
                                                setChatListView("chats");
                                            }

                                            setShowMenu(false);
                                        }}
                                    >
                                        <FaArchive />
                                        {getChatPreference(selectedUser).archived
                                            ? "Unarchive chat"
                                            : "Archive chat"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateChatPreference(
                                                selectedUser,
                                                "muted",
                                                !getChatPreference(selectedUser).muted
                                            );
                                            setShowMenu(false);
                                        }}
                                    >
                                        <FaVolumeMute />
                                        {getChatPreference(selectedUser).muted
                                            ? "Unmute notifications"
                                            : "Mute notifications"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={enableNotifications}
                                    >
                                        <FaBell />
                                        Notifications
                                    </button>


                                    <button
                                        type="button"
                                        onClick={() => {

                                            setMessages([]);

                                            setShowMenu(
                                                false
                                            );

                                        }}
                                    >
                                        <FaTimes />
                                        Clear local chat
                                    </button>


                                    {!selectedUser?.isGroup && (
                                        <button
                                            type="button"
                                            className="danger-option"
                                            onClick={handleBlockToggle}
                                        >
                                            <FaBan />
                                            {selectedUser?.isBlockedByMe
                                                ? "Unblock this user"
                                                : "Block this user"}
                                        </button>
                                    )}

                                </div>
                            )}


                            {showBackgrounds && (
                                <div className="background-panel">

                                    <div className="background-panel-title">

                                        <strong>
                                            Chat theme
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
                                            item => (

                                                <button
                                                    key={
                                                        item.id
                                                    }
                                                    type="button"
                                                    className={
                                                        `theme-option ${
                                                            background ===
                                                            item.id
                                                                ? "selected"
                                                                : ""
                                                        }`
                                                    }
                                                    onClick={() =>
                                                        handleBackground(
                                                            item.id
                                                        )
                                                    }
                                                >

                                                    <span
                                                        style={{
                                                            background:
                                                                item.value ||
                                                                "#ffffff"
                                                        }}
                                                    />

                                                    <small>
                                                        {item.name}
                                                    </small>

                                                </button>

                                            )
                                        )}

                                    </div>

                                </div>
                            )}

                        </header>


                        {showConvSearch && (

                            <div className="conversation-search-bar">

                                <FaSearch />

                                <input
                                    autoFocus
                                    type="text"
                                    value={convSearchTerm}
                                    onChange={
                                        event =>
                                            setConvSearchTerm(
                                                event.target.value
                                            )
                                    }
                                    placeholder="Search in this conversation..."
                                />

                                {convSearchTerm && (

                                    <span className="search-match-count">

                                        {searchMatchIndices.length >
                                        0
                                            ? `${
                                                  (activeMatchIndex %
                                                      searchMatchIndices.length) +
                                                  1
                                              }/${
                                                  searchMatchIndices.length
                                              }`
                                            : "0/0"}

                                    </span>

                                )}

                                <button
                                    type="button"
                                    title="Previous match"
                                    onClick={() =>
                                        goToMatch(-1)
                                    }
                                >
                                    <FaArrowLeft />
                                </button>

                                <button
                                    type="button"
                                    title="Next match"
                                    onClick={() =>
                                        goToMatch(1)
                                    }
                                >
                                    <FaArrowLeft
                                        style={{
                                            transform:
                                                "rotate(180deg)"
                                        }}
                                    />
                                </button>

                                <button
                                    type="button"
                                    title="Close search"
                                    onClick={
                                        closeConvSearch
                                    }
                                >
                                    <FaTimes />
                                </button>

                            </div>

                        )}


                        <section
                            ref={messagesContainerRef}
                            className="messages-container"
                            style={{
                                background:
                                    currentBackground.value ||
                                    undefined
                            }}
                        >

                            {!chatLoading &&
                                messages.length > 0 &&
                                (hasMoreMessages ||
                                    olderMessagesError) && (
                                    <div className="older-messages-control">
                                        <button
                                            type="button"
                                            onClick={loadOlderMessages}
                                            disabled={loadingOlderMessages}
                                        >
                                            {loadingOlderMessages
                                                ? "Loading older messages..."
                                                : olderMessagesError
                                                  ? "Try again"
                                                  : "Load older messages"}
                                        </button>
                                        {olderMessagesError && (
                                            <span role="alert">
                                                {olderMessagesError}
                                            </span>
                                        )}
                                    </div>
                                )}

                            {chatLoading ? (

                                <div className="chat-loading">

                                    <div />

                                    Loading messages...

                                </div>

                            ) : messages.length ===
                              0 ? (

                                <div className="no-messages">

                                    <div>
                                        👋
                                    </div>

                                    <p>
                                        Start the conversation
                                    </p>

                                    <small>
                                        Send a message to{" "}
                                        {getUserName(
                                            selectedUser
                                        )}
                                    </small>

                                </div>

                            ) : (

                                messagesWithSeparators.map(
                                    entry => {

                                        if (
                                            entry.type ===
                                            "separator"
                                        ) {

                                            return (
                                                <div
                                                    key={
                                                        entry.key
                                                    }
                                                    className="date-separator"
                                                >
                                                    <span>
                                                        {entry.label}
                                                    </span>
                                                </div>
                                            );

                                        }

                                        const {
                                            item,
                                            index
                                        } = entry;

                                        const senderId =
                                            getMessageSenderId(
                                                item
                                            );

                                        const own =
                                            senderId ===
                                            currentUserId;


                                        const text =
                                            item.message ||
                                            item.text ||
                                            item.content ||
                                            "";

                                        const location =
                                            !item.isDeleted &&
                                            !item.decryptionFailed
                                                ? parseLocationMessage(text)
                                                : null;


                                        const fileUrl =
                                            item.encryptedMedia ||
                                            !item.isEncrypted
                                                ? getUploadUrl(item.fileUrl || "")
                                                : "";


                                        const fileType =
                                            item.fileType ||
                                            "";


                                        const fileName =
                                            item.fileName ||
                                            "Attachment";


                                        const isImageFile =
                                            fileUrl &&
                                            (
                                                fileType.startsWith(
                                                    "image/"
                                                ) ||
                                                /\.(png|jpe?g|gif|webp)$/i.test(
                                                    fileUrl
                                                )
                                            );


                                        const isAudioFile =
                                            fileUrl &&
                                            (
                                                fileType.startsWith(
                                                    "audio/"
                                                ) ||
                                                /\.(webm|ogg|m4a|mp3|wav)$/i.test(
                                                    fileUrl
                                                )
                                            ) &&
                                            (
                                                fileName.startsWith(
                                                    "voice-"
                                                ) ||
                                                fileType.startsWith(
                                                    "audio/"
                                                )
                                            );


                                        const attachmentKey =
                                            getMessageId(
                                                item
                                            ) ||
                                            `msg-${index}`;


                                        const mediaRevealed =
                                            settings.autoDownloadMedia ||
                                            revealedMedia.has(
                                                attachmentKey
                                            );


                                        const time =
                                            item.createdAt ||
                                            item.timestamp;

                                        const messageCreatedAt =
                                            new Date(time).getTime();
                                        const canDeleteForEveryone =
                                            own &&
                                            Number.isFinite(messageCreatedAt) &&
                                            Date.now() >= messageCreatedAt &&
                                            Date.now() - messageCreatedAt <=
                                                15 * 60 * 1000;


                                        const seen =
                                            item.seen ||
                                            item.isSeen;


                                        const delivered =
                                            item.delivered ||
                                            item.isDelivered;


                                        const isActiveMatch =
                                            showConvSearch &&
                                            searchMatchIndices.length >
                                                0 &&
                                            index ===
                                                searchMatchIndices[
                                                    activeMatchIndex %
                                                        searchMatchIndices.length
                                                ];


                                        return (
                                            <div
                                                key={
                                                    getMessageId(
                                                        item
                                                    ) ||
                                                    index
                                                }
                                                id={
                                                    `chat-message-${
                                                        getMessageId(
                                                            item
                                                        ) ||
                                                        `msg-${index}`
                                                    }`
                                                }
                                                className={
                                                    `message-row ${
                                                        own
                                                            ? "own"
                                                            : ""
                                                    }`
                                                }
                                            >

                                                <div
                                                    className={
                                                        `message-bubble ${
                                                            own
                                                                ? "own"
                                                                : ""
                                                        } ${
                                                            isActiveMatch
                                                                ? "search-match"
                                                                : ""
                                                        } ${
                                                            swipeReplyProgress?.messageId ===
                                                            getMessageId(item)
                                                                ? "swipe-replying"
                                                                : ""
                                                        }`
                                                    }
                                                    style={
                                                        swipeReplyProgress?.messageId ===
                                                        getMessageId(item)
                                                            ? {
                                                                transform: `translateX(${swipeReplyProgress.offset}px)`
                                                            }
                                                            : undefined
                                                    }
                                                    onPointerDown={event =>
                                                        startMessageGesture(
                                                            event,
                                                            item
                                                        )
                                                    }
                                                    onPointerMove={
                                                        moveMessageGesture
                                                    }
                                                    onPointerUp={
                                                        finishMessageGesture
                                                    }
                                                    onPointerCancel={
                                                        cancelMessageGesture
                                                    }
                                                    onContextMenu={event => {
                                                        event.preventDefault();
                                                        if (!item.isDeleted) {
                                                            setReactionPickerFor(
                                                                getMessageId(item)
                                                            );
                                                            setMessageMenuFor(null);
                                                        }
                                                    }}
                                                >

                                                    {selectedUser.isGroup && !own && (
                                                        <strong className="group-message-sender">
                                                            {item.senderName ||
                                                                getUserName(item.sender)}
                                                            {item.sender?.isVerified && (
                                                                <VerifiedBadge className="verified-badge-small" />
                                                            )}
                                                        </strong>
                                                    )}

                                                    {(item.forwardedFrom ||
                                                        item.isForwarded) && (
                                                        <span className="forwarded-message-label">
                                                            <FaShare aria-hidden="true" />
                                                            Forwarded
                                                        </span>
                                                    )}

                                                    {item.replyTo && (

                                                        <div className="reply-quote">

                                                            <strong>

                                                                {getUserName(
                                                                    item.replyTo.sender
                                                                )}

                                                            </strong>

                                                            <span>

                                                                {getMessageText(
                                                                    item.replyTo
                                                                ) ||
                                                                    (
                                                                        item.replyTo.fileUrl
                                                                            ? "📎 Attachment"
                                                                            : ""
                                                                    )}

                                                            </span>

                                                        </div>

                                                    )}


                                                    {fileUrl && item.encryptedMedia ? (
                                                        <EncryptedMediaAttachment
                                                            url={fileUrl}
                                                            media={item.encryptedMedia}
                                                            own={own}
                                                        />
                                                    ) : fileUrl && (

                                                        isAudioFile ? (

                                                            <VoiceMessagePlayer
                                                                url={fileUrl}
                                                                own={own}
                                                            />

                                                        ) : isImageFile ? (

                                                            mediaRevealed ? (

                                                                <a
                                                                    href={
                                                                        fileUrl
                                                                    }
                                                                    download={
                                                                        fileName
                                                                    }
                                                                    onClick={
                                                                        event =>
                                                                            handleAttachmentDownload(
                                                                                event,
                                                                                fileUrl,
                                                                                fileName
                                                                            )
                                                                    }
                                                                    title="Click to download"
                                                                >
                                                                    <img
                                                                        src={
                                                                            fileUrl
                                                                        }
                                                                        alt={
                                                                            fileName
                                                                        }
                                                                        className="message-attachment-image"
                                                                    />
                                                                </a>

                                                            ) : (

                                                                <button
                                                                    type="button"
                                                                    className="message-attachment-file"
                                                                    onClick={() =>

                                                                        setRevealedMedia(
                                                                            previous => {

                                                                                const next =
                                                                                    new Set(
                                                                                        previous
                                                                                    );

                                                                                next.add(
                                                                                    attachmentKey
                                                                                );

                                                                                return next;

                                                                            }
                                                                        )

                                                                    }
                                                                >
                                                                    <FaImage />
                                                                    <span>
                                                                        Tap to load image
                                                                    </span>
                                                                </button>

                                                            )

                                                        ) : (

                                                            <a
                                                                href={
                                                                    fileUrl
                                                                }
                                                                download={
                                                                    fileName
                                                                }
                                                                onClick={
                                                                    event =>
                                                                        handleAttachmentDownload(
                                                                            event,
                                                                            fileUrl,
                                                                            fileName
                                                                        )
                                                                }
                                                                className="message-attachment-file"
                                                                title="Click to download"
                                                            >
                                                                <FaPaperclip />
                                                                <span>
                                                                    {fileName}
                                                                </span>
                                                            </a>

                                                        )

                                                    )}


                                                    {item.isDeleted ? (

                                                        <p className="message-deleted-text">
                                                            🚫 This message was deleted
                                                        </p>

                                                    ) : getMessageId(item) ===
                                                      getMessageId(editingMessage) ? (

                                                        <div className="message-edit-box">

                                                            <input
                                                                type="text"
                                                                value={editText}
                                                                autoFocus
                                                                onChange={event =>
                                                                    setEditText(
                                                                        event.target.value
                                                                    )
                                                                }
                                                                onKeyDown={event => {

                                                                    if (
                                                                        event.key ===
                                                                        "Enter"
                                                                    ) {
                                                                        handleEditSave();
                                                                    }

                                                                    if (
                                                                        event.key ===
                                                                        "Escape"
                                                                    ) {
                                                                        setEditingMessage(
                                                                            null
                                                                        );
                                                                    }

                                                                }}
                                                            />

                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    handleEditSave
                                                                }
                                                            >
                                                                ✓
                                                            </button>

                                                        </div>

                                                    ) : (

                                                        item.type === "call-log" ? (
                                                            <CallLogMessage
                                                                callType={item.callType}
                                                                callStatus={item.callStatus}
                                                                callDuration={item.callDuration}
                                                                isGroup={Boolean(item.groupId)}
                                                                participantCount={item.callParticipantCount}
                                                            />
                                                        ) : location ? (
                                                            <div className="message-location-card">
                                                                <span className="message-location-icon">
                                                                    <FaMapMarkerAlt />
                                                                </span>
                                                                <div>
                                                                    <strong>Approximate location</strong>
                                                                    <span>
                                                                        {location.latitude.toFixed(4)},{" "}
                                                                        {location.longitude.toFixed(4)}
                                                                    </span>
                                                                    <a
                                                                        href={location.mapUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        Open in Google Maps
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            text && (
                                                                <p>
                                                                    {text}
                                                                    {item.isEdited && (
                                                                        <span className="edited-tag">
                                                                            {" "}(edited)
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            )
                                                        )

                                                    )}


                                                    <div className="message-meta">

                                                        <button
                                                            type="button"
                                                            className="message-reply-btn"
                                                            title="More message options"
                                                            aria-label="More message options"
                                                            aria-haspopup="menu"
                                                            aria-expanded={
                                                                messageMenuFor ===
                                                                getMessageId(item)
                                                            }
                                                            onClick={() => {
                                                                const messageId =
                                                                    getMessageId(item);
                                                                setMessageMenuFor(
                                                                    messageMenuFor ===
                                                                        messageId
                                                                        ? null
                                                                        : messageId
                                                                );
                                                                setMessageDeleteFor(null);
                                                            }}
                                                        >
                                                            <FaEllipsisH />
                                                        </button>

                                                        {messageMenuFor ===
                                                            getMessageId(item) && (
                                                            <div
                                                                className="message-actions-menu"
                                                                role="menu"
                                                                aria-label="Message actions"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    role="menuitem"
                                                                    onClick={() => {
                                                                        setReplyingTo(item);
                                                                        setMessageMenuFor(null);
                                                                    }}
                                                                >
                                                                    <span aria-hidden="true">↩</span>
                                                                    Reply
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    role="menuitem"
                                                                    disabled={
                                                                        item.isDeleted ||
                                                                        item.decryptionFailed
                                                                    }
                                                                    onClick={() => {
                                                                        setForwardingMessage(item);
                                                                        setForwardSearch("");
                                                                        setForwardSentTo(new Set());
                                                                        setMessageMenuFor(null);
                                                                    }}
                                                                >
                                                                    <FaShare aria-hidden="true" />
                                                                    Forward
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    role="menuitem"
                                                                    disabled={item.isDeleted}
                                                                    onClick={() => {
                                                                        setReactionPickerFor(
                                                                            getMessageId(item)
                                                                        );
                                                                        setMessageMenuFor(null);
                                                                    }}
                                                                >
                                                                    <span aria-hidden="true">😊</span>
                                                                    React
                                                                </button>
                                                                {own &&
                                                                    !item.isDeleted &&
                                                                    item.type !== "call-log" && (
                                                                        <button
                                                                            type="button"
                                                                            role="menuitem"
                                                                            onClick={() => {
                                                                                setEditingMessage(item);
                                                                                setEditText(
                                                                                    getMessageText(item)
                                                                                );
                                                                                setMessageMenuFor(null);
                                                                            }}
                                                                        >
                                                                            <span aria-hidden="true">✎</span>
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                {!item.isDeleted && (
                                                                    <button
                                                                        type="button"
                                                                        role="menuitem"
                                                                        onClick={() => {
                                                                            setMessageDeleteFor(
                                                                                getMessageId(item)
                                                                            );
                                                                            setMessageMenuFor(null);
                                                                        }}
                                                                    >
                                                                        <FaTrash aria-hidden="true" />
                                                                        Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}


                                                        {reactionPickerFor ===
                                                            getMessageId(item) && (

                                                            <div className="reaction-picker">

                                                                {REACTION_EMOJIS.map(
                                                                    emoji => (

                                                                        <button
                                                                            key={emoji}
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleReact(
                                                                                    item,
                                                                                    emoji
                                                                                )
                                                                            }
                                                                        >
                                                                            {emoji}
                                                                        </button>

                                                                    )
                                                                )}

                                                            </div>

                                                        )}


                                                        <>
                                                            {!item.isDeleted &&
                                                                messageDeleteFor === getMessageId(item) && (
                                                                <div className="message-delete-options">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setMessageDeleteFor(null);
                                                                            setDeleteConfirmation({
                                                                                item,
                                                                                deleteFor: "me"
                                                                            });
                                                                        }}
                                                                    >
                                                                        Delete for me
                                                                    </button>
                                                                    {own && (
                                                                        <button
                                                                            type="button"
                                                                            disabled={!canDeleteForEveryone}
                                                                            title={
                                                                                canDeleteForEveryone
                                                                                    ? "Delete this message for both people"
                                                                                    : "Delete for everyone is only available for 15 minutes"
                                                                            }
                                                                            onClick={() => {
                                                                                setMessageDeleteFor(null);
                                                                                setDeleteConfirmation({
                                                                                    item,
                                                                                    deleteFor: "everyone"
                                                                                });
                                                                            }}
                                                                        >
                                                                            Delete for everyone
                                                                        </button>
                                                                    )}
                                                                    {!canDeleteForEveryone && own && (
                                                                        <small>
                                                                            15-minute limit passed
                                                                        </small>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>


                                                        <small>
                                                            {formatTime(
                                                                time
                                                            )}
                                                        </small>


                                                        {own && (
                                                            <span
                                                                className={
                                                                    `message-status ${
                                                                        seen
                                                                            ? "status-seen"
                                                                            : delivered
                                                                            ? "status-delivered"
                                                                            : "status-sent"
                                                                    }`
                                                                }
                                                                title={
                                                                    seen
                                                                        ? "Seen"
                                                                        : delivered
                                                                        ? "Delivered"
                                                                        : "Sent"
                                                                }
                                                            >

                                                                {(
                                                                    seen ||
                                                                    delivered
                                                                ) ? (
                                                                    <FaCheckDouble />
                                                                ) : (
                                                                    <FaCheck />
                                                                )}

                                                            </span>
                                                        )}

                                                    </div>


                                                    {item.reactions &&
                                                        item.reactions.length >
                                                            0 && (

                                                        <div className="message-reactions">

                                                            {Object.entries(
                                                                item.reactions.reduce(
                                                                    (acc, r) => {

                                                                        acc[r.emoji] =
                                                                            (acc[r.emoji] || 0) + 1;

                                                                        return acc;

                                                                    },
                                                                    {}
                                                                )
                                                            ).map(
                                                                ([emoji, count]) => (

                                                                    <span
                                                                        key={emoji}
                                                                        className="reaction-badge"
                                                                    >
                                                                        {emoji}
                                                                        {count > 1 && (
                                                                            <small>
                                                                                {count}
                                                                            </small>
                                                                        )}
                                                                    </span>

                                                                )
                                                            )}

                                                        </div>

                                                    )}

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

                        </section>


                        {isConversationBlocked ? (

                            <div className="blocked-banner">

                                <FaBan />

                                <span>

                                    {iBlockedThem
                                        ? `You blocked ${getUserName(selectedUser)}.`
                                        : `You can't message this user.`}

                                </span>

                                {iBlockedThem && (

                                    <button
                                        type="button"
                                        onClick={
                                            handleBlockToggle
                                        }
                                    >
                                        Unblock
                                    </button>

                                )}

                            </div>

                        ) : (

                        <>

                        {replyingTo && (

                            <div className="reply-preview-bar">

                                <div className="reply-preview-content">

                                    <strong>
                                        Replying to{" "}
                                        {getMessageSenderId(replyingTo) === currentUserId
                                            ? "yourself"
                                            : getUserName(selectedUser)}
                                    </strong>

                                    <span>
                                        {getMessageText(replyingTo) ||
                                            (replyingTo.fileUrl ? "📎 Attachment" : "")}
                                    </span>

                                </div>

                                <button
                                    type="button"
                                    onClick={() => setReplyingTo(null)}
                                >
                                    <FaTimes />
                                </button>

                            </div>

                        )}

                        <form
                            className="message-form"
                            onSubmit={
                                sendMessage
                            }
                        >

                        {isRecording ? (

                            <div className="voice-recording-bar">

                                <button
                                    type="button"
                                    className="voice-cancel-btn"
                                    title="Cancel"
                                    onClick={
                                        cancelRecording
                                    }
                                >
                                    <FaTrash />
                                </button>

                                <div className="voice-recording-indicator">

                                    <span className="recording-dot" />

                                    {formatDuration(
                                        recordingSeconds
                                    )}

                                </div>

                                <button
                                    type="button"
                                    className="send-message-btn"
                                    title="Send voice message"
                                    disabled={sendingVoice}
                                    onClick={
                                        stopAndSendRecording
                                    }
                                >
                                    <FaPaperPlane />
                                </button>

                            </div>

                        ) : (

                        <>

                            <div className="composer-actions">

                                <button
                                    type="button"
                                    title="Emoji"
                                    aria-label="Choose emoji"
                                    onClick={() =>
                                        setShowEmoji(
                                            value =>
                                                !value
                                        )
                                    }
                                >
                                    <FaSmile />
                                </button>


                                <button
                                    type="button"
                                    title="Attach image, audio, or document"
                                    aria-label="Attach image, audio, or document"
                                    disabled={
                                        !selectedUser ||
                                        isConversationBlocked
                                    }
                                    onClick={() =>
                                        fileInputRef
                                            .current
                                            ?.click()
                                    }
                                >
                                    <FaPaperclip />
                                </button>


                                <button
                                    type="button"
                                    title="Image"
                                    aria-label="Attach image"
                                    disabled={
                                        !selectedUser ||
                                        isConversationBlocked
                                    }
                                    onClick={() =>
                                        fileInputRef
                                            .current
                                            ?.click()
                                    }
                                >
                                    <FaImage />
                                </button>

                                <button
                                    type="button"
                                    title="Share approximate location"
                                    aria-label="Share approximate location"
                                    disabled={
                                        !selectedUser ||
                                        isConversationBlocked
                                    }
                                    onClick={shareCurrentLocation}
                                >
                                    <FaMapMarkerAlt />
                                </button>


                                <input
                                    ref={
                                        fileInputRef
                                    }
                                    type="file"
                                    hidden
                                    disabled={
                                        !selectedUser ||
                                        isConversationBlocked
                                    }
                                    accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
                                    aria-label="Attach an image, audio, or document"
                                    onChange={
                                        handleFile
                                    }
                                />

                            </div>


                            <div className="message-input-wrapper">

                                <textarea
                                    ref={messageInputRef}
                                    aria-label="Write a message"
                                    value={message}
                                    onChange={
                                        handleTyping
                                    }
                                    onKeyDown={
                                        event => {

                                            if (
                                                event.key === "Enter" &&
                                                settings.enterToSend &&
                                                !event.shiftKey &&
                                                !event.nativeEvent.isComposing
                                            ) {
                                                event.preventDefault();
                                                sendMessage(event);
                                            }

                                        }
                                    }
                                    rows={1}
                                    placeholder="Write a message..."
                                    autoComplete="off"
                                />

                            </div>


                            {message.trim() ? (

                                <button
                                    className="send-message-btn"
                                    type="submit"
                                    title="Send"
                                >
                                    <FaPaperPlane />
                                </button>

                            ) : (

                                <button
                                    type="button"
                                    className="send-message-btn mic-btn"
                                    title="Record voice message"
                                    disabled={
                                        sendingVoice ||
                                        startingVoiceRecording ||
                                        !selectedUser ||
                                        isConversationBlocked
                                    }
                                    onClick={
                                        startRecording
                                    }
                                >
                                    <FaMicrophone />
                                </button>

                            )}

                        </>

                        )}


                            {showEmoji && (
                                <div className="emoji-picker">

                                    <div className="emoji-header">

                                        <strong>
                                            Emoji
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
                                            emoji => (

                                                <button
                                                    key={
                                                        emoji
                                                    }
                                                    type="button"
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

                        </form>

                        </>

                        )}

                    </>

                )}

            </main>

            {showGroupCreator && (
                <div
                    className="group-modal-overlay"
                    onClick={() => setShowGroupCreator(false)}
                >
                    <form
                        className="group-modal"
                        onSubmit={createGroup}
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="group-modal-header">
                            <div>
                                <strong>Create a group</strong>
                                <span>Start a conversation with your people.</span>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setShowGroupCreator(false)}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="group-modal-body">
                            <label className="group-name-field">
                                <span>Group name</span>
                                <input
                                    value={groupName}
                                    maxLength={80}
                                    onChange={event => setGroupName(event.target.value)}
                                    placeholder="e.g. Weekend plans"
                                    autoFocus
                                />
                            </label>
                            <div className="group-member-heading">
                                Add members <span>{groupMemberIds.length} selected</span>
                            </div>
                            <div className="group-member-options">
                                {users.map(member => {
                                    const memberId = getId(member);
                                    const checked = groupMemberIds.includes(memberId);

                                    return (
                                        <label key={memberId} className="group-member-option">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    setGroupMemberIds(previous =>
                                                        checked
                                                            ? previous.filter(id => id !== memberId)
                                                            : [...previous, memberId]
                                                    )
                                                }
                                            />
                                            <span>{getUserName(member)}</span>
                                        </label>
                                    );
                                })}
                                {users.length === 0 && (
                                    <p className="group-empty-members">
                                        No people are available to add yet.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="group-modal-footer">
                            <button
                                type="button"
                                className="group-secondary-btn"
                                onClick={() => setShowGroupCreator(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="group-primary-btn"
                                disabled={!groupName.trim() || !groupMemberIds.length}
                            >
                                <FaUsers /> Create group
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showGroupDetails && selectedUser?.isGroup && (
                <div
                    className="group-modal-overlay"
                    onClick={() => setShowGroupDetails(false)}
                >
                    <div
                        className="group-modal"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="group-modal-header">
                            <div>
                                <strong>{getUserName(selectedUser)}</strong>
                                <span>
                                    {selectedUser.participants?.length || 0} group members
                                </span>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setShowGroupDetails(false)}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="group-modal-body">
                            <section className="group-encryption-panel">
                                <strong>
                                    {selectedUser.isEncrypted
                                        ? "End-to-end encryption is on"
                                        : "End-to-end encryption is off"}
                                </strong>
                                <p>
                                    Group text is encrypted separately for each member.
                                    Messages sent before encryption was enabled remain
                                    unchanged, and new members cannot decrypt older
                                    encrypted messages.
                                    Attachments and voice notes are encrypted
                                    client-side too. Voice/video calls are not
                                    end-to-end encrypted.
                                </p>
                                {selectedUser.isEncrypted && (
                                    <div className="group-encryption-fingerprint">
                                        <span>Group verification code</span>
                                        <code>
                                            {groupEncryptionSafetyCode ||
                                                groupEncryptionSafetyError ||
                                                "Verifying member keys..."}
                                        </code>
                                        <small>
                                            Compare this full code with every member
                                            through a trusted channel.
                                        </small>
                                    </div>
                                )}
                                {selectedUser.admins?.some(
                                    admin => getId(admin) === currentUserId
                                ) && (
                                    <button
                                        type="button"
                                        className="group-primary-btn"
                                        disabled={groupEncryptionBusy}
                                        onClick={toggleGroupEncryption}
                                    >
                                        <FaLock />
                                        {groupEncryptionBusy
                                            ? "Updating encryption..."
                                            : selectedUser.isEncrypted
                                            ? "Turn off for new messages"
                                            : "Enable group text encryption"}
                                    </button>
                                )}
                                {groupEncryptionMessage && (
                                    <p
                                        className="group-encryption-status"
                                        role="status"
                                    >
                                        {groupEncryptionMessage}
                                    </p>
                                )}
                            </section>
                            <div className="group-member-heading">
                                Members
                                {selectedUser.admins?.some(
                                    admin => getId(admin) === currentUserId
                                ) && <span>Admin</span>}
                            </div>
                            <div className="group-member-options">
                                {(selectedUser.participants || []).map(member => {
                                    const memberId = getId(member);
                                    const isAdmin = selectedUser.admins?.some(
                                        admin => getId(admin) === memberId
                                    );
                                    const currentIsAdmin = selectedUser.admins?.some(
                                        admin => getId(admin) === currentUserId
                                    );

                                    return (
                                        <div key={memberId} className="group-member-option">
                                            <span>
                                                {getUserName(member)}
                                                {memberId === currentUserId ? " (You)" : ""}
                                                {isAdmin ? " · Admin" : ""}
                                            </span>
                                            {currentIsAdmin && memberId !== currentUserId && (
                                                <button
                                                    type="button"
                                                    className="group-remove-member"
                                                    onClick={() => {
                                                        if (window.confirm(
                                                            `Remove ${getUserName(member)} from this group?`
                                                        )) {
                                                            removeGroupMember(memberId);
                                                        }
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedUser.admins?.some(
                                admin => getId(admin) === currentUserId
                            ) && (
                                <>
                                    <div className="group-member-heading">
                                        Add people
                                    </div>
                                    <div className="group-member-options compact">
                                        {users
                                            .filter(member =>
                                                !selectedUser.participants?.some(
                                                    participant =>
                                                        getId(participant) === getId(member)
                                                )
                                            )
                                            .map(member => {
                                                const memberId = getId(member);
                                                const checked =
                                                    groupMemberSelection.includes(memberId);

                                                return (
                                                    <label
                                                        key={memberId}
                                                        className="group-member-option"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() =>
                                                                setGroupMemberSelection(previous =>
                                                                    checked
                                                                        ? previous.filter(
                                                                              id => id !== memberId
                                                                          )
                                                                        : [...previous, memberId]
                                                                )
                                                            }
                                                        />
                                                        <span>{getUserName(member)}</span>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                    <button
                                        type="button"
                                        className="group-primary-btn group-add-btn"
                                        disabled={!groupMemberSelection.length}
                                        onClick={updateGroupDetails}
                                    >
                                        <FaUserPlus /> Add selected members
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="group-modal-footer">
                            <button
                                type="button"
                                className="group-secondary-btn"
                                onClick={() => setShowGroupDetails(false)}
                            >
                                Done
                            </button>
                            <button
                                type="button"
                                className="group-leave-btn"
                                onClick={leaveGroup}
                            >
                                Leave group
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {incomingGroupCall && !activeGroupCall && (
                <div className="group-call-invite" role="alertdialog" aria-live="assertive">
                    <div className="group-call-invite-icon">
                        {incomingGroupCall.type === "video" ? <FaVideo /> : <FaPhone />}
                    </div>
                    <div className="group-call-invite-copy">
                        <strong>{incomingGroupCall.groupName || "Group call"}</strong>
                        <span>
                            {incomingGroupCall.callerName || "A group member"} started a{" "}
                            {incomingGroupCall.type === "video" ? "video" : "voice"} call
                        </span>
                    </div>
                    <button
                        type="button"
                        className="group-call-invite-decline"
                        onClick={() => setIncomingGroupCall(null)}
                    >
                        Decline
                    </button>
                    <button
                        type="button"
                        className="group-call-invite-join"
                        disabled={Boolean(callState)}
                        onClick={acceptGroupCall}
                    >
                        Join
                    </button>
                </div>
            )}

            {activeGroupCall && (
                <GroupCallModal
                    group={activeGroupCall.group}
                    currentUser={user}
                    type={activeGroupCall.type}
                    callId={activeGroupCall.callId}
                    onConnected={announceGroupCall}
                    onClose={closeGroupCall}
                />
            )}

           <CallModal
    visible={Boolean(callState)}

    type={
        callState?.type || "audio"
    }

    mode={
        callState?.mode || "outgoing"
    }

    status={
        callState?.status || "calling"
    }

    callerName={
        callState?.mode === "incoming"
            ? (
                callState?.callerName ||
                callState?.senderName ||
                getUserName(
                    users.find(
                        u =>
                            getId(u) ===
                            getId(callState?.callerId)
                    )
                )
            )
            : (
                callState?.receiverName ||
                callState?.calleeName ||
                getUserName(selectedUser) ||
                getUserName(
                    users.find(
                        u =>
                            getId(u) ===
                            getId(callState?.receiverId)
                    )
                )
            )
    }

    callerAvatar={
        getUploadUrl(
            callState?.mode === "incoming"
                ? (
                    callState?.callerAvatar ||
                    callState?.senderAvatar ||
                    getAvatar(
                        users.find(
                            u =>
                                getId(u) ===
                                getId(callState?.callerId)
                        )
                    ) ||
                    ""
                )
                : (
                    callState?.receiverAvatar ||
                    callState?.calleeAvatar ||
                    getAvatar(selectedUser) ||
                    getAvatar(
                        users.find(
                            u =>
                                getId(u) ===
                                getId(callState?.receiverId)
                        )
                    ) ||
                    ""
                )
        )
    }

    localStream={
        localStream
    }

    remoteStream={
        remoteStream
    }

    callDuration={
        callDuration
    }

    onAccept={
        acceptCall
    }

    onReject={
        rejectCall
    }

    onEnd={
        endCall
    }

    onSwitchCamera={
        switchCamera
    }
/>

{deleteConfirmation && (
    <div
        className="message-delete-dialog-overlay"
        onMouseDown={event => {
            if (event.target === event.currentTarget && !deletingMessage) {
                setDeleteConfirmation(null);
            }
        }}
        onKeyDown={event => {
            if (event.key === "Escape" && !deletingMessage) {
                setDeleteConfirmation(null);
            }
        }}
    >
        <section
            className={`message-delete-dialog ${
                deleteConfirmation.deleteFor === "everyone"
                    ? "delete-everyone"
                    : "delete-for-me"
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="message-delete-title"
            aria-describedby="message-delete-description"
        >
            <div className="message-delete-dialog-icon" aria-hidden="true">
                <FaTrash />
            </div>
            <span className="message-delete-dialog-eyebrow">
                Confirm message deletion
            </span>
            <h2 id="message-delete-title">
                {deleteConfirmation.deleteFor === "everyone"
                    ? "Delete for everyone?"
                    : "Delete for you?"}
            </h2>
            <p id="message-delete-description">
                {deleteConfirmation.deleteFor === "everyone"
                    ? "This message will be removed for everyone in this chat. This action cannot be undone."
                    : "This message will disappear from your chat. Other people in the conversation can still see it."}
            </p>
            <div className="message-delete-dialog-actions">
                <button
                    type="button"
                    className="message-delete-cancel"
                    autoFocus
                    disabled={deletingMessage}
                    onClick={() => setDeleteConfirmation(null)}
                >
                    Keep message
                </button>
                <button
                    type="button"
                    className="message-delete-confirm"
                    disabled={deletingMessage}
                    onClick={() =>
                        handleDeleteMessage(
                            deleteConfirmation.item,
                            deleteConfirmation.deleteFor
                        )
                    }
                >
                    {deletingMessage
                        ? "Deleting…"
                        : deleteConfirmation.deleteFor === "everyone"
                            ? "Delete for everyone"
                            : "Delete for me"}
                </button>
            </div>
        </section>
    </div>
)}

{forwardingMessage && (

    <div className="forward-modal-overlay">

        <div className="forward-modal">

            <div className="forward-modal-header">

                <strong>Forward message</strong>

                <button
                    type="button"
                    onClick={() =>
                        setForwardingMessage(null)
                    }
                >
                    <FaTimes />
                </button>

            </div>

            <div className="forward-modal-search">

                <FaSearch />

                <input
                    type="text"
                    autoFocus
                    value={forwardSearch}
                    onChange={event =>
                        setForwardSearch(event.target.value)
                    }
                    placeholder="Search people..."
                />

            </div>

            <div className="forward-modal-list">

                {users
                    .filter(target =>
                        getUserName(target)
                            .toLowerCase()
                            .includes(
                                forwardSearch.trim().toLowerCase()
                            )
                    )
                    .map(target => {

                        const targetId = getId(target);
                        const sent = forwardSentTo.has(targetId);

                        return (
                            <div
                                key={targetId}
                                className="forward-modal-row"
                            >

                                <div className="messenger-avatar">
                                    {renderAvatar(target)}
                                </div>

                                <span>{getUserName(target)}</span>

                                <button
                                    type="button"
                                    disabled={sent || forwardSending}
                                    onClick={() =>
                                        handleForwardSend(target)
                                    }
                                >
                                    {sent ? "Sent" : "Send"}
                                </button>

                            </div>
                        );

                    })}

            </div>

        </div>

    </div>

)}


        </div>
    );
};


export default Messenger;
