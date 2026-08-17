
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, getDoc, query, where,
  orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import {
  getDatabase, ref as rref, set, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAy1hi8vq_bOCpsmCDxgof49cYLaCJ46lg",
  authDomain: "chats-54e77.firebaseapp.com",
  projectId: "chats-54e77",
  storageBucket: "chats-54e77.firebasestorage.app",
  messagingSenderId: "851919939421",
  appId: "1:851919939421:web:80650b62201b27d3a4aab4",
  measurementId: "G-9PM2NYMJVJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

const $ = id => document.getElementById(id);
let isRegister = false;
let current = null;
let selected = null;
let stopMessages = null;
let stopUsers = null;
let stopFriends = null;
let friendIds = new Set();

function showError(message) {
  $("authError").textContent = message;
}

function mode(registerMode) {
  isRegister = registerMode;
  $("loginTab").classList.toggle("active", !registerMode);
  $("registerTab").classList.toggle("active", registerMode);
  $("name").classList.toggle("hidden", !registerMode);
  $("name").required = registerMode;
  $("authButton").textContent = registerMode ? "Register" : "Login";
  showError("");
}

$("loginTab").addEventListener("click", e => { e.preventDefault(); mode(false); });
$("registerTab").addEventListener("click", e => { e.preventDefault(); mode(true); });

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  showError("");
  const email = $("email").value.trim();
  const password = $("password").value;
  const name = $("name").value.trim();

  if (!email || !password) return showError("Please enter your email and password.");

  try {
    $("authButton").disabled = true;
    $("authButton").textContent = isRegister ? "Creating account..." : "Logging in...";

    if (isRegister) {
      if (!name) throw new Error("Please enter your full name.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        name,
        email: credential.user.email,
        createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No account was found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/email-already-in-use": "This email is already registered.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/configuration-not-found": "Firebase Authentication configuration is not available.",
      "auth/network-request-failed": "Network error. Check your internet connection."
    };
    showError(messages[error.code] || error.message || "Authentication failed.");
  } finally {
    $("authButton").disabled = false;
    $("authButton").textContent = isRegister ? "Register" : "Login";
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    current = null;
    if (stopMessages) stopMessages();
    if (stopUsers) stopUsers();
    if (stopFriends) stopFriends();
    stopMessages = stopUsers = stopFriends = null;
    $("authScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
    return;
  }

  current = user;
  $("authScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  const name = user.displayName || user.email.split("@")[0];
  $("myName").textContent = name;
  $("myAvatar").textContent = name.charAt(0).toUpperCase();

  try {
    await setPresence(true);
  } catch (error) {
    console.error("Presence error:", error);
  }

  loadFriends();
  loadUsers();
});

async function setPresence(online) {
  if (!current) return;
  const presenceRef = rref(rtdb, `status/${current.uid}`);

  if (online) {
    await onDisconnect(presenceRef).set({ online: false, lastSeen: Date.now() });
    await set(presenceRef, { online: true, lastSeen: Date.now() });
  } else {
    await set(presenceRef, { online: false, lastSeen: Date.now() });
  }
}

function friendshipId(a, b) {
  return [a, b].sort().join("_");
}

function loadFriends() {
  if (stopFriends) stopFriends();

  const q = query(
    collection(db, "friendships"),
    where("members", "array-contains", current.uid)
  );

  stopFriends = onSnapshot(q, snapshot => {
    friendIds = new Set();

    snapshot.forEach(d => {
      const data = d.data();
      const friend = data.members.find(uid => uid !== current.uid);
      if (friend) friendIds.add(friend);
    });

    renderFriendList();
    renderUsersFromLastSnapshot();
  }, error => {
    console.error("Friends error:", error);
    $("friends").innerHTML = `<div class="empty-small">Could not load friends.</div>`;
  });
}

let latestUsers = [];

function loadUsers() {
  if (stopUsers) stopUsers();

  stopUsers = onSnapshot(collection(db, "users"), snapshot => {
    latestUsers = snapshot.docs
      .map(d => d.data())
      .filter(u => u.uid !== current.uid);

    renderFriendList();
    renderUsersFromLastSnapshot();
  }, error => {
    console.error("Users error:", error);
    $("users").innerHTML = `<div class="empty-small">Could not load users.</div>`;
  });
}

function renderFriendList() {
  if (!current || !$("friends")) return;

  const friends = latestUsers.filter(u => friendIds.has(u.uid));
  $("friends").innerHTML = "";

  if (!friends.length) {
    $("friends").innerHTML = `<div class="empty-small">No friends yet. Add someone below.</div>`;
    return;
  }

  friends.forEach(u => addUserRow(u, true, $("friends")));
}

function renderUsersFromLastSnapshot() {
  if (!current || !$("users")) return;

  const search = $("search").value.trim().toLowerCase();
  $("users").innerHTML = "";

  const users = latestUsers.filter(u => {
    const name = (u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  if (!users.length) {
    $("users").innerHTML = `<div class="empty-small">No other accounts found.</div>`;
    return;
  }

  users.forEach(u => {
    if (!friendIds.has(u.uid)) addUserRow(u, false, $("users"));
  });

  if (!$("users").children.length) {
    $("users").innerHTML = `<div class="empty-small">Everyone shown is already your friend.</div>`;
  }
}

function addUserRow(u, isFriend, container) {
  const row = document.createElement("div");
  row.className = "user" + (selected?.uid === u.uid ? " active" : "");

  row.innerHTML = `
    <div class="avatar">${esc((u.name || "U").charAt(0).toUpperCase())}</div>
    <div class="user-main">
      <b>${esc(u.name || "User")}</b>
      <small id="s-${esc(u.uid)}">Checking...</small>
    </div>
    <button class="user-action ${isFriend ? "chat-action" : ""}" type="button">
      ${isFriend ? "Chat" : "Add"}
    </button>
  `;

  row.querySelector(".user-action").addEventListener("click", async e => {
    e.stopPropagation();
    if (isFriend) {
      openChat(u);
    } else {
      await addFriend(u);
    }
  });

  row.addEventListener("click", () => {
    if (isFriend) openChat(u);
  });

  container.appendChild(row);

  onValue(rref(rtdb, `status/${u.uid}`), snapshot => {
    const status = snapshot.val();
    const element = $(`s-${u.uid}`);
    if (element) element.textContent = status?.online ? "Online" : "Offline";
    if (selected?.uid === u.uid && $("chatStatus")) {
      $("chatStatus").textContent = status?.online ? "Online" : "Offline";
    }
  });
}

async function addFriend(u) {
  if (!current || !u?.uid || u.uid === current.uid) return;

  const id = friendshipId(current.uid, u.uid);

  try {
    await setDoc(doc(db, "friendships", id), {
      members: [current.uid, u.uid].sort(),
      createdBy: current.uid,
      createdAt: serverTimestamp()
    });

    openChat(u);
  } catch (error) {
    console.error("Add friend error:", error);
    alert("Could not add this friend. Check your Firestore rules.");
  }
}

$("search").addEventListener("input", renderUsersFromLastSnapshot);

function conversationId(a, b) {
  return [a, b].sort().join("_");
}

async function ensureConversation(u) {
  const id = conversationId(current.uid, u.uid);
  await setDoc(doc(db, "conversations", id), {
    members: [current.uid, u.uid].sort(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

async function openChat(u) {
  selected = u;
  $("chatHeader").innerHTML = `
    <div class="avatar">${esc((u.name || "U").charAt(0).toUpperCase())}</div>
    <div style="margin-left:10px">
      <b>${esc(u.name || "User")}</b>
      <div id="chatStatus">Checking...</div>
    </div>
  `;
  $("messageForm").classList.remove("hidden");
  $("messages").innerHTML = "";

  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  try {
    const id = await ensureConversation(u);
    const messagesRef = collection(db, "conversations", id, "messages");
    const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

    stopMessages = onSnapshot(messagesQuery, snapshot => {
      $("messages").innerHTML = "";
      snapshot.forEach(d => renderMessage(d.data()));
      $("messages").scrollTop = $("messages").scrollHeight;
    }, error => {
      console.error("Messages error:", error);
      $("messages").innerHTML = `<div class="empty"><strong>⚠️</strong><h2>Chat unavailable</h2><p>Check your Firestore rules.</p></div>`;
    });

    onValue(rref(rtdb, `status/${u.uid}`), snapshot => {
      if ($("chatStatus")) $("chatStatus").textContent = snapshot.val()?.online ? "Online" : "Offline";
    });
  } catch (error) {
    console.error("Open chat error:", error);
  }
}

function renderMessage(m) {
  const sent = m.senderId === current.uid;
  const element = document.createElement("div");
  element.className = "msg " + (sent ? "sent" : "received");

  let body = "";
  if (m.type === "image") {
    body = `<div class="file"><img src="${esc(m.url)}" alt="image" style="max-width:250px;border-radius:10px;"></div>`;
  } else if (m.type === "file") {
    body = `<div class="file">📎 <a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.fileName || "File")}</a></div>`;
  } else {
    body = `<div class="bubble">${esc(m.text || "")}</div>`;
  }

  element.innerHTML = `
    ${sent ? "" : `<div class="avatar">${esc((selected.name || "U").charAt(0).toUpperCase())}</div>`}
    <div>
      ${body}
      <div class="time">${
        m.createdAt?.toDate
          ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : ""
      }</div>
    </div>
  `;

  $("messages").appendChild(element);
}

$("messageForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!current || !selected) return;

  const input = $("message");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  try {
    const id = await ensureConversation(selected);
    await addDoc(collection(db, "conversations", id, "messages"), {
      senderId: current.uid,
      text,
      type: "text",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Send message error:", error);
    input.value = text;
    alert("Message could not be sent. Check your Firestore rules.");
  }
});

$("fileButton").addEventListener("click", () => {
  $("fileInput").accept = "*/*";
  $("fileInput").click();
});

$("imageButton").addEventListener("click", () => {
  $("fileInput").accept = "image/*";
  $("fileInput").click();
});

$("fileInput").addEventListener("change", async () => {
  const file = $("fileInput").files[0];
  if (!file || !current || !selected) return;

  try {
    const id = await ensureConversation(selected);
    const path = `chat-files/${id}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, "conversations", id, "messages"), {
      senderId: current.uid,
      url,
      fileName: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Upload error:", error);
    alert("File upload failed. Check Firebase Storage settings.");
  }

  $("fileInput").value = "";
});

$("logout").addEventListener("click", async () => {
  try {
    await setPresence(false);
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

function esc(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}
