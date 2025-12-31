/**
 * Native Services Wrapper
 * Abstracts Capacitor plugins for camera, haptics, push notifications, etc.
 * Falls back gracefully when running in browser.
 */

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';

// Check if running on native platform
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Check current platform
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

// ============================================
// CAMERA
// ============================================

export interface PhotoResult {
  dataUrl: string;
  format: string;
}

// Take a photo using native camera
export const takePhoto = async (): Promise<PhotoResult | null> => {
  try {
    const image = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
      width: 1080,
      height: 1080,
    });

    if (image.dataUrl) {
      return {
        dataUrl: image.dataUrl,
        format: image.format,
      };
    }
    return null;
  } catch (error) {
    console.error('Camera error:', error);
    return null;
  }
};

// Pick photo from gallery
export const pickPhoto = async (): Promise<PhotoResult | null> => {
  try {
    const image = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      correctOrientation: true,
    });

    if (image.dataUrl) {
      return {
        dataUrl: image.dataUrl,
        format: image.format,
      };
    }
    return null;
  } catch (error) {
    console.error('Photo picker error:', error);
    return null;
  }
};

// Check camera permissions
export const checkCameraPermissions = async (): Promise<boolean> => {
  try {
    const permissions = await Camera.checkPermissions();
    return permissions.camera === 'granted';
  } catch {
    return false;
  }
};

// Request camera permissions
export const requestCameraPermissions = async (): Promise<boolean> => {
  try {
    const permissions = await Camera.requestPermissions();
    return permissions.camera === 'granted';
  } catch {
    return false;
  }
};

// ============================================
// HAPTICS
// ============================================

// Light haptic feedback (for swipes, selections)
export const hapticLight = async (): Promise<void> => {
  if (!isNative()) {
    // Fallback to navigator.vibrate for web
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    return;
  }

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Ignore
  }
};

// Medium haptic feedback (for confirmations)
export const hapticMedium = async (): Promise<void> => {
  if (!isNative()) {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
    return;
  }

  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Ignore
  }
};

// Heavy haptic feedback (for errors, wins)
export const hapticHeavy = async (): Promise<void> => {
  if (!isNative()) {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    return;
  }

  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {
    // Ignore
  }
};

// Success notification haptic
export const hapticSuccess = async (): Promise<void> => {
  if (!isNative()) {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 100]);
    }
    return;
  }

  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Ignore
  }
};

// Warning notification haptic
export const hapticWarning = async (): Promise<void> => {
  if (!isNative()) {
    if ('vibrate' in navigator) {
      navigator.vibrate([30, 30, 30]);
    }
    return;
  }

  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // Ignore
  }
};

// Error notification haptic (robbery alert, etc.)
export const hapticError = async (): Promise<void> => {
  if (!isNative()) {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
    return;
  }

  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // Ignore
  }
};

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Check push notification permissions
export const checkPushPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNative()) {
    // Check web notification permission
    if ('Notification' in window) {
      return Notification.permission as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }

  try {
    const result = await PushNotifications.checkPermissions();
    if (result.receive === 'granted') return 'granted';
    if (result.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
};

// Request push notification permissions
export const requestPushPermissions = async (): Promise<boolean> => {
  if (!isNative()) {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  try {
    const result = await PushNotifications.requestPermissions();
    return result.receive === 'granted';
  } catch {
    return false;
  }
};

// Register for push notifications
export const registerPush = async (): Promise<string | null> => {
  if (!isNative()) {
    return null; // Web push requires service worker setup
  }

  try {
    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', () => {
        resolve(null);
      });
    });
  } catch {
    return null;
  }
};

// Listen for push notifications
export const onPushReceived = (
  callback: (notification: { title: string; body: string; data?: Record<string, unknown> }) => void
): (() => void) => {
  if (!isNative()) {
    return () => {}; // No-op for web
  }

  const handle = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    callback({
      title: notification.title || '',
      body: notification.body || '',
      data: notification.data,
    });
  });

  return () => {
    handle.then((h) => h.remove());
  };
};

// ============================================
// GEOLOCATION
// ============================================

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

// Get current location
export const getCurrentLocation = async (): Promise<LocationResult | null> => {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch {
    return null;
  }
};

// Check location permissions
export const checkLocationPermissions = async (): Promise<boolean> => {
  try {
    const permissions = await Geolocation.checkPermissions();
    return permissions.location === 'granted' || permissions.coarseLocation === 'granted';
  } catch {
    return false;
  }
};

// Request location permissions
export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    const permissions = await Geolocation.requestPermissions();
    return permissions.location === 'granted' || permissions.coarseLocation === 'granted';
  } catch {
    return false;
  }
};

// ============================================
// LOCAL STORAGE (Preferences)
// ============================================

// Native-safe storage set
export const setStorageItem = async (key: string, value: string): Promise<void> => {
  if (isNative()) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
};

// Native-safe storage get
export const getStorageItem = async (key: string): Promise<string | null> => {
  if (isNative()) {
    const result = await Preferences.get({ key });
    return result.value;
  } else {
    return localStorage.getItem(key);
  }
};

// Native-safe storage remove
export const removeStorageItem = async (key: string): Promise<void> => {
  if (isNative()) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
};

// ============================================
// UTILITIES
// ============================================

// Request all permissions at once (for onboarding)
export const requestAllPermissions = async (): Promise<{
  camera: boolean;
  push: boolean;
  location: boolean;
}> => {
  const [camera, push, location] = await Promise.all([
    requestCameraPermissions(),
    requestPushPermissions(),
    requestLocationPermissions(),
  ]);

  return { camera, push, location };
};

// Get device info for proof metadata
export const getDeviceInfo = (): { platform: string; isNative: boolean } => {
  return {
    platform: getPlatform(),
    isNative: isNative(),
  };
};
