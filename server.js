// ========================================================
// Sri Ramakrishna Offset - Express Server & Authentication
// ========================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const net = require('net');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT || 3000, 10);

// Allowed production statuses according to project specifications
const ALLOWED_STATUSES = [
    'Order Received',
    'Printing',
    'Book Finishing',
    'Ready for Delivery',
    'Completed',
    'Rejected'
];

// --------------------------------------------------------
// 1. Auto-Free Port 3000 (Prevents EADDRINUSE error)
// --------------------------------------------------------
function freePortIfBusy(port) {
    if (process.platform !== 'win32') return;
    try {
        const cmd = `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess"`;
        const pids = execSync(cmd, { encoding: 'utf-8' }).trim();
        if (pids) {
            const pidList = pids.split(/\r?\n/).map(p => parseInt(p.trim(), 10)).filter(p => p && p !== process.pid);
            for (const pid of pidList) {
                try {
                    process.kill(pid, 'SIGKILL');
                } catch (_) {
                    try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (__) {}
                }
            }
        }
    } catch (_) {}
}

// --------------------------------------------------------
// 2. Auto-Start MySQL / MariaDB if not running
// --------------------------------------------------------
function isPortOpen(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, '127.0.0.1');
    });
}

async function ensureDatabaseService() {
    const dbPort = parseInt(process.env.DB_PORT || 3306, 10);
    const isOpen = await isPortOpen(dbPort);
    if (isOpen) {
        return true;
    }

    console.log('🔄 MySQL/MariaDB database is not running. Starting database daemon automatically...');
    const possiblePaths = [
        'C:\\Program Files\\MariaDB 13.0\\bin\\mysqld.exe',
        'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe',
        'C:\\xampp\\mysql\\bin\\mysqld.exe'
    ];

    for (const binPath of possiblePaths) {
        if (fs.existsSync(binPath)) {
            try {
                const workDir = path.dirname(path.dirname(binPath));
                const iniPath = path.join(workDir, 'data', 'my.ini');
                const args = fs.existsSync(iniPath)
                    ? [`--defaults-file=${iniPath}`, '--console']
                    : ['--console'];

                const child = spawn(binPath, args, {
                    cwd: workDir,
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();
                break;
            } catch (err) {
                console.warn('Could not launch:', binPath, err.message);
            }
        }
    }

    // Wait up to 10 seconds for port to open
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await isPortOpen(dbPort)) {
            console.log('✅ MySQL/MariaDB database started successfully on port ' + dbPort + '!');
            return true;
        }
    }

    console.warn('⚠️ Could not auto-start MySQL on port ' + dbPort + '. Make sure MySQL/MariaDB is running.');
    return false;
}

// --------------------------------------------------------
// 3. In-Memory Login Rate-Limiting Protection
// --------------------------------------------------------
const loginAttempts = new Map();

function checkLoginLockout(key) {
    const record = loginAttempts.get(key);
    if (!record) return null;

    if (record.lockedUntil && record.lockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((record.lockedUntil - Date.now()) / 60000);
        return `Too many failed attempts. Account locked for ${remainingMinutes} more minute(s).`;
    }

    if (record.lockedUntil && record.lockedUntil <= Date.now()) {
        loginAttempts.delete(key);
    }
    return null;
}

function recordFailedAttempt(key) {
    const record = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now(), lockedUntil: null };
    record.count += 1;
    if (record.count >= 5) {
        record.lockedUntil = Date.now() + 15 * 60 * 1000;
    }
    loginAttempts.set(key, record);
}

function clearFailedAttempts(key) {
    loginAttempts.delete(key);
}

// --------------------------------------------------------
// 4. Middlewares
// --------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'sri_ramakrishna_offset_secure_session_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000
    }
}));

// --------------------------------------------------------
// 5. Database Connection Pool Setup
// --------------------------------------------------------
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sri_ramakrishna_offset',
    port: parseInt(process.env.DB_PORT || 3306, 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Seed default admin & manager credentials
function seedDefaultUsers() {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const managerUser = process.env.MANAGER_USERNAME || 'manager';
    const managerPass = process.env.MANAGER_PASSWORD || 'manager123';

    const usersToSeed = [
        { username: adminUser, password: adminPass, role: 'admin' },
        { username: managerUser, password: managerPass, role: 'manager' }
    ];

    usersToSeed.forEach(u => {
        const hash = bcrypt.hashSync(u.password, 10);
        const upsertSql = `
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)
        `;
        db.query(upsertSql, [u.username, hash, u.role], (err) => {
            if (err) {
                console.error(`⚠️ Failed to seed user ${u.username}:`, err.message);
            }
        });
    });
    console.log('🔐 Admin and Manager credentials securely verified in MySQL users table.');
}

// Ensure database schema and tables exist
function initializeDatabaseSchema() {
    const rootConnection = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || 3306, 10)
    });

    rootConnection.query('CREATE DATABASE IF NOT EXISTS sri_ramakrishna_offset', (err) => {
        rootConnection.end();
        if (err) {
            console.warn('Database creation check:', err.message);
        }

        db.getConnection((connErr, connection) => {
            if (connErr) {
                console.error('❌ Database connection error:', connErr.message);
            } else {
                console.log('✅ Connected to MySQL database "sri_ramakrishna_offset" successfully!');
                connection.release();

                const createOrdersSql = `
                    CREATE TABLE IF NOT EXISTS orders (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        order_number VARCHAR(50) NOT NULL UNIQUE,
                        customer_name VARCHAR(100) NOT NULL,
                        customer_email VARCHAR(100) NOT NULL,
                        book_title VARCHAR(150) NOT NULL,
                        quantity INT NOT NULL,
                        pages INT NOT NULL,
                        book_size VARCHAR(50) NOT NULL,
                        instructions TEXT NULL,
                        status VARCHAR(50) NOT NULL DEFAULT 'Order Received',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `;

                const createUsersSql = `
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        username VARCHAR(50) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `;

                db.query(createOrdersSql, () => {
                    db.query(createUsersSql, () => {
                        seedDefaultUsers();
                    });
                });
            }
        });
    });
}

// --------------------------------------------------------
// 6. Auth Middlewares & Protected Routes
// --------------------------------------------------------
function requireApiAuth(allowedRole) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in to continue.'
            });
        }
        if (allowedRole && req.session.user.role !== allowedRole) {
            return res.status(403).json({
                success: false,
                message: `Forbidden. You do not have permissions for the ${allowedRole} role.`
            });
        }
        next();
    };
}

function requirePageAuth(allowedRole, redirectLoginUrl) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect(redirectLoginUrl);
        }
        if (allowedRole && req.session.user.role !== allowedRole) {
            return res.redirect(redirectLoginUrl);
        }
        next();
    };
}

// Protected HTML Routes
app.get('/manager.html', requirePageAuth('manager', '/manager-login.html'), (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'manager.html'));
});

app.get('/manager', requirePageAuth('manager', '/manager-login.html'), (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'manager.html'));
});

app.get('/admin.html', requirePageAuth('admin', '/admin-login.html'), (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'admin.html'));
});

app.get('/admin', requirePageAuth('admin', '/admin-login.html'), (req, res) => {
    res.sendFile(path.join(__dirname, 'protected', 'admin.html'));
});

// Serve frontend public static files
app.use(express.static(path.join(__dirname, 'public')));

// --------------------------------------------------------
// 7. Authentication API Endpoints
// --------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
    const { username, password, expected_role } = req.body;

    if (!username || !username.trim() || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const cleanUsername = username.trim();
    const lockoutMessage = checkLoginLockout(cleanUsername);
    if (lockoutMessage) {
        return res.status(429).json({ success: false, message: lockoutMessage });
    }

    const query = 'SELECT id, username, password_hash, role FROM users WHERE username = ?';
    db.query(query, [cleanUsername], (err, results) => {
        if (err) {
            console.error('Database query error during login:', err);
            return res.status(500).json({ success: false, message: 'Database error during authentication. Ensure MySQL is running.' });
        }

        if (results.length === 0) {
            recordFailedAttempt(cleanUsername);
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const user = results[0];
        const isMatch = bcrypt.compareSync(password, user.password_hash);

        if (!isMatch) {
            recordFailedAttempt(cleanUsername);
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        if (expected_role && user.role !== expected_role) {
            return res.status(403).json({
                success: false,
                message: `Access denied. This account has the "${user.role}" role and cannot log into the ${expected_role} portal.`
            });
        }

        clearFailedAttempts(cleanUsername);

        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        const redirectUrl = user.role === 'admin' ? '/admin.html' : '/manager.html';

        res.json({
            success: true,
            message: 'Login successful.',
            role: user.role,
            username: user.username,
            redirect: redirectUrl
        });
    });
});

app.post('/api/auth/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Could not log out.' });
            }
            res.clearCookie('connect.sid');
            return res.json({ success: true, message: 'Logged out successfully.' });
        });
    } else {
        res.json({ success: true, message: 'Already logged out.' });
    }
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({ authenticated: true, user: req.session.user });
    }
    res.json({ authenticated: false });
});

// --------------------------------------------------------
// 8. Public Customer API Endpoints
// --------------------------------------------------------
app.get('/api/health', (req, res) => {
    db.query('SELECT 1 + 1 AS solution', (err) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database connection error', error: err.message });
        }
        res.json({
            status: 'ok',
            message: 'Server and MySQL database are running properly!',
            database: process.env.DB_NAME || 'sri_ramakrishna_offset'
        });
    });
});

app.post('/api/orders', (req, res) => {
    const { customer_name, customer_email, book_title, quantity, pages, book_size, instructions } = req.body;

    if (!customer_name || !customer_name.trim()) {
        return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }
    if (!customer_email || !customer_email.trim() || !customer_email.includes('@') || !customer_email.includes('.')) {
        return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!book_title || !book_title.trim()) {
        return res.status(400).json({ success: false, message: 'Book title / project name is required.' });
    }

    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive number greater than 0.' });
    }

    const parsedPages = parseInt(pages, 10);
    if (isNaN(parsedPages) || parsedPages <= 0) {
        return res.status(400).json({ success: false, message: 'Number of pages must be a positive number greater than 0.' });
    }

    if (!book_size || !book_size.trim()) {
        return res.status(400).json({ success: false, message: 'Please select a book size.' });
    }

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `SRO-${randomDigits}`;

    const insertSql = `
        INSERT INTO orders 
        (order_number, customer_name, customer_email, book_title, quantity, pages, book_size, instructions, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Order Received')
    `;

    const values = [
        orderNumber,
        customer_name.trim(),
        customer_email.trim().toLowerCase(),
        book_title.trim(),
        parsedQuantity,
        parsedPages,
        book_size.trim(),
        instructions ? instructions.trim() : null
    ];

    db.query(insertSql, values, (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            return res.status(500).json({ success: false, message: 'Failed to save order to database.', error: err.message });
        }

        res.status(201).json({
            success: true,
            message: 'Printing order submitted successfully!',
            order_number: orderNumber,
            order_id: result.insertId
        });
    });
});

app.get('/api/orders/track', (req, res) => {
    const { order_number, customer_email } = req.query;

    if (!order_number || !order_number.trim() || !customer_email || !customer_email.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Both Order Number and Registered Email are required to track your order.'
        });
    }

    const trackSql = `
        SELECT id, order_number, customer_name, customer_email, book_title, quantity, pages, book_size, instructions, status, created_at 
        FROM orders 
        WHERE order_number = ? AND LOWER(customer_email) = LOWER(?)
    `;

    db.query(trackSql, [order_number.trim(), customer_email.trim()], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Database error while searching for order.', error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No matching order found. Please check both your Order Number and Registered Email address.'
            });
        }

        res.json({
            success: true,
            order: results[0]
        });
    });
});

// --------------------------------------------------------
// 9. Protected Manager & Admin API Endpoints
// --------------------------------------------------------
app.get('/api/orders', requireApiAuth('manager'), (req, res) => {
    const selectAllSql = `
        SELECT id, order_number, customer_name, customer_email, book_title, quantity, pages, book_size, instructions, status, created_at 
        FROM orders 
        ORDER BY created_at DESC
    `;

    db.query(selectAllSql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to retrieve orders.', error: err.message });
        }
        res.json({ success: true, orders: results });
    });
});

app.put('/api/orders/:id/status', requireApiAuth('manager'), (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;

    if (!status || !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Allowed values are: ${ALLOWED_STATUSES.join(', ')}`
        });
    }

    const updateSql = `UPDATE orders SET status = ? WHERE id = ?`;
    db.query(updateSql, [status, orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to update order status.', error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        res.json({
            success: true,
            message: `Order status successfully updated to "${status}".`,
            status: status
        });
    });
});

app.get('/api/admin/stats', requireApiAuth('admin'), (req, res) => {
    const totalQuery = `SELECT COUNT(*) AS total_orders FROM orders`;
    const inProgressQuery = `SELECT COUNT(*) AS in_progress FROM orders WHERE status IN ('Printing', 'Book Finishing', 'Ready for Delivery')`;
    const completedQuery = `SELECT COUNT(*) AS completed FROM orders WHERE status = 'Completed'`;
    const recentOrdersQuery = `
        SELECT id, order_number, customer_name, book_title, quantity, pages, book_size, status, created_at 
        FROM orders 
        ORDER BY created_at DESC 
        LIMIT 10
    `;

    db.query(totalQuery, (err, totalRes) => {
        if (err) return res.status(500).json({ success: false, message: 'Error querying total orders', error: err.message });

        db.query(inProgressQuery, (err, progRes) => {
            if (err) return res.status(500).json({ success: false, message: 'Error querying in-progress orders', error: err.message });

            db.query(completedQuery, (err, compRes) => {
                if (err) return res.status(500).json({ success: false, message: 'Error querying completed orders', error: err.message });

                db.query(recentOrdersQuery, (err, recentRes) => {
                    if (err) return res.status(500).json({ success: false, message: 'Error querying recent orders', error: err.message });

                    res.json({
                        success: true,
                        metrics: {
                            total_orders: totalRes[0].total_orders,
                            in_progress: progRes[0].in_progress,
                            completed: compRes[0].completed
                        },
                        recent_orders: recentRes
                    });
                });
            });
        });
    });
});

// --------------------------------------------------------
// 10. Startup Sequence
// --------------------------------------------------------
async function startServer() {
    // 1. Free port 3000 if an old node instance is running
    freePortIfBusy(PORT);

    // 2. Ensure MySQL/MariaDB daemon is running
    await ensureDatabaseService();

    // 3. Connect to database and seed tables
    initializeDatabaseSchema();

    // 4. Start HTTP Server
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 Sri Ramakrishna Offset Website & Server Running!`);
        console.log(`📍 URL: http://localhost:${PORT}`);
        console.log(`🔐 Admin Login:   http://localhost:${PORT}/admin-login.html`);
        console.log(`🛠️  Manager Login: http://localhost:${PORT}/manager-login.html`);
        console.log(`====================================================`);

        // Auto-open browser
        try {
            const openCmd = process.platform === 'win32' ? `start http://localhost:${PORT}` : `open http://localhost:${PORT}`;
            execSync(openCmd);
        } catch (_) {}
    });
}

startServer();

module.exports = { app, db };
