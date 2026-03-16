import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';
let socket = null;
export const connectSocket = () => {
  const token = useAuthStore.getState().accessToken;
  socket = io(import.meta.env.VITE_API_URL || '', { auth: { token } });
  return socket;
};
export const getSocket = () => socket;
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };
