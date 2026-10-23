# Vendor Management System (VMS) - Architectural Concept & Technical Specification

> **Course / Review Reference**: Full Stack Development (FSD) Project &bull; Combined Review 1 & 2  
> **System Scope**: Supplier Onboarding, Performance KPI Scoring, and Purchase Order Lifecycle Automation.

---

## 1. System Overview & Problem Statement

Modern enterprise supply chains face three critical bottlenecks:
1. **Unregulated Supplier Onboarding**: Fragmented documentation, lack of GSTIN/tax verification, and delayed credential approvals.
2. **Subjective Vendor Appraisals**: Absence of quantifiable, weighted KPI scorecards for assessing delivery punctuality, quality pass rates, and commercial value.
3. **Opaque Purchase Order Lifecycles**: Lack of real-time visibility between procurement requisition, vendor acknowledgment, transit tracking, dock receiving, and invoice settlement.

The **Vendor Management System (VMS)** resolves these challenges by providing a unified, three-tier procurement portal that streamlines end-to-end interactions between corporate buyers, procurement officers, and external suppliers.

---

## 2. Three-Tier Architectural Topology

```mermaid
graph TD
    subgraph "Presentation Layer (Client Browser)"
        UI["Modern Glassmorphic SPA (Vanilla HTML5 / CSS3 / ES6+)"]
        VMS_Views["Views: Executive Dashboard | Supplier Directory | PO Lifecycles | KPI Matrix | Audit Trail"]
        Client_API["API Client (Fetch API / Asynchronous REST)"]
    end

    subgraph "Application Layer (Node.js & Express)"
        Router["Express REST Routing Engine (/api)"]
        Auth_RBAC["Role-Based Access Control (Admin | Procurement | Vendor)"]
        Controllers["Business Logic: PO Calculations, Evaluation Engine, Status Machine"]
    end

    subgraph "Data Persistence Layer"
        Store["Dual-Mode Storage Adapter (Unified Store Model)"]
        JSON_Store[("Self-Healing Persistent JSON Store (vms_store.json)")]
        Mongo_Store[("Optional MongoDB Cluster (via Mongoose URI)")]
    end

    UI --> Client_API
    Client_API -->|HTTP / JSON Endpoints| Router
    Router --> Auth_RBAC
    Auth_RBAC --> Controllers
    Controllers --> Store
    Store --> JSON_Store
    Store -.-> Mongo_Store
```

---

## 3. Entity-Relationship (ER) Data Model

```mermaid
erDiagram
    VENDORS ||--o{ ORDERS : "fulfills"
    VENDORS ||--o{ EVALUATIONS : "receives"
    ORDERS ||--|{ ORDER_ITEMS : "contains"
    ORDERS ||--|{ TIMELINE_EVENTS : "tracks"

    VENDORS {
        string id PK "e.g. VND-1001"
        string name "Trade Name"
        string legalName "Registered Legal Name"
        string category "IT, Precision, Chemical, etc."
        string taxId "GSTIN / Tax Registration"
        string contactPerson "Primary Liaison"
        string email "Official Contact Email"
        string phone "Telephone"
        string status "Approved | Pending Review | Rejected"
        json bankDetails "Bank, Account No, IFSC"
        datetime onboardedAt "Registration Timestamp"
    }

    ORDERS {
        string id PK "e.g. PO-2026-001"
        string vendorId FK "References VENDORS.id"
        string title "Order Requisition Title"
        string status "Draft | Pending | Issued | Accepted | Fulfillment | Delivered | Completed"
        string paymentStatus "Pending | Paid"
        float subtotal "Total of Line Items"
        float taxRate "18% GST standard"
        float taxAmount "Calculated GST"
        float shippingFee "Freight Charges"
        float grandTotal "Final Payable Amount"
        datetime createdAt "Creation Timestamp"
        datetime expectedDelivery "SLA Target Date"
        datetime actualDelivery "Dock Delivery Timestamp"
    }

    ORDER_ITEMS {
        string name "Item Specification"
        int quantity "Count"
        float unitPrice "Cost per Unit"
        float total "Quantity x Unit Price"
    }

    TIMELINE_EVENTS {
        string status "Stage Reached"
        datetime timestamp "Event Time"
        string actor "Admin | Officer | Vendor"
        string comment "Audit Remark"
    }

    EVALUATIONS {
        string id PK "e.g. EVL-101"
        string vendorId FK "References VENDORS.id"
        float deliveryScore "Weight: 35%"
        float qualityScore "Weight: 35%"
        float pricingScore "Weight: 15%"
        float supportScore "Weight: 15%"
        float compositeScore "Weighted Composite Index"
        string tier "Gold | Silver | Bronze | Critical"
        string poReference "PO or Audit Ref"
        string comments "Inspector Notes"
    }
```

---

## 4. Purchase Order Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft : Procurement Officer drafts order
    Draft --> Pending_Approval : Submitted for executive review
    Pending_Approval --> Issued : Admin signs off on budget
    Pending_Approval --> Rejected : Budget or specification declined

    Issued --> Accepted : Supplier acknowledges order
    Issued --> Declined : Supplier unable to fulfill

    Accepted --> In_Fulfillment : Supplier dispatches goods
    In_Fulfillment --> Delivered : Goods received at warehouse dock
    Delivered --> Completed : Quality inspection passed & invoice paid
    Completed --> [*]
```

---

## 5. Performance Evaluation Mathematical Model

The composite vendor score $S_{composite}$ is calculated using an enterprise multi-criteria decision formula:

$$S_{composite} = (0.35 \times S_{delivery}) + (0.35 \times S_{quality}) + (0.15 \times S_{pricing}) + (0.15 \times S_{support})$$

Where each sub-metric is scored on a standardized $1.0 - 5.0$ scale:
- **$S_{delivery}$**: Punctuality against agreed PO expected delivery dates.
- **$S_{quality}$**: Spec compliance, dimensional tolerances, and incoming defect rates.
- **$S_{pricing}$**: Cost competitiveness against market benchmarks.
- **$S_{support}$**: Responsiveness of vendor customer support and SLA adherence.

### Tier Classification Matrix:
| Score Range | Tier Classification | Procurement Action |
| :--- | :--- | :--- |
| **$4.50 - 5.00$** | 🥇 **Gold (Preferred)** | First choice for direct PO issuance & long-term contracts |
| **$3.80 - 4.49$** | 🥈 **Silver (Approved)** | Qualified active supplier for competitive bidding |
| **$2.50 - 3.79$** | 🥉 **Bronze (Under Review)** | Monitored status; conditional orders only |
| **$< 2.50$** | ⚠️ **Critical (At Risk)** | Suspended from active procurement pipeline |

---

## 6. Role-Based Access Control (RBAC) Matrix

| Feature / Action | Admin | Procurement Officer | Vendor / Supplier |
| :--- | :---: | :---: | :---: |
| **View Dashboard & KPI Analytics** | ✅ | ✅ | ❌ (Scorecard Only) |
| **Onboard New Suppliers** | ✅ | ✅ | ✅ (Self-Register) |
| **Approve / Reject Supplier Dossier** | ✅ | ✅ | ❌ |
| **Draft Purchase Orders** | ✅ | ✅ | ❌ |
| **Approve Financial Requisitions** | ✅ | ❌ | ❌ |
| **Acknowledge / Accept Issued PO** | ❌ | ❌ | ✅ |
| **Update Transit & Fulfillment** | ❌ | ❌ | ✅ |
| **Confirm Dock Delivery** | ✅ | ✅ | ❌ |
| **Settle Payments & Close PO** | ✅ | ❌ | ❌ |
| **Submit Performance Appraisals** | ✅ | ✅ | ❌ |
| **Export Audit Logs & CSV Reports**| ✅ | ✅ | ❌ |

---

## 7. Viva & Review Discussion Points

1. **Why use dual persistence (File-backed JSON + MongoDB support)?**
   - Eliminates environment setup dependencies for presentation evaluators. If MongoDB is inactive, the system functions seamlessly with persistent atomic writes.
2. **How is data integrity maintained in PO calculations?**
   - Totals, GST (18%), and line totals are strictly calculated server-side in `store.js` regardless of client payload to prevent financial manipulation.
3. **What prevents unauthorized lifecycle transitions?**
   - The state machine restricts invalid jumps (e.g., an order cannot jump directly from `Draft` to `Delivered`). Every state change appends an immutable timeline log.
