# Vendor Management System (VMS) - Enterprise Procurement Portal

A full-stack, enterprise-grade **Vendor Management System (VMS)** built for academic evaluations, college project demonstrations (FSD Review 1 & Review 2), and real-world supply chain workflows.

---

## 🌟 Key Functional Pillars

1. **Supplier Onboarding & Directory**:
   - Multi-step onboarding registration wizard (Corporate profile, GSTIN/Tax ID, Contact person, Bank details, SLA notes).
   - Approval workflow with administrative oversight (`Pending Review` &rarr; `Approved` / `Rejected`).
   - Search & filtering by category, status, and performance tier.

2. **Vendor Performance Evaluation Engine (KPI Matrix)**:
   - 4-Pillar Quantitative Evaluation:
     - **On-Time Delivery & SLA Compliance** (35% weight)
     - **Product/Service Quality & Spec Compliance** (35% weight)
     - **Commercial Pricing Competitiveness** (15% weight)
     - **Customer Support & Responsiveness** (15% weight)
   - Real-time weighted score calculation ($1.0$ to $5.0$) with automated tier classification:
     - 🥇 **Gold (Preferred)**: Score $\ge 4.5$
     - 🥈 **Silver (Approved)**: Score $3.8 - 4.49$
     - 🥉 **Bronze (Under Review)**: Score $2.5 - 3.79$
     - ⚠️ **Critical / At Risk**: Score $< 2.5$

3. **Purchase Order (PO) Lifecycle Management**:
   - Comprehensive multi-stage procurement lifecycle:
     $$\text{Draft} \longrightarrow \text{Pending Approval} \longrightarrow \text{Issued} \longrightarrow \text{Accepted} \longrightarrow \text{In Fulfillment} \longrightarrow \text{Delivered} \longrightarrow \text{Completed / Paid}$$
   - Dynamic multi-item order requisition generator with automated GST (18%) and freight calculations.
   - Interactive visual stepper & audit timeline with timestamped actor logs.

4. **Executive Dashboard & Business Intelligence**:
   - Real-time KPI summary tickers (Active Suppliers, In-Pipeline Orders, Spend in Lakhs, Vendor Quality Index).
   - Category-wise procurement spend distribution bars.
   - Lifecycle order pipeline funnel.
   - Top-performing supplier leaderboard.

5. **Role-Based Demonstration (RBAC Persona Switcher)**:
   - Built-in header switcher to toggle between **Admin**, **Procurement Officer**, and **Supplier / Vendor** roles without needing separate logins during project viva/presentations.

6. **Zero-Friction Dual-Mode Persistence**:
   - Self-healing persistent JSON database (`src/data/vms_store.json`).
   - Works immediately out-of-the-box with **zero database setup required** (prevents connection errors during viva).
   - Optional MongoDB support via `.env` (`MONGO_URI`).

---

## 🚀 Quick Start Guide

### 1. Requirements
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)

### 2. Run the Application
Open a terminal in the project directory (`c:\Users\malathy\Downloads\FSD Project`):

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Start the application
npm start
```

### 3. Open in Browser
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🏗️ System Architecture

```
FSD Project/
├── package.json               # Dependencies and scripts
├── server.js                  # Main Express REST server & static hosting
├── .env                       # Environment configuration
├── README.md                  # Project documentation & instructions
├── CONCEPT_ARCHITECTURE.md    # Detailed system design & diagrams for Review 1 & 2
├── src/
│   ├── data/
│   │   ├── initialData.js     # Enterprise seed dataset (vendors, orders, evaluations)
│   │   └── vms_store.json     # Auto-generated persistent JSON database
│   ├── models/
│   │   └── store.js           # Unified storage adapter with full CRUD and aggregations
│   └── routes/
│       ├── vendorRoutes.js    # /api/vendors endpoints
│       ├── orderRoutes.js     # /api/orders endpoints
│       └── statsRoutes.js     # /api/stats, /api/reset-data, /api/export/:type
└── public/
    ├── index.html             # Single-Page Application interface
    ├── css/
    │   └── style.css          # Glassmorphic responsive design system
    └── js/
        ├── api.js             # Asynchronous REST client wrapper
        └── app.js             # UI state controller, modal manager, and calculators
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check and storage status |
| `GET` | `/api/stats` | Executive dashboard KPI metrics & spend breakdown |
| `GET` | `/api/vendors` | List suppliers (supports `?search=`, `?category=`, `?status=`) |
| `GET` | `/api/vendors/:id` | Get single supplier with full dossier & orders |
| `POST` | `/api/vendors` | Onboard new supplier |
| `PUT` | `/api/vendors/:id` | Update supplier profile |
| `PUT` | `/api/vendors/:id/status`| Approve, reject, or suspend supplier |
| `POST` | `/api/vendors/:id/evaluate`| Record supplier KPI scorecard appraisal |
| `DELETE`| `/api/vendors/:id` | Archive/delete supplier |
| `GET` | `/api/orders` | List purchase orders (supports `?status=`, `?vendorId=`) |
| `GET` | `/api/orders/:id` | Get purchase order with full lifecycle timeline |
| `POST` | `/api/orders` | Draft new purchase order with line items |
| `PUT` | `/api/orders/:id/status`| Advance PO lifecycle stage with actor log |
| `DELETE`| `/api/orders/:id` | Cancel/remove purchase order |
| `POST` | `/api/reset-data` | Restore fresh demo dataset |
| `GET` | `/api/export/:type` | Export `vendors` or `orders` as CSV |

---

## 🎯 Demonstration Checklist for Reviews

1. **Executive Dashboard**:
   - Point out the 4 KPI cards, procurement spend in INR Lakhs, and the Category Spend bars.
2. **Onboarding a Supplier**:
   - Click `+ Onboard Supplier`, fill in company details, GSTIN, and submit.
   - Filter by `Pending Review` and click `✓ Approve` with Admin role.
3. **Drafting a Purchase Order**:
   - Click `+ Create PO`, select a vendor, add multiple line items, observe live GST (18%) and Grand Total calculation, then save.
4. **Lifecycle Progression**:
   - Go to `Purchase Order Lifecycles`, click `Inspect PO`, and click the contextual action buttons to move it through `Pending Approval` &rarr; `Issued` &rarr; `Accepted` &rarr; `In Fulfillment` &rarr; `Delivered` &rarr; `Completed`.
5. **Vendor Performance Evaluation**:
   - Go to `Vendor KPI Scorecard Matrix`, adjust the 4 sliders, and demonstrate live calculation of the weighted score and Tier badge.
6. **Data Export**:
   - Click `Export CSV` to download instant Excel-compatible reports.
