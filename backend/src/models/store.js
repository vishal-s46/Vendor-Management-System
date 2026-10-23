/**
 * Unified Storage Adapter for Vendor Management System
 * Automatically provides persistent file-backed JSON storage with zero friction.
 * If MongoDB is ever configured via MONGO_URI in .env, it can sync as well.
 */

const fs = require('fs');
const path = require('path');
const { initialVendors, initialOrders, initialEvaluations } = require('../data/initialData');

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../data');
const STORE_FILE = path.join(DATA_DIR, 'vms_store.json');

class Store {
  constructor() {
    this.memoryCache = null;
    this.ensureStoreInitialized();
  }

  ensureStoreInitialized() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (!fs.existsSync(STORE_FILE)) {
        this.resetData();
      }
    } catch (err) {
      console.warn('Filesystem init warning (using in-memory store):', err.message);
      this.resetData();
    }
  }

  readStore() {
    if (this.memoryCache) return this.memoryCache;
    try {
      if (fs.existsSync(STORE_FILE)) {
        const content = fs.readFileSync(STORE_FILE, 'utf8');
        this.memoryCache = JSON.parse(content);
        return this.memoryCache;
      }
      return this.resetData();
    } catch (err) {
      console.error('Error reading store file, reinitializing...', err);
      return this.resetData();
    }
  }

  writeStore(data) {
    this.memoryCache = data;
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn('Notice: Written to in-memory store (disk read-only or restricted):', err.message);
      return true;
    }
  }

  resetData() {
    const data = {
      vendors: JSON.parse(JSON.stringify(initialVendors)),
      orders: JSON.parse(JSON.stringify(initialOrders)),
      evaluations: JSON.parse(JSON.stringify(initialEvaluations)),
      auditLog: [
        {
          id: "AUD-001",
          action: "System Initialized",
          entity: "Core VMS",
          timestamp: new Date().toISOString(),
          details: "Seed procurement records, suppliers, and PO lifecycles loaded successfully.",
        }
      ]
    };
    this.writeStore(data);
    return data;
  }

  // ===================== VENDOR OPERATIONS =====================

  getVendors(filter = {}) {
    const store = this.readStore();
    let vendors = store.vendors || [];

    if (filter.search) {
      const q = filter.search.toLowerCase();
      vendors = vendors.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        (v.taxId && v.taxId.toLowerCase().includes(q))
      );
    }

    if (filter.category && filter.category !== 'All') {
      vendors = vendors.filter(v => v.category === filter.category);
    }

    if (filter.status && filter.status !== 'All') {
      vendors = vendors.filter(v => v.status === filter.status);
    }

    if (filter.tier && filter.tier !== 'All') {
      vendors = vendors.filter(v => v.evaluation && v.evaluation.tier.includes(filter.tier));
    }

    return vendors;
  }

  getVendorById(id) {
    const store = this.readStore();
    return store.vendors.find(v => v.id === id) || null;
  }

  createVendor(vendorData) {
    const store = this.readStore();
    const nextNumber = store.vendors.length + 1001;
    const newId = `VND-${nextNumber}`;

    const newVendor = {
      id: newId,
      name: vendorData.name || "Unnamed Supplier",
      legalName: vendorData.legalName || vendorData.name,
      category: vendorData.category || "General Services",
      email: vendorData.email || "",
      phone: vendorData.phone || "",
      address: vendorData.address || "",
      taxId: vendorData.taxId || "Pending Verification",
      bankDetails: {
        accountNumber: vendorData.bankDetails?.accountNumber || vendorData.accountNumber || "N/A",
        bankName: vendorData.bankDetails?.bankName || vendorData.bankName || "N/A",
        ifscCode: vendorData.bankDetails?.ifscCode || vendorData.ifscCode || "N/A",
      },
      contactPerson: vendorData.contactPerson || "Primary Representative",
      status: vendorData.status || "Pending Review",
      onboardedAt: new Date().toISOString(),
      evaluation: {
        deliveryScore: 0,
        qualityScore: 0,
        pricingScore: 0,
        supportScore: 0,
        compositeScore: 0,
        tier: "New Supplier (Unrated)",
        evaluationsCount: 0,
        lastEvaluated: null,
        remarks: vendorData.remarks || "Newly submitted onboarding dossier.",
      },
    };

    store.vendors.unshift(newVendor);
    this.addAuditLog(store, "Vendor Registered", `Vendor ${newId} (${newVendor.name}) registered.`);
    this.writeStore(store);
    return newVendor;
  }

  updateVendor(id, updateData) {
    const store = this.readStore();
    const index = store.vendors.findIndex(v => v.id === id);
    if (index === -1) return null;

    store.vendors[index] = {
      ...store.vendors[index],
      ...updateData,
      id, // ensure ID is preserved
    };

    this.addAuditLog(store, "Vendor Updated", `Vendor profile ${id} updated.`);
    this.writeStore(store);
    return store.vendors[index];
  }

  updateVendorStatus(id, newStatus, reason = "") {
    const store = this.readStore();
    const vendor = store.vendors.find(v => v.id === id);
    if (!vendor) return null;

    const oldStatus = vendor.status;
    vendor.status = newStatus;
    if (reason) {
      vendor.evaluation.remarks = reason;
    }

    this.addAuditLog(store, "Vendor Status Changed", `Vendor ${id} status changed from ${oldStatus} to ${newStatus}. ${reason}`);
    this.writeStore(store);
    return vendor;
  }

  deleteVendor(id) {
    const store = this.readStore();
    const index = store.vendors.findIndex(v => v.id === id);
    if (index === -1) return false;

    const deleted = store.vendors.splice(index, 1)[0];
    this.addAuditLog(store, "Vendor Removed", `Vendor ${id} (${deleted.name}) archived.`);
    this.writeStore(store);
    return true;
  }

  evaluateVendor(id, evalData) {
    const store = this.readStore();
    const vendor = store.vendors.find(v => v.id === id);
    if (!vendor) return null;

    const dScore = Math.min(5, Math.max(1, parseFloat(evalData.deliveryScore) || 4.0));
    const qScore = Math.min(5, Math.max(1, parseFloat(evalData.qualityScore) || 4.0));
    const pScore = Math.min(5, Math.max(1, parseFloat(evalData.pricingScore) || 4.0));
    const sScore = Math.min(5, Math.max(1, parseFloat(evalData.supportScore) || 4.0));

    // Weighted composite calculation: Delivery 35%, Quality 35%, Pricing 15%, Support 15%
    const composite = (dScore * 0.35 + qScore * 0.35 + pScore * 0.15 + sScore * 0.15);
    const roundedComposite = Math.round(composite * 100) / 100;

    let tier = "Bronze (Under Review)";
    if (roundedComposite >= 4.5) {
      tier = "Gold (Preferred)";
    } else if (roundedComposite >= 3.8) {
      tier = "Silver (Approved)";
    } else if (roundedComposite < 2.5) {
      tier = "Critical (At Risk)";
    }

    vendor.evaluation = {
      deliveryScore: dScore,
      qualityScore: qScore,
      pricingScore: pScore,
      supportScore: sScore,
      compositeScore: roundedComposite,
      tier,
      evaluationsCount: (vendor.evaluation?.evaluationsCount || 0) + 1,
      lastEvaluated: new Date().toISOString(),
      remarks: evalData.comments || "Periodic performance appraisal submitted.",
    };

    const evaluationRecord = {
      id: `EVL-${Date.now().toString().slice(-4)}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      evaluatedBy: evalData.evaluatedBy || "Procurement Inspector",
      date: new Date().toISOString(),
      metrics: {
        deliveryScore: dScore,
        qualityScore: qScore,
        pricingScore: pScore,
        supportScore: sScore,
      },
      compositeScore: roundedComposite,
      tier,
      poReference: evalData.poReference || "Annual Vendor Audit",
      comments: evalData.comments || "Evaluation logged.",
    };

    if (!store.evaluations) store.evaluations = [];
    store.evaluations.unshift(evaluationRecord);

    this.addAuditLog(store, "Performance Evaluated", `Vendor ${id} evaluated with composite score ${roundedComposite} (${tier}).`);
    this.writeStore(store);
    return { vendor, evaluation: evaluationRecord };
  }

  // ===================== PURCHASE ORDER OPERATIONS =====================

  getOrders(filter = {}) {
    const store = this.readStore();
    let orders = store.orders || [];

    if (filter.vendorId) {
      orders = orders.filter(o => o.vendorId === filter.vendorId);
    }

    if (filter.status && filter.status !== 'All') {
      orders = orders.filter(o => o.status === filter.status);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      orders = orders.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q) ||
        o.vendorName.toLowerCase().includes(q)
      );
    }

    return orders;
  }

  getOrderById(id) {
    const store = this.readStore();
    return store.orders.find(o => o.id === id) || null;
  }

  createOrder(orderData) {
    const store = this.readStore();
    const vendor = store.vendors.find(v => v.id === orderData.vendorId);
    if (!vendor) {
      throw new Error(`Vendor ID ${orderData.vendorId} not found.`);
    }

    const orderNumber = store.orders.length + 1;
    const padded = String(orderNumber).padStart(3, '0');
    const newId = `PO-2026-${padded}`;

    const items = (orderData.items || []).map(item => ({
      name: item.name || "Procured Item",
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    const subtotal = items.reduce((acc, curr) => acc + curr.total, 0);
    const taxRate = Number(orderData.taxRate) || 18;
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const shippingFee = Number(orderData.shippingFee) || 0;
    const grandTotal = subtotal + taxAmount + shippingFee;

    const initialStatus = orderData.status || "Draft";

    const newOrder = {
      id: newId,
      vendorId: vendor.id,
      vendorName: vendor.name,
      title: orderData.title || `Procurement Order for ${vendor.name}`,
      category: vendor.category,
      items,
      subtotal,
      taxRate,
      taxAmount,
      shippingFee,
      grandTotal,
      status: initialStatus,
      paymentStatus: initialStatus === "Completed" ? "Paid" : "Pending",
      createdAt: new Date().toISOString(),
      expectedDelivery: orderData.expectedDelivery || new Date(Date.now() + 14 * 86400000).toISOString(),
      actualDelivery: null,
      notes: orderData.notes || "",
      timeline: [
        {
          status: initialStatus,
          timestamp: new Date().toISOString(),
          actor: orderData.createdActor || "Procurement Officer",
          comment: `Purchase order created with ${items.length} line item(s).`,
        },
      ],
    };

    store.orders.unshift(newOrder);
    this.addAuditLog(store, "PO Created", `Purchase Order ${newId} drafted for ${vendor.name} (₹${grandTotal.toLocaleString('en-IN')}).`);
    this.writeStore(store);
    return newOrder;
  }

  updateOrderStatus(id, newStatus, actor = "User", comment = "") {
    const store = this.readStore();
    const order = store.orders.find(o => o.id === id);
    if (!order) return null;

    const oldStatus = order.status;
    order.status = newStatus;

    if (newStatus === "Delivered" && !order.actualDelivery) {
      order.actualDelivery = new Date().toISOString();
    }

    if (newStatus === "Completed") {
      order.paymentStatus = "Paid";
      if (!order.actualDelivery) order.actualDelivery = new Date().toISOString();
    }

    if (newStatus === "In Fulfillment" && order.paymentStatus === "Pending") {
      order.paymentStatus = "Pending Delivery";
    }

    order.timeline.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      actor,
      comment: comment || `Status progressed to ${newStatus}.`,
    });

    this.addAuditLog(store, "PO Status Updated", `Order ${id} changed from ${oldStatus} to ${newStatus} by ${actor}.`);
    this.writeStore(store);
    return order;
  }

  deleteOrder(id) {
    const store = this.readStore();
    const index = store.orders.findIndex(o => o.id === id);
    if (index === -1) return false;

    const deleted = store.orders.splice(index, 1)[0];
    this.addAuditLog(store, "PO Cancelled/Deleted", `Order ${id} removed.`);
    this.writeStore(store);
    return true;
  }

  // ===================== METRICS & STATS =====================

  getStats() {
    const store = this.readStore();
    const vendors = store.vendors || [];
    const orders = store.orders || [];

    const totalVendors = vendors.length;
    const activeVendors = vendors.filter(v => v.status === "Approved").length;
    const pendingVendors = vendors.filter(v => v.status === "Pending Review").length;

    const totalOrders = orders.length;
    const totalSpend = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const completedSpend = orders
      .filter(o => o.status === "Completed")
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

    const ordersByStatus = {
      Draft: orders.filter(o => o.status === "Draft").length,
      "Pending Approval": orders.filter(o => o.status === "Pending Approval").length,
      Issued: orders.filter(o => o.status === "Issued").length,
      Accepted: orders.filter(o => o.status === "Accepted").length,
      "In Fulfillment": orders.filter(o => o.status === "In Fulfillment").length,
      Delivered: orders.filter(o => o.status === "Delivered").length,
      Completed: orders.filter(o => o.status === "Completed").length,
      Cancelled: orders.filter(o => o.status === "Cancelled" || o.status === "Rejected").length,
    };

    // Category spend breakdown
    const categorySpend = {};
    orders.forEach(o => {
      const cat = o.category || "General";
      categorySpend[cat] = (categorySpend[cat] || 0) + o.grandTotal;
    });

    // Average vendor performance score
    const ratedVendors = vendors.filter(v => v.evaluation && v.evaluation.compositeScore > 0);
    const avgRating = ratedVendors.length > 0
      ? (ratedVendors.reduce((sum, v) => sum + v.evaluation.compositeScore, 0) / ratedVendors.length).toFixed(2)
      : 0;

    // Top rated vendors
    const topVendors = [...vendors]
      .filter(v => v.evaluation && v.evaluation.compositeScore > 0)
      .sort((a, b) => b.evaluation.compositeScore - a.evaluation.compositeScore)
      .slice(0, 5);

    return {
      totalVendors,
      activeVendors,
      pendingVendors,
      totalOrders,
      totalSpend,
      completedSpend,
      avgRating: Number(avgRating),
      ordersByStatus,
      categorySpend,
      topVendors,
      recentAudit: (store.auditLog || []).slice(0, 10),
    };
  }

  getEvaluations(vendorId = null) {
    const store = this.readStore();
    let evals = store.evaluations || [];
    if (vendorId) {
      evals = evals.filter(e => e.vendorId === vendorId);
    }
    return evals;
  }

  addAuditLog(store, action, details) {
    if (!store.auditLog) store.auditLog = [];
    store.auditLog.unshift({
      id: `AUD-${Date.now().toString().slice(-5)}`,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
    if (store.auditLog.length > 100) {
      store.auditLog = store.auditLog.slice(0, 100);
    }
  }
}

const storeInstance = new Store();
module.exports = storeInstance;
