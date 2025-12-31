import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { logDebug, logError, logWarn } from '../utils/logger';

// Check if push notifications are available
export const isPushAvailable = () => {
  return Capacitor.isNativePlatform();
};

// Request permission and register for push notifications
export const initializePushNotifications = async (): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> => {
  if (!isPushAvailable()) {
    logDebug('Push notifications not available on web');
    return { success: false, error: 'Not on native platform' };
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();

    if (permResult.receive === 'granted') {
      // Register with APNs/FCM
      await PushNotifications.register();

      return { success: true };
    } else {
      logWarn('Push permission denied');
      return { success: false, error: 'Permission denied' };
    }
  } catch (error) {
    logError('Push init error');
    return { success: false, error: String(error) };
  }
};

// Check current permission status
export const checkPushPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isPushAvailable()) {
    return 'denied';
  }

  try {
    const result = await PushNotifications.checkPermissions();
    return result.receive;
  } catch {
    return 'denied';
  }
};

// Setup push notification listeners
export const setupPushListeners = (callbacks: {
  onRegistration?: (token: string) => void;
  onRegistrationError?: (error: string) => void;
  onNotificationReceived?: (notification: PushNotificationData) => void;
  onNotificationTapped?: (notification: PushNotificationData) => void;
}) => {
  if (!isPushAvailable()) return () => {};

  // Registration success
  const regListener = PushNotifications.addListener('registration', (token) => {
    logDebug('Push registration success');
    callbacks.onRegistration?.(token.value);
  });

  // Registration error
  const regErrorListener = PushNotifications.addListener('registrationError', (error) => {
    logError('Push registration error');
    callbacks.onRegistrationError?.(error.error);
  });

  // Notification received while app is in foreground
  const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    logDebug('Push received');
    callbacks.onNotificationReceived?.({
      id: notification.id,
      title: notification.title || '',
      body: notification.body || '',
      data: notification.data,
    });
  });

  // Notification tapped (app opened from notification)
  const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    logDebug('Push tapped');
    callbacks.onNotificationTapped?.({
      id: action.notification.id,
      title: action.notification.title || '',
      body: action.notification.body || '',
      data: action.notification.data,
    });
  });

  // Return cleanup function
  return () => {
    regListener.then(l => l.remove());
    regErrorListener.then(l => l.remove());
    receivedListener.then(l => l.remove());
    actionListener.then(l => l.remove());
  };
};

// Data structure for notifications
export interface PushNotificationData {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Show a local notification (useful for showing notifications when app is in foreground)
export const showLocalNotification = async (
  title: string,
  body: string,
  data?: Record<string, unknown>
) => {
  if (!isPushAvailable()) {
    // Fallback for web - use browser notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }

  // For native, we'd need @capacitor/local-notifications
  // For now, just log it
  logDebug('Local notification:', { title, body, data });
};

// Get list of delivered notifications
export const getDeliveredNotifications = async () => {
  if (!isPushAvailable()) return [];

  try {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  } catch {
    return [];
  }
};

// Remove specific delivered notification
export const removeDeliveredNotification = async (id: string) => {
  if (!isPushAvailable()) return;

  try {
    await PushNotifications.removeDeliveredNotifications({ notifications: [{ id }] });
  } catch (error) {
    logError('Remove notification error');
  }
};

// Remove all delivered notifications
export const removeAllDeliveredNotifications = async () => {
  if (!isPushAvailable()) return;

  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    logError('Remove all notifications error');
  }
};
