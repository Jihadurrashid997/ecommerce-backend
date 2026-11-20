import React from "react";
import { Link } from "react-router-dom";
import "../styles/LegalPage.css";

const policyContent = {
    privacy: {
        title: "Privacy Policy",
        updated: "November 17, 2026",
        sections: [
            ["Information we collect", "E Top stores account details you provide, profile and social content, messages, device sessions, and Shop activity needed to operate the service."],
            ["How information is used", "Information is used to provide accounts, social features, messaging, safety and moderation, customer support, and marketplace services."],
            ["Sharing and retention", "Information may be shared with service providers that operate the platform or when required by law. We retain records for as long as needed for service, security, and legal obligations."],
            ["Your choices", "You can update profile and privacy settings, block users, submit reports, and request account deletion from Settings. Deletion may not remove records that must be retained for legal or transaction obligations."],
            ["Safety and contact", "Do not share passwords or sensitive personal information in public posts. For privacy requests or questions, contact the platform operator through the support channel listed in the app."]
        ]
    },
    terms: {
        title: "Terms of Use",
        updated: "November 17, 2026",
        sections: [
            ["Eligibility", "You must be at least 13 years old to create an account. If local law requires a higher minimum age, that higher age applies."],
            ["Your account", "Provide accurate account information, keep credentials secure, and do not impersonate others or evade account restrictions."],
            ["User content and conduct", "You are responsible for content you submit. Do not post unlawful, abusive, deceptive, or rights-infringing material, harass users, or misuse reporting and blocking features."],
            ["Moderation", "E Top may review reports and hide or remove content, suspend or ban accounts, or restrict features to protect users and comply with law. You may report content or block accounts using in-app controls."],
            ["Shop", "Where Shop is available, additional order, payment, seller, refund, and marketplace terms may apply. Transactions remain subject to applicable law and payment provider terms."],
            ["Changes and contact", "These terms may change as the service or legal requirements change. Continued use after an update means the updated terms apply. Contact the platform operator through the support channel listed in the app."]
        ]
    }
};

const LegalPage = ({ type }) => {
    const policy = policyContent[type] || policyContent.privacy;
    return (
        <main className="legal-page">
            <Link to="/register">Back to sign up</Link>
            <h1>{policy.title}</h1>
            <p className="legal-updated">Last updated: {policy.updated}</p>
            <p>This page summarizes E Top's current service terms. It is not legal advice; review local law and applicable store policies before publishing or changing the service.</p>
            {policy.sections.map(([heading, text]) => (
                <section key={heading}>
                    <h2>{heading}</h2>
                    <p>{text}</p>
                </section>
            ))}
        </main>
    );
};

export default LegalPage;
