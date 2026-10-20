import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/Shop.css";

const ShopNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const navigate = useNavigate();

    const loadNotifications = useCallback(async ({ before, append = false } = {}) => {
        const setBusyLoading = append ? setLoadingMore : setLoading;
        setBusyLoading(true);
        setError("");

        try {
            const response = await api.get("/shop-notifications", {
                params: {
                    limit: 30,
                    ...(before ? { before } : {})
                }
            });
            const data = response.data;
            setNotifications(previous => append
                ? [...previous, ...(data.notifications || [])]
                : data.notifications || []);
            setUnreadCount(Number(data.unreadCount) || 0);
            setNextCursor(data.nextCursor || null);
            setHasMore(Boolean(data.hasMore));
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                "Could not load Shop notifications."
            );
        } finally {
            setBusyLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const markAllRead = async () => {
        setBusy("all");
        setError("");
        try {
            await api.patch("/shop-notifications/read-all");
            const now = new Date().toISOString();
            setNotifications(previous => previous.map(notification => ({
                ...notification,
                readAt: notification.readAt || now
            })));
            setUnreadCount(0);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                "Could not mark Shop notifications as read."
            );
        } finally {
            setBusy("");
        }
    };

    const openNotification = async notification => {
        if (!notification.readAt) {
            setBusy(notification._id);
            setError("");
            try {
                await api.patch(`/shop-notifications/${notification._id}/read`);
                setNotifications(previous => previous.map(item =>
                    item._id === notification._id
                        ? { ...item, readAt: new Date().toISOString() }
                        : item
                ));
                setUnreadCount(count => Math.max(0, count - 1));
            } catch (requestError) {
                setError(
                    requestError.response?.data?.message ||
                    "Could not update this Shop notification."
                );
                setBusy("");
                return;
            }
            setBusy("");
        }
        navigate(notification.href);
    };

    return (
        <main className="shop-notifications-page">
            <header className="shop-notifications-header">
                <div>
                    <span className="shop-kicker">YOUR SHOP ACTIVITY</span>
                    <h1>Shop notifications</h1>
                    <p>Order, delivery, payment, payout, refund, and product updates stay here, separate from social notifications.</p>
                </div>
                <div className="shop-notifications-summary">
                    <strong>{unreadCount}</strong>
                    <span>unread</span>
                </div>
            </header>

            {error && <p className="shop-notifications-error" role="alert">{error}</p>}

            {unreadCount > 0 && (
                <button
                    type="button"
                    className="shop-notifications-read-all"
                    disabled={busy === "all"}
                    onClick={markAllRead}
                >
                    {busy === "all" ? "Updating..." : "Mark all as read"}
                </button>
            )}

            {loading ? (
                <p className="shop-notifications-empty">Loading Shop notifications...</p>
            ) : notifications.length === 0 ? (
                <section className="shop-notifications-empty">
                    <h2>You're all caught up</h2>
                    <p>New Shop activity will appear here.</p>
                </section>
            ) : (
                <div className="shop-notifications-list">
                    {notifications.map(notification => (
                        <button
                            className={`shop-notification-item${notification.readAt ? "" : " unread"}`}
                            type="button"
                            key={notification._id}
                            disabled={busy === notification._id}
                            onClick={() => openNotification(notification)}
                        >
                            <span className="shop-notification-indicator" aria-hidden="true" />
                            <span className="shop-notification-copy">
                                <strong>{notification.title}</strong>
                                <span>{notification.message}</span>
                                <time dateTime={notification.createdAt}>
                                    {new Date(notification.createdAt).toLocaleString()}
                                </time>
                            </span>
                            {!notification.readAt && (
                                <span className="shop-notification-new">New</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {hasMore && nextCursor && (
                <button
                    type="button"
                    className="shop-notifications-load-more"
                    disabled={loadingMore}
                    onClick={() => loadNotifications({
                        before: nextCursor,
                        append: true
                    })}
                >
                    {loadingMore ? "Loading..." : "Load older notifications"}
                </button>
            )}
        </main>
    );
};

export default ShopNotifications;
