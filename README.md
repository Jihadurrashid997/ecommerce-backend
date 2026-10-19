# E Top — social marketplace

E Top keeps the social feed, short videos, profiles, follows, chat, and calls separate from the Shop. Product browsing, seller tools, cart, wishlist, orders, checkout, and payment return pages are all contained under `/shop`.

## Run locally

Requirements: Node.js, npm, and a MongoDB database.

1. Copy the root `.env.example` to `.env`, then set `MONGO_URI` and a strong, private `JWT_SECRET`.
2. Copy `frontend/.env.example` to `frontend/.env`. Keep the local API and Socket.IO URLs for local development.
3. Install and start the backend from the repository root:

   ```sh
   npm install
   npm run dev
   ```

4. In a second terminal, install and start the frontend:

   ```sh
   cd frontend
   npm install
   npm start
   ```

The frontend is served at `http://localhost:3000`; the API health endpoint is `http://localhost:5000/api/health`.

## Production services

- Set `CLIENT_URL` to the deployed frontend origin. Add any other exact frontend origins to `CORS_ORIGINS`, separated by commas.
- Configure Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`) in the backend host's environment before deploying if users need persistent profile photos, posts, reels, or message attachments. Without it, media uses local disk and may be lost when the host restarts or redeploys. Profile/post photos are limited to 10MB; reels are limited to 80MB and 5 minutes.
- Configure SMTP (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, and `EMAIL_PASS`) to deliver password-reset codes; optionally set `EMAIL_FROM`. Use an email-provider app password where required. Password reset now reports an unavailable email service instead of pretending a code was sent.
- Configure SSLCommerz credentials to enable checkout payments. Keep `SSLC_IS_LIVE=false` while testing; set it to `true` only with approved production credentials.
- Set frontend `REACT_APP_API_URL` to the backend URL (with or without `/api`). If Socket.IO runs on a different host, set `REACT_APP_SOCKET_URL` too. Rebuild the frontend after changing `REACT_APP_*` values.
- For a Render Static Site, use `frontend` as the root directory, `npm ci && npm run build` as the build command, and `build` as the publish directory. In the Render Dashboard, add a rewrite rule with source `/*` and destination `/index.html` so React Router routes such as `/shop` load on direct visits and refresh. The included `frontend/public/_redirects` file is for hosts that support that file; Render's route rule must be configured in the Dashboard.
- Video and voice calls require HTTPS. The built-in public TURN fallback is best-effort; configure a dedicated TURN service with the frontend build-time `REACT_APP_TURN_URL`, `REACT_APP_TURN_USERNAME`, and `REACT_APP_TURN_CREDENTIAL` settings for reliable calls across mobile-carrier and restrictive NAT networks.
- Messenger group chats use the authenticated `/api/groups` endpoints and JWT-authenticated Socket.IO connections. Deploy the frontend and backend together so group membership notifications and realtime chat use the same release.
- Group admins can optionally enable end-to-end encryption for group text, media, and calls after every current member has registered an encryption key. Each group message uses a fresh content key wrapped individually for current members; each attachment is independently encrypted in the browser, and its filename, MIME type, caption, and decryption key are included only in the encrypted message. Encrypted-group calls use LiveKit's E2EE media/data-channel transforms and a random call key wrapped separately for every current member; only those encrypted envelopes are stored server-side, and keys expire after 12 hours of call inactivity (an active room extends the key). Membership or encryption-setting changes invalidate the key and end the active room. Encrypted-group calls fail closed on browsers that do not support LiveKit E2EE—there is no unencrypted fallback. Members added later cannot decrypt earlier messages, media, or calls. Group details show a verification code derived from all member public keys; compare the full code with every member through a trusted channel before treating their identities as independently verified.
- Direct and group Messenger history loads the newest 50 messages first; the “Load older messages” control fetches additional pages. The API accepts `page` and `limit` query parameters and caps each page at 100 messages.
- Messenger messages can be deleted only for the current user or for everyone. Delete-for-everyone is sender-only and available for 15 minutes; delete-for-me hides the message from that user's history without removing it for other participants. Direct voice/video call events are stored as typed chat history entries so they remain after refresh and are visible to both participants.
- Communities support public membership and private admin-approved requests. Community posts are kept out of the global/profile feed, and private community posts are available only to members.
- Admin Control's Shop tab can pause product browsing and checkout and require approval for new or seller-edited products. Approval settings are stored in MongoDB; pending products remain hidden until an admin approves them.
- Shop hides seller profiles from public product and buyer order responses and does not expose buyer account profiles to sellers. Sellers only receive the name and delivery address needed for fulfillment. Online order payouts are held in the marketplace ledger until both the buyer confirms receipt and the seller confirms the delivered shipment, payout amount, and payout destination; administrators then send the seller transfer manually and record its method and reference. The seller sees the confirmed payout destination and instructions in Bengali and English after both confirmations. This is a manual merchant payout workflow, not payment-provider escrow.
- Messenger group calls use a LiveKit SFU. Configure `LIVEKIT_URL` (the project's WebSocket URL, usually `wss://...`), `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` on the backend from a LiveKit Cloud project or your self-hosted LiveKit server; keep the API secret private and restart/redeploy the backend after setting them. Group members receive a short-lived room token only after server-side membership is verified; encrypted groups additionally require a current per-member call-key envelope before the token is issued.
- Messenger end-to-end encryption is opt-in for direct text/media and admin-enabled group text/media/calls. Encrypted attachments and voice notes are encrypted in the browser with a fresh AES-GCM key; their names, MIME types, captions, and decryption keys are carried inside the encrypted message. The server stores and serves only opaque attachment bytes. In Messenger settings, users can save a recovery backup encrypted in the browser with a passphrase (minimum 12 characters) and restore it on another device; the server stores only the encrypted backup. Losing both the original device key and the recovery passphrase makes encrypted history and media unreadable. Compare direct-chat safety codes through a trusted channel. Direct calls use WebRTC's encrypted peer-to-peer media transport, but are not protected by the Messenger message-key system. Calls in groups without group E2EE use LiveKit without app-level E2EE. Text forwarded into an encrypted direct chat is encrypted for that chat.
- Messenger attachments support common audio formats including WebM, Ogg, MP3, M4A/MP4, AAC, WAV, FLAC, and Opus, alongside images and documents, up to 10MB per file.
- Messenger location sharing sends a one-time pin rounded to four decimal places only after the user confirms the selected conversation. It does not continuously track location; browser location access requires HTTPS or localhost.

Never commit `.env` files or production secrets.
