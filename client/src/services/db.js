import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

// COLECCIONES
const PATIENTS_COLLECTION = 'patients';
const APPOINTMENTS_COLLECTION = 'appointments';
const INVENTORY_COLLECTION = 'inventory';
const INVOICES_COLLECTION = 'invoices';
const USERS_COLLECTION = 'users';

// --- PACIENTES ---
export const getPatients = async () => {
  const querySnapshot = await getDocs(collection(db, PATIENTS_COLLECTION));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getPatient = async (id) => {
  const docSnap = await getDoc(doc(db, PATIENTS_COLLECTION, id));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const addPatient = async (patientData) => {
  const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), patientData);
  return { id: docRef.id, ...patientData };
};

export const updatePatient = async (id, patientData) => {
  await updateDoc(doc(db, PATIENTS_COLLECTION, id), patientData);
};

export const deletePatient = async (id) => {
  await deleteDoc(doc(db, PATIENTS_COLLECTION, id));
};

// Historial Médico (Subcolección de Paciente)
export const getMedicalHistory = async (patientId) => {
  const q = query(collection(db, `${PATIENTS_COLLECTION}/${patientId}/medical-history`), orderBy('fecha', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addMedicalHistory = async (patientId, historyData) => {
  await addDoc(collection(db, `${PATIENTS_COLLECTION}/${patientId}/medical-history`), historyData);
};

export const updateMedicalHistory = async (patientId, historyId, historyData) => {
  await updateDoc(doc(db, `${PATIENTS_COLLECTION}/${patientId}/medical-history`, historyId), historyData);
};

export const deleteMedicalHistory = async (patientId, historyId) => {
  await deleteDoc(doc(db, `${PATIENTS_COLLECTION}/${patientId}/medical-history`, historyId));
};

// Vacunas (Subcolección de Paciente)
export const getVaccines = async (patientId) => {
  const querySnapshot = await getDocs(collection(db, `${PATIENTS_COLLECTION}/${patientId}/vaccines`));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addVaccine = async (patientId, vaccineData) => {
  await addDoc(collection(db, `${PATIENTS_COLLECTION}/${patientId}/vaccines`), vaccineData);
};

export const updateVaccine = async (patientId, vaccineId, vaccineData) => {
  await updateDoc(doc(db, `${PATIENTS_COLLECTION}/${patientId}/vaccines`, vaccineId), vaccineData);
};

export const deleteVaccine = async (patientId, vaccineId) => {
  await deleteDoc(doc(db, `${PATIENTS_COLLECTION}/${patientId}/vaccines`, vaccineId));
};

// --- INVENTARIO ---
export const getInventory = async () => {
  const querySnapshot = await getDocs(collection(db, INVENTORY_COLLECTION));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addInventoryItem = async (itemData) => {
  const docRef = await addDoc(collection(db, INVENTORY_COLLECTION), itemData);
  return { id: docRef.id, ...itemData };
};

export const updateInventoryItem = async (id, itemData) => {
  await updateDoc(doc(db, INVENTORY_COLLECTION, id), itemData);
};

export const deleteInventoryItem = async (id) => {
  await deleteDoc(doc(db, INVENTORY_COLLECTION, id));
};

// --- CITAS ---
export const getAppointments = async () => {
  const q = query(collection(db, APPOINTMENTS_COLLECTION), orderBy('fecha', 'asc'));
  const querySnapshot = await getDocs(q);
  // Sort by time in memory to avoid composite index requirement
  const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return docs.sort((a, b) => {
    if (a.fecha === b.fecha) return (a.hora || '').localeCompare(b.hora || '');
    return 0;
  });
};

export const addAppointment = async (appointmentData) => {
  const docRef = await addDoc(collection(db, APPOINTMENTS_COLLECTION), appointmentData);
  return { id: docRef.id, ...appointmentData };
};

export const updateAppointment = async (id, appointmentData) => {
  await updateDoc(doc(db, APPOINTMENTS_COLLECTION, id), appointmentData);
};

export const deleteAppointment = async (id) => {
  await deleteDoc(doc(db, APPOINTMENTS_COLLECTION, id));
};

// --- FACTURAS ---
export const getInvoices = async () => {
  const q = query(collection(db, INVOICES_COLLECTION), orderBy('fecha', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addInvoice = async (invoiceData) => {
  const docRef = await addDoc(collection(db, INVOICES_COLLECTION), invoiceData);
  return { id: docRef.id, ...invoiceData };
};

export const updateInvoice = async (id, updates) => {
  await updateDoc(doc(db, INVOICES_COLLECTION, id), updates);
};

// --- USUARIOS (por correo) ---
export const getUsers = async () => {
  const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUserByEmail = async (email) => {
  const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase()));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const docSnap = querySnapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

export const addUserRole = async (userData) => {
  // userData: { email, nombre, rol }
  const docRef = await addDoc(collection(db, USERS_COLLECTION), {
    email: userData.email.toLowerCase().trim(),
    nombre: userData.nombre,
    rol: userData.rol
  });
  return { id: docRef.id, ...userData };
};

export const updateUserRole = async (id, rol) => {
  await updateDoc(doc(db, USERS_COLLECTION, id), { rol });
};

export const deleteUserRole = async (id) => {
  await deleteDoc(doc(db, USERS_COLLECTION, id));
};
