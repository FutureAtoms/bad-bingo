# Firebase Cloud Messaging Setup

Follow these steps to enable push notifications in Bad Bingo.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it "Bad Bingo" (or whatever you prefer)
4. Disable Google Analytics (optional, not needed for push)
5. Click "Create project"

## Step 2: Add Android App to Firebase

1. In your Firebase project, click the Android icon to add an Android app
2. Enter the package name: `com.badbingo.app`
3. App nickname: "Bad Bingo Android"
4. Debug signing certificate SHA-1 (optional for now)
5. Click "Register app"

## Step 3: Download google-services.json

1. Click "Download google-services.json"
2. Save the file to: `android/app/google-services.json`

```
bad-bingo/
├── android/
│   └── app/
│       └── google-services.json  <-- PUT IT HERE
```

## Step 4: Enable Cloud Messaging

1. In Firebase Console, go to Project Settings (gear icon)
2. Click "Cloud Messaging" tab
3. Make sure "Firebase Cloud Messaging API (V1)" is enabled

## Step 5: Build and Test

```bash
cd bad-bingo
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Testing Push Notifications

### From Firebase Console:
1. Go to Firebase Console > Engage > Messaging
2. Click "Create your first campaign"
3. Select "Firebase Notification messages"
4. Enter title and body
5. Click "Send test message"
6. Enter your device's FCM token (shown in app logs)

### From Backend (Supabase Edge Function):
Push tokens are stored in `bb_push_tokens` table. You can send notifications using:

```typescript
// Example Edge Function to send notification
import admin from 'firebase-admin';

const sendPushNotification = async (token: string, title: string, body: string, data?: object) => {
  const message = {
    token: token,
    notification: {
      title: title,
      body: body,
    },
    data: data || {},
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
  };

  await admin.messaging().send(message);
};
```

## Notification Types for Bad Bingo

| Type | When to Send | Priority |
|------|--------------|----------|
| `challenge` | Friend sends a challenge bet | high |
| `steal` | Someone is robbing you (16s window!) | critical |
| `clash` | Bet result - you disagreed | high |
| `proof` | Time to submit proof | high |
| `beg` | Someone is begging from you | normal |
| `system` | App updates, announcements | normal |

## Troubleshooting

### No notifications received?
1. Check that `google-services.json` is in the right place
2. Make sure app has notification permission (Settings > Apps > Bad Bingo > Notifications)
3. Check device is not in Do Not Disturb mode
4. Verify push token is saved in `bb_push_tokens` table

### Token not registering?
1. Check Firebase project is correctly configured
2. Verify internet connection on device
3. Check logcat for errors: `adb logcat | grep -i firebase`
