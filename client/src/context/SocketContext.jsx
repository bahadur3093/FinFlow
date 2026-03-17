import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const accessToken = useAuthStore(s => s.accessToken);

  useEffect(() => {
    // Only connect if logged in
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Don't reconnect if already connected
    if (socketRef.current?.connected) return;

    const socket = io(import.meta.env.VITE_API_URL || '', {
      auth: { token: accessToken },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect',            () => setConnected(true));
    socket.on('disconnect',         () => setConnected(false));
    socket.on('connect_error', (e)  => console.warn('Socket error:', e.message));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);