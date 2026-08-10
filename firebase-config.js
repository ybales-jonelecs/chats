// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAy1hi8vq_bOCpsmCDxgof49cYLaCJ46lg",
  authDomain: "chats-54e77.firebaseapp.com",
  projectId: "chats-54e77",
  storageBucket: "chats-54e77.firebasestorage.app",
  messagingSenderId: "851919939421",
  appId: "1:851919939421:web:80650b62201b27d3a4aab4",
  measurementId: "G-9PM2NYMJVJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
