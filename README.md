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
- For a Render Static Site, use `frontend` as the root directory, `npm ci && npm run build` as the build command, and `build` as the publish directory. The `frontend/public/_redirects` rule serves React Router routes such as `/shop` through `index.html`, including on direct visits and refresh.
- Video and voice calls require HTTPS. The built-in public TURN fallback is best-effort; configure a dedicated TURN service with the frontend build-time `REACT_APP_TURN_URL`, `REACT_APP_TURN_USERNAME`, and `REACT_APP_TURN_CREDENTIAL` settings for reliable calls across mobile-carrier and restrictive NAT networks.
- Messenger group chats use the authenticated `/api/groups` endpoints and JWT-authenticated Socket.IO connections. Deploy the frontend and backend together so group membership notifications and realtime chat use the same release.
- Communities support public membership and private admin-approved requests. Community posts are kept out of the global/profile feed, and private community posts are available only to members.
- Admin Control's Shop tab can pause product browsing and checkout and require approval for new or seller-edited products. Approval settings are stored in MongoDB; pending products remain hidden until an admin approves them.
- Shop hides seller profiles from public product and buyer order responses and does not expose buyer account profiles to sellers. Sellers only receive the name and delivery address needed for fulfillment. Online order payouts are held in the marketplace ledger until both the buyer confirms receipt and the seller confirms the delivered shipment, payout amount, and payout destination; administrators then send the seller transfer manually and record its method and reference. The seller sees the confirmed payout destination and instructions in Bengali and English after both confirmations. This is a manual merchant payout workflow, not payment-provider escrow.
- Messenger group calls use a LiveKit SFU. Configure `LIVEKIT_URL` (the project's WebSocket URL, usually `wss://...`), `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` on the backend from a LiveKit Cloud project or your self-hosted LiveKit server; keep the API secret private and restart/redeploy the backend after setting them. Group members receive a short-lived room token only after server-side membership is verified.
- Messenger end-to-end encryption is opt-in and currently covers direct text messages only. The private key stays in that browser's local storage; clearing browser data or switching devices can make encrypted history unreadable, and there is no recovery flow. Compare the displayed safety code with the other person through a trusted channel. Group messages, attachments, voice notes, and calls are not encrypted by this feature.
- Messenger attachments support common audio formats including WebM, Ogg, MP3, M4A/MP4, AAC, WAV, FLAC, and Opus, alongside images and documents, up to 10MB per file.
- Messenger location sharing sends a one-time pin rounded to four decimal places only after the user confirms the selected conversation. It does not continuously track location; browser location access requires HTTPS or localhost.

Never commit `.env` files or production secrets.
