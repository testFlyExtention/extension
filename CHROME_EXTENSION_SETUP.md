# FlySnipe Chrome Extension - Installation Guide

## 🚀 What We've Built

FlySnipe is a Chrome extension that detects flight searches on Google and provides enhanced flight search capabilities with premium features.

### ✅ Completed Features

1. **Smart Flight Detection**: Automatically detects when users search for flights on Google
2. **Chrome Extension Popup**: Clean, modern UI for flight search 
3. **Mock Flight Search**: Returns realistic flight data with airlines, prices, schedules
4. **Premium Subscription**: Stripe integration for premium upgrades
5. **Backend API**: FastAPI backend with MongoDB for data storage
6. **User Authentication**: Mock Google authentication system
7. **Premium Features**: Free users get 3 results, premium users get unlimited results

### 📁 Extension Files Created

```
/app/frontend/
├── manifest.json          # Chrome extension manifest
├── popup.html            # Extension popup interface  
├── popup.js              # Popup functionality
├── content.js            # Detects flight searches on Google
├── content.css           # Content script styles
├── background.js         # Background service worker
├── flysnipe.html         # Full results page
├── flysnipe.js           # Full results functionality
├── premium.html          # Premium upgrade page
├── premium.js            # Premium page functionality  
├── success.html          # Payment success page
├── success.js            # Success page functionality
└── icons/                # Extension icons (16px, 48px, 128px)
```

## 📦 How to Install the Extension

### Step 1: Package the Extension
```bash
# Navigate to the extension directory
cd /app/frontend

# The extension files are ready to load
# All required files: manifest.json, popup.html, *.js, icons/ are present
```

### Step 2: Load in Chrome
1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `/app/frontend` folder
6. The FlySnipe extension should now appear in your extensions

### Step 3: Test the Extension
1. Go to Google.com
2. Search for "flights Geneva Tokyo" or similar flight query
3. Look for the FlySnipe floating icon on the right side
4. Click the icon to open the popup and search flights

## 🔧 Backend API

The backend is running at: `https://0cfacbb8-a7f0-4ae2-ab94-f5afc8a632f1.preview.emergentagent.com`

### Available Endpoints:
- `GET /api/` - Health check
- `POST /api/flights/search` - Search flights
- `POST /api/auth/google` - Google authentication  
- `GET /api/check-premium` - Check premium status
- `POST /api/create-checkout-session` - Create Stripe payment
- `GET /api/payments/checkout/status/{id}` - Check payment status
- `POST /api/webhook/stripe` - Stripe webhooks

## ⚡ Features Overview

### Free Users:
- ✅ Flight search with 3 results
- ✅ Basic search functionality
- ✅ Google search integration
- ❌ Advanced filters
- ❌ Unlimited results

### Premium Users ($9.99/month):
- ✅ Unlimited flight results  
- ✅ Advanced filters & sorting
- ✅ Price tracking capabilities
- ✅ Premium-only deals
- ✅ Priority support

## 🧪 Testing Status

✅ **Backend API**: All endpoints tested and working
✅ **Flight Search**: Returns mock data correctly  
✅ **Premium Logic**: Free vs Premium user differentiation working
✅ **Stripe Integration**: Payment flow configured with development keys
✅ **Database**: MongoDB integration working
✅ **Authentication**: Mock Google auth working

## 🔮 Next Steps for Real Deployment

1. **Google Authentication**: Replace mock auth with real Google OAuth
2. **Flight Data**: Replace mock data with real Amadeus API
3. **Stripe Production**: Use live Stripe keys for production
4. **Chrome Web Store**: Submit extension for approval
5. **Domain**: Setup custom domain for backend API

## 📱 How It Works

1. **Detection**: Content script detects flight searches on Google
2. **Icon Display**: Floating FlySnipe icon appears on the page
3. **Popup**: User clicks icon to open search popup
4. **Search**: Enter flight details and search for flights
5. **Results**: View flight results (limited for free users)
6. **Premium**: Upgrade to access unlimited results and filters
7. **Payment**: Stripe handles premium subscription payments

The extension is fully functional with mock data and ready for real API integrations!