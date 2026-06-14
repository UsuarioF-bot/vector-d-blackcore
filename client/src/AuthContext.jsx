import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from './firebaseConfig';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from './services/db';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Correos con rol fijo (no dependen de Firestore para garantía)
const HARDCODED_ADMINS = ['aramosfugon28@gmail.com'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userNombre, setUserNombre] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Error logging in with Google:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setUserRole(null);
      setUserNombre(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        const email = user.email?.toLowerCase() || '';

        // 1. Verificar si es admin hardcoded
        if (HARDCODED_ADMINS.includes(email)) {
          setUserRole('Administrador');
          setUserNombre(user.displayName || user.email);
          setLoading(false);
          return;
        }

        // 2. Buscar en Firestore por email
        try {
          const userDoc = await getUserByEmail(email);
          if (userDoc) {
            setUserRole(userDoc.rol || 'Veterinario');
            setUserNombre(userDoc.nombre || user.displayName || user.email);
          } else {
            // Si no está registrado en el sistema, acceso denegado (rol null)
            setUserRole(null);
            setUserNombre(null);
          }
        } catch (e) {
          console.error('Error fetching user role:', e);
          setUserRole('Veterinario'); // fallback seguro
          setUserNombre(user.displayName || user.email);
        }
      } else {
        setUserRole(null);
        setUserNombre(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userNombre,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
