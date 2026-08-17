# Messenger friend + real-time chat update

This update adds:

- Account registration and login
- Automatic transition to the Messenger app after login/register
- A live list of every registered user
- Add Friend button
- Friends list
- Chat button for friends
- Real-time Firestore messages using `onSnapshot`
- Online/offline presence using Realtime Database
- Image/file messaging
- Safer Firestore conversation rules

## Replace these files

Upload these files to the root of your GitHub Pages repository:

- `app.js`
- `index.html`
- `firestore.rules`

Keep your existing `style.css`, `firebase-config.js`, `firebase-messaging-sw.js`, and `storage.rules`.

## Important Firebase step

In Firebase Console -> Firestore Database -> Rules, replace the current Firestore rules with the included `firestore.rules` and publish them.

The old message rule in the repository checks `request.resource` during reads. Reads do not have a pending resource, so that rule can block real-time message reads. The new rules authorize message reads using the conversation's `members` field.

## How it works

1. User A registers.
2. User B registers.
3. A sees B under "Find People".
4. A taps `Add`.
5. Both UIDs are stored in one `friendships` document.
6. B's account receives the same friendship through the real-time listener.
7. A can tap `Chat`.
8. Messages are stored in `conversations/{conversationId}/messages`.
9. Both users see new messages immediately through Firestore `onSnapshot`.

No Firebase service-account private key belongs in GitHub.
