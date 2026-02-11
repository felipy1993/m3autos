import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
// Configuração direta do Firebase (Hardcoded para evitar erros na Vercel)
const firebaseConfig = {
  apiKey: "AIzaSyBg1xv3BfqyzwAvjgseudTn4CPcjX0ynFU",
  authDomain: "m3-autos.firebaseapp.com",
  projectId: "m3-autos",
  storageBucket: "m3-autos.firebasestorage.app",
  messagingSenderId: "668732505794",
  appId: "1:668732505794:web:e36ca9090d4723db02855b"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const carsCollection = collection(db, "carros");
const leadsCollection = collection(db, "leads");
const configDoc = doc(db, "config", "site");

// --- AUTENTICAÇÃO ---

export async function loginAdmin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Erro ao fazer login:", error.code);
    throw error;
  }
}

export async function logoutAdmin() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
  }
}

export function checkAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Erro ao enviar e-mail de recuperação:", error.code);
    throw error;
  }
}

// --- CRUD DE CARROS ---

// Adicionar carro
export async function addCar(carData) {
  try {
    const docRef = await addDoc(carsCollection, {
      ...carData,
      createdAt: new Date().toISOString(),
      vendido: false
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar carro: ", error);
    throw error;
  }
}

// Buscar todos os carros (tempo real)
export function subscribeToCars(callback) {
  const q = query(carsCollection, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const cars = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(cars);
  }, (error) => {
    console.error("Erro ao assinar carros:", error);
  });
}

// Atualizar carro
export async function updateCar(id, carData) {
  try {
    const carRef = doc(db, "carros", id);
    await updateDoc(carRef, carData);
  } catch (error) {
    console.error("Erro ao atualizar carro: ", error);
    throw error;
  }
}

// Excluir carro
export async function deleteCar(id) {
  try {
    const carRef = doc(db, "carros", id);
    await deleteDoc(carRef);
  } catch (error) {
    console.error("Erro ao excluir carro: ", error);
    throw error;
  }
}

// Marcar como vendido
export async function toggleSold(id, currentStatus) {
  return updateCar(id, { vendido: !currentStatus });
}

// --- LEADS ---

export async function addLead(leadData) {
  try {
    await addDoc(leadsCollection, {
      ...leadData,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erro ao salvar lead:", error);
  }
}

export function subscribeToLeads(callback) {
  const q = query(leadsCollection, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(leads);
  });
}

// --- STORAGE DE IMAGENS ---

export async function uploadCarImages(files) {
  const uploadPromises = Array.from(files).map(async (file) => {
    const storageRef = ref(storage, `carros/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  });

  return Promise.all(uploadPromises);
}

// --- CONFIGURAÇÃO DO SITE ---

// Salvar config do site
export async function saveSiteConfig(config) {
  try {
    await setDoc(configDoc, config, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    throw error;
  }
}

// Carregar config do site
export function subscribeToConfig(callback) {
  return onSnapshot(configDoc, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
}
