import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import VerifiedBadge from "../components/VerifiedBadge";
import "../styles/AdminControl.css";
import "../styles/VerifiedBadge.css";

const fmtDate = v => (v ? new Date(v).toLocaleString() : "-");

const Avatar = ({ u }) => (
    <div className="ac-avatar">
        {u?.profileImage
            ? <img src={getUploadUrl(u.profileImage)} alt="" />
            : (u?.name || "U").charAt(0).toUpperCase()}
    </div>
);

/* ------------------------------------------------ overview */

const Overview = () => {

    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/admin/control/overview")
            .then(r => setData(r.data.overview))
            .catch(e => setError(e.response?.data?.message || "Could not load overview."));
    }, []);

    if (error) return <p className="ac-note error">{error}</p>;
    if (!data) return <p className="ac-note">Loading...</p>;

    const cards = [
        ["Total users", data.users.total],
        ["New this week", data.users.newThisWeek],
        ["Customers", data.users.customers],
        ["Sellers", data.users.sellers],
        ["Admins", data.users.admins],
        ["Suspended", data.users.suspended],
        ["Photo posts", data.content.posts],
        ["Reels", data.content.reels],
        ["Comments", data.content.comments],
        ["Messages", data.messages],
        ["Products", data.products]
    ];

    return (
        <>
            <div className="ac-cards">
                {cards.map(([label, value]) => (
                    <div className="ac-card" key={label}>
                        <b>{value}</b>
                        <span>{label}</span>
                    </div>
                ))}
            </div>

            <p className={`ac-note ${data.mediaStorage.startsWith("cloudinary") ? "" : "warn"}`}>
                Media storage: <b>{data.mediaStorage}</b>
                {!data.mediaStorage.startsWith("cloudinary") &&
                    " - uploaded photos/videos will be lost on the next deploy. Set up Cloudinary."}
            </p>
        </>
    );

};

/* ------------------------------------------------ user detail */

const UserDetail = ({ id, myId, onClose, onChanged }) => {

    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [role, setRole] = useState("");
    const [tempPassword, setTempPassword] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await api.get(`/admin/control/users/${id}`);
            setData(r.data);
            setRole(r.data.user.role);
        } catch (e) {
            alert(e.response?.data?.message || "Could not load this user.");
            onClose();
        }
    }, [id, onClose]);

    useEffect(() => { load(); }, [load]);

    const run = async (fn, okMessage) => {
        try {
            setBusy(true);
            const r = await fn();
            if (okMessage) alert(okMessage);
            await load();
            onChanged();
            return r;
        } catch (e) {
            alert(e.response?.data?.message || "Something went wrong.");
            return null;
        } finally {
            setBusy(false);
        }
    };

    if (!data) {
        return <div className="ac-overlay"><div className="ac-modal"><p className="ac-note">Loading...</p></div></div>;
    }

    const { user, stats, recent } = data;

    const isSelf = String(user._id) === String(myId);

    const toggleSuspend = () => {

        if (user.isSuspended) {
            return run(() => api.patch(`/admin/control/users/${id}/suspend`, { suspend: false }), "Account re-activated.");
        }

        const reason = window.prompt("Reason for suspension (shown to the user):", "");

        if (reason === null) return null;

        return run(() => api.patch(`/admin/control/users/${id}/suspend`, { suspend: true, reason }), "Account suspended.");

    };

    const saveRole = () => run(() => api.patch(`/admin/control/users/${id}/role`, { role }), "Role updated.");

    const resetPassword = async () => {

        if (!window.confirm(`Reset ${user.name}'s password? They will have to log in with the temporary one.`)) return;

        const r = await run(() => api.post(`/admin/control/users/${id}/reset-password`));

        if (r?.data?.tempPassword) setTempPassword(r.data.tempPassword);

    };

    const removeUser = async () => {

        const typed = window.prompt(
            `This permanently deletes ${user.name} and ALL their posts and reels.\nType DELETE to confirm:`
        );

        if (typed !== "DELETE") return;

        try {
            setBusy(true);
            await api.delete(`/admin/control/users/${id}`);
            onChanged();
            onClose();
        } catch (e) {
            alert(e.response?.data?.message || "Could not delete this user.");
            setBusy(false);
        }

    };

    return (
        <div className="ac-overlay" onClick={onClose}>
            <div className="ac-modal" onClick={e => e.stopPropagation()}>

                <button type="button" className="ac-x" onClick={onClose}>x</button>

                <div className="ac-user-head">
                    <Avatar u={user} />
                    <div>
                        <h3>
                            {user.name}
                            {user.isVerified && (
                                <VerifiedBadge className="verified-badge-admin" />
                            )}
                        </h3>
                        <span className={`ac-badge ${user.role}`}>{user.role}</span>
                        {user.isSuspended && <span className="ac-badge suspended">suspended</span>}
                    </div>
                </div>

                <dl className="ac-dl">
                    <dt>Email</dt><dd>{user.email}</dd>
                    <dt>Location</dt><dd>{user.location || "-"}</dd>
                    <dt>Bio</dt><dd>{user.bio || "-"}</dd>
                    <dt>Joined</dt><dd>{fmtDate(user.createdAt)}</dd>
                    <dt>Last seen</dt><dd>{fmtDate(user.lastSeen)}</dd>
                    {user.isSuspended && (<><dt>Suspended</dt><dd>{user.suspendedReason || "no reason given"}</dd></>)}
                </dl>

                <div className="ac-stats">
                    <div><b>{stats.posts}</b><span>Photos</span></div>
                    <div><b>{stats.reels}</b><span>Reels</span></div>
                    <div><b>{stats.followers}</b><span>Followers</span></div>
                    <div><b>{stats.following}</b><span>Following</span></div>
                    <div><b>{stats.products}</b><span>Products</span></div>
                </div>

                {recent.length > 0 && (
                    <>
                        <h4>Recent uploads</h4>
                        <div className="ac-thumbs">
                            {recent.map(p => (
                                <div key={p._id} className="ac-thumb">
                                    {p.kind === "reel"
                                        ? <video src={`${getUploadUrl(p.media[0]?.url)}#t=0.1`} muted preload="metadata" />
                                        : <img src={getUploadUrl(p.media[0]?.url)} alt="" loading="lazy" />}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className="ac-actions">

                    {!isSelf && (
                        <>
                            <div className="ac-row">
                                <select value={role} onChange={e => setRole(e.target.value)} disabled={busy}>
                                    <option value="customer">customer</option>
                                    <option value="seller">seller</option>
                                    <option value="admin">admin</option>
                                </select>
                                <button type="button" onClick={saveRole} disabled={busy || role === user.role}>
                                    Change role
                                </button>
                            </div>

                            <button
                                type="button"
                                className={user.isVerified ? "warn" : "ok"}
                                onClick={() =>
                                    run(
                                        () =>
                                            api.patch(
                                                `/admin/control/users/${id}/verification`,
                                                { isVerified: !user.isVerified }
                                            ),
                                        user.isVerified
                                            ? "Verified badge removed."
                                            : "Verified badge granted."
                                    )
                                }
                                disabled={busy}
                            >
                                {user.isVerified
                                    ? "Remove verification badge"
                                    : "Grant verification badge"}
                            </button>

                            {user.role !== "admin" && (
                                <button type="button" className={user.isSuspended ? "ok" : "warn"} onClick={toggleSuspend} disabled={busy}>
                                    {user.isSuspended ? "Re-activate account" : "Suspend account"}
                                </button>
                            )}

                            <button type="button" onClick={resetPassword} disabled={busy}>
                                Reset password
                            </button>

                            <button type="button" className="danger" onClick={removeUser} disabled={busy}>
                                Delete user
                            </button>
                        </>
                    )}

                    {isSelf && <p className="ac-note">This is your own account.</p>}

                </div>

                <p className="ac-note small">
                    Passwords are stored as one-way hashes, so nobody can see them - use "Reset password" to give someone a new temporary one.
                </p>

                {tempPassword && (
                    <div className="ac-temp">
                        <b>Temporary password (shown once):</b>
                        <code>{tempPassword}</code>
                        <button type="button" onClick={() => navigator.clipboard?.writeText(tempPassword)}>Copy</button>
                    </div>
                )}

            </div>
        </div>
    );

};

/* ------------------------------------------------ users */

const Users = ({ myId }) => {

    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const r = await api.get("/admin/control/users", {
                params: { page, search: query, role, status }
            });
            setItems(r.data.items);
            setPages(r.data.pages);
            setTotal(r.data.total);
        } catch (e) {
            alert(e.response?.data?.message || "Could not load users.");
        } finally {
            setLoading(false);
        }
    }, [page, query, role, status]);

    useEffect(() => { load(); }, [load]);

    const submit = e => { e.preventDefault(); setPage(1); setQuery(search.trim()); };

    return (
        <>
            <form className="ac-filters" onSubmit={submit}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email" />
                <select value={role} onChange={e => { setPage(1); setRole(e.target.value); }}>
                    <option value="">All roles</option>
                    <option value="customer">customer</option>
                    <option value="seller">seller</option>
                    <option value="admin">admin</option>
                </select>
                <select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
                    <option value="">All status</option>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                </select>
                <button type="submit">Search</button>
            </form>

            <p className="ac-note small">{total} users</p>

            {loading && <p className="ac-note">Loading...</p>}

            <div className="ac-list">
                {items.map(u => (
                    <button type="button" key={u._id} className="ac-item" onClick={() => setOpenId(u._id)}>
                        <Avatar u={u} />
                        <div className="ac-item-main">
                            <b>
                                {u.name}
                                {u.isVerified && (
                                    <VerifiedBadge className="verified-badge-admin" />
                                )}
                            </b>
                            <span>{u.email}</span>
                        </div>
                        <div className="ac-item-side">
                            <span className={`ac-badge ${u.role}`}>{u.role}</span>
                            {u.isSuspended && <span className="ac-badge suspended">suspended</span>}
                            <small>{u.postsCount} photos - {u.reelsCount} reels</small>
                        </div>
                    </button>
                ))}
            </div>

            <div className="ac-pager">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <span>{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>

            {openId && (
                <UserDetail
                    id={openId}
                    myId={myId}
                    onClose={() => setOpenId(null)}
                    onChanged={load}
                />
            )}
        </>
    );

};

/* ------------------------------------------------ content */

const Content = () => {

    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [kind, setKind] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const r = await api.get("/admin/control/content", { params: { page, kind } });
            setItems(r.data.items);
            setPages(r.data.pages);
        } catch (e) {
            alert(e.response?.data?.message || "Could not load content.");
        } finally {
            setLoading(false);
        }
    }, [page, kind]);

    useEffect(() => { load(); }, [load]);

    const remove = async item => {

        if (!window.confirm(`Delete this ${item.kind}${item.author?.name ? ` by ${item.author.name}` : ""}?`)) return;

        try {
            await api.delete(`/posts/${item._id}`);
            setItems(prev => prev.filter(p => p._id !== item._id));
        } catch (e) {
            alert(e.response?.data?.message || "Could not delete.");
        }

    };

    return (
        <>
            <div className="ac-filters">
                <select value={kind} onChange={e => { setPage(1); setKind(e.target.value); }}>
                    <option value="">Photos + Reels</option>
                    <option value="post">Photos</option>
                    <option value="reel">Reels</option>
                </select>
            </div>

            {loading && <p className="ac-note">Loading...</p>}

            {!loading && items.length === 0 && <p className="ac-note">Nothing here yet.</p>}

            <div className="ac-content-grid">
                {items.map(item => (
                    <div className="ac-content" key={item._id}>

                        <div className="ac-content-media">
                            {item.kind === "reel"
                                ? <video src={`${getUploadUrl(item.media[0]?.url)}#t=0.1`} controls preload="metadata" playsInline />
                                : <img src={getUploadUrl(item.media[0]?.url)} alt="" loading="lazy" />}
                        </div>

                        <div className="ac-content-body">
                            <b>{item.author?.name || "Deleted user"}</b>
                            <small>{item.kind} - {fmtDate(item.createdAt)}</small>
                            {item.caption && <p>{item.caption}</p>}
                            <small>{item.likeCount} likes - {item.commentCount} comments{item.kind === "reel" ? ` - ${item.views} views` : ""}</small>
                            <button type="button" className="danger" onClick={() => remove(item)}>Delete</button>
                        </div>

                    </div>
                ))}
            </div>

            <div className="ac-pager">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <span>{page} / {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
        </>
    );

};

/* ------------------------------------------------ shop settings */

const ShopSettings = () => {
    const [settings, setSettings] = useState(null);
    const [pendingProducts, setPendingProducts] = useState([]);
    const [sellerApplications, setSellerApplications] = useState([]);
    const [readyPayouts, setReadyPayouts] = useState([]);
    const [refundRequests, setRefundRequests] = useState([]);
    const [payoutForms, setPayoutForms] = useState({});
    const [refundForms, setRefundForms] = useState({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const [settingsResponse, productsResponse, payoutsResponse, refundsResponse, applicationsResponse] = await Promise.all([
                api.get("/admin/settings"),
                api.get("/admin/products/pending"),
                api.get("/orders/admin/payouts/ready"),
                api.get("/orders/admin/refunds/requested"),
                api.get("/admin/seller-applications")
            ]);
            setSettings(settingsResponse.data.settings);
            setPendingProducts(productsResponse.data.products || []);
            setReadyPayouts(payoutsResponse.data.payouts || []);
            setRefundRequests(refundsResponse.data.refunds || []);
            setSellerApplications(applicationsResponse.data.applications || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not load Shop settings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async (field, value) => {
        try {
            setBusy(field);
            setError("");
            setNotice("");
            const response = await api.put("/admin/settings", { [field]: value });
            setSettings(response.data.settings);
            setNotice("Shop settings saved.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not save Shop settings.");
        } finally {
            setBusy("");
        }
    };

    const approve = async productId => {
        try {
            setBusy(productId);
            setError("");
            setNotice("");
            await api.put(`/admin/approve/${productId}`);
            setPendingProducts(products => products.filter(product => product._id !== productId));
            setNotice("Product approved and published.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not approve product.");
        } finally {
            setBusy("");
        }
    };

    const rejectProduct = async productId => {
        const reviewNote = window.prompt(
            "Explain what must be corrected before approval (at least 3 characters):",
            ""
        );
        if (reviewNote === null) return;
        if (reviewNote.trim().length < 3) {
            setError("A product review note of at least 3 characters is required.");
            return;
        }

        try {
            setBusy(productId);
            setError("");
            setNotice("");
            await api.put(`/admin/reject/${productId}`, { reviewNote });
            setPendingProducts(products =>
                products.filter(product => product._id !== productId)
            );
            setNotice("Product rejected and the seller was sent a review note.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not reject product.");
        } finally {
            setBusy("");
        }
    };

    const reviewSellerApplication = async (application, status) => {
        const reviewNote = status === "rejected"
            ? window.prompt("Explain why the application was rejected (at least 3 characters):", "")
            : "";
        if (status === "rejected" && reviewNote === null) return;
        if (status === "rejected" && reviewNote.trim().length < 3) {
            setError("A rejection note of at least 3 characters is required.");
            return;
        }

        try {
            setBusy(String(application.userId));
            setError("");
            setNotice("");
            await api.put(`/admin/seller-applications/${application.userId}`, {
                status,
                reviewNote
            });
            setSellerApplications(previous =>
                previous.filter(item => String(item.userId) !== String(application.userId))
            );
            setNotice(status === "approved"
                ? "Seller application approved; seller access is active."
                : "Seller application rejected with a review note.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not review seller application.");
        } finally {
            setBusy("");
        }
    };

    const updatePayoutForm = (fulfillmentId, field, value) => {
        setPayoutForms(previous => ({
            ...previous,
            [fulfillmentId]: {
                payoutMethod: "Manual transfer",
                ...previous[fulfillmentId],
                [field]: value
            }
        }));
    };

    const updateRefundForm = (orderId, field, value) => {
        setRefundForms(previous => ({
            ...previous,
            [orderId]: {
                refundMethod: "SSLCommerz dashboard",
                refundReference: "",
                adminNote: "",
                ...previous[orderId],
                [field]: value
            }
        }));
    };

    const rejectRefund = async order => {
        const form = refundForms[order._id] || {};
        if ((form.adminNote || "").trim().length < 3) {
            setError("Add a review note of at least 3 characters before rejecting a refund request.");
            return;
        }

        try {
            setBusy(order._id);
            setError("");
            setNotice("");
            await api.put(`/orders/admin/${order._id}/refund/reject`, {
                adminNote: form.adminNote
            });
            setRefundRequests(previous =>
                previous.filter(request => request._id !== order._id)
            );
            setNotice("Refund request rejected and the review note was saved.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not reject refund request.");
        } finally {
            setBusy("");
        }
    };

    const recordRefund = async order => {
        const form = refundForms[order._id] || {};
        if (!form.refundMethod?.trim() || !form.refundReference?.trim()) {
            setError("Enter the refund method and actual transfer reference before recording a refund.");
            return;
        }

        try {
            setBusy(order._id);
            setError("");
            setNotice("");
            await api.put(`/orders/admin/${order._id}/refund/complete`, {
                refundMethod: form.refundMethod,
                refundReference: form.refundReference,
                adminNote: form.adminNote || ""
            });
            setRefundRequests(previous =>
                previous.filter(request => request._id !== order._id)
            );
            setReadyPayouts(previous =>
                previous.filter(payout => String(payout.orderId) !== String(order._id))
            );
            setNotice("Manual refund recorded and unpaid seller payouts cancelled.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not record refund.");
        } finally {
            setBusy("");
        }
    };

    const markPayoutPaid = async payout => {
        const form = payoutForms[payout.fulfillmentId] || {};
        if (!form.payoutMethod?.trim() || !form.payoutReference?.trim()) {
            setError("Enter the payout method and actual transfer reference before marking it paid.");
            return;
        }

        try {
            setBusy(payout.fulfillmentId);
            setError("");
            setNotice("");
            await api.put(`/orders/admin/${payout.orderId}/payout`, {
                fulfillmentId: payout.fulfillmentId,
                payoutMethod: form.payoutMethod,
                payoutReference: form.payoutReference
            });
            setPayoutForms(previous => {
                const next = { ...previous };
                delete next[payout.fulfillmentId];
                return next;
            });
            setReadyPayouts(previous =>
                previous.filter(item => item.fulfillmentId !== payout.fulfillmentId)
            );
            setNotice("Payout recorded. The transfer reference is saved in the order ledger.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not record payout.");
        } finally {
            setBusy("");
        }
    };

    const approvePayout = async payout => {
        try {
            setBusy(payout.fulfillmentId);
            setError("");
            setNotice("");
            await api.put(`/orders/admin/${payout.orderId}/payout/approve`, {
                fulfillmentId: payout.fulfillmentId
            });
            setReadyPayouts(previous => previous.map(item =>
                item.fulfillmentId === payout.fulfillmentId
                    ? { ...item, payoutStatus: "approved" }
                    : item
            ));
            setNotice("Payout approved. Make the manual transfer, then record its actual reference.");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not approve payout.");
        } finally {
            setBusy("");
        }
    };

    if (loading) return <p className="ac-note">Loading Shop settings...</p>;
    if (!settings) return <p className="ac-note error" role="alert">{error}</p>;

    return (
        <section className="ac-shop-settings">
            <h3>Shop controls</h3>
            <p className="ac-note">These controls apply to all buyers and sellers.</p>

            {error && <p className="ac-note error" role="alert">{error}</p>}
            {notice && <p className="ac-note" role="status">{notice}</p>}

            <label className="ac-setting-row">
                <span>
                    <b>Shop is open</b>
                    <small>When turned off, product browsing and checkout are paused.</small>
                </span>
                <input
                    type="checkbox"
                    checked={settings.marketplaceEnabled}
                    disabled={Boolean(busy)}
                    onChange={event => save("marketplaceEnabled", event.target.checked)}
                />
            </label>

            <label className="ac-setting-row">
                <span>
                    <b>Require product approval</b>
                    <small>New and seller-edited products stay hidden until approved.</small>
                </span>
                <input
                    type="checkbox"
                    checked={settings.requireProductApproval}
                    disabled={Boolean(busy)}
                    onChange={event => save("requireProductApproval", event.target.checked)}
                />
            </label>

            <h3>Products awaiting approval ({pendingProducts.length})</h3>
            {pendingProducts.length === 0 ? (
                <p className="ac-note">There are no products waiting for review.</p>
            ) : (
                <div className="ac-list">
                    {pendingProducts.map(product => (
                        <div className="ac-item" key={product._id}>
                            <div className="ac-item-main">
                                <b>{product.name}</b>
                                <span>{product.seller?.name || "Seller"} · ৳{Number(product.price || 0).toLocaleString("en-BD")}</span>
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={() => approve(product._id)}
                                    disabled={Boolean(busy)}
                                >
                                    {busy === product._id ? "Saving..." : "Approve"}
                                </button>
                                <button
                                    type="button"
                                    className="ac-refund-reject"
                                    onClick={() => rejectProduct(product._id)}
                                    disabled={Boolean(busy)}
                                >
                                    Reject with note
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <h3>Seller applications awaiting review ({sellerApplications.length})</h3>
            <p className="ac-note">
                Review store and contact information only. Seller access is granted after approval; payout credentials are collected separately and remain private.
            </p>
            {sellerApplications.length === 0 ? (
                <p className="ac-note">There are no seller applications waiting for review.</p>
            ) : (
                <div className="ac-list">
                    {sellerApplications.map(application => (
                        <div className="ac-item ac-seller-application" key={application.userId}>
                            <div className="ac-item-main">
                                <b>{application.displayName} · {application.name}</b>
                                <span>{application.email} · Contact: {application.contact}</span>
                                {application.businessName && <span>Business: {application.businessName}</span>}
                                {application.address && <span>Address: {application.address}</span>}
                                <span>Submitted: {application.submittedAt
                                    ? new Date(application.submittedAt).toLocaleString()
                                    : "Unknown"}</span>
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={() => reviewSellerApplication(application, "approved")}
                                    disabled={Boolean(busy)}
                                >
                                    {busy === String(application.userId) ? "Saving..." : "Approve"}
                                </button>
                                <button
                                    type="button"
                                    className="ac-refund-reject"
                                    onClick={() => reviewSellerApplication(application, "rejected")}
                                    disabled={Boolean(busy)}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <h3>Full-order refund requests ({refundRequests.length})</h3>
            <p className="ac-note">
                Review requests manually. Process the refund through the payment provider or transfer service first, then record its real reference here. This does not issue an automatic refund.
            </p>
            {refundRequests.length === 0 ? (
                <p className="ac-note">There are no refund requests awaiting review.</p>
            ) : (
                <div className="ac-list">
                    {refundRequests.map(order => {
                        const form = refundForms[order._id] || {
                            refundMethod: "SSLCommerz dashboard",
                            refundReference: "",
                            adminNote: ""
                        };
                        return (
                            <div className="ac-refund-card" key={order._id}>
                                <div className="ac-refund-summary">
                                    <b>Order #{String(order._id).slice(-8)} · Full refund ৳{Number(order.totalPrice || 0).toLocaleString("en-BD")}</b>
                                    <span>Buyer: {order.user?.name || "Unknown"} · {order.user?.email || "No email"}</span>
                                    <span>Requested: {order.refundRequest?.requestedAt
                                        ? new Date(order.refundRequest.requestedAt).toLocaleString()
                                        : "Date unavailable"}</span>
                                    <span>Payment transaction: {order.transactionId || "Not available"}</span>
                                    <span>Reason: {order.refundRequest?.reason || "No reason provided"}</span>
                                    <span>Items: {(order.items || []).map(item => `${item.name} × ${item.quantity}`).join(", ") || "No items"}</span>
                                </div>
                                <div className="ac-refund-actions">
                                    <input
                                        aria-label={`Refund method for order ${String(order._id).slice(-8)}`}
                                        value={form.refundMethod}
                                        onChange={event => updateRefundForm(order._id, "refundMethod", event.target.value)}
                                        maxLength={40}
                                        placeholder="Refund method"
                                    />
                                    <input
                                        aria-label={`Refund reference for order ${String(order._id).slice(-8)}`}
                                        value={form.refundReference}
                                        onChange={event => updateRefundForm(order._id, "refundReference", event.target.value)}
                                        maxLength={120}
                                        placeholder="Actual refund reference"
                                    />
                                    <textarea
                                        aria-label={`Review note for order ${String(order._id).slice(-8)}`}
                                        value={form.adminNote}
                                        onChange={event => updateRefundForm(order._id, "adminNote", event.target.value)}
                                        maxLength={500}
                                        placeholder="Buyer-facing review note (required to reject)"
                                        rows={2}
                                    />
                                    <div>
                                        <button
                                            type="button"
                                            className="ac-refund-complete"
                                            disabled={Boolean(busy)}
                                            onClick={() => recordRefund(order)}
                                        >
                                            {busy === order._id ? "Saving..." : "Record refund completed"}
                                        </button>
                                        <button
                                            type="button"
                                            className="ac-refund-reject"
                                            disabled={Boolean(busy)}
                                            onClick={() => rejectRefund(order)}
                                        >
                                            {busy === order._id ? "Saving..." : "Reject request"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <h3>Seller payouts for review ({readyPayouts.length})</h3>
            <p className="ac-note">Approve only eligible payouts. After approval, send the transfer outside the Shop and record its actual method and reference. This is a manual transfer record, not escrow or an automatic payout.</p>
            {readyPayouts.length === 0 ? (
                <p className="ac-note">No seller payouts are awaiting approval or transfer recording.</p>
            ) : (
                <div className="ac-list">
                    {readyPayouts.map(payout => {
                        const form = payoutForms[payout.fulfillmentId] || {
                            payoutMethod: "Manual transfer",
                            payoutReference: ""
                        };
                        return (
                            <div className="ac-payout-card" key={payout.fulfillmentId}>
                                <div>
                                    <b>Order #{payout.orderNumber} · ৳{Number(payout.amount || 0).toLocaleString("en-BD")}</b>
                                    <span>Status: {payout.payoutStatus === "approved" ? "Approved — transfer not yet recorded" : "Awaiting admin approval"}</span>
                                    <span>{payout.seller?.name || "Seller"} · {payout.seller?.email || "No email"}</span>
                                    <span>{payout.seller?.payoutMethod || "Payout method not set"}: {payout.seller?.payoutAccount || "Seller has not added an account"}</span>
                                </div>
                                {payout.payoutStatus !== "approved" ? (
                                    <div className="ac-payout-actions">
                                        <button
                                            type="button"
                                            disabled={
                                                Boolean(busy) ||
                                                !payout.seller?.payoutMethod ||
                                                !payout.seller?.payoutAccount
                                            }
                                            onClick={() => approvePayout(payout)}
                                        >
                                            {busy === payout.fulfillmentId
                                                ? "Saving..."
                                                : !payout.seller?.payoutAccount
                                                    ? "Seller payout details missing"
                                                    : "Approve payout"}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="ac-payout-actions">
                                    <input
                                        aria-label={`Payout method for order ${payout.orderNumber}`}
                                        value={form.payoutMethod}
                                        onChange={event => updatePayoutForm(
                                            payout.fulfillmentId,
                                            "payoutMethod",
                                            event.target.value
                                        )}
                                        maxLength={40}
                                        placeholder="Method"
                                    />
                                    <input
                                        aria-label={`Transfer reference for order ${payout.orderNumber}`}
                                        value={form.payoutReference}
                                        onChange={event => updatePayoutForm(
                                            payout.fulfillmentId,
                                            "payoutReference",
                                            event.target.value
                                        )}
                                        maxLength={120}
                                        placeholder="Actual transfer reference"
                                    />
                                    <button
                                        type="button"
                                        disabled={
                                            Boolean(busy) ||
                                            !payout.seller?.payoutMethod ||
                                            !payout.seller?.payoutAccount
                                        }
                                        onClick={() => markPayoutPaid(payout)}
                                    >
                                        {busy === payout.fulfillmentId
                                            ? "Saving..."
                                            : !payout.seller?.payoutAccount
                                                ? "Seller payout details missing"
                                                : "Record completed transfer"}
                                    </button>
                                </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

const Announcements = () => {
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [audience, setAudience] = useState("all");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const send = async event => {
        event.preventDefault();
        try {
            setBusy(true);
            setError("");
            setNotice("");
            const response = await api.post("/admin/control/announcements", {
                title,
                message,
                audience
            });
            setNotice(`Announcement sent to ${response.data.recipientCount} users.`);
            setTitle("");
            setMessage("");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not send the announcement.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="ac-announcements">
            <h3>Website announcement</h3>
            <p className="ac-note">
                This sends a persistent notification to E Top users. Shop and Messenger notifications remain separate.
            </p>
            {error && <p className="ac-note error" role="alert">{error}</p>}
            {notice && <p className="ac-note" role="status">{notice}</p>}
            <form onSubmit={send}>
                <label>
                    Audience
                    <select value={audience} onChange={event => setAudience(event.target.value)} disabled={busy}>
                        <option value="all">All customers and sellers</option>
                        <option value="customer">Customers</option>
                        <option value="seller">Sellers</option>
                    </select>
                </label>
                <label>
                    Title
                    <input value={title} onChange={event => setTitle(event.target.value)} minLength={3} maxLength={100} required disabled={busy} />
                </label>
                <label>
                    Message
                    <textarea value={message} onChange={event => setMessage(event.target.value)} minLength={3} maxLength={500} rows={4} required disabled={busy} />
                </label>
                <button type="submit" disabled={busy}>{busy ? "Sending..." : "Send announcement"}</button>
            </form>
        </section>
    );
};

/* ------------------------------------------------ page */

const AdminControl = () => {

    const { user } = useApp();

    const [tab, setTab] = useState("overview");

    if (user?.role !== "admin") {
        return <p className="ac-note error">Admins only.</p>;
    }

    return (
        <div className="ac-page">

            <div className="ac-head">
                <h2>Admin Control</h2>
                <Link to="/admin">Sales dashboard</Link>
            </div>

            <div className="ac-tabs">
                {[["overview", "Overview"], ["users", "Users"], ["content", "Content"], ["shop", "Shop"], ["announcements", "Announcements"]].map(([key, label]) => (
                    <button type="button" key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === "overview" && <Overview />}
            {tab === "users" && <Users myId={user._id || user.id} />}
            {tab === "content" && <Content />}
            {tab === "shop" && <ShopSettings />}
            {tab === "announcements" && <Announcements />}

        </div>
    );

};

export default AdminControl;
