import { api } from './api';
import { hasSession } from './auth-storage';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request notification permission, subscribe to Web Push, and register with backend.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;

  if (!hasSession()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.register('/sw-push.js');
    await navigator.serviceWorker.ready;

    let vapidKey = VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      try {
        const res: any = await api.get('/devices/vapid-public-key');
        vapidKey = res?.publicKey || res?.data?.publicKey || '';
      } catch {
        return false;
      }
    }

    if (!vapidKey) return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    await api.post('/devices/register', {
      fcmToken: JSON.stringify(subscription),
      deviceType: 'web',
      deviceName: navigator.userAgent.substring(0, 100),
    });

    return true;
  } catch (error) {
    console.warn('Failed to set up push notifications:', error);
    return false;
  }
}
