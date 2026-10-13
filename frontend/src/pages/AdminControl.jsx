import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { getUploadUrl } from "../services/api";
import { useApp } from "../context/AppContext";
import "../styles/AdminControl.css";

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
                        <h3>{user.name}</h3>
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
                            <b>{u.name}</b>
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
                {[["overview", "Overview"], ["users", "Users"], ["content", "Content"]].map(([key, label]) => (
                    <button type="button" key={key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === "overview" && <Overview />}
            {tab === "users" && <Users myId={user._id || user.id} />}
            {tab === "content" && <Content />}

        </div>
    );

};

export default AdminControl;
