import { useState } from 'react';

export const STORAGE_CARDS_KEY = 'lamencards_custom_catalog_v2';
export const STORAGE_CONFIG_KEY = 'lamencards_custom_config_v2';
export const STORAGE_PLAYER_ID_KEY = 'lamencards_device_player_id_v1';
export const STORAGE_PLAYER_NAME_KEY = 'lamencards_device_player_name_v1';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      // fallback if quota exceeded
    }
  };

  return [storedValue, setValue];
}

export function getOrCreateDevicePlayerId(): string {
  const existing = sessionStorage.getItem(STORAGE_PLAYER_ID_KEY);
  if (existing) return existing;
  const created = `p-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36).slice(-3)}`;
  sessionStorage.setItem(STORAGE_PLAYER_ID_KEY, created);
  return created;
}

export function generateSafeRoomCode(): string {
  // Nessun carattere ambiguo 0/O o 1/I
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Ridimensiona e comprime una foto caricata dall'utente al formato carta (max 630x880 px)
 * in WebP/PNG compresso per non saturare mai localStorage o i messaggi WebRTC.
 */
export function compressAndResizeCardPhoto(
  file: File,
  maxWidth = 420,
  maxHeight = 580
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore lettura file immagine'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const targetW = Math.round(img.width * ratio);
        const targetH = Math.round(img.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const webpData = canvas.toDataURL('image/webp', 0.82);
        if (webpData.startsWith('data:image/webp')) {
          resolve(webpData);
        } else {
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
