const messageForm=document.getElementById("messageForm"),messageInput=document.getElementById("messageInput"),messages=document.getElementById("messages"),chatList=document.getElementById("chatList"),headerName=document.getElementById("headerName"),headerAvatar=document.getElementById("headerAvatar"),status=document.getElementById("status"),searchInput=document.getElementById("searchInput"),emojiBtn=document.getElementById("emojiBtn"),emojiPanel=document.getElementById("emojiPanel"),newChatBtn=document.getElementById("newChatBtn");

function getCurrentTime(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}

function addMessage(text){if(!text.trim())return;const message=document.createElement("div");message.className="message sent";message.innerHTML=`<div class="message-content"><div class="bubble"></div><span class="message-time">${getCurrentTime()}</span></div>`;message.querySelector(".bubble").textContent=text;messages.appendChild(message);messages.scrollTop=messages.scrollHeight}

messageForm.addEventListener("submit",e=>{e.preventDefault();const text=messageInput.value.trim();if(!text)return;addMessage(text);messageInput.value="";setTimeout(()=>{const reply=document.createElement("div");reply.className="message received";reply.innerHTML=`<div class="avatar blue small">${headerName.textContent.charAt(0)}</div><div class="message-content"><span class="sender">${headerName.textContent}</span><div class="bubble">Thanks for your message! 👋</div><span class="message-time">${getCurrentTime()}</span></div>`;messages.appendChild(reply);messages.scrollTop=messages.scrollHeight},1000)});

function selectChat(chat){document.querySelectorAll(".chat").forEach(x=>x.classList.remove("active"));chat.classList.add("active");const name=chat.dataset.name,avatar=chat.querySelector(".avatar");headerName.textContent=name;headerAvatar.textContent=avatar.textContent;headerAvatar.className="avatar "+(avatar.classList.contains("pink")?"pink":avatar.classList.contains("green")?"green":"blue");status.textContent="Active now";messages.innerHTML=`<div class="message received"><div class="avatar small ${headerAvatar.classList.contains("pink")?"pink":headerAvatar.classList.contains("green")?"green":"blue"}">${avatar.textContent}</div><div class="message-content"><span class="sender">${name}</span><div class="bubble">Hi! 👋</div><span class="message-time">${getCurrentTime()}</span></div></div>`;messageInput.focus()}

document.querySelectorAll(".chat").forEach(chat=>chat.addEventListener("click",()=>selectChat(chat)));

searchInput.addEventListener("input",()=>{const search=searchInput.value.toLowerCase();document.querySelectorAll(".chat").forEach(chat=>chat.style.display=chat.dataset.name.toLowerCase().includes(search)?"flex":"none")});

emojiBtn.addEventListener("click",()=>emojiPanel.classList.toggle("show"));
document.querySelectorAll(".emoji-panel button").forEach(button=>button.addEventListener("click",()=>{messageInput.value+=button.textContent;messageInput.focus();emojiPanel.classList.remove("show")}));
document.addEventListener("click",e=>{if(!emojiPanel.contains(e.target)&&e.target!==emojiBtn)emojiPanel.classList.remove("show")});

newChatBtn.addEventListener("click",()=>{const name=prompt("Enter the name of the person you want to chat with:");if(!name||!name.trim())return;const cleanName=name.trim(),chat=document.createElement("div");chat.className="chat";chat.dataset.name=cleanName;chat.innerHTML=`<div class="avatar blue">${cleanName.charAt(0).toUpperCase()}</div><div class="chat-info"><strong>${cleanName}</strong><p>Start a conversation</p></div><span class="time">Now</span>`;chatList.appendChild(chat);chat.addEventListener("click",()=>selectChat(chat));selectChat(chat)});

messageInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();messageForm.requestSubmit()}});

messages.scrollTop=messages.scrollHeight;messageInput.focus();
