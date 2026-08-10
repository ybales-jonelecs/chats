import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

import {
  getDatabase,
  ref as rref,
  set,
  onDisconnect,
  onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js";

import { firebaseConfig, vapidKey } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);

let messaging = null;

try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn("Firebase Messaging unavailable:", error);
}

const $ = (id) => document.getElementById(id);

let register = false;
let current = null;
let selected = null;
let stopMessages = null;
let stopUsers = null;

$("loginTab").onclick = () => mode(false);
$("registerTab").onclick = () => mode(true);

function mode(isRegister) {
  register = isRegister;
  $("loginTab").classList.toggle("active", !isRegister);
  $("registerTab").classList.toggle("active", isRegister);
  $("name").classList.toggle("hidden", !isRegister);
  $("name").required = isRegister;
  $("authButton").textContent = isRegister ? "Register" : "Login";
  $("authError").textContent = "";

  if (!isRegister) $("name").value = "";
}

$("authForm").onsubmit = async (e) => {
  e.preventDefault();
  $("authError").textContent = "";

  const email = $("email").value.trim();
  const password = $("password").value;
  const name = $("name").value.trim();

  try {
    if (register) {
      if (!name) {
        $("authError").textContent = "Please enter your full name.";
        return;
      }

      if (password.length < 6) {
        $("authError").textContent = "Password must be at least 6 characters.";
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(credential.user, {
        displayName: name
      });

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
    console.error("Authentication error:", error);

    switch (error.code) {
      case "auth/email-already-in-use":
        $("authError").textContent = "This email is already registered.";
        break;
      case "auth/invalid-email":
        $("authError").textContent = "Please enter a valid email address.";
        break;
      case "auth/weak-password":
        $("authError").textContent = "Password must be at least 6 characters.";
        break;
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        $("authError").textContent = "Incorrect email or password.";
        break;
      case "auth/configuration-not-found":
        $("authError").textContent =
          "Firebase Authentication is not configured correctly. Check Firebase Authentication settings.";
        break;
      default:
        $("authError").textContent = error.message || "Authentication failed.";
    }
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("authScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
    current = null;
    selected = null;
    return;
  }

  current = user;
  $("authScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  const name = user.displayName || (user.email ? user.email.split("@")[0] : "User");
  $("myName").textContent = name;
  $("myAvatar").textContent = name.charAt(0).toUpperCase();

  try {
    await setPresence(true);
  } catch (error) {
    console.warn("Presence error:", error);
  }

  loadUsers();
  setupNotifications();
});

async function setPresence(online) {
  if (!current) return;

  const presenceRef = rref(rtdb, `status/${current.uid}`);

  if (online) {
    onDisconnect(presenceRef).set({
      online: false,
      lastSeen: Date.now()
    });

    await set(presenceRef, {
      online: true,
      lastSeen: Date.now()
    });
  } else {
    await set(presenceRef, {
      online: false,
      lastSeen: Date.now()
    });
  }
}

function loadUsers() {
  if (stopUsers) stopUsers();

  stopUsers = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      renderUsers(snapshot.docs.map((d) => d.data()));
    },
    (error) => {
      console.error("Users error:", error);
      $("users").innerHTML = `<p class="error">Unable to load users.</p>`;
    }
  );
}

function renderUsers(users) {
  const search = $("search").value.trim().toLowerCase();
  $("users").innerHTML = "";

  users
    .filter((user) => user.uid !== current?.uid)
    .filter((user) => {
      const name = (user.name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      return name.includes(search) || email.includes(search);
    })
    .forEach(addUser);
}

$("search").oninput = () => {
  if (current) loadUsers();
};

function addUser(user) {
  const row = document.createElement("div");
  row.className = "user" + (selected?.uid === user.uid ? " active" : "");

  const avatar = (user.name || "U").charAt(0).toUpperCase();

  row.innerHTML = `
    <div class="avatar">${esc(avatar)}</div>
    <div>
      <b>${esc(user.name || "User")}</b>
      <small id="s-${esc(user.uid)}">Offline</small>
    </div>
  `;

  row.onclick = () => openChat(user);
  $("users").appendChild(row);

  onValue(rref(rtdb, `status/${user.uid}`), (snapshot) => {
    const statusElement = $(`s-${user.uid}`);
    const value = snapshot.val();

    if (statusElement) {
      statusElement.textContent = value?.online ? "Online" : "Offline";
    }

    if (selected?.uid === user.uid && $("chatStatus")) {
      $("chatStatus").textContent = value?.online ? "Online" : "Offline";
      $("chatStatus").className = value?.online ? "online" : "";
    }
  });
}

function cid(a, b) {
  return [a, b].sort().join("_");
}

function openChat(user) {
  selected = user;

  $("chatHeader").innerHTML = `
    <div class="avatar">${esc((user.name || "U").charAt(0).toUpperCase())}</div>
    <div style="margin-left:10px">
      <b>${esc(user.name || "User")}</b>
      <div id="chatStatus">Offline</div>
    </div>
  `;

  $("messageForm").classList.remove("hidden");
  $("messages").innerHTML = "";

  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  const messagesRef = collection(
    db,
    "conversations",
    cid(current.uid, user.uid),
    "messages"
  );

  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

  stopMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      $("messages").innerHTML = "";

      snapshot.forEach((messageDoc) => {
        render(messageDoc.data());
      });

      $("messages").scrollTop = $("messages").scrollHeight;
    },
    (error) => {
      console.error("Messages error:", error);
    }
  );
}

function render(message) {
  const sent = message.senderId === current.uid;
  const element = document.createElement("div");

  element.className = "msg " + (sent ? "sent" : "received");

  let body = "";

  if (message.type === "image") {
    body = `
      <div class="file">
        <img src="${esc(message.url)}" alt="image"
             style="max-width:250px;border-radius:10px;">
      </div>
    `;
  } else if (message.type === "file") {
    body = `
      <div class="file">
        📎
        <a href="${esc(message.url)}" target="_blank" rel="noopener noreferrer">
          ${esc(message.fileName || "File")}
        </a>
      </div>
    `;
  } else {
    body = `<div class="bubble">${esc(message.text || "")}</div>`;
  }

  const avatar = selected
    ? (selected.name || "U").charAt(0).toUpperCase()
    : "U";

  element.innerHTML = `
    ${sent ? "" : `<div class="avatar">${esc(avatar)}</div>`}
    <div>
      ${body}
      <div class="time">
        ${
          message.createdAt?.toDate
            ? message.createdAt.toDate().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })
            : ""
        }
      </div>
    </div>
  `;

  $("messages").appendChild(element);
}

$("messageForm").onsubmit = async (e) => {
  e.preventDefault();

  if (!current || !selected) return;

  const input = $("message");
  const text = input.value.trim();

  if (!text) return;

  input.value = "";

  try {
    await addDoc(
      collection(
        db,
        "conversations",
        cid(current.uid, selected.uid),
        "messages"
      ),
      {
        senderId: current.uid,
        text,
        type: "text",
        createdAt: serverTimestamp()
      }
    );
  } catch (error) {
    console.error("Message send error:", error);
    input.value = text;
  }
};

$("fileButton").onclick = () => {
  $("fileInput").accept = "*/*";
  $("fileInput").click();
};

$("imageButton").onclick = () => {
  $("fileInput").accept = "image/*";
  $("fileInput").click();
};

$("fileInput").onchange = async () => {
  const file = $("fileInput").files[0];

  if (!file || !selected || !current) return;

  try {
    const path =
      `chat-files/${cid(current.uid, selected.uid)}/${Date.now()}-${file.name}`;

    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);

    const url = await getDownloadURL(storageRef);

    await addDoc(
      collection(
        db,
        "conversations",
        cid(current.uid, selected.uid),
        "messages"
      ),
      {
        senderId: current.uid,
        url,
        fileName: file.name,
        type: file.type.startsWith("image/") ? "image" : "file",
        createdAt: serverTimestamp()
      }
    );
  } catch (error) {
    console.error("File upload error:", error);
    alert("Unable to upload the file. Check your Firebase Storage settings.");
  }

  $("fileInput").value = "";
};

$("logout").onclick = async () => {
  try {
    await setPresence(false);
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
};

async function setupNotifications() {
  if (!messaging || !vapidKey || vapidKey.includes("YOUR_")) return;

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js"
    );

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await setDoc(
        doc(db, "users", current.uid),
        { fcmToken: token },
        { merge: true }
      );
    }

    onMessage(messaging, (payload) => {
      console.log("Foreground notification:", payload);
    });
  } catch (error) {
    console.warn("Notification setup failed:", error);
  }
}

function esc(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}
