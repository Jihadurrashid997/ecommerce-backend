import React, { useCallback, useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import api from "../services/api";

const AppUpdater = registerPlugin("AppUpdater");

const formatBytes = bytes => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return "0 MB";
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const AndroidUpdatePrompt = () => {
    const [release, setRelease] = useState(null);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState("");
    const [downloadId, setDownloadId] = useState(null);
    const [progress, setProgress] = useState(null);
    const [permissionRequired, setPermissionRequired] = useState(false);
    const [actionError, setActionError] = useState("");
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
            setChecking(false);
            return undefined;
        }

        let cancelled = false;
        const checkForUpdate = async () => {
            try {
                const [appInfo, response] = await Promise.all([
                    NativeApp.getInfo(),
                    api.get("/platform/android-release/latest")
                ]);
                if (cancelled) return;

                const installedVersionCode = Number(appInfo.build);
                const latest = response.data?.release;
                if (
                    latest?.packageId === appInfo.id &&
                    Number.isSafeInteger(installedVersionCode) &&
                    latest.versionCode > installedVersionCode
                ) {
                    setRelease(latest);
                    const pending = await AppUpdater.getPendingDownload({
                        sha256: latest.sha256
                    });
                    if (!cancelled && Number(pending.downloadId) >= 0) {
                        const state = await AppUpdater.getDownloadProgress({
                            downloadId: pending.downloadId
                        });
                        if (!cancelled && ["pending", "running", "paused", "successful"].includes(state.status)) {
                            setDownloadId(pending.downloadId);
                            setProgress(state);
                        }
                    }
                }
            } catch (requestError) {
                if (!cancelled && requestError.response?.status !== 404) {
                    setError(
                        requestError.response?.data?.message ||
                        "Could not check for Android app updates."
                    );
                }
            } finally {
                if (!cancelled) setChecking(false);
            }
        };

        checkForUpdate();
        return () => { cancelled = true; };
    }, []);

    const requestInstall = useCallback(async () => {
        if (!release || downloadId === null) return;
        try {
            setActionError("");
            const result = await AppUpdater.installApk({
                downloadId,
                sha256: release.sha256
            });
            setPermissionRequired(result.permissionRequired === true);
        } catch (installError) {
            setActionError(installError.message || "Could not start the Android installer.");
        }
    }, [downloadId, release]);

    useEffect(() => {
        if (downloadId === null || !release) return undefined;
        let cancelled = false;
        let timer;

        const poll = async () => {
            try {
                const state = await AppUpdater.getDownloadProgress({ downloadId });
                if (cancelled) return;
                setProgress(state);
                if (state.status === "successful") {
                    window.clearInterval(timer);
                } else if (state.status === "failed") {
                    window.clearInterval(timer);
                    setActionError("The Android update download failed. Please try again.");
                }
            } catch (pollError) {
                if (!cancelled) {
                    setActionError(pollError.message || "Could not check update download progress.");
                }
            }
        };

        poll();
        timer = window.setInterval(poll, 1200);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [downloadId, release]);

    const startDownload = async () => {
        if (!release) return;
        try {
            setActionError("");
            setPermissionRequired(false);
            const result = await AppUpdater.downloadApk({
                url: release.downloadUrl,
                sha256: release.sha256
            });
            setDownloadId(result.downloadId);
            setProgress({
                status: "pending",
                bytesDownloaded: 0,
                totalBytes: release.fileSize
            });
        } catch (downloadError) {
            setActionError(downloadError.message || "Could not start the Android update download.");
        }
    };

    if (
        checking ||
        !release ||
        (dismissed && !release.forceUpdate)
    ) {
        return null;
    }

    const failed = progress?.status === "failed";
    const downloading = Boolean(downloadId) && !failed;
    const bytesDownloaded = Number(progress?.bytesDownloaded) || 0;
    const totalBytes = Number(progress?.totalBytes) > 0
        ? Number(progress.totalBytes)
        : release.fileSize;
    const percent = totalBytes > 0
        ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100))
        : 0;
    const complete = progress?.status === "successful";

    return (
        <div className="android-update-overlay" role="dialog" aria-modal="true" aria-labelledby="android-update-title">
            <section className="android-update-card">
                <span className="android-update-label">E TOP APP UPDATE</span>
                <h2 id="android-update-title">Version {release.versionName} is ready</h2>
                <p>Update size: <b>{formatBytes(release.fileSize)}</b></p>
                {release.releaseNotes && <p className="android-update-notes">{release.releaseNotes}</p>}

                {downloading && (
                    <div className="android-update-progress">
                        <progress value={complete ? 100 : percent} max="100" />
                        <span>
                            {complete
                                ? "Download complete"
                                : `${formatBytes(bytesDownloaded)} of ${formatBytes(release.fileSize)} downloaded (${percent}%)`}
                        </span>
                    </div>
                )}

                {permissionRequired && (
                    <p className="android-update-help">
                        Allow E Top to install unknown apps in Android settings, then return and tap Install update.
                    </p>
                )}
                {actionError && <p className="android-update-error" role="alert">{actionError}</p>}
                {error && <p className="android-update-error" role="alert">{error}</p>}

                <div className="android-update-actions">
                    {(!downloading || failed) && !complete && (
                        <button type="button" onClick={startDownload}>Download update</button>
                    )}
                    {complete && (
                        <button type="button" onClick={requestInstall}>Install update</button>
                    )}
                    {downloading && !complete && (
                        <button type="button" disabled>Downloading...</button>
                    )}
                    {!release.forceUpdate && (
                        <button type="button" className="secondary" onClick={() => setDismissed(true)}>
                            Later
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AndroidUpdatePrompt;
