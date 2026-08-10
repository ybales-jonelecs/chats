import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
import { getDatabase, ref as rref, set, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js";

import { firebaseConfig, vapidKey } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app),rtdb=getDatabase(app);
let messaging=null;
try{messaging=getMessaging(app)}catch(e){console.warn("FCM unavailable",e)}

const $=x=>document.getElementById(x);
let register=false,current=null,selected=null,stopMessages=null;

$("loginTab").onclick=()=>mode(false);$("registerTab").onclick=()=>mode(true);
function mode(v){register=v;$("loginTab").classList.toggle("active",!v);$("registerTab").classList.toggle("active",v);$("name").classList.toggle("hidden",!v);$("name").required=v;$("authButton").textContent=v?"Register":"Login";$("authError").textContent=""}

$("authForm").onsubmit=async e=>{
 e.preventDefault();$("authError").textContent="";
 try{
  if(register){
   const c=await createUserWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);
   await updateProfile(c.user,{displayName:$("name").value.trim()});
   await setDoc(doc(db,"users",c.user.uid),{uid:c.user.uid,name:$("name").value.trim(),email:c.user.email,createdAt:serverTimestamp()});
  }else await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);
 }catch(e){$("authError").textContent=e.message}
};

onAuthStateChanged(auth,async user=>{
 if(!user){$("authScreen").classList.remove("hidden");$("app").classList.add("hidden");return}
 current=user;$("authScreen").classList.add("hidden");$("app").classList.remove("hidden");
 const n=user.displayName||user.email.split("@")[0];$("myName").textContent=n;$("myAvatar").textContent=n[0].toUpperCase();
 await setPresence(true);loadUsers();setupNotifications();
});

async function setPresence(online){
 const p=rref(rtdb,`status/${current.uid}`);
 if(online){onDisconnect(p).set({online:false,lastSeen:Date.now()});await set(p,{online:true,lastSeen:Date.now()})}
 else await set(p,{online:false,lastSeen:Date.now()});
}

async function loadUsers(){
 onSnapshot(collection(db,"users"),snap=>{
  const search=$("search").value.toLowerCase();$("users").innerHTML="";
  snap.docs.map(d=>d.data()).filter(u=>u.uid!==current.uid&&((u.name||"").toLowerCase().includes(search)||(u.email||"").toLowerCase().includes(search))).forEach(addUser);
 });
}
$("search").oninput=loadUsers;

function addUser(u){
 const row=document.createElement("div");row.className="user"+(selected?.uid===u.uid?" active":"");
 row.innerHTML=`<div class="avatar">${esc((u.name||"U")[0].toUpperCase())}</div><div><b>${esc(u.name||"User")}</b><small id="s-${u.uid}">Offline</small></div>`;
 row.onclick=()=>openChat(u);$("users").appendChild(row);
 onValue(rref(rtdb,`status/${u.uid}`),s=>{const x=$(`s-${u.uid}`),v=s.val();if(x)x.textContent=v?.online?"Online":"Offline";if(selected?.uid===u.uid){$("chatStatus").textContent=v?.online?"Online":"Offline";$("chatStatus").className=v?.online?"online":""}});
}

function cid(a,b){return[a,b].sort().join("_")}
function openChat(u){
 selected=u;$("chatHeader").innerHTML=`<div class="avatar">${esc((u.name||"U")[0].toUpperCase())}</div><div style="margin-left:10px"><b>${esc(u.name||"User")}</b><div id="chatStatus">Offline</div></div>`;
 $("messageForm").classList.remove("hidden");$("messages").innerHTML="";
 if(stopMessages)stopMessages();
 const q=query(collection(db,"conversations",cid(current.uid,u.uid),"messages"),orderBy("createdAt","asc"));
 stopMessages=onSnapshot(q,snap=>{ $("messages").innerHTML="";snap.forEach(d=>render(d.data()));$("messages").scrollTop=$("messages").scrollHeight});
}

function render(m){
 const sent=m.senderId===current.uid,x=document.createElement("div");x.className="msg "+(sent?"sent":"received");
 let body="";
 if(m.type==="image")body=`<div class="file"><img src="${m.url}" alt="image"></div>`;
 else if(m.type==="file")body=`<div class="file">📎 <a href="${m.url}" target="_blank">${esc(m.fileName||"File")}</a></div>`;
 else body=`<div class="bubble">${esc(m.text||"")}</div>`;
 x.innerHTML=`${sent?"":`<div class="avatar">${esc((selected.name||"U")[0].toUpperCase())}</div>`}<div>${body}<div class="time">${m.createdAt?.toDate?m.createdAt.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</div></div>`;
 $("messages").appendChild(x);
}

$("messageForm").onsubmit=async e=>{
 e.preventDefault();const text=$("message").value.trim();if(!text||!selected)return;
 $("message").value="";await addDoc(collection(db,"conversations",cid(current.uid,selected.uid),"messages"),{senderId:current.uid,text,type:"text",createdAt:serverTimestamp()});
};

$("fileButton").onclick=()=>{$("fileInput").accept="*/*";$("fileInput").click()};
$("imageButton").onclick=()=>{$("fileInput").accept="image/*";$("fileInput").click()};
$("fileInput").onchange=async()=>{
 const f=$("fileInput").files[0];if(!f||!selected)return;
 const path=`chat-files/${cid(current.uid,selected.uid)}/${Date.now()}-${f.name}`,sr=ref(storage,path);
 await uploadBytes(sr,f);const url=await getDownloadURL(sr);
 await addDoc(collection(db,"conversations",cid(current.uid,selected.uid),"messages"),{senderId:current.uid,url,fileName:f.name,type:f.type.startsWith("image/")?"image":"file",createdAt:serverTimestamp()});
 $("fileInput").value="";
};

$("logout").onclick=async()=>{await setPresence(false);await signOut(auth)};

async function setupNotifications(){
 if(!messaging||!vapidKey||vapidKey.includes("YOUR_"))return;
 try{
  const permission=await Notification.requestPermission();if(permission!=="granted")return;
  const token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:await navigator.serviceWorker.register("./firebase-messaging-sw.js")});
  if(token)await setDoc(doc(db,"users",current.uid),{fcmToken:token},{merge:true});
  onMessage(messaging,p=>console.log("Foreground notification",p));
 }catch(e){console.warn("Notification setup failed",e)}
}
function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}
