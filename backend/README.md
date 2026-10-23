# ⚙️ Vendor Management System - Backend API

Robust Express.js REST API engine for Supplier Onboarding, PO Tracking, and Performance Evaluation.

## 🚀 How to Run Backend

```bash
cd backend
npm install
npm start
```
- Server starts at `http://localhost:5000`
- API Endpoints at `http://localhost:5000/api`
- Health check at `http://localhost:5000/api/health`

## 📡 API Endpoints
- `GET /api/health` - System health & status
- `GET /api/stats` - Dashboard KPIs & analytics
- `GET /api/vendors` - List suppliers (with filtering)
- `POST /api/vendors` - Onboard new supplier
- `GET /api/vendors/:id` - Vendor profile & metrics
- `PUT /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Remove vendor
- `POST /api/vendors/:id/evaluate` - Submit performance review
- `GET /api/orders` - Purchase Orders list
- `POST /api/orders` - Issue new PO
- `PUT /api/orders/:id/status` - Transition PO state
- `GET /api/export/vendors` - Download CSV export

## ☁️ Deployment
- **Render**: Connect repository, Root directory = `backend`, Build: `npm install`, Start: `npm start`
- **Vercel**: Pre-configured with `vercel.json`
