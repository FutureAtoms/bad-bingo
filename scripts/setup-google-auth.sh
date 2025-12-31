#!/bin/bash

# Bad Bingo - Google Auth Setup Script
# =====================================
# This script helps configure Google OAuth for Supabase

echo "======================================"
echo "  Bad Bingo - Google Auth Setup"
echo "======================================"
echo ""

# Configuration
PROJECT_REF="rsienbixfyzoiullonvw"
GCP_PROJECT="bad-bingo-app"
PACKAGE_NAME="com.badbingo.app"
SHA1_FINGERPRINT="48:70:2B:28:00:27:2B:68:E0:32:B7:F8:68:CB:C2:2C:39:D9:62:07"

echo "Step 1: Google Cloud Console Setup"
echo "-----------------------------------"
echo ""
echo "1. Open: https://console.cloud.google.com/apis/credentials?project=$GCP_PROJECT"
echo ""
echo "2. Configure OAuth Consent Screen:"
echo "   - Go to 'OAuth consent screen'"
echo "   - Select 'External' user type"
echo "   - App name: Bad Bingo"
echo "   - Support email: your email"
echo "   - Add scopes: email, profile, openid"
echo "   - Add your Supabase domain: $PROJECT_REF.supabase.co"
echo ""
echo "3. Create Web OAuth Client ID:"
echo "   - Click 'CREATE CREDENTIALS' > 'OAuth client ID'"
echo "   - Application type: Web application"
echo "   - Name: Bad Bingo Web"
echo "   - Authorized redirect URIs:"
echo "     https://$PROJECT_REF.supabase.co/auth/v1/callback"
echo ""
echo "   Save the Client ID and Client Secret!"
echo ""
echo "4. Create Android OAuth Client ID:"
echo "   - Click 'CREATE CREDENTIALS' > 'OAuth client ID'"
echo "   - Application type: Android"
echo "   - Name: Bad Bingo Android"
echo "   - Package name: $PACKAGE_NAME"
echo "   - SHA-1 certificate fingerprint: $SHA1_FINGERPRINT"
echo ""

read -p "Press Enter when you have created the credentials..."
echo ""

echo "Step 2: Enter your OAuth Credentials"
echo "------------------------------------"
read -p "Enter Web Client ID: " GOOGLE_CLIENT_ID
read -p "Enter Web Client Secret: " GOOGLE_CLIENT_SECRET
echo ""

echo "Step 3: Configure Supabase"
echo "--------------------------"
echo ""
echo "Option A: Use Supabase Dashboard"
echo "  1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/auth/providers"
echo "  2. Find 'Google' provider and enable it"
echo "  3. Enter Client ID: $GOOGLE_CLIENT_ID"
echo "  4. Enter Client Secret: $GOOGLE_CLIENT_SECRET"
echo "  5. Click Save"
echo ""
echo "Option B: Use Supabase Management API"
echo "  Get your access token from: https://supabase.com/dashboard/account/tokens"
echo ""

read -p "Enter Supabase Access Token (or press Enter to skip): " SUPABASE_ACCESS_TOKEN

if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo ""
    echo "Configuring Google Auth via API..."

    curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"external_google_enabled\": true,
        \"external_google_client_id\": \"$GOOGLE_CLIENT_ID\",
        \"external_google_secret\": \"$GOOGLE_CLIENT_SECRET\"
      }"

    echo ""
    echo "Google Auth configuration sent to Supabase!"
fi

echo ""
echo "Step 4: Add Redirect URLs to Supabase"
echo "-------------------------------------"
echo "Go to: https://supabase.com/dashboard/project/$PROJECT_REF/auth/url-configuration"
echo ""
echo "Add these redirect URLs:"
echo "  - com.badbingo.app://auth/callback"
echo "  - https://rsienbixfyzoiullonvw.supabase.co/auth/v1/callback"
echo ""

echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "To build and run the Android app:"
echo "  npm run cap:android"
echo ""
echo "Or build the APK directly:"
echo "  cd android && ./gradlew assembleDebug"
echo "  APK will be at: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
