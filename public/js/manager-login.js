// ========================================================
// Sri Ramakrishna Offset - Manager Login Script
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('managerLoginForm');
    const alertBox = document.getElementById('loginAlert');
    const loginBtn = document.getElementById('loginBtn');

    function showAlert(message, type = 'error') {
        alertBox.className = `alert-box alert-${type} show`;
        alertBox.innerHTML = message;
    }

    function clearAlert() {
        alertBox.className = 'alert-box';
        alertBox.innerHTML = '';
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showAlert('Please provide both username and password.');
                return;
            }

            const originalBtnText = loginBtn.innerText;

            try {
                loginBtn.disabled = true;
                loginBtn.innerText = 'Signing In...';

                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        expected_role: 'manager'
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Invalid manager credentials.');
                }

                // Redirect to manager dashboard
                window.location.href = data.redirect || '/manager.html';

            } catch (err) {
                showAlert(err.message, 'error');
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = originalBtnText;
            }
        });
    }
});
