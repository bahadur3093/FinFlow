import api from './api.js';
export const subscribeToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.ready;
  const { data } = await api.get('/push/vapid-key');
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: data.publicKey });
  await api.post('/push/subscribe', sub);
};
