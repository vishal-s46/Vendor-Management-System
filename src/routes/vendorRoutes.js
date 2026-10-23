const express = require('express');
const router = express.Router();
const store = require('../models/store');

// GET all vendors (supports ?search=&category=&status=&tier=)
router.get('/', (req, res) => {
  try {
    const { search, category, status, tier } = req.query;
    const vendors = store.getVendors({ search, category, status, tier });
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single vendor
router.get('/:id', (req, res) => {
  try {
    const vendor = store.getVendorById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    const evaluations = store.getEvaluations(vendor.id);
    const orders = store.getOrders({ vendorId: vendor.id });
    res.json({ success: true, data: { ...vendor, evaluations, orders } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST onboard new vendor
router.post('/', (req, res) => {
  try {
    const { name, category, email, phone, address, taxId, contactPerson, bankDetails } = req.body;
    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'Company name and category are required.' });
    }
    const newVendor = store.createVendor(req.body);
    res.status(201).json({ success: true, message: 'Supplier registered successfully for onboarding review', data: newVendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update vendor profile
router.put('/:id', (req, res) => {
  try {
    const updated = store.updateVendor(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, message: 'Vendor profile updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update vendor approval status (Admin/Procurement Officer action)
router.put('/:id/status', (req, res) => {
  try {
    const { status, remarks } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required (Approved, Rejected, Suspended).' });
    }
    const updated = store.updateVendorStatus(req.params.id, status, remarks);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, message: `Vendor status updated to ${status}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST evaluate vendor performance (KPI scorecard)
router.post('/:id/evaluate', (req, res) => {
  try {
    const result = store.evaluateVendor(req.params.id, req.body);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({
      success: true,
      message: `Performance evaluation recorded! New Tier: ${result.vendor.evaluation.tier}`,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE vendor
router.delete('/:id', (req, res) => {
  try {
    const success = store.deleteVendor(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.json({ success: true, message: 'Vendor archived successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
