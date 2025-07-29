import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

export function useFirestore<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Autenticação anônima
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Login anônimo se não estiver autenticado
        try {
          const result = await signInAnonymously(auth);
          setUserId(result.user.uid);
        } catch (error) {
          console.error('Erro na autenticação:', error);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sincronização com Firestore
  useEffect(() => {
    if (!userId) return;

    const docRef = doc(db, 'users', userId, 'data', key);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setStoredValue(docSnap.data().value);
      } else {
        // Documento não existe, criar com valor inicial
        setDoc(docRef, { value: initialValue }, { merge: true });
        setStoredValue(initialValue);
      }
      setLoading(false);
    }, (error) => {
      console.error(`Erro ao ler Firestore key "${key}":`, error);
      setStoredValue(initialValue);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, key, initialValue]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = async (value) => {
    if (!userId) return;
    
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const docRef = doc(db, 'users', userId, 'data', key);
      await setDoc(docRef, { value: valueToStore }, { merge: true });
      // O onSnapshot atualizará o estado automaticamente
    } catch (error) {
      console.error(`Erro ao salvar Firestore key "${key}":`, error);
    }
  };

  return [storedValue, setValue, loading] as const;
}