import { Platform } from "react-native";
import { io, Socket } from "socket.io-client";
import {
    MediaStream,
    MediaStreamTrack,
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    mediaDevices
} from "react-native-webrtc";

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
    type: "audio" | "video";
    status: string;
    mode: "incoming" | "outgoing" | "accepted" | "connected";
}

export interface DirectCallSnapshot {
    connected: boolean;
    call: DirectCall | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    screenStream: MediaStream | null;
    muted: boolean;
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
    private snapshot: DirectCallSnapshot = { ...emptySnapshot };
    private listeners = new Set<(snapshot: DirectCallSnapshot) => void>();

    subscribe(listener: (snapshot: DirectCallSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    connect(user: CallUser, token: string) {
        this.disconnect();
        this.currentUser = user;
        const userId = getId(user);
        if (!userId || !token) {
            throw new Error("Sign in again to connect to calls.");
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
            socket.emit("user-online", userId);
            this.update({ connected: true, error: "" });
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
        socket.on("incoming-call", data => this.handleIncomingCall(data));
        socket.on("call-accepted", data => {
            void this.handleCallAccepted(data);
        });
        socket.on("call-connected", data => this.handleCallConnected(data));
        socket.on("call-rejected", data => this.finishCall(
            data?.reason === "not-connected"
                ? "You can only call a chat contact."
                : "The call was declined."
        ));
        socket.on("call-busy", () => this.finishCall("The other person is busy."));
        socket.on("call-missed", () => this.finishCall("The call was not answered."));
        socket.on("call-ended", () => this.finishCall(""));
        socket.on("webrtc-offer", data => {
            void this.handleOffer(data);
        });
        socket.on("webrtc-answer", data => {
            void this.handleAnswer(data);
        });
        socket.on("webrtc-ice-candidate", data => {
            void this.handleIceCandidate(data);
        });
    }

    disconnect() {
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
        this.call = {
            roomId: getRoomId(userId, receiverId),
            callerId: userId,
            receiverId,
            callerName: this.currentUser?.name || "User",
            receiverName: target.name || target.username || "User",
            type,
            status: "calling",
            mode: "outgoing"
        };
        this.hasReportedConnected = false;
        this.update({
            call: this.call,
            localStream: stream,
            remoteStream: null,
            screenStream: null,
            muted: false,
            sharingScreen: false,
            error: ""
        });
        socket.emit("call-user", {
            ...this.call,
            status: "calling",
            callerAvatar: "",
            receiverAvatar: ""
        });
    }

    async acceptCall() {
        const call = this.call;
        const socket = this.socket;
        const userId = getId(this.currentUser);
        if (!call || call.mode !== "incoming" || !socket?.connected) {
            throw new Error("There is no incoming call to accept.");
        }

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
        this.finishCall("");
    }

    endCall() {
        if (this.call) {
            this.socket?.emit("end-call", {
                roomId: this.call.roomId,
                callId: this.call.callId
            });
        }
        this.finishCall("");
    }

    toggleMute() {
        const audioTracks = this.localStream?.getAudioTracks() || [];
        const muted = !this.snapshot.muted;
        audioTracks.forEach(track => {
            track.enabled = !muted;
        });
        this.update({ muted });
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

    private handleIncomingCall(data: Partial<DirectCall>) {
        const userId = getId(this.currentUser);
        if (!data.roomId || !data.callerId || this.call) {
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

    private finishCall(message: string) {
        this.clearMedia();
        this.call = null;
        this.update({
            call: null,
            localStream: null,
            remoteStream: null,
            screenStream: null,
            sharingScreen: false,
            muted: false,
            error: message
        });
    }

    private clearMedia() {
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
