// ========================================================
// Sri Ramakrishna Offset - Admin Overview Logic
// ========================================================

document.addEventListener('DOMContentLoaded', async () => {
    const statTotalOrders = document.getElementById('statTotalOrders');
    const statInProgress = document.getElementById('statInProgress');
    const statCompleted = document.getElementById('statCompleted');
    const recentOrdersBody = document.getElementById('recentOrdersBody');
    const refreshAdminBtn = document.getElementById('refreshAdminBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loggedInUserSpan = document.getElementById('loggedInUser');

    // ----------------------------------------------------
    // 1. Session Verification
    // ----------------------------------------------------
    try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();

        if (!authData.authenticated || authData.user.role !== 'admin') {
            window.location.href = '/admin-login.html';
            return;
        }

        if (loggedInUserSpan && authData.user) {
            loggedInUserSpan.innerText = authData.user.username;
        }
    } catch (err) {
        window.location.href = '/admin-login.html';
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
                window.location.href = '/admin-login.html';
            }
        });
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
    // 3. Fetch Metrics & Recent Orders from API
    // ----------------------------------------------------
    async function loadAdminData() {
        try {
            const res = await fetch('/api/admin/stats');

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin-login.html';
                return;
            }

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to load statistics.');
            }

            // Update Metric Counters
            statTotalOrders.innerText = data.metrics.total_orders;
            statInProgress.innerText = data.metrics.in_progress;
            statCompleted.innerText = data.metrics.completed;

            // Render Recent Orders Table
            const recent = data.recent_orders || [];

            if (recent.length === 0) {
                recentOrdersBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
                            No orders in the database yet.
                        </td>
                    </tr>
                `;
                return;
            }

            recentOrdersBody.innerHTML = recent.map(order => {
                const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });

                return `
                    <tr>
                        <td><strong>${order.order_number}</strong></td>
                        <td>${order.customer_name}</td>
                        <td>${order.book_title}</td>
                        <td>${order.quantity}</td>
                        <td>${order.pages}</td>
                        <td>${formattedDate}</td>
                        <td>
                            <span class="status-badge ${getStatusBadgeClass(order.status)}">
                                ${order.status}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            recentOrdersBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:2rem; color:var(--danger-color);">
                        Error loading admin metrics: ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    if (refreshAdminBtn) {
        refreshAdminBtn.addEventListener('click', loadAdminData);
    }

    // Initial load
    loadAdminData();
});
