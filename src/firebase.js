import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyAeamhHfotd5ryoL2qy2WtJr2w0BN4e4mA",
  authDomain: "bangtinh-2415f.firebaseapp.com",
  projectId: "bangtinh-2415f",
  storageBucket: "bangtinh-2415f.firebasestorage.app",
  messagingSenderId: "787253100685",
  appId: "1:787253100685:web:45e9d29aec27b6459662c4",
  measurementId: "G-5ZEEGSB1LX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
