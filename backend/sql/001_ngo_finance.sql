ALTER TABLE users
    ADD COLUMN ngo_id INT NULL,
    ADD INDEX idx_users_ngo_id (ngo_id),
    ADD CONSTRAINT fk_users_ngo
        FOREIGN KEY (ngo_id) REFERENCES ngos(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE blockchain_transactions
    ADD COLUMN ngo_id INT NULL,
    ADD INDEX idx_blockchain_transactions_ngo_id (ngo_id),
    ADD CONSTRAINT fk_blockchain_transactions_ngo
        FOREIGN KEY (ngo_id) REFERENCES ngos(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE blockchain_transactions
    ADD COLUMN budget_id INT NULL,
    ADD INDEX idx_blockchain_transactions_budget_id (budget_id),
    ADD CONSTRAINT fk_blockchain_transactions_budget
        FOREIGN KEY (budget_id) REFERENCES project_budgets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE ngo_financial_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_id INT NOT NULL,
    user_id INT NOT NULL,
    blockchain_transaction_id INT NOT NULL UNIQUE,
    transaction_type ENUM('FUND_RECEIVED', 'NGO_EXPENSE') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    document_hash VARCHAR(255) NULL,
    record_date DATE NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ngo_financial_records_balance (ngo_id, status, transaction_type),
    INDEX idx_ngo_financial_records_date (ngo_id, record_date),
    CONSTRAINT fk_ngo_financial_records_ngo
        FOREIGN KEY (ngo_id) REFERENCES ngos(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ngo_financial_records_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ngo_financial_records_transaction
        FOREIGN KEY (blockchain_transaction_id) REFERENCES blockchain_transactions(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;