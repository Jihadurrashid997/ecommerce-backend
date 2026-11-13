# JR Messenger mobile

This React Native companion app uses the ecommerce backend's existing account
login, Messenger contacts, direct-call signaling, and WebRTC calls. It supports
voice/video calls and full-device screen sharing on Android and iOS; it is not
a mobile port of the ecommerce storefront.

## Development

Install dependencies with `npm ci`, then run `npm start` to start Metro. A
development build is required because the app uses native WebRTC and screen
capture modules; Expo Go cannot provide these native modules.

Set `EXPO_PUBLIC_API_URL` to the backend API URL when it differs from the
default `https://ecommerce-api-9wc9.onrender.com/api`. Set
`EXPO_PUBLIC_SOCKET_URL` only when the Socket.IO server is hosted at a different
origin from the API.

## Native builds

- **Android:** install the Android SDK and use `npm run android`. Android
  prompts the user to approve screen capture and shows the system's active
  screen-sharing indicator.
- **iOS:** on macOS with Xcode, use `npm run ios`. Before generating or building
  the native project, set `IOS_BUNDLE_ID` and `IOS_APP_GROUP` to identifiers
  registered for your Apple Developer team. The app group must be enabled for
  both the app and the ReplayKit broadcast extension, and the provisioning
  profiles must include that capability. The app group defaults in
  `app.config.js` are placeholders and are not provisioned identifiers.

iOS screen sharing uses ReplayKit. The user must start the broadcast in the
system picker and can stop it from the system screen-recording controls. The
captured display is sent as video; this implementation does not capture device
audio.

Generated `android/` and `ios/` directories are ignored by Git and can be
recreated with Expo prebuild after changing native configuration.
