-- ========================================================
-- Sri Ramakrishna Offset - Database Setup Script
-- Database: sri_ramakrishna_offset
-- ========================================================

CREATE DATABASE IF NOT EXISTS sri_ramakrishna_offset;
USE sri_ramakrishna_offset;

-- Orders Table
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

-- Users Table for Secure Role-Based Authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'admin' or 'manager'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
