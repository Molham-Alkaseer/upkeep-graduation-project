-- Database: techsupport_db
CREATE DATABASE IF NOT EXISTS techsupport_db;
USE techsupport_db;

-- Table structure for users
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_pw VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'technician', 'admin') NOT NULL,
    specialization_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table structure for specializations
CREATE TABLE IF NOT EXISTS specializations (
    specialization_id INT AUTO_INCREMENT PRIMARY KEY,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table structure for service_requests
CREATE TABLE IF NOT EXISTS service_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    technician_id INT NULL,
    service_type INT NOT NULL,
    description TEXT,
    status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (technician_id) REFERENCES users(user_id),
    FOREIGN KEY (service_type) REFERENCES specializations(specialization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table structure for payments
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method ENUM('credit_card', 'cash', 'bank_transfer', 'online') NOT NULL,
    transaction_id VARCHAR(255),
    status ENUM('pending', 'completed', 'failed') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample data for specializations
INSERT INTO specializations (name_ar, name_en, description) VALUES
('كهرباء', 'Electrician', 'إصلاحات كهربائية عامة'),
('سباكة', 'Plumber', 'إصلاحات سباكة عامة'),
('تكييف', 'AC Technician', 'إصلاح وصيانة أجهزة التكييف'),
('نجارة', 'Carpenter', 'أعمال النجارة العامة'),
('بناء', 'Construction', 'أعمال البناء والإصلاحات');

-- Sample admin user
INSERT INTO users (email, hashed_pw, full_name, role) VALUES
('admin@upkeep.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Admin User', 'admin');

-- Sample technician user
INSERT INTO users (email, hashed_pw, full_name, phone, role, specialization_id) VALUES
('tech1@upkeep.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'فني كهرباء / Electrician', '0555555555', 'technician', 1);