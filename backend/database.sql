USE fund_transparency;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM(
        'ADMIN',
        'NGO_OFFICIAL',
        'GOVERNMENT_OFFICIAL',
        'AUDITOR',
        'PUBLIC_USER'
    ) NOT NULL,
    wallet_address VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ngos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_name VARCHAR(200) NOT NULL,
    registration_number VARCHAR(100) UNIQUE,
    address TEXT,
    contact_email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE government_departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(200) NOT NULL,
    description TEXT,
    contact_email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blockchain_project_id VARCHAR(100) UNIQUE,
    project_name VARCHAR(200) NOT NULL,
    department_id INT,
    description TEXT,
    approved_budget DECIMAL(15,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status ENUM(
        'PLANNED',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED'
    ) DEFAULT 'PLANNED',

    FOREIGN KEY (department_id)
        REFERENCES government_departments(id)
);
CREATE TABLE project_budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    allocated_amount DECIMAL(15,2) NOT NULL,
    allocation_date DATE NOT NULL,
    allocated_by INT,
    description TEXT,

    FOREIGN KEY (project_id)
        REFERENCES projects(id),

    FOREIGN KEY (allocated_by)
        REFERENCES users(id)
);
CREATE TABLE expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL,
    payment_status ENUM(
        'PENDING',
        'PAID',
        'REJECTED'
    ) DEFAULT 'PENDING',
    blockchain_tx_hash VARCHAR(100),

    FOREIGN KEY (project_id)
        REFERENCES projects(id)
);
CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    uploaded_by INT,
    document_name VARCHAR(255) NOT NULL,
    document_path VARCHAR(500),
    document_type VARCHAR(100),
    verification_status ENUM(
        'PENDING',
        'VERIFIED',
        'REJECTED'
    ) DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id)
        REFERENCES projects(id),

    FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
);
CREATE TABLE blockchain_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    expense_id INT,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    wallet_address VARCHAR(100),
    tx_hash VARCHAR(100) UNIQUE,
    block_number BIGINT,
    status ENUM(
        'PENDING',
        'CONFIRMED',
        'FAILED'
    ) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id)
        REFERENCES projects(id),

    FOREIGN KEY (expense_id)
        REFERENCES expenses(id)
);
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    budget BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL,
    category VARCHAR(100),
    description TEXT,
    transaction_hash VARCHAR(100) NOT NULL,
    block_number BIGINT,
    recorded_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
