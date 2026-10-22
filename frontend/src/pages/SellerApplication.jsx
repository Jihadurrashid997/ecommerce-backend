import React, { useEffect, useState } from "react";
import api from "../services/api";
import "../styles/Shop.css";

const SellerApplication = () => {
    const [application, setApplication] = useState(null);
    const [form, setForm] = useState({
        displayName: "",
        contact: "",
        businessName: "",
        address: "",
        termsAccepted: false
    });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let cancelled = false;
        api.get("/seller/application")
            .then(response => {
                if (cancelled) return;
                setApplication(response.data);
                setForm(previous => ({
                    ...previous,
                    displayName: response.data.displayName || "",
                    contact: response.data.contact || "",
                    businessName: response.data.businessName || "",
                    address: response.data.address || ""
                }));
            })
            .catch(requestError => {
                if (!cancelled) {
                    setError(
                        requestError.response?.data?.message ||
                        "Could not load your seller application."
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const submit = async event => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        setNotice("");
        try {
            const response = await api.post("/seller/application", form);
            setApplication(previous => ({
                ...previous,
                ...form,
                status: response.data.status,
                submittedAt: new Date().toISOString(),
                reviewNote: ""
            }));
            setNotice(response.data.message);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                "Could not submit your seller application."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <main className="shop-seller-application"><p role="status">Loading application...</p></main>;
    }

    const status = application?.status || "not_submitted";
    const canApply = ["not_submitted", "rejected"].includes(status);

    return (
        <main className="shop-seller-application">
            <span className="shop-kicker">SELL WITH E TOP</span>
            <h1>Seller application</h1>
            <p className="shop-seller-application-intro">
                Seller access is reviewed by the Shop team. We only ask for basic contact and store details here; do not submit banking passwords, card details, or identity documents.
            </p>
            <section className={`shop-seller-application-status status-${status}`}>
                <strong>Application status: {status.replaceAll("_", " ")}</strong>
                {application?.submittedAt && (
                    <span>Submitted {new Date(application.submittedAt).toLocaleString()}</span>
                )}
                {application?.reviewNote && <p>{application.reviewNote}</p>}
            </section>
            {error && <p className="shop-notifications-error" role="alert">{error}</p>}
            {notice && <p className="shop-seller-application-notice" role="status">{notice}</p>}

            {canApply && (
                <form className="shop-seller-application-form" onSubmit={submit}>
                    <label>
                        Store display name
                        <input
                            required
                            minLength={2}
                            maxLength={80}
                            value={form.displayName}
                            onChange={event => setForm(previous => ({
                                ...previous,
                                displayName: event.target.value
                            }))}
                        />
                    </label>
                    <label>
                        Contact phone or email
                        <input
                            required
                            minLength={5}
                            maxLength={40}
                            value={form.contact}
                            onChange={event => setForm(previous => ({
                                ...previous,
                                contact: event.target.value
                            }))}
                        />
                    </label>
                    <label>
                        Business name <span>(optional)</span>
                        <input
                            maxLength={100}
                            value={form.businessName}
                            onChange={event => setForm(previous => ({
                                ...previous,
                                businessName: event.target.value
                            }))}
                        />
                    </label>
                    <label>
                        Business address <span>(optional)</span>
                        <textarea
                            maxLength={200}
                            value={form.address}
                            onChange={event => setForm(previous => ({
                                ...previous,
                                address: event.target.value
                            }))}
                        />
                    </label>
                    <label className="shop-seller-terms">
                        <input
                            type="checkbox"
                            checked={form.termsAccepted}
                            onChange={event => setForm(previous => ({
                                ...previous,
                                termsAccepted: event.target.checked
                            }))}
                        />
                        I agree to follow the Shop seller terms and marketplace policies.
                    </label>
                    <button type="submit" disabled={submitting}>
                        {submitting ? "Submitting..." : status === "rejected"
                            ? "Resubmit application"
                            : "Submit for review"}
                    </button>
                </form>
            )}
        </main>
    );
};

export default SellerApplication;
