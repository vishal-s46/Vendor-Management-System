/**
 * Vendor Management System - Core Frontend Application Controller
 * Handles reactivity, tabs, modals, calculations, lifecycle steppers, and role switching.
 */

const app = {
  currentRole: 'admin', // 'admin' | 'procurement' | 'vendor'
  vendors: [],
  orders: [],
  stats: null,
  activeOrder: null,
  currentWizardStep: 1,

  // ===================== INITIALIZATION =====================
  async init() {
    this.bindEvents();
    await this.refreshAllData();
    this.addLineItemRow(); // initial row for PO modal
    this.updateEvalCalculations();
  },

  bindEvents() {
    // Role Switcher
    const roleSelector = document.getElementById('role-selector');
    if (roleSelector) {
      roleSelector.addEventListener('change', (e) => {
        this.setRole(e.target.value);
      });
    }

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // Quick Action Header Buttons
    document.getElementById('btn-open-onboard')?.addEventListener('click', () => this.openOnboardModal());
    document.getElementById('btn-open-create-po')?.addEventListener('click', () => this.openCreatePoModal());

    // Search and Filters
    document.getElementById('vendor-search')?.addEventListener('input', () => this.filterVendors());
    document.getElementById('vendor-category-filter')?.addEventListener('change', () => this.filterVendors());
    document.getElementById('vendor-status-filter')?.addEventListener('change', () => this.filterVendors());

    document.getElementById('order-search')?.addEventListener('input', () => this.filterOrders());
    document.getElementById('order-status-filter')?.addEventListener('change', () => this.filterOrders());

    // Export buttons
    document.getElementById('btn-export-vendors-csv')?.addEventListener('click', () => this.downloadExport('vendors'));
    document.getElementById('btn-export-orders-csv')?.addEventListener('click', () => this.downloadExport('orders'));
  },

  // ===================== DATA REFRESH =====================
  async refreshAllData() {
    try {
      const [statsRes, vendorsRes, ordersRes] = await Promise.all([
        api.getStats(),
        api.getVendors(),
        api.getOrders(),
      ]);

      this.stats = statsRes.data;
      this.vendors = vendorsRes.data;
      this.orders = ordersRes.data;

      this.renderKPIs();
      this.renderDashboardViews();
      this.renderVendors(this.vendors);
      this.renderOrders(this.orders);
      this.renderVendorDropdowns();
      this.renderAuditTrail();
      this.renderEvaluationLog();
    } catch (err) {
      this.showToast('Failed to load system data: ' + err.message, 'error');
    }
  },

  // ===================== ROLE / PERSONA =====================
  setRole(newRole) {
    this.currentRole = newRole;
    const badge = document.getElementById('current-role-badge');
    badge.className = `role-badge ${newRole}`;
    
    if (newRole === 'admin') {
      badge.textContent = 'ADMIN';
      this.showToast('Switched to Administrator: Full approval & deletion permissions', 'info');
    } else if (newRole === 'procurement') {
      badge.textContent = 'PROCUREMENT';
      this.showToast('Switched to Procurement Officer: Can draft POs, onboard & evaluate', 'info');
    } else {
      badge.textContent = 'VENDOR';
      this.showToast('Switched to Vendor / Supplier: Can accept orders & update shipping', 'info');
    }

    // Re-render views affected by role controls
    this.renderVendors(this.vendors);
    this.renderOrders(this.orders);
    if (this.activeOrder) {
      this.renderPoControls(this.activeOrder);
    }
  },

  // ===================== NAVIGATION TABS =====================
  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  },

  // ===================== KPI RENDERING =====================
  renderKPIs() {
    if (!this.stats) return;

    // Vendors
    document.getElementById('kpi-vendors-val').textContent = this.stats.totalVendors;
    document.getElementById('kpi-vendors-sub').textContent = `${this.stats.activeVendors} Active`;
    document.getElementById('badge-vendor-count').textContent = this.stats.totalVendors;

    // Orders
    document.getElementById('kpi-orders-val').textContent = this.stats.totalOrders;
    const inTransit = (this.stats.ordersByStatus['In Fulfillment'] || 0) + (this.stats.ordersByStatus['Accepted'] || 0);
    document.getElementById('kpi-orders-sub').textContent = `${inTransit} In Pipeline`;
    document.getElementById('badge-order-count').textContent = this.stats.totalOrders;

    // Spend
    const totalSpendLakhs = (this.stats.totalSpend / 100000).toFixed(2);
    document.getElementById('kpi-spend-val').textContent = `₹${totalSpendLakhs} L`;
    const completedLakhs = (this.stats.completedSpend / 100000).toFixed(2);
    document.getElementById('kpi-completed-spend').textContent = `₹${completedLakhs} L Paid`;

    // Vendor Rating
    document.getElementById('kpi-rating-val').textContent = `${this.stats.avgRating} / 5.0`;
  },

  // ===================== DASHBOARD CHARTS & PIPELINE =====================
  renderDashboardViews() {
    if (!this.stats) return;

    // 1. Spend by Category
    const catContainer = document.getElementById('category-spend-container');
    catContainer.innerHTML = '';
    const totalSpend = this.stats.totalSpend || 1;
    const categories = Object.entries(this.stats.categorySpend || {});

    if (categories.length === 0) {
      catContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No spend records available.</p>';
    } else {
      categories.forEach(([cat, amount]) => {
        const pct = Math.round((amount / totalSpend) * 100);
        const bar = document.createElement('div');
        bar.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.25rem;">
            <span style="font-weight: 600; color: #fff;">${cat}</span>
            <span style="color: var(--text-muted); font-family: var(--font-mono);">₹${(amount / 100000).toFixed(2)} Lakhs (${pct}%)</span>
          </div>
          <div style="background: rgba(255, 255, 255, 0.08); height: 7px; border-radius: var(--radius-full); overflow: hidden;">
            <div style="background: var(--primary-gradient); height: 100%; width: ${pct}%; border-radius: var(--radius-full);"></div>
          </div>
        `;
        catContainer.appendChild(bar);
      });
    }

    // 2. Order Funnel Pipeline
    const pipelineContainer = document.getElementById('order-pipeline-container');
    pipelineContainer.innerHTML = '';
    const stages = [
      { name: 'Draft', color: '#94a3b8' },
      { name: 'Pending Approval', color: '#fbbf24' },
      { name: 'Issued', color: '#60a5fa' },
      { name: 'Accepted', color: '#c084fc' },
      { name: 'In Fulfillment', color: '#22d3ee' },
      { name: 'Delivered', color: '#34d399' },
      { name: 'Completed', color: '#10b981' },
    ];

    stages.forEach(stage => {
      const count = this.stats.ordersByStatus[stage.name] || 0;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '0.35rem 0.6rem';
      row.style.background = 'rgba(255, 255, 255, 0.02)';
      row.style.borderRadius = 'var(--radius-sm)';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${stage.color};"></span>
          <span style="font-weight: 500;">${stage.name}</span>
        </div>
        <span style="font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem; color: #fff;">${count}</span>
      `;
      pipelineContainer.appendChild(row);
    });

    // 3. Top Performing Vendors
    const topTbody = document.getElementById('top-vendors-tbody');
    topTbody.innerHTML = '';
    (this.stats.topVendors || []).forEach(v => {
      const tr = document.createElement('tr');
      const tierClass = v.evaluation.tier.includes('Gold') ? 'tier-gold' : v.evaluation.tier.includes('Silver') ? 'tier-silver' : 'tier-bronze';
      tr.innerHTML = `
        <td><span class="po-id-tag">${v.id}</span></td>
        <td><strong>${v.name}</strong></td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">${v.category}</span></td>
        <td>
          <span style="font-weight: 700; color: #fde047;">★ ${v.evaluation.compositeScore.toFixed(2)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">(${v.evaluation.evaluationsCount} evals)</span>
        </td>
        <td><span class="tier-badge ${tierClass}">${v.evaluation.tier}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="app.viewVendorDossier('${v.id}')">Dossier</button>
        </td>
      `;
      topTbody.appendChild(tr);
    });
  },

  // ===================== VENDORS DIRECTORY =====================
  filterVendors() {
    const search = document.getElementById('vendor-search').value.toLowerCase();
    const category = document.getElementById('vendor-category-filter').value;
    const status = document.getElementById('vendor-status-filter').value;

    let filtered = this.vendors.filter(v => {
      const matchSearch = !search ||
        v.name.toLowerCase().includes(search) ||
        v.id.toLowerCase().includes(search) ||
        (v.taxId && v.taxId.toLowerCase().includes(search));
      const matchCat = category === 'All' || v.category === category;
      const matchStatus = status === 'All' || v.status === status;
      return matchSearch && matchCat && matchStatus;
    });

    this.renderVendors(filtered);
  },

  renderVendors(vendorsList) {
    const grid = document.getElementById('vendor-cards-grid');
    grid.innerHTML = '';

    if (vendorsList.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No suppliers match the selected filter criteria.</div>';
      return;
    }

    vendorsList.forEach(vendor => {
      const card = document.createElement('div');
      card.className = 'vendor-card';

      const statusClass = vendor.status.toLowerCase().replace(/\s+/g, '-');
      const score = vendor.evaluation?.compositeScore || 0;
      const tier = vendor.evaluation?.tier || 'Unrated';
      const tierClass = tier.includes('Gold') ? 'tier-gold' : tier.includes('Silver') ? 'tier-silver' : tier.includes('Bronze') ? 'tier-bronze' : 'tier-unrated';

      // Admin or Procurement status approval buttons
      let approvalControls = '';
      if (vendor.status === 'Pending Review' && (this.currentRole === 'admin' || this.currentRole === 'procurement')) {
        approvalControls = `
          <button class="btn btn-success btn-sm" onclick="app.approveVendor('${vendor.id}')">✓ Approve</button>
          <button class="btn btn-outline-danger btn-sm" onclick="app.rejectVendor('${vendor.id}')">✕ Reject</button>
        `;
      }

      card.innerHTML = `
        <div>
          <div class="vendor-card-header">
            <div>
              <span class="vendor-id-pill">${vendor.id}</span>
              <h3 class="vendor-card-title">${vendor.name}</h3>
              <p class="vendor-card-category">${vendor.category}</p>
            </div>
            <span class="status-pill ${statusClass}">${vendor.status}</span>
          </div>

          <div class="vendor-score-box">
            <div class="score-metric-item">
              <span class="score-metric-label">KPI Performance</span>
              <div class="score-metric-number">
                ${score > 0 ? score.toFixed(2) : '--'}
                <span class="score-metric-max">/ 5.0</span>
              </div>
            </div>
            <div>
              <span class="tier-badge ${tierClass}">${tier}</span>
            </div>
          </div>

          <div class="vendor-meta-list">
            <div class="vendor-meta-item">
              <span>👤</span>
              <span><strong>Contact:</strong> ${vendor.contactPerson}</span>
            </div>
            <div class="vendor-meta-item">
              <span>✉️</span>
              <span>${vendor.email}</span>
            </div>
            <div class="vendor-meta-item">
              <span>🏛️</span>
              <span><strong>GSTIN/Tax:</strong> ${vendor.taxId}</span>
            </div>
          </div>
        </div>

        <div class="vendor-card-footer">
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="app.viewVendorDossier('${vendor.id}')">Dossier</button>
          <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="app.openEvaluationModalFor('${vendor.id}')">Evaluate</button>
          ${approvalControls}
        </div>
      `;

      grid.appendChild(card);
    });
  },

  async approveVendor(vendorId) {
    try {
      await api.updateVendorStatus(vendorId, 'Approved', 'Supplier verified & authorized for corporate procurement.');
      this.showToast(`Supplier ${vendorId} approved successfully!`, 'success');
      await this.refreshAllData();
    } catch (err) {
      this.showToast('Approval failed: ' + err.message, 'error');
    }
  },

  async rejectVendor(vendorId) {
    const reason = prompt('Specify rejection reason for vendor dossier:');
    if (!reason) return;
    try {
      await api.updateVendorStatus(vendorId, 'Rejected', reason);
      this.showToast(`Supplier ${vendorId} status set to Rejected`, 'info');
      await this.refreshAllData();
    } catch (err) {
      this.showToast('Rejection update failed: ' + err.message, 'error');
    }
  },

  // ===================== SUPPLIER ONBOARDING WIZARD =====================
  openOnboardModal() {
    this.currentWizardStep = 1;
    this.wizardNext(1);
    document.getElementById('modal-onboard').classList.add('open');
  },

  wizardNext(step) {
    this.currentWizardStep = step;
    [1, 2, 3].forEach(s => {
      document.getElementById(`wizard-pane-${s}`).style.display = s === step ? 'block' : 'none';
      const ind = document.getElementById(`step-ind-${s}`);
      ind.classList.toggle('active', s === step);
      ind.classList.toggle('completed', s < step);
    });
  },

  async submitOnboard() {
    const name = document.getElementById('ob-name').value.trim();
    const legalName = document.getElementById('ob-legalName').value.trim();
    const taxId = document.getElementById('ob-taxId').value.trim();
    const category = document.getElementById('ob-category').value;
    const contactPerson = document.getElementById('ob-contact').value.trim();
    const email = document.getElementById('ob-email').value.trim();
    const phone = document.getElementById('ob-phone').value.trim();
    const address = document.getElementById('ob-address').value.trim();
    const bankName = document.getElementById('ob-bankName').value.trim();
    const ifscCode = document.getElementById('ob-ifsc').value.trim();
    const accountNumber = document.getElementById('ob-accNo').value.trim();
    const remarks = document.getElementById('ob-remarks').value.trim();

    if (!name || !taxId || !contactPerson || !email) {
      this.showToast('Please fill all required supplier fields.', 'error');
      return;
    }

    try {
      await api.createVendor({
        name,
        legalName: legalName || name,
        taxId,
        category,
        contactPerson,
        email,
        phone,
        address,
        remarks,
        bankDetails: { bankName, ifscCode, accountNumber },
        status: 'Pending Review',
      });

      this.closeModals();
      this.showToast(`Supplier ${name} registered for onboarding review!`, 'success');
      await this.refreshAllData();
      this.switchTab('tab-vendors');
    } catch (err) {
      this.showToast('Onboarding submission failed: ' + err.message, 'error');
    }
  },

  // ===================== PURCHASE ORDERS =====================
  filterOrders() {
    const search = document.getElementById('order-search').value.toLowerCase();
    const status = document.getElementById('order-status-filter').value;

    let filtered = this.orders.filter(o => {
      const matchSearch = !search ||
        o.id.toLowerCase().includes(search) ||
        o.title.toLowerCase().includes(search) ||
        o.vendorName.toLowerCase().includes(search);
      const matchStatus = status === 'All' || o.status === status;
      return matchSearch && matchStatus;
    });

    this.renderOrders(filtered);
  },

  renderOrders(ordersList) {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '';

    if (ordersList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No purchase orders found matching current criteria.</td></tr>';
      return;
    }

    const stages = ['Draft', 'Pending Approval', 'Issued', 'Accepted', 'In Fulfillment', 'Delivered', 'Completed'];

    ordersList.forEach(order => {
      const tr = document.createElement('tr');
      const statusClass = order.status.toLowerCase().replace(/\s+/g, '-');
      const currentStageIndex = stages.indexOf(order.status);

      // Mini stepper dots
      let dotsHtml = '<div class="po-stepper-progress">';
      stages.forEach((st, idx) => {
        if (order.status === 'Cancelled' || order.status === 'Rejected') {
          dotsHtml += `<div class="po-step-dot" style="background: var(--rose);"></div>`;
        } else if (idx <= currentStageIndex) {
          dotsHtml += `<div class="po-step-dot completed" title="${st}"></div>`;
        } else {
          dotsHtml += `<div class="po-step-dot" title="${st}"></div>`;
        }
      });
      dotsHtml += '</div>';

      const deliveryDate = order.expectedDelivery ? order.expectedDelivery.slice(0, 10) : 'TBD';

      tr.innerHTML = `
        <td><span class="po-id-tag">${order.id}</span></td>
        <td>
          <div style="font-weight: 600;">${order.vendorName}</div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${order.vendorId}</span>
        </td>
        <td>
          <div style="font-weight: 500;">${order.title}</div>
          <span style="font-size: 0.75rem; color: var(--text-subtle);">${order.items?.length || 0} line items</span>
        </td>
        <td>
          <span class="status-pill ${statusClass}">${order.status}</span>
          ${dotsHtml}
        </td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #fff;">
          ₹${(order.grandTotal).toLocaleString('en-IN')}
        </td>
        <td style="font-size: 0.82rem; color: var(--text-muted);">
          📅 ${deliveryDate}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="app.inspectPoDetails('${order.id}')">Inspect PO</button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  },

  // ===================== CREATE PURCHASE ORDER MODAL =====================
  openCreatePoModal() {
    this.renderVendorDropdowns();
    const poItemsContainer = document.getElementById('po-line-items-container');
    poItemsContainer.innerHTML = '';
    this.addLineItemRow();

    // Default expected delivery to +14 days
    const defDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    document.getElementById('po-deliveryDate').value = defDate;

    document.getElementById('modal-create-po').classList.add('open');
  },

  addLineItemRow() {
    const container = document.getElementById('po-line-items-container');
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.innerHTML = `
      <input type="text" class="form-control item-name" placeholder="Item description / specification" required>
      <input type="number" class="form-control item-qty" value="1" min="1" oninput="app.recalculatePoTotals()" required>
      <input type="number" class="form-control item-price" value="5000" min="0" oninput="app.recalculatePoTotals()" required>
      <span class="row-total">₹5,000</span>
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="this.parentElement.remove(); app.recalculatePoTotals();">&times;</button>
    `;
    container.appendChild(row);
    this.recalculatePoTotals();
  },

  recalculatePoTotals() {
    const rows = document.querySelectorAll('#po-line-items-container .line-item-row');
    let subtotal = 0;

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const total = qty * price;
      row.querySelector('.row-total').textContent = `₹${total.toLocaleString('en-IN')}`;
      subtotal += total;
    });

    const tax = Math.round(subtotal * 0.18);
    const shipping = parseFloat(document.getElementById('po-calc-shipping').value) || 0;
    const grand = subtotal + tax + shipping;

    document.getElementById('po-calc-subtotal').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    document.getElementById('po-calc-tax').textContent = `₹${tax.toLocaleString('en-IN')}`;
    document.getElementById('po-calc-grand').textContent = `₹${grand.toLocaleString('en-IN')}`;
  },

  async submitPo() {
    const vendorId = document.getElementById('po-vendorId').value;
    const title = document.getElementById('po-title').value.trim();
    const expectedDelivery = document.getElementById('po-deliveryDate').value;
    const status = document.getElementById('po-initialStatus').value;
    const shippingFee = parseFloat(document.getElementById('po-calc-shipping').value) || 0;
    const notes = document.getElementById('po-notes').value.trim();

    const rows = document.querySelectorAll('#po-line-items-container .line-item-row');
    const items = [];
    rows.forEach(r => {
      const name = r.querySelector('.item-name').value.trim();
      const quantity = parseFloat(r.querySelector('.item-qty').value) || 1;
      const unitPrice = parseFloat(r.querySelector('.item-price').value) || 0;
      if (name) {
        items.push({ name, quantity, unitPrice });
      }
    });

    if (items.length === 0) {
      this.showToast('Add at least one line item.', 'error');
      return;
    }

    try {
      await api.createOrder({
        vendorId,
        title,
        expectedDelivery,
        status,
        shippingFee,
        notes,
        items,
        createdActor: this.currentRole === 'admin' ? 'Finance Admin' : 'Procurement Officer',
      });

      this.closeModals();
      this.showToast(`Purchase Order created successfully!`, 'success');
      await this.refreshAllData();
      this.switchTab('tab-orders');
    } catch (err) {
      this.showToast('Failed to create PO: ' + err.message, 'error');
    }
  },

  // ===================== PO LIFECYCLE & TIMELINE INSPECTOR =====================
  async inspectPoDetails(orderId) {
    try {
      const res = await api.getOrder(orderId);
      const order = res.data;
      this.activeOrder = order;

      document.getElementById('pod-id').textContent = order.id;
      document.getElementById('pod-vendor').textContent = `${order.vendorName} • Category: ${order.category}`;
      
      const badge = document.getElementById('pod-status-badge');
      badge.className = `status-pill ${order.status.toLowerCase().replace(/\s+/g, '-')}`;
      badge.textContent = order.status;

      // Render Lifecycle Stepper
      const stepperContainer = document.getElementById('pod-stepper-stages');
      stepperContainer.innerHTML = '';
      const stages = ['Draft', 'Pending Approval', 'Issued', 'Accepted', 'In Fulfillment', 'Delivered', 'Completed'];
      const currentIndex = stages.indexOf(order.status);

      stages.forEach((stage, idx) => {
        const item = document.createElement('div');
        item.style.textAlign = 'center';
        item.style.flex = '1';

        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;
        const circleBg = isCompleted ? 'var(--emerald)' : isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)';
        const textColor = isCompleted || isActive ? '#fff' : 'var(--text-subtle)';

        item.innerHTML = `
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${circleBg}; color: #fff; margin: 0 auto 0.35rem auto; display: grid; place-items: center; font-size: 0.72rem; font-weight: 700;">
            ${isCompleted ? '✓' : idx + 1}
          </div>
          <div style="font-size: 0.72rem; font-weight: 600; color: ${textColor};">${stage}</div>
        `;
        stepperContainer.appendChild(item);
      });

      // Render Dynamic Next Actions based on State & Persona
      this.renderPoControls(order);

      // Render Line Items
      const itemsTbody = document.getElementById('pod-items-tbody');
      itemsTbody.innerHTML = '';
      (order.items || []).forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${it.name}</strong></td>
          <td>${it.quantity}</td>
          <td style="font-family: var(--font-mono);">₹${it.unitPrice.toLocaleString('en-IN')}</td>
          <td style="font-family: var(--font-mono); font-weight: 700;">₹${it.total.toLocaleString('en-IN')}</td>
        `;
        itemsTbody.appendChild(tr);
      });

      // Append Total row
      const trTotal = document.createElement('tr');
      trTotal.style.background = 'rgba(255, 255, 255, 0.03)';
      trTotal.innerHTML = `
        <td colspan="3" style="text-align: right; font-weight: 700;">Grand Total (incl. 18% GST):</td>
        <td style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 800; color: #34d399;">₹${order.grandTotal.toLocaleString('en-IN')}</td>
      `;
      itemsTbody.appendChild(trTotal);

      // Render Timeline
      const timelineList = document.getElementById('pod-timeline-list');
      timelineList.innerHTML = '';
      (order.timeline || []).forEach(evt => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.innerHTML = `
          <div class="timeline-marker completed"></div>
          <div class="timeline-title">${evt.status}</div>
          <div class="timeline-meta">${new Date(evt.timestamp).toLocaleString()} &bull; <strong>${evt.actor}</strong></div>
          <div class="timeline-comment">${evt.comment}</div>
        `;
        timelineList.appendChild(div);
      });

      document.getElementById('modal-po-details').classList.add('open');
    } catch (err) {
      this.showToast('Failed to load PO details: ' + err.message, 'error');
    }
  },

  renderPoControls(order) {
    const controls = document.getElementById('pod-action-controls');
    controls.innerHTML = '';
    const st = order.status;

    // Build context-aware state actions
    if (st === 'Draft') {
      controls.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Pending Approval', 'Submitted for executive financial authorization')">
          Submit for Approval &rarr;
        </button>
      `;
    } else if (st === 'Pending Approval') {
      if (this.currentRole === 'admin' || this.currentRole === 'procurement') {
        controls.innerHTML = `
          <button class="btn btn-success btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Issued', 'Authorized and transmitted to vendor portal')">
            ✓ Approve & Issue PO to Vendor
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Rejected', 'Budget limit exceeded')">
            ✕ Reject PO
          </button>
        `;
      } else {
        controls.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">Waiting for Admin / Procurement Officer approval.</span>`;
      }
    } else if (st === 'Issued') {
      controls.innerHTML = `
        <button class="btn btn-success btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Accepted', 'Vendor formally acknowledged order and confirmed lead times')">
          ✓ Accept Purchase Order
        </button>
        <button class="btn btn-outline-danger btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Rejected', 'Vendor stock unavailable')">
          ✕ Decline PO
        </button>
      `;
    } else if (st === 'Accepted') {
      controls.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'In Fulfillment', 'Goods packaged and handed to logistics carrier')">
          📦 Dispatch & Mark In Fulfillment &rarr;
        </button>
      `;
    } else if (st === 'In Fulfillment') {
      controls.innerHTML = `
        <button class="btn btn-success btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Delivered', 'Dock receiving confirmed shipment integrity')">
          🚚 Confirm Warehouse Delivery
        </button>
      `;
    } else if (st === 'Delivered') {
      if (this.currentRole === 'admin' || this.currentRole === 'procurement') {
        controls.innerHTML = `
          <button class="btn btn-success btn-sm" onclick="app.transitionOrderStatus('${order.id}', 'Completed', 'Payment processed and invoice reconciled')">
            💰 Settle Payment & Complete Order
          </button>
        `;
      } else {
        controls.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">Shipment delivered. Awaiting final finance invoice settlement.</span>`;
      }
    } else if (st === 'Completed') {
      controls.innerHTML = `
        <span style="font-size: 0.82rem; color: #34d399; font-weight: 700;">✓ Purchase order fully completed, received, and paid.</span>
        <button class="btn btn-primary btn-sm" onclick="app.openEvaluationModalFor('${order.vendorId}', '${order.id}')">
          ★ Evaluate Vendor Performance
        </button>
      `;
    }
  },

  async transitionOrderStatus(orderId, newStatus, defaultComment) {
    const actor = this.currentRole === 'admin' ? 'Finance Admin' : this.currentRole === 'procurement' ? 'Procurement Officer' : 'Supplier Representative';
    try {
      await api.updateOrderStatus(orderId, newStatus, actor, defaultComment);
      this.showToast(`Order ${orderId} transitioned to '${newStatus}'`, 'success');
      await this.refreshAllData();
      await this.inspectPoDetails(orderId);
    } catch (err) {
      this.showToast('Lifecycle transition error: ' + err.message, 'error');
    }
  },

  // ===================== PERFORMANCE EVALUATION MATRIX =====================
  updateEvalCalculations() {
    const d = parseFloat(document.getElementById('slider-delivery')?.value || 4.5);
    const q = parseFloat(document.getElementById('slider-quality')?.value || 4.5);
    const p = parseFloat(document.getElementById('slider-pricing')?.value || 4.0);
    const s = parseFloat(document.getElementById('slider-support')?.value || 4.2);

    document.getElementById('val-delivery').textContent = `${d.toFixed(1)} / 5.0`;
    document.getElementById('val-quality').textContent = `${q.toFixed(1)} / 5.0`;
    document.getElementById('val-pricing').textContent = `${p.toFixed(1)} / 5.0`;
    document.getElementById('val-support').textContent = `${s.toFixed(1)} / 5.0`;

    // Formula: 35% delivery + 35% quality + 15% price + 15% support
    const composite = (d * 0.35 + q * 0.35 + p * 0.15 + s * 0.15);
    const rounded = Math.round(composite * 100) / 100;

    document.getElementById('eval-calculated-score').textContent = rounded.toFixed(2);

    let tier = 'Bronze (Under Review)';
    let tierClass = 'tier-bronze';
    if (rounded >= 4.5) {
      tier = 'Gold (Preferred)';
      tierClass = 'tier-gold';
    } else if (rounded >= 3.8) {
      tier = 'Silver (Approved)';
      tierClass = 'tier-silver';
    } else if (rounded < 2.5) {
      tier = 'Critical (At Risk)';
      tierClass = 'tier-unrated';
    }

    const tierBadge = document.getElementById('eval-calculated-tier');
    tierBadge.textContent = tier;
    tierBadge.className = `tier-badge ${tierClass}`;
  },

  openEvaluationModalFor(vendorId, poRef = '') {
    this.switchTab('tab-performance');
    const select = document.getElementById('eval-vendor-select');
    if (select) {
      select.value = vendorId;
    }
    if (poRef) {
      document.getElementById('eval-po-ref').value = poRef;
    }
    this.closeModals();
  },

  onEvalVendorChange() {
    const vendorId = document.getElementById('eval-vendor-select').value;
    const vendor = this.vendors.find(v => v.id === vendorId);
    if (vendor && vendor.evaluation && vendor.evaluation.deliveryScore > 0) {
      document.getElementById('slider-delivery').value = vendor.evaluation.deliveryScore;
      document.getElementById('slider-quality').value = vendor.evaluation.qualityScore;
      document.getElementById('slider-pricing').value = vendor.evaluation.pricingScore;
      document.getElementById('slider-support').value = vendor.evaluation.supportScore;
      this.updateEvalCalculations();
    }
  },

  async submitEvaluation() {
    const vendorId = document.getElementById('eval-vendor-select').value;
    const poReference = document.getElementById('eval-po-ref').value.trim();
    const comments = document.getElementById('eval-comments').value.trim();

    const deliveryScore = parseFloat(document.getElementById('slider-delivery').value);
    const qualityScore = parseFloat(document.getElementById('slider-quality').value);
    const pricingScore = parseFloat(document.getElementById('slider-pricing').value);
    const supportScore = parseFloat(document.getElementById('slider-support').value);

    try {
      const res = await api.evaluateVendor(vendorId, {
        deliveryScore,
        qualityScore,
        pricingScore,
        supportScore,
        poReference,
        comments,
        evaluatedBy: this.currentRole === 'admin' ? 'Chief Procurement Auditor' : 'Procurement Inspector',
      });

      this.showToast(res.message, 'success');
      document.getElementById('eval-comments').value = '';
      await this.refreshAllData();
    } catch (err) {
      this.showToast('Evaluation failed: ' + err.message, 'error');
    }
  },

  renderEvaluationLog() {
    const container = document.getElementById('evaluations-log-list');
    if (!container) return;
    container.innerHTML = '';

    // Extract recent evaluations
    const evals = [];
    this.vendors.forEach(v => {
      if (v.evaluation && v.evaluation.lastEvaluated) {
        evals.push({
          vendorId: v.id,
          vendorName: v.name,
          compositeScore: v.evaluation.compositeScore,
          tier: v.evaluation.tier,
          date: v.evaluation.lastEvaluated,
          remarks: v.evaluation.remarks,
        });
      }
    });

    if (evals.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No evaluation audits logged yet.</p>';
      return;
    }

    evals.forEach(ev => {
      const div = document.createElement('div');
      div.style.background = 'rgba(255, 255, 255, 0.02)';
      div.style.border = '1px solid var(--border-subtle)';
      div.style.borderRadius = 'var(--radius-md)';
      div.style.padding = '0.9rem';

      const tierClass = ev.tier.includes('Gold') ? 'tier-gold' : ev.tier.includes('Silver') ? 'tier-silver' : 'tier-bronze';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
          <div>
            <strong style="color: #fff; font-size: 0.9rem;">${ev.vendorName}</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.4rem;">(${ev.vendorId})</span>
          </div>
          <span class="tier-badge ${tierClass}">${ev.tier}</span>
        </div>
        <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem;">
          <span>Score: <strong style="color: #fde047;">★ ${ev.compositeScore.toFixed(2)}</strong></span>
          <span>Date: ${new Date(ev.date).toLocaleDateString()}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-subtle);">${ev.remarks}</p>
      `;
      container.appendChild(div);
    });
  },

  // ===================== VENDOR DOSSIER MODAL =====================
  async viewVendorDossier(vendorId) {
    try {
      const res = await api.getVendor(vendorId);
      const vendor = res.data;

      document.getElementById('vd-name').textContent = vendor.name;
      document.getElementById('vd-id').textContent = vendor.id;

      const content = document.getElementById('vd-content');
      const score = vendor.evaluation?.compositeScore || 0;
      const tier = vendor.evaluation?.tier || 'Unrated';
      const tierClass = tier.includes('Gold') ? 'tier-gold' : tier.includes('Silver') ? 'tier-silver' : 'tier-bronze';

      content.innerHTML = `
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">Corporate Profile</h4>
          <p><strong>Legal Entity:</strong> ${vendor.legalName}</p>
          <p><strong>Supply Category:</strong> ${vendor.category}</p>
          <p><strong>Tax ID / GSTIN:</strong> <span style="font-family: var(--font-mono);">${vendor.taxId}</span></p>
          <p><strong>Primary Address:</strong> ${vendor.address}</p>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">Point of Contact</h4>
          <p><strong>Name:</strong> ${vendor.contactPerson}</p>
          <p><strong>Email:</strong> ${vendor.email}</p>
          <p><strong>Phone:</strong> ${vendor.phone}</p>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem;">Banking & Settlement</h4>
          <p><strong>Bank:</strong> ${vendor.bankDetails?.bankName || 'N/A'}</p>
          <p><strong>Account Number:</strong> <span style="font-family: var(--font-mono);">${vendor.bankDetails?.accountNumber || 'N/A'}</span></p>
          <p><strong>IFSC Code:</strong> <span style="font-family: var(--font-mono);">${vendor.bankDetails?.ifscCode || 'N/A'}</span></p>
        </div>

        <div style="background: rgba(10, 16, 32, 0.6); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="color: #fff;">Performance Standing</strong>
            <span class="tier-badge ${tierClass}">${tier}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Composite Score: <strong style="color: #fde047;">★ ${score > 0 ? score.toFixed(2) : '--'} / 5.0</strong>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-subtle); margin-top: 0.5rem;">${vendor.evaluation?.remarks || 'No notes.'}</p>
        </div>
      `;

      document.getElementById('modal-vendor-dossier').classList.add('open');
    } catch (err) {
      this.showToast('Could not load dossier: ' + err.message, 'error');
    }
  },

  // ===================== AUDIT TRAIL =====================
  renderAuditTrail() {
    const tbody = document.getElementById('audit-log-tbody');
    if (!tbody || !this.stats) return;
    tbody.innerHTML = '';

    (this.stats.recentAudit || []).forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="po-id-tag">${item.id}</span></td>
        <td><strong style="color: #a5b4fc;">${item.action}</strong></td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(item.timestamp).toLocaleString()}</td>
        <td style="font-size: 0.85rem;">${item.details}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // ===================== DATA UTILITIES =====================
  renderVendorDropdowns() {
    const poSelect = document.getElementById('po-vendorId');
    const evalSelect = document.getElementById('eval-vendor-select');

    if (poSelect) {
      poSelect.innerHTML = '';
      this.vendors.filter(v => v.status === 'Approved').forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.category})`;
        poSelect.appendChild(opt);
      });
    }

    if (evalSelect) {
      evalSelect.innerHTML = '';
      this.vendors.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.id})`;
        evalSelect.appendChild(opt);
      });
    }
  },

  downloadExport(type) {
    this.showToast(`Generating ${type} CSV export...`, 'info');
    api.downloadExport(type);
  },

  async resetSystemData() {
    if (!confirm('Are you sure you want to reset all data back to the clean initial demo state?')) return;
    try {
      const res = await api.resetData();
      this.showToast(res.message, 'success');
      await this.refreshAllData();
      this.switchTab('tab-dashboard');
    } catch (err) {
      this.showToast('Reset failed: ' + err.message, 'error');
    }
  },

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  },

  // ===================== TOAST SYSTEM =====================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },
};

// Auto-run on document ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
