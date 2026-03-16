import webpush from 'web-push';
import { prisma } from '../services/db.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:app@finflow.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export const getVapidKey = (_, res) => res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });

export const subscribe = async (req, res) => {
  const { endpoint, keys: { p256dh, auth } } = req.body;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth },
    create: { endpoint, p256dh, auth, userId: req.user.id }
  });
  res.status(201).json({ message: 'Subscribed' });
};
