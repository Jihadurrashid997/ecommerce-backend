import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    NativeModules,
    Platform,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    findNodeHandle
} from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    MediaStream,
    RTCView,
    ScreenCapturePickerView
} from "react-native-webrtc";
import { api, getErrorMessage } from "./src/api";
import {
    CallUser,
    DirectCallService,
    DirectCallSnapshot
} from "./src/calls/DirectCallService";

const TOKEN_KEY = "jr-mobile-token";
const USER_KEY = "jr-mobile-user";
const DEVICE_ID_KEY = "jr-mobile-device-id";

const createDeviceId = () =>
    Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join("");

const getUserId = (user: CallUser | null) =>
    String(user?._id || user?.id || "");

const getDisplayName = (user: CallUser) =>
    user.name || user.username || "Messenger contact";

const getCallStatus = (call: DirectCallSnapshot["call"]) => {
    if (!call) {
        return "";
    }
    if (call.mode === "incoming") {
        return `Incoming ${call.type} call`;
    }
    if (call.mode === "outgoing") {
        return "Calling…";
    }
    if (call.status === "connected") {
        return call.type === "video" ? "Video call" : "Voice call";
    }
    return "Connecting…";
};

const callService = new DirectCallService();

export default function App() {
    const [user, setUser] = useState<CallUser | null>(null);
    const [token, setToken] = useState("");
    const [callState, setCallState] = useState<DirectCallSnapshot>({
        connected: false,
        call: null,
        localStream: null,
        remoteStream: null,
        screenStream: null,
        muted: false,
        sharingScreen: false,
        error: ""
    });
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [search, setSearch] = useState("");
    const [contacts, setContacts] = useState<CallUser[]>([]);
    const [busy, setBusy] = useState(false);
    const [screenError, setScreenError] = useState("");
    const pickerRef =
        useRef<React.ComponentRef<typeof ScreenCapturePickerView>>(null);

    useEffect(() => {
        let mounted = true;
        const restoreSession = async () => {
            try {
                const [savedToken, savedUser] = await Promise.all([
                    SecureStore.getItemAsync(TOKEN_KEY),
                    SecureStore.getItemAsync(USER_KEY)
                ]);
                if (!mounted || !savedToken || !savedUser) {
                    return;
                }
                setToken(savedToken);
                setUser(JSON.parse(savedUser) as CallUser);
            } catch (error) {
                if (mounted) {
                    setScreenError(
                        getErrorMessage(error, "Could not restore your sign-in.")
                    );
                }
            }
        };
        void restoreSession();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!user || !token) {
            return undefined;
        }
        const unsubscribe = callService.subscribe(setCallState);
        callService.connect(user, token);
        return () => {
            unsubscribe();
            callService.disconnect();
        };
    }, [user, token]);

    useEffect(() => {
        if (!user || !token) {
            return undefined;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const response = await api.get("/users/chat-users", {
                    params: { q: search.trim(), page: 1, limit: 50 },
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!cancelled) {
                    setContacts(response.data?.users || []);
                }
            } catch (error) {
                if (!cancelled) {
                    setScreenError(
                        getErrorMessage(error, "Could not load Messenger contacts.")
                    );
                }
            }
        }, search.trim() ? 250 : 0);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [search, token, user]);

    const localPreview = useMemo<MediaStream | null>(
        () => callState.screenStream || callState.localStream,
        [callState.localStream, callState.screenStream]
    );

    const handleLogin = async () => {
        setBusy(true);
        setScreenError("");
        try {
            let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
            if (!deviceId) {
                deviceId = createDeviceId();
                await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
            }
            const response = await api.post("/auth/login", {
                email: email.trim(),
                password,
                deviceId,
                deviceName: `JR Messenger (${Platform.OS})`
            });
            const data = response.data || {};
            const authToken =
                data.token ||
                data.accessToken ||
                data.data?.token ||
                data.data?.accessToken;
            const authenticatedUser =
                data.user || data.data?.user || data.data;
            if (!authToken || !getUserId(authenticatedUser)) {
                throw new Error("The server returned an invalid sign-in response.");
            }
            await Promise.all([
                SecureStore.setItemAsync(TOKEN_KEY, authToken),
                SecureStore.setItemAsync(
                    USER_KEY,
                    JSON.stringify(authenticatedUser)
                )
            ]);
            setToken(authToken);
            setUser(authenticatedUser);
            setPassword("");
        } catch (error) {
            setScreenError(getErrorMessage(error, "Could not sign in."));
        } finally {
            setBusy(false);
        }
    };

    const handleLogout = async () => {
        callService.disconnect();
        await Promise.all([
            SecureStore.deleteItemAsync(TOKEN_KEY),
            SecureStore.deleteItemAsync(USER_KEY)
        ]);
        setToken("");
        setUser(null);
        setContacts([]);
    };

    const runCallAction = async (action: () => Promise<void>) => {
        setScreenError("");
        try {
            await action();
        } catch (error) {
            setScreenError(
                error instanceof Error ? error.message : "The call action failed."
            );
        }
    };

    const openIosScreenPicker = () => {
        const reactTag = findNodeHandle(pickerRef.current);
        const pickerManager = NativeModules.ScreenCapturePickerViewManager;
        if (!reactTag || typeof pickerManager?.show !== "function") {
            throw new Error("The iOS screen broadcast picker is unavailable.");
        }
        pickerManager.show(reactTag);
    };

    const handleScreenShare = () =>
        runCallAction(() =>
            callState.sharingScreen
                ? callService.stopScreenShare()
                : callService.startScreenShare(openIosScreenPicker)
        );

    const handleAcceptCall = () =>
        runCallAction(() => callService.acceptCall());

    const handleStartCall = (contact: CallUser, type: "audio" | "video") =>
        runCallAction(() => callService.startCall(contact, type));

    const renderContact = ({ item }: { item: CallUser }) => (
        <View style={styles.contactRow}>
            <View style={styles.contactIdentity}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {getDisplayName(item).slice(0, 1).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.contactCopy}>
                    <Text style={styles.contactName}>{getDisplayName(item)}</Text>
                    <Text style={styles.contactHandle}>
                        {item.username ? `@${item.username}` : "Messenger contact"}
                    </Text>
                </View>
            </View>
            <View style={styles.contactActions}>
                <Pressable
                    accessibilityLabel={`Voice call ${getDisplayName(item)}`}
                    disabled={!callState.connected}
                    onPress={() => handleStartCall(item, "audio")}
                    style={[
                        styles.smallAction,
                        !callState.connected && styles.disabledAction
                    ]}
                >
                    <Text style={styles.smallActionText}>Call</Text>
                </Pressable>
                <Pressable
                    accessibilityLabel={`Video call ${getDisplayName(item)}`}
                    disabled={!callState.connected}
                    onPress={() => handleStartCall(item, "video")}
                    style={[
                        styles.smallAction,
                        styles.videoAction,
                        !callState.connected && styles.disabledAction
                    ]}
                >
                    <Text style={styles.smallActionText}>Video</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" />
            {Platform.OS === "ios" && (
                <View style={styles.pickerHost} pointerEvents="none">
                    <ScreenCapturePickerView ref={pickerRef} />
                </View>
            )}

            {user && callState.call ? (
                <View style={styles.callScreen}>
                    <View style={styles.callHeading}>
                        <Text style={styles.eyebrow}>JR MESSENGER CALL</Text>
                        <Text style={styles.callName}>
                            {callState.call.mode === "outgoing"
                                ? callState.call.receiverName
                                : callState.call.callerName}
                        </Text>
                        <Text style={styles.callStatus}>
                            {getCallStatus(callState.call)}
                        </Text>
                    </View>

                    <View style={styles.videoStage}>
                        {callState.remoteStream ? (
                            <RTCView
                                streamURL={callState.remoteStream.toURL()}
                                objectFit="cover"
                                style={styles.remoteVideo}
                            />
                        ) : (
                            <View style={styles.waitingStage}>
                                <View style={styles.largeAvatar}>
                                    <Text style={styles.largeAvatarText}>
                                        {(callState.call.mode === "outgoing"
                                            ? callState.call.receiverName
                                            : callState.call.callerName)
                                            .slice(0, 1)
                                            .toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.waitingText}>
                                    Waiting for the other person…
                                </Text>
                            </View>
                        )}
                        {localPreview && (
                            <RTCView
                                streamURL={localPreview.toURL()}
                                objectFit="cover"
                                mirror={!callState.sharingScreen}
                                style={styles.localVideo}
                            />
                        )}
                        {callState.sharingScreen && (
                            <View style={styles.sharingBadge}>
                                <Text style={styles.sharingBadgeText}>
                                    Sharing your screen
                                </Text>
                            </View>
                        )}
                    </View>

                    {callState.call.mode === "incoming" ? (
                        <View style={styles.incomingActions}>
                            <Pressable
                                onPress={() => callService.rejectCall()}
                                style={[styles.actionButton, styles.endButton]}
                            >
                                <Text style={styles.actionButtonText}>Decline</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleAcceptCall}
                                style={[styles.actionButton, styles.acceptButton]}
                            >
                                <Text style={styles.actionButtonText}>Accept</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.callActions}>
                            <Pressable
                                accessibilityLabel={
                                    callState.muted ? "Unmute microphone" : "Mute microphone"
                                }
                                onPress={() => callService.toggleMute()}
                                style={[
                                    styles.actionButton,
                                    callState.muted && styles.selectedAction
                                ]}
                            >
                                <Text style={styles.actionButtonText}>
                                    {callState.muted ? "Unmute" : "Mute"}
                                </Text>
                            </Pressable>
                            {callState.call.status === "connected" && (
                                <Pressable
                                    accessibilityLabel={
                                        callState.sharingScreen
                                            ? "Stop screen sharing"
                                            : "Share phone screen"
                                    }
                                    onPress={handleScreenShare}
                                    style={[
                                        styles.actionButton,
                                        callState.sharingScreen && styles.selectedAction
                                    ]}
                                >
                                    <Text style={styles.actionButtonText}>
                                        {callState.sharingScreen
                                            ? "Stop share"
                                            : "Share screen"}
                                    </Text>
                                </Pressable>
                            )}
                            <Pressable
                                onPress={() => callService.endCall()}
                                style={[styles.actionButton, styles.endButton]}
                            >
                                <Text style={styles.actionButtonText}>End call</Text>
                            </Pressable>
                        </View>
                    )}
                    {callState.sharingScreen && (
                        <Text style={styles.shareHint}>
                            Your phone is sharing its screen. Use the system screen
                            recording control to stop sharing at any time.
                        </Text>
                    )}
                    {!!(screenError || callState.error) && (
                        <Text accessibilityRole="alert" style={styles.error}>
                            {screenError || callState.error}
                        </Text>
                    )}
                </View>
            ) : user ? (
                <KeyboardAvoidingView
                    style={styles.main}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.eyebrow}>JR MESSENGER</Text>
                            <Text style={styles.title}>
                                Hello, {getDisplayName(user)}
                            </Text>
                        </View>
                        <Pressable onPress={handleLogout} style={styles.logoutButton}>
                            <Text style={styles.logoutText}>Sign out</Text>
                        </Pressable>
                    </View>
                    <View style={styles.connectionRow}>
                        <View
                            style={[
                                styles.connectionDot,
                                callState.connected && styles.connectionDotOnline
                            ]}
                        />
                        <Text style={styles.connectionText}>
                            {callState.connected
                                ? "Ready for calls"
                                : "Connecting to calls…"}
                        </Text>
                    </View>
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Find a Messenger contact"
                        placeholderTextColor="#718096"
                        autoCapitalize="none"
                        style={styles.searchInput}
                    />
                    <Text style={styles.sectionTitle}>Contacts</Text>
                    {contacts.length ? (
                        <FlatList
                            data={contacts}
                            keyExtractor={contact => getUserId(contact)}
                            renderItem={renderContact}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.contactList}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>
                                {search ? "No contacts found" : "No chat contacts yet"}
                            </Text>
                            <Text style={styles.emptyCopy}>
                                Calls are available with people in your Messenger contacts.
                            </Text>
                        </View>
                    )}
                    {!!(screenError || callState.error) && (
                        <Text accessibilityRole="alert" style={styles.error}>
                            {screenError || callState.error}
                        </Text>
                    )}
                </KeyboardAvoidingView>
            ) : (
                <KeyboardAvoidingView
                    style={styles.signIn}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <View style={styles.brandMark}>
                        <Text style={styles.brandMarkText}>JR</Text>
                    </View>
                    <Text style={styles.eyebrow}>JR MESSENGER</Text>
                    <Text style={styles.title}>Calls on your phone</Text>
                    <Text style={styles.subtitle}>
                        Sign in to call Messenger contacts and share your full phone
                        screen during a call.
                    </Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        placeholderTextColor="#718096"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        style={styles.input}
                    />
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password"
                        placeholderTextColor="#718096"
                        secureTextEntry
                        autoComplete="password"
                        style={styles.input}
                    />
                    <Pressable
                        disabled={busy || !email.trim() || !password}
                        onPress={() => void handleLogin()}
                        style={[
                            styles.primaryButton,
                            (busy || !email.trim() || !password) &&
                                styles.disabledPrimaryButton
                        ]}
                    >
                        {busy ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Sign in</Text>
                        )}
                    </Pressable>
                    {!!screenError && (
                        <Text accessibilityRole="alert" style={styles.error}>
                            {screenError}
                        </Text>
                    )}
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#0b141a"
    },
    main: {
        flex: 1,
        paddingHorizontal: 22,
        paddingTop: 16
    },
    signIn: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 26,
        paddingBottom: 24
    },
    brandMark: {
        width: 58,
        height: 58,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        backgroundColor: "#087f72",
        marginBottom: 24
    },
    brandMarkText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 21
    },
    eyebrow: {
        color: "#53d4b8",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.8
    },
    title: {
        color: "#f4f7f8",
        fontSize: 30,
        fontWeight: "800",
        letterSpacing: -0.5,
        marginTop: 8
    },
    subtitle: {
        color: "#9db0b8",
        fontSize: 15,
        lineHeight: 23,
        marginTop: 12,
        marginBottom: 28
    },
    input: {
        color: "#f4f7f8",
        borderColor: "#34434c",
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        backgroundColor: "#15232b"
    },
    primaryButton: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        backgroundColor: "#087f72",
        minHeight: 52,
        marginTop: 8
    },
    disabledPrimaryButton: {
        opacity: 0.55
    },
    primaryButtonText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 16
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    logoutButton: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 11,
        backgroundColor: "#1d2b33"
    },
    logoutText: {
        color: "#b8c5ca",
        fontWeight: "700",
        fontSize: 13
    },
    connectionRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 16,
        marginBottom: 20
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#77858b",
        marginRight: 9
    },
    connectionDotOnline: {
        backgroundColor: "#48cf8e"
    },
    connectionText: {
        color: "#9db0b8",
        fontSize: 13
    },
    searchInput: {
        color: "#f4f7f8",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#293941",
        backgroundColor: "#15232b",
        paddingHorizontal: 15,
        paddingVertical: 13,
        marginBottom: 22
    },
    sectionTitle: {
        color: "#eaf0f2",
        fontWeight: "800",
        fontSize: 16,
        marginBottom: 10
    },
    contactList: {
        paddingBottom: 24
    },
    contactRow: {
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#293941"
    },
    contactIdentity: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#274b55"
    },
    avatarText: {
        color: "#d8faf1",
        fontSize: 17,
        fontWeight: "800"
    },
    contactCopy: {
        flex: 1,
        marginLeft: 12
    },
    contactName: {
        color: "#eef4f5",
        fontWeight: "700",
        fontSize: 14
    },
    contactHandle: {
        color: "#81949c",
        fontSize: 12,
        marginTop: 4
    },
    contactActions: {
        flexDirection: "row",
        marginLeft: 8
    },
    smallAction: {
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderRadius: 10,
        backgroundColor: "#087f72",
        marginLeft: 7
    },
    videoAction: {
        backgroundColor: "#34434c"
    },
    smallActionText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800"
    },
    disabledAction: {
        opacity: 0.45
    },
    emptyState: {
        alignItems: "center",
        padding: 28,
        borderRadius: 18,
        backgroundColor: "#15232b",
        marginTop: 16
    },
    emptyTitle: {
        color: "#eaf0f2",
        fontWeight: "700",
        fontSize: 16
    },
    emptyCopy: {
        color: "#93a5ac",
        fontSize: 13,
        lineHeight: 19,
        textAlign: "center",
        marginTop: 8
    },
    callScreen: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 18
    },
    callHeading: {
        alignItems: "center",
        paddingBottom: 20
    },
    callName: {
        color: "#f4f7f8",
        fontSize: 27,
        fontWeight: "800",
        marginTop: 9
    },
    callStatus: {
        color: "#9db0b8",
        marginTop: 5,
        fontSize: 14
    },
    videoStage: {
        flex: 1,
        minHeight: 280,
        overflow: "hidden",
        borderRadius: 24,
        backgroundColor: "#15232b"
    },
    remoteVideo: {
        ...StyleSheet.absoluteFill
    },
    waitingStage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    },
    largeAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#087f72",
        alignItems: "center",
        justifyContent: "center"
    },
    largeAvatarText: {
        color: "#fff",
        fontSize: 38,
        fontWeight: "800"
    },
    waitingText: {
        color: "#9db0b8",
        marginTop: 18
    },
    localVideo: {
        position: "absolute",
        top: 14,
        right: 14,
        width: 104,
        height: 148,
        borderRadius: 15,
        backgroundColor: "#0b141a"
    },
    sharingBadge: {
        position: "absolute",
        top: 14,
        left: 14,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 12,
        backgroundColor: "rgba(8,127,114,0.94)"
    },
    sharingBadgeText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 12
    },
    callActions: {
        flexDirection: "row",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 12,
        paddingTop: 22
    },
    incomingActions: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        paddingTop: 22
    },
    actionButton: {
        minWidth: 78,
        minHeight: 50,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 25,
        backgroundColor: "#34434c"
    },
    actionButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800"
    },
    selectedAction: {
        backgroundColor: "#087f72"
    },
    endButton: {
        backgroundColor: "#d83e4c"
    },
    acceptButton: {
        backgroundColor: "#159e62"
    },
    shareHint: {
        color: "#93a5ac",
        textAlign: "center",
        fontSize: 12,
        lineHeight: 18,
        marginTop: 14
    },
    error: {
        color: "#ffb4b4",
        textAlign: "center",
        marginTop: 12,
        lineHeight: 19
    },
    pickerHost: {
        position: "absolute",
        zIndex: -1,
        width: 44,
        height: 44,
        opacity: 0
    },
});
