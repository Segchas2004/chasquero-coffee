// Configuración de Firebase (tu configuración real)
const firebaseConfig = {
  apiKey: "AIzaSyDXKFyT5UHdxbzgAJw5zFmo_DnxI6gDuLA",
  authDomain: "app-cafe-caf16.firebaseapp.com",
  projectId: "app-cafe-caf16",
  storageBucket: "app-cafe-caf16.firebasestorage.app",
  messagingSenderId: "786373273884",
  appId: "1:786373273884:web:43f736a46147f2e54232d9"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Servicios
const auth = firebase.auth();
const db = firebase.firestore();

console.log("Firebase conectado:", firebase.apps.length > 0);
