# E Top — social marketplace

E Top combines a social feed and short videos with profiles, follows, chat and calls, while keeping the seller, shopping, order, and payment features.

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
- Configure Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`) in the backend host's environment before deploying if users need persistent profile photos, posts, reels, or message attachments. Without it, media uses local disk and may be lost when the host restarts or redeploys. Profile/post photos are limited to 10MB; reels are limited to 80MB and 60 seconds.
- Configure SMTP (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, and `EMAIL_PASS`) to deliver password-reset codes; optionally set `EMAIL_FROM`. Use an email-provider app password where required. Password reset now reports an unavailable email service instead of pretending a code was sent.
- Configure SSLCommerz credentials to enable checkout payments. Keep `SSLC_IS_LIVE=false` while testing; set it to `true` only with approved production credentials.
- Set frontend `REACT_APP_API_URL` to the backend URL (with or without `/api`). If Socket.IO runs on a different host, set `REACT_APP_SOCKET_URL` too. Rebuild the frontend after changing `REACT_APP_*` values.
- Video and voice calls require HTTPS in deployment and may need a TURN relay; configure the optional `REACT_APP_TURN_*` settings for restrictive networks.

Never commit `.env` files or production secrets.
