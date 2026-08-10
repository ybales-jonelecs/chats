# Messenger Full Firebase Version

## Features
- Email/password registration and login
- User accounts stored in Firestore
- Conversations and messages stored in Firestore
- Real-time chat using Firestore `onSnapshot`
- Online/offline presence using Realtime Database
- Image/file uploads using Firebase Storage
- Web push notification token registration using Firebase Cloud Messaging

## Setup

1. Create a Firebase project at the Firebase Console.
2. Add a Web App.
3. Enable Authentication > Sign-in method > Email/Password.
4. Create Firestore Database.
5. Create Realtime Database.
6. Enable Storage.
7. In Project Settings > Your apps, copy the Web App configuration into `firebase-config.js`.
8. In Cloud Messaging settings, create a Web Push certificate/key pair and put the public VAPID key in `firebase-config.js`.
9. Copy the same Firebase config values into `firebase-messaging-sw.js`.
10. Apply `firestore.rules` and `storage.rules`.
11. Serve the folder through a web server. Do not open `index.html` with `file://` because ES modules, service workers, and Firebase features require a web origin.
12. For production notifications, use a trusted server/Cloud Function with Firebase Admin SDK to send FCM messages when a new message is created.

## Important
The browser can register an FCM token and receive foreground/background notifications, but automatic "new message" push sending should be done by a secure backend/Cloud Function. Never put a Firebase service-account private key in this project or GitHub repository.
