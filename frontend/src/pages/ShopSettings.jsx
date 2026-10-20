import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaBoxOpen, FaBell } from "react-icons/fa";
import api from "../services/api";
import "../styles/Shop.css";

const DEFAULT_PREFERENCES = {
    orders: true,
    refundsAndPayouts: true,
    products: true
};

const ShopSettings = () => {
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const response = await api.get("/shop-notifications/preferences");
            setPreferences(response.data.preferences || DEFAULT_PREFERENCES);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Could not load Shop settings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const updatePreference = async (key, value) => {
        const previous = preferences;
        const next = { ...preferences, [key]: value };
        setPreferences(next);
        setBusy(true);
        setError("");
        setNotice("");

        try {
            const response = await api.patch("/shop-notifications/preferences", {
                preferences: { [key]: value }
            });
            setPreferences(response.data.preferences);
            setNotice("Shop notification settings saved.");
        } catch (requestError) {
            setPreferences(previous);
            setError(requestError.response?.data?.message || "Could not save Shop settings.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="shop-settings-page">
            <Link className="shop-settings-back" to="/shop"><FaArrowLeft /> Back to Shop</Link>
            <header className="shop-settings-header">
                <span className="shop-kicker">YOUR SHOP PREFERENCES</span>
                <h1>Shop settings</h1>
                <p>Control Shop-only updates here. These choices do not affect E Top or Messenger notifications.</p>
            </header>

            <nav className="shop-settings-shortcuts" aria-label="Shop shortcuts">
                <Link to="/shop/notifications"><FaBell /> Shop notifications</Link>
                <Link to="/shop/orders"><FaBoxOpen /> My orders</Link>
            </nav>

            {error && <p className="shop-settings-feedback error" role="alert">{error}</p>}
            {notice && <p className="shop-settings-feedback" role="status">{notice}</p>}

            {loading ? (
                <p className="shop-settings-loading" role="status">Loading Shop settings...</p>
            ) : (
                <section className="shop-settings-card">
                    <h2>Shop notifications</h2>
                    <p>Choose which order and marketplace activity should create notifications in your Shop inbox.</p>
                    {[
                        ["orders", "Orders and delivery", "Order placed, payment, shipment, and buyer/seller confirmation updates."],
                        ["refundsAndPayouts", "Refunds and payouts", "Refund requests and decisions, payout readiness, and payout completion."],
                        ["products", "Product updates", "Product review results and approval updates."]
                    ].map(([key, title, description]) => (
                        <label className="shop-settings-toggle" key={key}>
                            <span><strong>{title}</strong><small>{description}</small></span>
                            <input
                                type="checkbox"
                                checked={preferences[key]}
                                disabled={busy}
                                onChange={event => updatePreference(key, event.target.checked)}
                            />
                        </label>
                    ))}
                    {busy && <span className="shop-settings-saving" role="status">Saving...</span>}
                </section>
            )}
        </main>
    );
};

export default ShopSettings;
