import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCR8Oysnz5l8UVt92jk9UmR4NqgPBkJkBA",
  authDomain: "dse-easy.firebaseapp.com",
  projectId: "dse-easy",
  storageBucket: "dse-easy.firebasestorage.app",
  messagingSenderId: "614010697994",
  appId: "1:614010697994:web:2a89878437b01fca7562f3",
  measurementId: "G-5EPE3H3S04"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const messaging = getMessaging(app);

export { auth, messaging };
export default app;
