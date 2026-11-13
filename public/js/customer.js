// ========================================================
// Sri Ramakrishna Offset - Customer Page Logic
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('orderForm');
    const trackForm = document.getElementById('trackForm');
    const orderAlert = document.getElementById('orderAlert');
    const trackAlert = document.getElementById('trackAlert');
    const trackingResult = document.getElementById('trackingResult');

    // UI Helper: Display alert
    function showAlert(element, message, type = 'info') {
        element.className = `alert-box alert-${type} show`;
        element.innerHTML = message;
    }

    // UI Helper: Clear alert
    function clearAlert(element) {
        element.className = 'alert-box';
        element.innerHTML = '';
    }

    // Map status string to CSS badge class
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
    // 1. Handle Customer Order Submission
    // ----------------------------------------------------
    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert(orderAlert);

            const submitBtn = document.getElementById('submitOrderBtn');
            const originalBtnText = submitBtn.innerText;

            // Form data extraction
            const customer_name = document.getElementById('customerName').value.trim();
            const customer_email = document.getElementById('customerEmail').value.trim();
            const book_title = document.getElementById('bookTitle').value.trim();
            const quantity = parseInt(document.getElementById('quantity').value, 10);
            const pages = parseInt(document.getElementById('pages').value, 10);
            const book_size = document.getElementById('bookSize').value;
            const instructions = document.getElementById('instructions').value.trim();

            // Client-side Validation
            if (!customer_name || !customer_email || !book_title || !quantity || !pages || !book_size) {
                showAlert(orderAlert, 'Please fill in all required fields.', 'error');
                return;
            }

            if (quantity <= 0 || pages <= 0) {
                showAlert(orderAlert, 'Quantity and pages must both be greater than 0.', 'error');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Submitting Order...';

                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer_name,
                        customer_email,
                        book_title,
                        quantity,
                        pages,
                        book_size,
                        instructions
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Error occurred while saving your order.');
                }

                // Show confirmation message with unique order number
                showAlert(
                    orderAlert,
                    `<strong>🎉 Order Confirmed!</strong><br>
                     Your Order Number is: <span style="font-size:1.15rem; font-weight:800; color:var(--primary-color);">${data.order_number}</span><br>
                     Please save this number and your email (<strong>${customer_email}</strong>) to track progress.`,
                    'success'
                );

                // Reset form fields
                orderForm.reset();

                // Pre-fill tracking form for convenience
                document.getElementById('trackOrderNumber').value = data.order_number;
                document.getElementById('trackEmail').value = customer_email;

            } catch (err) {
                showAlert(orderAlert, err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    }

    // ----------------------------------------------------
    // 2. Handle Order Tracking Lookup
    // ----------------------------------------------------
    if (trackForm) {
        trackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert(trackAlert);
            trackingResult.classList.remove('show');

            const orderNumberInput = document.getElementById('trackOrderNumber').value.trim();
            const emailInput = document.getElementById('trackEmail').value.trim();

            if (!orderNumberInput || !emailInput) {
                showAlert(trackAlert, 'Please enter both Order Number and your registered Email.', 'error');
                return;
            }

            const trackBtn = document.getElementById('trackBtn');
            const originalBtnText = trackBtn.innerText;

            try {
                trackBtn.disabled = true;
                trackBtn.innerText = 'Searching...';

                const url = `/api/orders/track?order_number=${encodeURIComponent(orderNumberInput)}&customer_email=${encodeURIComponent(emailInput)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Order could not be found.');
                }

                const order = data.order;

                // Populate tracking result box
                document.getElementById('resOrderNumber').innerText = order.order_number;
                const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                document.getElementById('resOrderDate').innerText = `Placed: ${formattedDate}`;

                const badge = document.getElementById('resStatusBadge');
                badge.className = `status-badge ${getStatusBadgeClass(order.status)}`;
                badge.innerText = order.status;

                document.getElementById('resBookTitle').innerText = order.book_title;
                document.getElementById('resQuantity').innerText = `${order.quantity} copies`;
                document.getElementById('resPages').innerText = `${order.pages} pages`;
                document.getElementById('resBookSize').innerText = order.book_size;

                trackingResult.classList.add('show');

            } catch (err) {
                showAlert(trackAlert, err.message, 'error');
            } finally {
                trackBtn.disabled = false;
                trackBtn.innerText = originalBtnText;
            }
        });
    }
});
