import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
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
    // Request push notification permission
    const permResult = await PushNotifications.requestPermissions();

    // Also request local notification permission
    await LocalNotifications.requestPermissions();

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

  // Registration error - still allow local notifications
  const regErrorListener = PushNotifications.addListener('registrationError', (error) => {
    logError('Push registration error - FCM not available, using local notifications');
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

  // Also setup local notification listeners
  const localActionListener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    logDebug('Local notification tapped');
    callbacks.onNotificationTapped?.({
      id: String(action.notification.id),
      title: action.notification.title || '',
      body: action.notification.body || '',
      data: action.notification.extra as Record<string, unknown>,
    });
  });

  // Return cleanup function
  return () => {
    regListener.then(l => l.remove());
    regErrorListener.then(l => l.remove());
    receivedListener.then(l => l.remove());
    actionListener.then(l => l.remove());
    localActionListener.then(l => l.remove());
  };
};

// Data structure for notifications
export interface PushNotificationData {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Show a local notification (shows in Android notification tray)
// This is used to display notifications on the RECIPIENT's device when
// they receive a notification via Supabase Realtime subscription.
export const showLocalNotification = async (
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> => {
  logDebug('showLocalNotification called:', { title, body, isNative: isPushAvailable() });

  if (!isPushAvailable()) {
    // Fallback for web - use browser notification API
    logDebug('Not on native platform, trying browser notification');
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
          return true;
        }
      }
    }
    return false;
  }

  try {
    // Check and request permission if needed
    const permStatus = await LocalNotifications.checkPermissions();
    logDebug('Local notification permission status:', permStatus.display);

    if (permStatus.display !== 'granted') {
      const reqResult = await LocalNotifications.requestPermissions();
      logDebug('Permission request result:', reqResult.display);
      if (reqResult.display !== 'granted') {
        logWarn('Local notification permission denied');
        return false;
      }
    }

    // Generate a unique ID (must be a 32-bit integer for Android)
    const notificationId = Math.floor(Math.random() * 2147483647);

    // Schedule notification for immediate delivery
    // Using a small delay (50ms) ensures the notification is processed
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: title,
          body: body,
          channelId: 'bad_bingo_notifications',
          smallIcon: 'ic_launcher', // Use app icon for status bar
          largeIcon: 'ic_launcher',
          extra: data,
          sound: 'default',
          // Schedule for near-immediate delivery
          schedule: {
            at: new Date(Date.now() + 50),
            allowWhileIdle: true, // Important for Doze mode
          },
        },
      ],
    });

    logDebug('Local notification scheduled successfully:', { id: notificationId, title });
    return true;
  } catch (error) {
    logError('Local notification error:', error);
    return false;
  }
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
