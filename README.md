# Sri Ramakrishna Offset — Full-Stack Web Application

A clean, beginner-friendly Full-Stack Development (FSD) project for **Sri Ramakrishna Offset**, a commercial book manufacturing and offset printing company.

---

## 1. Project Overview

The website provides a centralized web system for customers, plant managers, and administrators:
- **Customer Page (`index.html`)**: Introduces the 5-step industrial book manufacturing process, displays commercial printing services, provides quick links to staff portals, enables customers to submit book printing orders, and allows them to track real-time order status.
- **Admin Login (`admin-login.html`)**: Secure administrative login portal authenticating executive administrators.
- **Manager Login (`manager-login.html`)**: Dedicated operations login portal authenticating plant and production managers.
- **Manager Dashboard (`protected/manager.html`)**: Protected operations dashboard allowing production managers to review incoming book orders, view technical specifications (paper size, page counts, custom binding notes), update order statuses through 6 manufacturing stages, and sign out.
- **Admin Overview (`protected/admin.html`)**: Protected executive dashboard displaying live counts of total orders, orders in progress, and completed orders, alongside a recent orders activity table and logout option.

---

## 2. Technology Stack & Security

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6)
- **Backend:** Node.js, Express.js
- **Database:** MySQL / MariaDB (Port 3306)
- **Authentication & Security:**
  - Secure session-based authentication (`express-session` with `httpOnly` and `sameSite` cookie security)
  - Passwords hashed with `bcryptjs` (salt rounds: 10, no plain-text passwords stored)
  - Role-Based Access Control (RBAC): strict separation between `admin` and `manager` roles
  - Server-side route guards preventing direct URL access to protected pages
  - In-memory login attempt lockout protection (locks after 5 failed attempts for 15 minutes)
  - Parameterized SQL queries preventing SQL Injection

---

## 3. Project Directory Structure

```text
sri-ramakrishna-offset/
│
├── public/                     # Public static frontend files served by Express
│   ├── index.html              # Customer Page (Intro, 5-step process, services, order form, tracking, staff portals)
│   ├── admin-login.html        # Separate Admin Login Page
│   ├── manager-login.html      # Separate Manager Login Page
│   ├── css/
│   │   └── style.css           # Master stylesheet (navy theme, cards, tables, badges, login forms)
│   └── js/
│       ├── customer.js         # Handles customer order submission & tracking lookup
│       ├── admin-login.js      # Handles admin authentication requests
│       ├── manager-login.js    # Handles manager authentication requests
│       ├── manager.js          # Handles manager dashboard orders, status updates, and logout
│       └── admin.js            # Handles admin dashboard KPI counts and logout
│
├── protected/                  # Protected HTML files (Never served statically without valid session)
│   ├── manager.html            # Protected Manager Dashboard
│   └── admin.html              # Protected Admin Overview
│
├── server.js                   # Express server, authentication logic, session store, MySQL pool
├── database.sql                # SQL initialization script (database, orders table, users table)
├── .env.example                # Configuration template for MySQL credentials & secrets
├── .env                        # Active environment credentials (git-ignored in production)
├── package.json                # Project manifest with dependencies
└── README.md                   # Complete documentation and viva guide
```

---

## 4. Database Schema

The database `sri_ramakrishna_offset` contains two tables: `orders` and `users`.

### Table 1: `orders`
| Column Name | Data Type | Constraint | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT PRIMARY KEY` | Internal row identifier |
| `order_number` | `VARCHAR(50)` | `NOT NULL UNIQUE` | Customer tracking ID (e.g. `SRO-459994`) |
| `customer_name` | `VARCHAR(100)` | `NOT NULL` | Name of the customer / publishing house |
| `customer_email`| `VARCHAR(100)` | `NOT NULL` | Customer email for verification |
| `book_title` | `VARCHAR(150)` | `NOT NULL` | Title of the publication |
| `quantity` | `INT` | `NOT NULL` | Number of printed copies requested |
| `pages` | `INT` | `NOT NULL` | Number of pages per book |
| `book_size` | `VARCHAR(50)` | `NOT NULL` | Dimension standard (e.g., A4, A5, Crown 8vo) |
| `instructions` | `TEXT` | `NULL` | Optional binding, paper GSM, or lamination notes |
| `status` | `VARCHAR(50)` | `DEFAULT 'Order Received'` | Current production status |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Order timestamp |

### Table 2: `users`
| Column Name | Data Type | Constraint | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT PRIMARY KEY` | Internal user ID |
| `username` | `VARCHAR(50)` | `NOT NULL UNIQUE` | Login username |
| `password_hash`| `VARCHAR(255)`| `NOT NULL` | Bcrypt password hash |
| `role` | `VARCHAR(20)` | `NOT NULL` | Role (`admin` or `manager`) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp |

### The 6 Allowed Production Statuses:
1. `Order Received` (Default)
2. `Printing`
3. `Book Finishing`
4. `Ready for Delivery`
5. `Completed`
6. `Rejected`

---

## 5. Initial Credentials Configuration

Initial credentials are read from `.env` and automatically seeded/hashed into the MySQL `users` table on startup:

| Portal | Username | Default Password | Environment Variable (.env) | Authorized Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Overview** | `admin` | `admin123` | `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `/admin.html` |
| **Manager Portal** | `manager` | `manager123` | `MANAGER_USERNAME`, `MANAGER_PASSWORD` | `/manager.html` |

> [!NOTE]  
> If you change credentials in `.env`, restart the server. The application will automatically update the bcrypt hash in the database.

---

## 6. Setup & Run Instructions

### Step 1: Open Terminal
```powershell
cd C:\Users\Sreekar\.gemini\antigravity\scratch\sri-ramakrishna-offset
```

### Step 2: Install Dependencies
```powershell
npm install
```

### Step 3: Run the Application
```powershell
npm start
```
The application will launch on `http://localhost:3000`.

---

## 7. Website Navigation Links

- **Customer Website:** [http://localhost:3000/](http://localhost:3000/)
- **Admin Login:** [http://localhost:3000/admin-login.html](http://localhost:3000/admin-login.html)
- **Manager Login:** [http://localhost:3000/manager-login.html](http://localhost:3000/manager-login.html)
- **Protected Manager Dashboard:** [http://localhost:3000/manager.html](http://localhost:3000/manager.html) *(Requires Manager Login)*
- **Protected Admin Overview:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html) *(Requires Admin Login)*
- **Health Check API:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 8. College Viva Demonstration Guide

1. **Homepage Walkthrough:**
   - Show the navbar with the **Manager Login** and **Admin Login** buttons.
   - Point out the **Operations & Management Portals** cards on the homepage.
2. **Customer Order & Tracking:**
   - Place a book order and copy the generated Order Number (`SRO-XXXXXX`).
   - Track the order using the order number and email.
3. **Manager Workflow & Role Enforcement:**
   - Try to access `http://localhost:3000/manager.html` directly in an incognito window $\rightarrow$ show that it automatically redirects to `/manager-login.html`.
   - Log in with `manager` / `manager123`.
   - Update an order's status to `Printing`.
   - Show that a manager attempting to fetch `/api/admin/stats` receives a `403 Forbidden` error.
4. **Admin Workflow:**
   - Log in with `admin` / `admin123`.
   - Show the live KPI cards and the recent orders list.
5. **Logout:**
   - Click the **Logout** button on either dashboard and demonstrate that access is immediately revoked.
