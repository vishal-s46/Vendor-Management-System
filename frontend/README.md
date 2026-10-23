# 🌐 Vendor Management System - Frontend Client

Interactive Enterprise Procurement & Supplier Lifecycle Management Portal.

## 🚀 How to Run Frontend

### Method 1: VS Code Live Server (Zero Install)
1. Open `frontend/index.html` in VS Code / Antigravity IDE.
2. Right-click and choose **Open with Live Server** (runs on `http://127.0.0.1:5500`).
3. Ensure backend is running on `http://localhost:5000`. The frontend auto-detects and connects!

### Method 2: Direct in Browser
Simply double-click `frontend/index.html` to open it in Chrome, Edge, or Firefox.

### Method 3: Using npm
```bash
npm start
# Serves the frontend at http://localhost:3000
```

## ⚙️ Connecting to a Deployed Backend
If your backend is hosted online (e.g. on Render or Railway):
Add this before loading `js/api.js` in `index.html`, or set in browser console:
```javascript
window.VMS_BACKEND_URL = "https://your-backend-app.onrender.com";
```
