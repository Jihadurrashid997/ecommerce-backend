import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaBell, FaLock, FaMoon, FaShieldAlt, FaUser, FaUserSlash } from "react-icons/fa";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import "../styles/Settings.css";

const DEFAULT_SETTINGS = {
    theme: "dark",
    notifications: {
        follows: true,
        posts: true,
        communities: true,
        announcements: true
    }
};

const Settings = () => {
    const { theme, setTheme, user } = useApp();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const [settingsResponse, blockedResponse] = await Promise.all([
                api.get("/users/settings"),
                api.get("/users/blocked")
            ]);
            const nextSettings = settingsResponse.data.settings;
            setSettings(nextSettings);
            setTheme(nextSettings.theme);
            setBlockedUsers(blockedResponse.data.users || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not load your settings.");
        } finally {
            setLoading(false);
        }
    }, [setTheme]);

    useEffect(() => { load(); }, [load]);

    const saveSettings = async updates => {
        try {
            setBusy("settings");
            setError("");
            setNotice("");
            const response = await api.patch("/users/settings", updates);
            setSettings(response.data.settings);
            setTheme(response.data.settings.theme);
            setNotice("Your settings have been saved.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not save your settings.");
        } finally {
            setBusy("");
        }
    };

    const updateNotificationPreference = key => value => {
        saveSettings({ notifications: { [key]: value } });
    };

    const changePassword = async event => {
        event.preventDefault();
        try {
            setBusy("password");
            setError("");
            setNotice("");
            const response = await api.patch("/users/change-password", {
                currentPassword,
                newPassword
            });
            setCurrentPassword("");
            setNewPassword("");
            setNotice(response.data.message || "Password updated successfully.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not update your password.");
        } finally {
            setBusy("");
        }
    };

    const unblock = async blockedUser => {
        try {
            setBusy(String(blockedUser._id));
            setError("");
            setNotice("");
            await api.post(`/users/unblock/${blockedUser._id}`);
            setBlockedUsers(previous => previous.filter(userItem =>
                String(userItem._id) !== String(blockedUser._id)
            ));
            setNotice(`${blockedUser.name || "User"} was unblocked.`);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not unblock this user.");
        } finally {
            setBusy("");
        }
    };

    if (loading) {
        return <main className="settings-page"><p role="status">Loading your settings...</p></main>;
    }

    return (
        <main className="settings-page">
            <header className="settings-header">
                <div>
                    <Link className="settings-back" to="/"><FaArrowLeft /> Back to E Top</Link>
                    <h1>Settings</h1>
                    <p>Manage your account and website-wide preferences.</p>
                </div>
                <span className="settings-user">{user?.name}</span>
            </header>

            {error && <p className="settings-feedback is-error" role="alert">{error}</p>}
            {notice && <p className="settings-feedback" role="status">{notice}</p>}

            <section className="settings-card">
                <div className="settings-section-heading">
                    <FaUser />
                    <div><h2>Account & profile</h2><p>Keep your public profile information up to date.</p></div>
                </div>
                <Link className="settings-link-card" to="/edit-profile">
                    <span><b>Edit profile</b><small>Update your name, bio, location, and profile photo.</small></span>
                    <span aria-hidden="true">›</span>
                </Link>
            </section>

            <section className="settings-card">
                <div className="settings-section-heading">
                    <FaMoon />
                    <div><h2>Appearance</h2><p>Your theme is saved to your account and follows you across devices.</p></div>
                </div>
                <div className="settings-choice-row">
                    <label><input type="radio" name="theme" checked={settings.theme === "dark"} disabled={busy === "settings"} onChange={() => saveSettings({ theme: "dark" })} /> Dark</label>
                    <label><input type="radio" name="theme" checked={settings.theme === "light"} disabled={busy === "settings"} onChange={() => saveSettings({ theme: "light" })} /> Light</label>
                    <span className="settings-current-theme">Current: {theme}</span>
                </div>
            </section>

            <section className="settings-card">
                <div className="settings-section-heading">
                    <FaBell />
                    <div><h2>Website notifications</h2><p>Choose which E Top activity appears in the website notification bell. Shop and Messenger remain separate.</p></div>
                </div>
                {[
                    ["follows", "New followers", "When someone follows you."],
                    ["posts", "Posts, likes, and comments", "Updates about posts you follow, likes, and comments."],
                    ["communities", "Communities", "Join requests, new members, and membership approvals."],
                    ["announcements", "Admin announcements", "Important updates sent by E Top administrators."]
                ].map(([key, title, description]) => (
                    <label className="settings-toggle-row" key={key}>
                        <span><b>{title}</b><small>{description}</small></span>
                        <input
                            type="checkbox"
                            checked={settings.notifications[key]}
                            disabled={busy === "settings"}
                            onChange={event => updateNotificationPreference(key)(event.target.checked)}
                        />
                    </label>
                ))}
            </section>

            <section className="settings-card">
                <div className="settings-section-heading">
                    <FaUserSlash />
                    <div><h2>Privacy</h2><p>Review accounts you have blocked. Blocking controls are also available on user profiles.</p></div>
                </div>
                {blockedUsers.length ? (
                    <div className="settings-blocked-list">
                        {blockedUsers.map(blockedUser => (
                            <div className="settings-blocked-user" key={blockedUser._id}>
                                <span className="settings-avatar">
                                    {blockedUser.profileImage
                                        ? <img src={getUploadUrl(blockedUser.profileImage)} alt="" />
                                        : (blockedUser.name || "U").charAt(0).toUpperCase()}
                                </span>
                                <b>{blockedUser.name || "E Top user"}</b>
                                <button type="button" disabled={Boolean(busy)} onClick={() => unblock(blockedUser)}>
                                    {busy === String(blockedUser._id) ? "Unblocking..." : "Unblock"}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : <p className="settings-empty">You have not blocked anyone.</p>}
            </section>

            <section className="settings-card">
                <div className="settings-section-heading">
                    <FaShieldAlt />
                    <div><h2>Security</h2><p>Change your account password. If you signed in with Google, use password recovery to set a password first.</p></div>
                </div>
                <form className="settings-password-form" onSubmit={changePassword}>
                    <label>
                        Current password
                        <input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
                    </label>
                    <label>
                        New password
                        <input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
                    </label>
                    <button type="submit" disabled={Boolean(busy)}>{busy === "password" ? "Updating..." : "Update password"}</button>
                    <Link to="/forgot-password">Forgot your password?</Link>
                </form>
                <div className="settings-security-note"><FaLock /> Your current password is required to make this change.</div>
            </section>
        </main>
    );
};

export default Settings;
