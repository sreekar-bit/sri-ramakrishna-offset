// ========================================================
// Sri Ramakrishna Offset - Manager Dashboard Logic
// ========================================================

document.addEventListener('DOMContentLoaded', async () => {
    const ordersTableBody = document.getElementById('ordersTableBody');
    const statusAlert = document.getElementById('statusAlert');
    const refreshBtn = document.getElementById('refreshBtn');
    const orderModal = document.getElementById('orderModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const modalContent = document.getElementById('modalContent');
    const modalOrderNumber = document.getElementById('modalOrderNumber');
    const logoutBtn = document.getElementById('logoutBtn');
    const loggedInUserSpan = document.getElementById('loggedInUser');

    // ----------------------------------------------------
    // 1. Session Verification
    // ----------------------------------------------------
    try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();

        if (!authData.authenticated || authData.user.role !== 'manager') {
            window.location.href = '/manager-login.html';
            return;
        }

        if (loggedInUserSpan && authData.user) {
            loggedInUserSpan.innerText = authData.user.username;
        }
    } catch (err) {
        window.location.href = '/manager-login.html';
        return;
    }

    // ----------------------------------------------------
    // 2. Logout Handler
    // ----------------------------------------------------
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } finally {
                window.location.href = '/manager-login.html';
            }
        });
    }

    // Keep cached orders list for modal inspection
    let cachedOrders = [];

    const ALLOWED_STATUSES = [
        'Order Received',
        'Printing',
        'Book Finishing',
        'Ready for Delivery',
        'Completed',
        'Rejected'
    ];

    // Helper: Show banner alert
    function showAlert(message, type = 'info') {
        if (!statusAlert) return;
        statusAlert.className = `alert-box alert-${type} show`;
        statusAlert.innerHTML = message;
        setTimeout(() => {
            statusAlert.className = 'alert-box';
            statusAlert.innerHTML = '';
        }, 5000);
    }

    // Helper: Map status to badge class
    function getStatusBadgeClass(status) {
        switch (status) {
            case 'Order Received': return 'badge-order-received';
            case 'Printing': return 'badge-printing';
            case 'Book Finishing': return 'badge-book-finishing';
            case 'Ready for Delivery': return 'badge-ready-for-delivery';
            case 'Completed': return 'badge-completed';
            case 'Rejected': return 'badge-rejected';
            default: return 'badge-order-received';
        }
    }

    // ----------------------------------------------------
    // 3. Load All Orders from MySQL Database
    // ----------------------------------------------------
    async function loadOrders() {
        try {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
                        Fetching latest orders from database...
                    </td>
                </tr>
            `;

            const res = await fetch('/api/orders');

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/manager-login.html';
                return;
            }

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to load orders.');
            }

            cachedOrders = data.orders || [];

            if (cachedOrders.length === 0) {
                ordersTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                            No orders placed yet. Submit an order from the Customer Website to see it here!
                        </td>
                    </tr>
                `;
                return;
            }

            // Render table rows
            ordersTableBody.innerHTML = cachedOrders.map(order => {
                const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });

                // Generate dropdown options
                const optionsHtml = ALLOWED_STATUSES.map(st => `
                    <option value="${st}" ${st === order.status ? 'selected' : ''}>${st}</option>
                `).join('');

                return `
                    <tr id="row-${order.id}">
                        <td><strong>${order.order_number}</strong></td>
                        <td>${order.customer_name}</td>
                        <td>${order.book_title}</td>
                        <td>${order.quantity}</td>
                        <td>${formattedDate}</td>
                        <td>
                            <span id="badge-${order.id}" class="status-badge ${getStatusBadgeClass(order.status)}">
                                ${order.status}
                            </span>
                        </td>
                        <td>
                            <select 
                                style="padding:0.4rem 0.6rem; font-size:0.85rem;" 
                                onchange="handleStatusChange(${order.id}, '${order.order_number}', this.value)"
                            >
                                ${optionsHtml}
                            </select>
                        </td>
                        <td>
                            <button 
                                class="btn btn-secondary" 
                                style="padding:0.35rem 0.75rem; font-size:0.8rem;" 
                                onclick="openOrderModal(${order.id})"
                            >
                                View Specs
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:2rem; color:var(--danger-color);">
                        Error: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    // ----------------------------------------------------
    // 4. Update Order Status via PUT API
    // ----------------------------------------------------
    window.handleStatusChange = async function(orderId, orderNumber, newStatus) {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.status === 401 || response.status === 403) {
                window.location.href = '/manager-login.html';
                return;
            }

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to update status.');
            }

            // Update badge in the table row immediately
            const badge = document.getElementById(`badge-${orderId}`);
            if (badge) {
                badge.className = `status-badge ${getStatusBadgeClass(newStatus)}`;
                badge.innerText = newStatus;
            }

            // Update cached order
            const targetOrder = cachedOrders.find(o => o.id === orderId);
            if (targetOrder) targetOrder.status = newStatus;

            showAlert(`✅ Order <strong>${orderNumber}</strong> updated to <strong>${newStatus}</strong>!`, 'success');

        } catch (err) {
            showAlert(`❌ ${err.message}`, 'error');
            loadOrders(); // reload on error to revert dropdown
        }
    };

    // ----------------------------------------------------
    // 5. Open Modal with Full Technical Specifications
    // ----------------------------------------------------
    window.openOrderModal = function(orderId) {
        const order = cachedOrders.find(o => o.id === orderId);
        if (!order) return;

        modalOrderNumber.innerText = `Order Details — ${order.order_number}`;

        const formattedDate = new Date(order.created_at).toLocaleString();

        modalContent.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.92rem;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Customer:</span>
                    <strong>${order.customer_name}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Customer Email:</span>
                    <strong>${order.customer_email}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Book Title:</span>
                    <strong>${order.book_title}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Print Quantity:</span>
                    <strong>${order.quantity} copies</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Page Count:</span>
                    <strong>${order.pages} pages</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Book Dimensions:</span>
                    <strong>${order.book_size}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">
                    <span style="color:var(--text-muted);">Order Placed:</span>
                    <span>${formattedDate}</span>
                </div>
                <div style="border-top:1px solid #e2e8f0; padding-top:0.75rem; margin-top:0.25rem;">
                    <span style="color:var(--text-muted); display:block; margin-bottom:0.25rem;">Additional Notes / Instructions:</span>
                    <p style="background:#f8fafc; padding:0.75rem; border-radius:6px; border:1px solid #e2e8f0; font-style:${order.instructions ? 'normal' : 'italic'};">
                        ${order.instructions ? order.instructions : 'No special instructions provided.'}
                    </p>
                </div>
            </div>
        `;

        orderModal.classList.add('show');
    };

    // Close modal handlers
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => orderModal.classList.remove('show'));
    if (modalOkBtn) modalOkBtn.addEventListener('click', () => orderModal.classList.remove('show'));
    if (orderModal) {
        orderModal.addEventListener('click', (e) => {
            if (e.target === orderModal) orderModal.classList.remove('show');
        });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);

    // Initial load
    loadOrders();
});
