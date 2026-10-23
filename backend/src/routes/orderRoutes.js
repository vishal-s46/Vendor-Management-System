const express = require('express');
const router = express.Router();
const store = require('../models/store');

// GET all purchase orders
router.get('/', (req, res) => {
  try {
    const { status, vendorId, search } = req.query;
    const orders = store.getOrders({ status, vendorId, search });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single order with vendor details
router.get('/:id', (req, res) => {
  try {
    const order = store.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }
    const vendor = store.getVendorById(order.vendorId);
    res.json({ success: true, data: { ...order, vendor } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create new purchase order
router.post('/', (req, res) => {
  try {
    const { vendorId, title, items, taxRate, shippingFee, expectedDelivery, notes } = req.body;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Supplier/Vendor selection is required' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'At least one line item is required' });
    }

    const newOrder = store.createOrder(req.body);
    res.status(201).json({ success: true, message: `Purchase Order ${newOrder.id} created successfully`, data: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT advance / update PO lifecycle status
router.put('/:id/status', (req, res) => {
  try {
    const { status, actor, comment } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Target status is required' });
    }

    const validStatuses = [
      'Draft',
      'Pending Approval',
      'Issued',
      'Accepted',
      'In Fulfillment',
      'Delivered',
      'Completed',
      'Cancelled',
      'Rejected',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const updated = store.updateOrderStatus(req.params.id, status, actor || 'Procurement User', comment || '');
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }

    res.json({
      success: true,
      message: `Purchase Order ${req.params.id} progressed to '${status}'`,
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE / cancel purchase order
router.delete('/:id', (req, res) => {
  try {
    const success = store.deleteOrder(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }
    res.json({ success: true, message: 'Purchase Order removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
