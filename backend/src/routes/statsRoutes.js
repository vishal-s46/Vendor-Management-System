const express = require('express');
const router = express.Router();
const store = require('../models/store');

// GET dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const stats = store.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST reset to seed demo data
router.post('/reset-data', (req, res) => {
  try {
    const freshData = store.resetData();
    res.json({
      success: true,
      message: 'System data reset to initial sample procurement records successfully.',
      data: {
        vendorCount: freshData.vendors.length,
        orderCount: freshData.orders.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET export data as CSV
router.get('/export/:type', (req, res) => {
  try {
    const { type } = req.params;

    if (type === 'vendors') {
      const vendors = store.getVendors();
      let csv = 'Vendor ID,Company Name,Category,Status,Tax/GSTIN,Contact Person,Phone,Email,Rating,Tier\n';
      vendors.forEach(v => {
        const rating = v.evaluation?.compositeScore || 'N/A';
        const tier = v.evaluation?.tier || 'Unrated';
        csv += `"${v.id}","${v.name.replace(/"/g, '""')}","${v.category}","${v.status}","${v.taxId}","${v.contactPerson}","${v.phone}","${v.email}","${rating}","${tier}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="vendors_export.csv"');
      return res.send(csv);
    }

    if (type === 'orders') {
      const orders = store.getOrders();
      let csv = 'PO ID,Vendor ID,Vendor Name,Category,Status,Created Date,Grand Total (INR),Payment Status\n';
      orders.forEach(o => {
        csv += `"${o.id}","${o.vendorId}","${o.vendorName.replace(/"/g, '""')}","${o.category}","${o.status}","${o.createdAt.slice(0, 10)}","${o.grandTotal}","${o.paymentStatus}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="purchase_orders_export.csv"');
      return res.send(csv);
    }

    res.status(400).json({ success: false, message: 'Invalid export type. Use "vendors" or "orders".' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
