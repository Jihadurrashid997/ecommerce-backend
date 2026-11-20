import { AppState, Platform } from "react-native";
import { io, Socket } from "socket.io-client";
import {
    MediaStream,
    MediaStreamTrack,
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    mediaDevices
} from "react-native-webrtc";
import {
    answerCall as answerNativeCall,
    addAudioRouteChangedListener,
    endCall as endNativeCall,
    failIncomingCallConnected,
    fulfillIncomingCallConnected,
    getAudioSession,
    getActiveCallSession,
    prepareAudioSessionForCall,
    reportCallEnded,
    reportIncomingCall,
    reportOutgoingCallConnected,
    setMuted as setNativeMuted,
    setAudioSessionPortOverride,
    setRTCAudioSessionConfiguration,
    startOutgoingCall
} from "expo-callkit-telecom";
import type {
    CallAnsweredEvent,
    CallEndedEvent,
    CallSession,
    IncomingCallEvent
} from "expo-callkit-telecom";

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    "https://ecommerce-api-9wc9.onrender.com/api";
const normalizedApiUrl = API_BASE_URL.replace(/\/+$/, "");
const SOCKET_URL = (
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    normalizedApiUrl.replace(/\/api$/, "")
).replace(/\/+$/, "");

const iceServers = [
    {
        urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302"
        ]
    },
    {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
    },
    {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
    },
    {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
    }
];

export interface CallUser {
    _id?: string;
    id?: string;
    name?: string;
    username?: string;
    profileImage?: string;
}

export interface DirectCall {
    roomId: string;
    callId?: string;
    callerId: string;
    receiverId: string;
    callerName: string;
    receiverName: string;
    callerAvatar?: string;
    type: "audio" | "video";
    status: string;
    mode: "incoming" | "outgoing" | "accepted" | "connected";
    nativeCallId?: string;
    nativeRequestId?: string;
}

export interface DirectCallSnapshot {
    connected: boolean;
    call: DirectCall | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    screenStream: MediaStream | null;
    muted: boolean;
    speakerEnabled: boolean;
    sharingScreen: boolean;
    error: string;
}

const emptySnapshot: DirectCallSnapshot = {
    connected: false,
    call: null,
    localStream: null,
    remoteStream: null,
    screenStream: null,
    muted: false,
    speakerEnabled: false,
    sharingScreen: false,
    error: ""
};

const getId = (user: CallUser | string | null | undefined): string => {
    if (typeof user === "string") {
        return user;
    }
    return String(user?._id || user?.id || "");
};

const getRoomId = (firstId: string, secondId: string) =>
    [firstId, secondId].sort().join("_");

export class DirectCallService {
    private socket: Socket | null = null;
    private currentUser: CallUser | null = null;
    private peer: RTCPeerConnection | null = null;
    private call: DirectCall | null = null;
    private localStream: MediaStream | null = null;
    private screenStream: MediaStream | null = null;
    private remoteTracks: MediaStreamTrack[] = [];
    private pendingCandidates: RTCIceCandidate[] = [];
    private hasReportedConnected = false;
    private appStateSubscription: { remove: () => void } | null = null;
    private audioRouteSubscription: { remove: () => void } | null = null;
    private pendingNativeAnswer: CallAnsweredEvent | null = null;
    private pendingNativeEnd: CallEndedEvent | null = null;
    private ignoredNativeEnds = new Set<string>();
    private snapshot: DirectCallSnapshot = { ...emptySnapshot };
    private listeners = new Set<(snapshot: DirectCallSnapshot) => void>();

    subscribe(listener: (snapshot: DirectCallSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    connect(user: CallUser, token: string) {
        const userId = getId(user);
        const pendingIncomingCall =
            this.call?.mode === "incoming" &&
            this.call.receiverId === userId
                ? this.call
                : null;
        this.disconnect();
        this.currentUser = user;
        if (!userId || !token) {
            throw new Error("Sign in again to connect to calls.");
        }
        if (pendingIncomingCall) {
            this.call = pendingIncomingCall;
            this.update({ call: pendingIncomingCall });
        }

        const socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            auth: { userId, token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });
        this.socket = socket;

        socket.on("connect", () => {
            socket.emit("app-state", AppState.currentState);
            socket.emit("user-online", userId);
            this.update({ connected: true, error: "" });
            if (this.pendingNativeEnd) {
                this.processPendingNativeEnd();
            } else if (this.pendingNativeAnswer) {
                void this.processPendingNativeAnswer();
            }
        });
        socket.on("disconnect", () => {
            this.update({ connected: false });
        });
        socket.on("connect_error", error => {
            this.update({
                connected: false,
                error: `Call service connection failed: ${error.message}`
            });
        });
        socket.on("incoming-call", data => {
            void this.handleIncomingCall(data);
        });
        socket.on("call-accepted", data => {
            void this.handleCallAccepted(data);
        });
        socket.on("call-connected", data => this.handleCallConnected(data));
        socket.on("call-rejected", data => this.finishCallFromServer(
            data?.reason === "not-connected"
                ? "You can only call a chat contact."
                : "The call was declined.",
            "declinedElsewhere"
        ));
        socket.on("call-busy", () =>
            this.finishCallFromServer("The other person is busy.", "unanswered")
        );
        socket.on("call-missed", () =>
            this.finishCallFromServer("The call was not answered.", "unanswered")
        );
        socket.on("call-ended", () =>
            this.finishCallFromServer("", "remoteEnded")
        );
        socket.on("webrtc-offer", data => {
            void this.handleOffer(data);
        });
        socket.on("webrtc-answer", data => {
            void this.handleAnswer(data);
        });
        socket.on("webrtc-ice-candidate", data => {
            void this.handleIceCandidate(data);
        });
        this.appStateSubscription = AppState.addEventListener(
            "change",
            state => socket.emit("app-state", state)
        );
        void getActiveCallSession()
            .then(session => {
                if (session?.origin === "incoming") {
                    this.handleNativeCallSession(session);
                }
            })
            .catch(error => {
                this.reportError(error, "Could not restore the system call.");
            });
    }

    disconnect() {
        this.appStateSubscription?.remove();
        this.appStateSubscription = null;
        this.clearMedia();
        this.socket?.removeAllListeners();
        this.socket?.disconnect();
        this.socket = null;
        this.currentUser = null;
        this.call = null;
        this.update({ ...emptySnapshot });
    }

    async startCall(target: CallUser, type: "audio" | "video") {
        const socket = this.socket;
        const userId = getId(this.currentUser);
        const receiverId = getId(target);
        if (!socket?.connected || !userId || !receiverId) {
            throw new Error("Wait for the call service to connect.");
        }
        if (this.call) {
            throw new Error("Finish the current call first.");
        }
        if (userId === receiverId) {
            throw new Error("You cannot call your own account.");
        }

        const call: DirectCall = {
            roomId: getRoomId(userId, receiverId),
            callerId: userId,
            receiverId,
            callerName: this.currentUser?.name || "User",
            receiverName: target.name || target.username || "User",
            type,
            status: "calling",
            mode: "outgoing"
        };
        try {
            setRTCAudioSessionConfiguration(type === "video");
            prepareAudioSessionForCall(type === "video");
            call.nativeCallId = await startOutgoingCall(
                {
                    id: receiverId,
                    displayName: call.receiverName,
                    ...(target.profileImage
                        ? { avatarUrl: target.profileImage }
                        : {})
                },
                { hasVideo: type === "video" }
            );
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: type === "video"
                    ? {
                        facingMode: "user",
                        width: 1280,
                        height: 720,
                        frameRate: 24
                    }
                    : false
            });
            this.localStream = stream;
            this.call = call;
            this.hasReportedConnected = false;
            this.update({
                call,
                localStream: stream,
                remoteStream: null,
                screenStream: null,
                muted: false,
                sharingScreen: false,
                error: ""
            });
            socket.emit("call-user", {
                ...call,
                status: "calling",
                callerAvatar: this.currentUser?.profileImage || "",
                receiverAvatar: target.profileImage || ""
            });
        } catch (error) {
            if (call.nativeCallId) {
                void reportCallEnded(call.nativeCallId, "failed");
            }
            this.finishCall("");
            throw error;
        }
    }

    async requestAcceptCall() {
        if (this.call?.nativeCallId) {
            await answerNativeCall(this.call.nativeCallId);
            return;
        }
        await this.acceptCall();
    }

    async acceptCall() {
        const call = this.call;
        const socket = this.socket;
        const userId = getId(this.currentUser);
        if (!call || call.mode !== "incoming" || !socket?.connected) {
            throw new Error("There is no incoming call to accept.");
        }

        try {
            setRTCAudioSessionConfiguration(call.type === "video");
            prepareAudioSessionForCall(call.type === "video");
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: call.type === "video"
                    ? { facingMode: "user", width: 1280, height: 720 }
                    : false
            });
            this.localStream = stream;
            this.call = { ...call, mode: "accepted", status: "accepted" };
            this.update({
                call: this.call,
                localStream: stream,
                remoteStream: null,
                error: ""
            });
            socket.emit("accept-call", {
                roomId: call.roomId,
                callerId: call.callerId,
                receiverId: userId,
                type: call.type,
                status: "accepted"
            });
        } catch (error) {
            if (call.nativeCallId && call.nativeRequestId) {
                void failIncomingCallConnected(
                    call.nativeCallId,
                    call.nativeRequestId
                );
            } else if (call.nativeCallId) {
                void reportCallEnded(call.nativeCallId, "failed");
            }
            this.finishCall("");
            throw error;
        }
    }

    rejectCall() {
        const call = this.call;
        const userId = getId(this.currentUser);
        if (call) {
            this.socket?.emit("reject-call", {
                callerId: call.callerId,
                receiverId: userId,
                roomId: call.roomId
            });
        }
        if (call?.nativeCallId) {
            this.ignoredNativeEnds.add(call.nativeCallId);
            void endNativeCall(call.nativeCallId);
        }
        this.finishCall("");
    }

    endCall() {
        if (this.call) {
            this.socket?.emit("end-call", {
                roomId: this.call.roomId,
                callId: this.call.callId
            });
        }
        if (this.call?.nativeCallId) {
            this.ignoredNativeEnds.add(this.call.nativeCallId);
            void endNativeCall(this.call.nativeCallId);
        }
        this.finishCall("");
    }

    toggleMute() {
        this.setMuted(!this.snapshot.muted);
    }

    toggleSpeaker() {
        if (!this.call || this.call.status !== "connected") {
            return;
        }

        const speakerEnabled = !this.snapshot.speakerEnabled;
        try {
            const configureForVideo =
                this.call.type === "video" && speakerEnabled;
            setRTCAudioSessionConfiguration(configureForVideo);
            prepareAudioSessionForCall(configureForVideo);
            setAudioSessionPortOverride(speakerEnabled);
            this.update({ speakerEnabled, error: "" });
        } catch (error) {
            this.reportError(error, "Could not switch the call audio output.");
        }
    }

    setMuted(muted: boolean, updateSystem = true) {
        const audioTracks = this.localStream?.getAudioTracks() || [];
        audioTracks.forEach(track => {
            track.enabled = !muted;
        });
        this.update({ muted });
        if (updateSystem && this.call?.nativeCallId) {
            void setNativeMuted(this.call.nativeCallId, muted);
        }
    }

    handleNativeCallSession(session: CallSession) {
        const incoming = this.createCallFromIncomingEvent(
            session.incomingCallEvent,
            session.id
        );
        if (!incoming) {
            return;
        }
        if (this.call && this.call.callId !== incoming.callId) {
            return;
        }
        this.call = {
            ...this.call,
            ...incoming,
            mode: this.localStream ? "accepted" : "incoming",
            status: this.localStream ? "accepted" : "ringing"
        };
        this.update({ call: this.call, error: "" });
    }

    async handleNativeCallAnswered(event: CallAnsweredEvent) {
        this.pendingNativeAnswer = event;
        try {
            const session = await getActiveCallSession();
            if (session?.id === event.id) {
                this.handleNativeCallSession(session);
            }
        } catch (error) {
            this.reportError(error, "Could not restore the incoming call.");
        }
        if (this.call) {
            this.call = {
                ...this.call,
                nativeCallId: event.id,
                nativeRequestId: event.requestId
            };
        }
        await this.processPendingNativeAnswer();
    }

    handleNativeCallEnded(event: CallEndedEvent) {
        if (this.ignoredNativeEnds.delete(event.id)) {
            return;
        }
        if (!this.socket?.connected) {
            this.pendingNativeEnd = event;
            this.pendingNativeAnswer = null;
            if (!this.call) {
                this.call = this.createCallFromIncomingEvent(
                    event.session.incomingCallEvent,
                    event.id
                );
            }
            if (this.call) {
                this.update({ call: this.call });
            }
            return;
        }
        this.processNativeCallEnded(event);
    }

    private processNativeCallEnded(event: CallEndedEvent) {
        const call = this.call || this.createCallFromIncomingEvent(
            event.session.incomingCallEvent,
            event.id
        );
        if (!call) {
            return;
        }
        this.call = call;
        const isIncomingRinging = call.mode === "incoming";
        if (isIncomingRinging) {
            this.socket?.emit("reject-call", {
                callerId: call.callerId,
                receiverId: getId(this.currentUser),
                roomId: call.roomId
            });
        } else {
            this.socket?.emit("end-call", {
                roomId: call.roomId,
                callId: call.callId
            });
        }
        this.finishCall("");
    }

    async startScreenShare(openIosPicker: () => void) {
        if (this.call?.status !== "connected" || !this.peer) {
            throw new Error("Screen sharing is available after the call connects.");
        }
        if (this.screenStream) {
            await this.stopScreenShare();
            return;
        }

        const stream = await mediaDevices.getDisplayMedia(
            Platform.OS === "android"
                ? {
                    android: {
                        createConfigForDefaultDisplay: true,
                        resolutionScale: 0.75
                    }
                }
                : {}
        );
        const track = stream.getVideoTracks()[0];
        if (!track) {
            stream.getTracks().forEach(item => item.stop());
            throw new Error("The operating system did not provide a screen track.");
        }

        try {
            await this.replaceVideoTrack(track);
            this.screenStream = stream;
            this.update({ screenStream: stream, sharingScreen: true, error: "" });
            track.addEventListener("ended", () => {
                void this.stopScreenShare();
            });
            if (Platform.OS === "ios") {
                openIosPicker();
            }
        } catch (error) {
            this.screenStream = null;
            let restoreError: unknown;
            try {
                const cameraTrack =
                    this.localStream?.getVideoTracks()
                        .find(item => item.readyState === "live") || null;
                await this.replaceVideoTrack(cameraTrack);
            } catch (restoreFailure) {
                restoreError = restoreFailure;
            }
            stream.getTracks().forEach(item => item.stop());
            this.update({ screenStream: null, sharingScreen: false });
            if (restoreError instanceof Error) {
                throw new Error(
                    `Screen sharing failed and camera video could not be restored: ${restoreError.message}`
                );
            }
            throw error;
        }
    }

    async stopScreenShare() {
        const screenStream = this.screenStream;
        if (!screenStream) {
            return;
        }
        this.screenStream = null;
        const cameraTrack =
            this.localStream?.getVideoTracks()
                .find(track => track.readyState === "live") || null;
        try {
            await this.replaceVideoTrack(cameraTrack);
        } finally {
            screenStream.getTracks().forEach(track => track.stop());
            this.update({ screenStream: null, sharingScreen: false });
        }
    }

    private update(patch: Partial<DirectCallSnapshot>) {
        this.snapshot = { ...this.snapshot, ...patch };
        this.listeners.forEach(listener => listener(this.snapshot));
    }

    private async handleIncomingCall(data: Partial<DirectCall>) {
        const userId = getId(this.currentUser);
        if (!data.roomId || !data.callerId || !data.callId) {
            return;
        }
        if (this.call?.callId === data.callId) {
            return;
        }
        if (this.call) {
            if (data.callerId && data.receiverId && data.roomId) {
                this.socket?.emit("call-busy", {
                    callerId: data.callerId,
                    receiverId: userId,
                    roomId: data.roomId
                });
            }
            return;
        }

        this.call = {
            roomId: data.roomId,
            callId: data.callId,
            callerId: data.callerId,
            receiverId: userId,
            callerName: data.callerName || "User",
            receiverName: this.currentUser?.name || "User",
            type: data.type === "video" ? "video" : "audio",
            status: "ringing",
            mode: "incoming"
        };
        this.update({ call: this.call, error: "" });
        try {
            const session = await getActiveCallSession();
            if (session?.incomingCallEvent?.serverCallId === data.callId) {
                this.handleNativeCallSession(session);
                return;
            }
            const event: IncomingCallEvent = {
                eventId: data.callId,
                serverCallId: data.callId,
                hasVideo: data.type === "video",
                startedAt: new Date().toISOString(),
                caller: {
                    id: data.callerId,
                    displayName: data.callerName || "Messenger contact",
                    ...(data.callerAvatar
                        ? { avatarUrl: data.callerAvatar }
                        : {})
                },
                metadata: {
                    roomId: data.roomId,
                    callerId: data.callerId,
                    receiverId: userId,
                    callerName: data.callerName || "Messenger contact",
                    receiverName: this.currentUser?.name || "Messenger contact",
                    type: data.type === "video" ? "video" : "audio"
                }
            };
            await reportIncomingCall(event);
            const activeSession = await getActiveCallSession();
            if (
                activeSession?.incomingCallEvent?.serverCallId ===
                event.serverCallId
            ) {
                this.handleNativeCallSession(activeSession);
            }
        } catch (error) {
            this.reportError(error, "Could not show the system incoming-call screen.");
        }
    }

    private async handleCallAccepted(data: Partial<DirectCall>) {
        if (
            !this.call ||
            this.call.mode !== "outgoing" ||
            data.roomId !== this.call.roomId ||
            !this.localStream
        ) {
            return;
        }
        this.call = {
            ...this.call,
            callId: data.callId,
            status: "accepted",
            mode: "accepted"
        };
        this.update({ call: this.call });

        try {
            const peer = this.createPeer();
            const tracks = this.localStream.getTracks();
            tracks.forEach(track => peer.addTrack(track, this.localStream!));
            if (!this.localStream.getVideoTracks().length) {
                peer.addTransceiver("video", { direction: "sendrecv" });
            }
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            this.socket?.emit("webrtc-offer", {
                receiverId: this.call.receiverId,
                callerId: this.call.callerId,
                roomId: this.call.roomId,
                offer
            });
        } catch (error) {
            this.reportError(error, "Could not start the call.");
            this.endCall();
        }
    }

    private async handleOffer(data: {
        roomId?: string;
        callerId?: string;
        offer?: RTCSessionDescription;
    }) {
        if (
            !this.call ||
            this.call.mode === "outgoing" ||
            data.roomId !== this.call.roomId ||
            !data.offer ||
            !this.localStream
        ) {
            return;
        }

        try {
            const peer = this.peer || this.createPeer();
            await peer.setRemoteDescription(
                new RTCSessionDescription(data.offer)
            );
            await this.attachLocalTracksToOffer(peer);
            await this.flushCandidates(peer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            this.socket?.emit("webrtc-answer", {
                receiverId: this.call.callerId,
                callerId: getId(this.currentUser),
                roomId: this.call.roomId,
                answer
            });
            this.call = { ...this.call, mode: "accepted", status: "accepted" };
            this.update({ call: this.call });
        } catch (error) {
            this.reportError(error, "Could not answer the call.");
            this.endCall();
        }
    }

    private async attachLocalTracksToOffer(peer: RTCPeerConnection) {
        const transceivers = peer.getTransceivers();
        for (const track of this.localStream?.getTracks() || []) {
            const transceiver = transceivers.find(
                item => {
                    const receiverTrack = item.receiver.track;
                    return item.mid !== null &&
                    item.currentDirection !== "stopped" &&
                    receiverTrack !== null &&
                    receiverTrack.kind === track.kind
                }
            );
            if (!transceiver) {
                throw new Error(
                    `The caller did not offer a ${track.kind} media section.`
                );
            }
            if (!transceiver.direction.includes("send")) {
                transceiver.direction = "sendrecv";
            }
            await transceiver.sender.replaceTrack(track);
        }
    }

    private async handleAnswer(data: {
        roomId?: string;
        answer?: RTCSessionDescription;
    }) {
        if (
            !this.peer ||
            !this.call ||
            data.roomId !== this.call.roomId ||
            !data.answer
        ) {
            return;
        }
        try {
            await this.peer.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );
            await this.flushCandidates(this.peer);
        } catch (error) {
            this.reportError(error, "Could not connect the call.");
        }
    }

    private async handleIceCandidate(data: {
        roomId?: string;
        candidate?: RTCIceCandidate;
    }) {
        if (
            !this.call ||
            data.roomId !== this.call.roomId ||
            !data.candidate
        ) {
            return;
        }
        const candidate = new RTCIceCandidate(data.candidate);
        if (!this.peer?.remoteDescription) {
            this.pendingCandidates.push(candidate);
            return;
        }
        try {
            await this.peer.addIceCandidate(candidate);
        } catch (error) {
            this.reportError(error, "Could not add a network candidate.");
        }
    }

    private handleCallConnected(data: { roomId?: string }) {
        if (!this.call || data.roomId !== this.call.roomId) {
            return;
        }
        this.call = { ...this.call, mode: "connected", status: "connected" };
        this.update({ call: this.call });
        this.startAudioRouteObservation();
        if (this.call.nativeRequestId) {
            const requestId = this.call.nativeRequestId;
            this.call = { ...this.call, nativeRequestId: undefined };
            void fulfillIncomingCallConnected(requestId).catch(error => {
                this.reportError(error, "Could not connect the system call.");
            });
        } else if (
            this.call.nativeCallId &&
            this.call.callerId === getId(this.currentUser)
        ) {
            void reportOutgoingCallConnected(this.call.nativeCallId).catch(error => {
                this.reportError(error, "Could not connect the system call.");
            });
        }
    }

    private createCallFromIncomingEvent(
        event: IncomingCallEvent | undefined,
        nativeCallId: string
    ): DirectCall | null {
        const metadata = event?.metadata;
        const roomId = String(metadata?.roomId || "");
        const callerId = String(event?.caller?.id || "");
        const receiverId = String(
            metadata?.receiverId || getId(this.currentUser)
        );
        if (!event || !roomId || !callerId || !receiverId) {
            return null;
        }
        return {
            roomId,
            callId: event.serverCallId,
            callerId,
            receiverId,
            callerName: event.caller.displayName || "Messenger contact",
            receiverName: String(metadata?.receiverName || "User"),
            type: event.hasVideo ? "video" : "audio",
            status: "ringing",
            mode: "incoming",
            nativeCallId
        };
    }

    private async processPendingNativeAnswer() {
        const event = this.pendingNativeAnswer;
        if (!event || !this.socket?.connected || !this.call) {
            return;
        }
        this.pendingNativeAnswer = null;
        this.call = {
            ...this.call,
            nativeCallId: event.id,
            nativeRequestId: event.requestId
        };
        try {
            await this.acceptCall();
        } catch (error) {
            this.reportError(error, "Could not answer the incoming call.");
        }
    }

    private processPendingNativeEnd() {
        const event = this.pendingNativeEnd;
        if (!event || !this.socket?.connected) {
            return;
        }
        this.pendingNativeEnd = null;
        this.processNativeCallEnded(event);
    }

    private finishCallFromServer(
        message: string,
        reason: "failed" | "remoteEnded" | "unanswered" | "declinedElsewhere"
    ) {
        const nativeCallId = this.call?.nativeCallId;
        if (nativeCallId) {
            void reportCallEnded(nativeCallId, reason).catch(error => {
                this.reportError(error, "Could not end the system call.");
            });
        }
        this.finishCall(message);
    }

    private createPeer() {
        if (this.peer) {
            return this.peer;
        }
        const peer = new RTCPeerConnection({
            iceServers,
            iceCandidatePoolSize: 10,
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require"
        });
        this.peer = peer;
        peer.addEventListener("icecandidate", event => {
            const call = this.call;
            const userId = getId(this.currentUser);
            if (!event.candidate || !call || !userId) {
                return;
            }
            const receiverId =
                userId === call.callerId
                    ? call.receiverId
                    : call.callerId;
            this.socket?.emit("webrtc-ice-candidate", {
                receiverId,
                callerId: call.callerId,
                roomId: call.roomId,
                candidate: event.candidate
            });
        });
        peer.addEventListener("track", event => {
            const track = event.track;
            if (!track) {
                return;
            }
            const received = [
                ...(event.streams || []).flatMap(stream => stream.getTracks()),
                track
            ];
            received.forEach(track => {
                if (!this.remoteTracks.some(item => item.id === track.id)) {
                    this.remoteTracks.push(track);
                }
            });
            const stream = new MediaStream();
            this.remoteTracks.forEach(track => stream.addTrack(track));
            this.update({ remoteStream: stream });
        });
        peer.onconnectionstatechange = () => {
            if (
                peer.connectionState === "connected" &&
                !this.hasReportedConnected &&
                this.call
            ) {
                this.hasReportedConnected = true;
                this.socket?.emit("call-connected", {
                    roomId: this.call.roomId,
                    callId: this.call.callId
                });
            } else if (peer.connectionState === "failed") {
                this.update({ error: "Call connection failed. Check your network." });
            }
        };
        return peer;
    }

    private async replaceVideoTrack(track: MediaStreamTrack | null) {
        const peer = this.peer;
        if (!peer) {
            throw new Error("The call media connection is not ready.");
        }
        let transceiver = peer.getTransceivers().find(
            item =>
                item.receiver.track !== null &&
                item.receiver.track.kind === "video"
        );
        if (!transceiver) {
            transceiver = peer.addTransceiver("video", {
                direction: "sendrecv"
            });
        }
        if (!transceiver.direction.includes("send")) {
            transceiver.direction = "sendrecv";
        }
        await transceiver.sender.replaceTrack(track);
    }

    private async flushCandidates(peer: RTCPeerConnection) {
        const candidates = this.pendingCandidates;
        this.pendingCandidates = [];
        for (const candidate of candidates) {
            await peer.addIceCandidate(candidate);
        }
    }

    private reportError(error: unknown, fallback: string) {
        this.update({
            error: error instanceof Error ? error.message : fallback
        });
    }

    private startAudioRouteObservation() {
        if (this.audioRouteSubscription) {
            return;
        }
        this.audioRouteSubscription = addAudioRouteChangedListener(event => {
            const outputs = event.currentRoute.outputs;
            const speakerEnabled = outputs.some(
                output => output.portType === "builtInSpeaker"
            );
            this.update({ speakerEnabled });
        });
        try {
            const currentRoute = getAudioSession().currentRoute;
            this.update({
                speakerEnabled: currentRoute.outputs.some(
                    output => output.portType === "builtInSpeaker"
                )
            });
        } catch (error) {
            this.reportError(error, "Could not read the active audio route.");
        }
    }

    private stopAudioRouteObservation() {
        this.audioRouteSubscription?.remove();
        this.audioRouteSubscription = null;
    }

    private finishCall(message: string) {
        this.clearMedia();
        this.call = null;
        this.update({
            call: null,
            localStream: null,
            remoteStream: null,
            screenStream: null,
            speakerEnabled: false,
            sharingScreen: false,
            muted: false,
            error: message
        });
    }

    private clearMedia() {
        this.stopAudioRouteObservation();
        this.peer?.close();
        this.peer = null;
        this.localStream?.getTracks().forEach(track => track.stop());
        this.screenStream?.getTracks().forEach(track => track.stop());
        this.remoteTracks = [];
        this.localStream = null;
        this.screenStream = null;
        this.pendingCandidates = [];
        this.hasReportedConnected = false;
    }
}
