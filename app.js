import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDoc, getDocs, query, orderBy, onSnapshot, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { getDatabase, ref as dbRef, onDisconnect, set, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

/*
  1. Create a Firebase project.
  2. Enable Authentication > Email/Password.
  3. Create Firestore Database.
  4. Create Realtime Database.
  5. Enable Storage.
  6. Replace the firebaseConfig values below with your Firebase Web App config.
*/

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
};

const firebaseConfigured = !Object.values(firebaseConfig).some(v => v.includes("YOUR_"));

let firebaseApp, auth, db, storage, realtimeDb;
if (firebaseConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  storage = getStorage(firebaseApp);
  realtimeDb = getDatabase(firebaseApp);
}

const $ = id => document.getElementById(id);
const authScreen=$("authScreen"), mainApp=$("mainApp"), authForm=$("authForm");
const loginTab=$("loginTab"), registerTab=$("registerTab"), nameInput=$("nameInput");
const emailInput=$("emailInput"), passwordInput=$("passwordInput"), authSubmit=$("authSubmit"), authMessage=$("authMessage");
const usersList=$("usersList"), userSearch=$("userSearch"), messages=$("messages"), messageForm=$("messageForm");
const messageInput=$("messageInput"), fileInput=$("fileInput"), attachBtn=$("attachBtn"), imageBtn=$("imageBtn");
const myAvatar=$("myAvatar"), myName=$("myName"), logoutBtn=$("logoutBtn");
const emptyHeader=$("emptyHeader"), activeHeader=$("activeHeader"), chatAvatar=$("chatAvatar"), chatName=$("chatName"), chatStatus=$("chatStatus"), chatActions=$("chatActions");
const profilePanel=$("profilePanel"), profileAvatar=$("profileAvatar"), profileName=$("profileName"), profileEmail=$("profileEmail"), profileStatus=$("profileStatus"), closeProfile=$("closeProfile");

let registerMode=false, currentUser=null, selectedUser=null, unsubscribeMessages=null, users=[];

function setMessage(text,error=true){authMessage.textContent=text;authMessage.style.color=error?"#d93025":"#31a24c"}

function initials(name="User"){return name.trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}

function avatarClass(uid=""){const n=[...uid].reduce((a,c)=>a+c.charCodeAt(0),0)%5;return ["blue","pink","green","orange","purple"][n]}

function setAuthMode(register){
  registerMode=register;
  loginTab.classList.toggle("active",!register); registerTab.classList.toggle("active",register);
  nameInput.classList.toggle("hidden",!register); nameInput.required=register;
  authSubmit.textContent=register?"Register":"Login"; setMessage("");
}

loginTab.onclick=()=>setAuthMode(false); registerTab.onclick=()=>setAuthMode(true);

authForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!firebaseConfigured){setMessage("Add your Firebase configuration in app.js first.");return}
  try{
    setMessage("Please wait...",false);
    if(registerMode){
      const cred=await createUserWithEmailAndPassword(auth,emailInput.value.trim(),passwordInput.value);
      await updateProfile(cred.user,{displayName:nameInput.value.trim()});
      await setDoc(doc(db,"users",cred.user.uid),{uid:cred.user.uid,name:nameInput.value.trim(),email:emailInput.value.trim(),createdAt:serverTimestamp()});
    }else await signInWithEmailAndPassword(auth,emailInput.value.trim(),passwordInput.value);
  }catch(err){setMessage(err.message.replace("Firebase: ",""))}
});

function showMain(user){
  currentUser=user; authScreen.classList.add("hidden"); mainApp.classList.remove("hidden");
  const name=user.displayName||user.email.split("@")[0];
  myName.textContent=name; myAvatar.textContent=initials(name); myAvatar.className="avatar "+avatarClass(user.uid);
  profileAvatar.textContent=initials(name); profileAvatar.className="avatar profile-avatar "+avatarClass(user.uid);
  profileName.textContent=name; profileEmail.textContent=user.email;
  listenPresence(); loadUsers();
}

async function loadUsers(){
  if(!db)return;
  onSnapshot(collection(db,"users"),snap=>{
    users=snap.docs.map(d=>d.data()).filter(u=>u.uid!==currentUser.uid);
    renderUsers();
  });
}

function renderUsers(){
  const search=userSearch.value.toLowerCase();
  usersList.innerHTML="";
  users.filter(u=>(u.name||"").toLowerCase().includes(search)||(u.email||"").toLowerCase().includes(search)).forEach(user=>{
    const row=document.createElement("div"); row.className="user-row"+(selectedUser?.uid===user.uid?" active":"");
    row.innerHTML=`<div class="avatar ${avatarClass(user.uid)}">${initials(user.name||"User")}</div>
      <div class="user-row-info"><strong>${escapeHtml(user.name||"User")}</strong><small id="presence-${user.uid}">Checking status...</small></div>`;
    row.onclick=()=>selectUser(user); usersList.appendChild(row); listenUserPresence(user.uid);
  });
}

userSearch.addEventListener("input",renderUsers);

function listenUserPresence(uid){
  if(!realtimeDb)return;
  onValue(dbRef(realtimeDb,`status/${uid}`),snap=>{
    const el=$(`presence-${uid}`); const data=snap.val();
    if(el)el.textContent=data?.online?"Online":"Offline";
    if(selectedUser?.uid===uid) updateChatStatus(data);
  });
}

function listenPresence(){
  if(!realtimeDb||!currentUser)return;
  const statusRef=dbRef(realtimeDb,`status/${currentUser.uid}`);
  onDisconnect(statusRef).set({online:false,lastSeen:Date.now()});
  set(statusRef,{online:true,lastSeen:Date.now()});
}

function updateChatStatus(data){
  chatStatus.textContent=data?.online?"Online":"Offline";
  chatStatus.classList.toggle("online",!!data?.online);
}

function conversationId(a,b){return [a,b].sort().join("_")}

function selectUser(user){
  selectedUser=user; renderUsers();
  emptyHeader.classList.add("hidden"); activeHeader.classList.remove("hidden"); chatActions.classList.remove("hidden"); messageForm.classList.remove("hidden");
  chatName.textContent=user.name||"User"; chatAvatar.textContent=initials(user.name||"User"); chatAvatar.className="avatar "+avatarClass(user.uid);
  chatStatus.textContent="Checking status..."; messages.innerHTML="";
  profilePanel.classList.add("hidden");
  if(unsubscribeMessages)unsubscribeMessages();
  if(!db)return;
  const cid=conversationId(currentUser.uid,user.uid);
  const q=query(collection(db,"conversations",cid,"messages"),orderBy("createdAt","asc"));
  unsubscribeMessages=onSnapshot(q,snap=>{
    messages.innerHTML="";
    snap.forEach(d=>renderMessage(d.data()));
    messages.scrollTop=messages.scrollHeight;
  });
  listenUserPresence(user.uid);
}

function renderMessage(m){
  const sent=m.senderId===currentUser.uid;
  const wrap=document.createElement("div"); wrap.className="message "+(sent?"sent":"received");
  const avatar=!sent?`<div class="avatar small ${avatarClass(selectedUser.uid)}">${initials(selectedUser.name||"User")}</div>`:"";
  let content="";
  if(m.type==="image") content=`<img class="message-image" src="${m.url}" alt="Image">`;
  else if(m.type==="file") content=`<div class="file-card">📎 <a href="${m.url}" target="_blank" rel="noopener">${escapeHtml(m.fileName||"File")}</a></div>`;
  else content=`<div class="bubble">${escapeHtml(m.text||"")}</div>`;
  wrap.innerHTML=`${avatar}<div class="message-content">${content}<span class="message-time">${formatTime(m.createdAt)}</span></div>`;
  messages.appendChild(wrap);
}

async function sendText(text){
  if(!selectedUser||!db||!text.trim())return;
  const cid=conversationId(currentUser.uid,selectedUser.uid);
  await addDoc(collection(db,"conversations",cid,"messages"),{senderId:currentUser.uid,text:text.trim(),type:"text",createdAt:serverTimestamp()});
}

messageForm.addEventListener("submit",async e=>{e.preventDefault();const text=messageInput.value.trim();if(!text)return;messageInput.value="";try{await sendText(text)}catch(err){alert(err.message)}});

attachBtn.onclick=()=>fileInput.click(); imageBtn.onclick=()=>{fileInput.accept="image/*";fileInput.click()};

fileInput.addEventListener("change",async()=>{
  const file=fileInput.files[0]; if(!file||!selectedUser||!storage)return;
  try{
    const cid=conversationId(currentUser.uid,selectedUser.uid), path=`chat-files/${cid}/${Date.now()}-${file.name}`;
    const storageRef=ref(storage,path); await uploadBytes(storageRef,file); const url=await getDownloadURL(storageRef);
    await addDoc(collection(db,"conversations",cid,"messages"),{senderId:currentUser.uid,url,fileName:file.name,type:file.type.startsWith("image/")?"image":"file",createdAt:serverTimestamp()});
  }catch(err){alert(err.message)}
  fileInput.value="";
});

logoutBtn.onclick=async()=>{if(realtimeDb&&currentUser)await set(dbRef(realtimeDb,`status/${currentUser.uid}`),{online:false,lastSeen:Date.now()});if(auth)await signOut(auth)};

profileAvatar.onclick=()=>profilePanel.classList.remove("hidden"); myAvatar.onclick=()=>profilePanel.classList.remove("hidden"); closeProfile.onclick=()=>profilePanel.classList.add("hidden");

function formatTime(ts){if(!ts?.toDate)return "";return ts.toDate().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
function escapeHtml(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}

if(firebaseConfigured){
  onAuthStateChanged(auth,user=>{if(user)showMain(user);else{currentUser=null;authScreen.classList.remove("hidden");mainApp.classList.add("hidden")}});
}else{
  setMessage("Demo files ready. Add Firebase config in app.js to enable real accounts and chat.");
}
