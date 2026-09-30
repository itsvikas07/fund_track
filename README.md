# Fund Transparency System

A blockchain-based fund transparency system designed to track and verify the flow of funds for **government projects and NGOs**.

The system combines a traditional web application with blockchain technology to provide transparent, tamper-resistant records of project budgets, fund allocations, and expenses.

---

## 📌 Problem Statement

Funds allocated to government projects and NGOs need to be tracked transparently to reduce the possibility of unauthorized modifications and provide accountability.

This project provides a system where:

* Government project budgets can be recorded.
* Funds and expenses can be tracked.
* Authorized officials can add financial transactions.
* Blockchain stores tamper-resistant transaction records.
* MySQL stores application and financial data.
* Auditors can verify financial records.
* Public users can view permitted government project information.

---

## 🎯 Objectives

* Track government project funds from allocation to expenditure.
* Track NGO funds received and spent.
* Maintain transparent financial records.
* Prevent unauthorized modification of blockchain records.
* Provide role-based access control.
* Allow auditors to verify transactions.
* Provide public visibility into government project spending.
* Maintain a connection between database records and blockchain transactions.

---

## 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │      React.js        │
                    │      Frontend        │
                    └──────────┬───────────┘
                               │
                         REST API / JWT
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Django + DRF       │
                    │      Backend         │
                    └───────┬───────┬──────┘
                            │       │
                  Direct SQL│       │Web3.py
                            │       │
                            ▼       ▼
                    ┌──────────┐  ┌─────────────────┐
                    │  MySQL   │  │ Ethereum / EVM  │
                    │ Database │  │   Blockchain     │
                    └──────────┘  └────────┬────────┘
                                           │
                                           ▼
                                      Solidity Smart
                                         Contract
                                           │
                                           ▼
                                      MetaMask
```

---

## 🛠️ Technologies Used

### Frontend

* React.js
* Vite
* JavaScript
* HTML5
* CSS3
* ethers.js
* MetaMask

### Backend

* Python
* Django
* Django REST Framework
* SimpleJWT
* Web3.py
* mysql-connector-python

### Database

* MySQL

The application data is accessed using direct MySQL queries rather than Django ORM.

### Blockchain

* Ethereum-compatible blockchain
* Solidity
* Hardhat
* Web3.py
* ethers.js
* MetaMask

### Development Tools

* Visual Studio Code
* Git
* GitHub
* Node.js
* npm

---

## 👥 User Roles

The system supports the following roles:

| Role                | Responsibility                                                |
| ------------------- | ------------------------------------------------------------- |
| ADMIN               | Manage users and system administration                        |
| GOVERNMENT_OFFICIAL | Create government projects and record government transactions |
| NGO_OFFICIAL        | Manage NGO funds and expenses                                 |
| AUDITOR             | Verify and inspect financial records                          |
| PUBLIC_USER         | View publicly available project information                   |

---

## 🔐 Authentication

The application uses:

* Email and password authentication
* Password hashing
* JWT access tokens
* JWT refresh tokens
* Role-based authorization

The website login and MetaMask wallet connection are separate.

### Website Login

```text
Email + Password
       ↓
Django Backend
       ↓
JWT Authentication
```

### Blockchain Wallet

```text
MetaMask
    ↓
Hardhat Local Network
    ↓
Smart Contract
```

---

# 🏛️ Government Project Management

Government officials can create and manage government projects.

A project can contain:

* Project name
* Department
* Description
* Approved budget
* Start date
* End date
* Project status

Supported project statuses:

```text
PLANNED
ACTIVE
COMPLETED
CANCELLED
```

---

## 💰 Budget Categories

Government project expenses can be categorized into:

* LABOUR
* MATERIAL
* EQUIPMENT
* CONTRACTOR
* OTHER

Example:

```text
Government Project
        │
        ├── Labour
        ├── Materials
        ├── Equipment
        ├── Contractor
        └── Other
```

---

# ⛓️ Blockchain Integration

The blockchain is used to maintain a tamper-resistant record of important financial transactions.

The smart contract supports operations such as:

* Creating government projects
* Allocating project budgets
* Recording project expenses
* Recording NGO funds received
* Recording NGO expenses
* Retrieving project information
* Retrieving transaction information

---

## 📜 Smart Contract

The main Solidity contract is:

```text
blockchain/contracts/FundTransparency.sol
```

The contract implements role-based access control.

### Blockchain Roles

```text
DEFAULT_ADMIN_ROLE
        │
        ├── GOVERNMENT_OFFICIAL_ROLE
        ├── NGO_OFFICIAL_ROLE
        └── AUDITOR_ROLE
```

Public users have read-only access to permitted information.

---

# 🗄️ Database

The MySQL database is named:

```text
fund_transparency
```

Important tables include:

```text
users
ngos
government_departments
projects
project_budgets
expenses
documents
notifications
blockchain_transactions
```

The database stores application information and references to blockchain transactions.

For example:

```text
MySQL Expense Record
       │
       ├── Project ID
       ├── Category
       ├── Amount
       ├── Description
       ├── Expense Date
       └── Blockchain Transaction Hash
```

---

# 🔗 Blockchain and Database Relationship

The system uses both MySQL and blockchain for different purposes.

### MySQL

Stores:

* User information
* Project information
* Budget information
* Expense details
* Documents
* Notifications
* Blockchain transaction hashes

### Blockchain

Stores:

* Financial transaction records
* Project blockchain identifiers
* Transaction history
* Transaction metadata
* Role-controlled financial operations

The blockchain transaction hash is stored in MySQL so that database records can be associated with blockchain transactions.

---

# 🧑‍💻 Project Structure

```text
fund-transparency/
│
├── README.md
│
├── backend/
│   │
│   ├── accounts/
│   │   ├── migrations/
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── auth_views.py
│   │   ├── permissions.py
│   │   └── mysql_service.py
│   │
│   ├── config/
│   │   ├── database.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   │
│   ├── blockchain_service.py
│   ├── database.sql
│   └── manage.py
│
├── blockchain/
│   │
│   ├── contracts/
│   │   └── FundTransparency.sol
│   │
│   ├── scripts/
│   ├── test/
│   ├── artifacts/
│   ├── hardhat.config.js
│   ├── package.json
│   └── package-lock.json
│
└── frontend/
    │
    ├── src/
    │   ├── context/
    │   ├── services/
    │   ├── FundApp.jsx
    │   ├── App.jsx
    │   └── main.jsx
    │
    ├── public/
    ├── package.json
    └── vite.config.js
```

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
```

Navigate into the project:

```bash
cd fund-transparency
```

---

# 🐍 Backend Setup

Navigate to the backend:

```cmd
cd backend
```

Create a virtual environment:

```cmd
python -m venv env
```

Activate it:

```cmd
env\Scripts\activate
```

Install dependencies:

```cmd
pip install django djangorestframework djangorestframework-simplejwt mysql-connector-python web3 python-dotenv
```

---

## 🗄️ MySQL Setup

Create the database:

```sql
CREATE DATABASE fund_transparency;
```

The backend uses MySQL for application data.

Configure the database connection in the backend configuration.

Make sure MySQL is running before starting the Django backend.

---

# ⛓️ Blockchain Setup

Navigate to the blockchain directory:

```cmd
cd blockchain
```

Install Node.js dependencies:

```cmd
npm install
```

Compile the smart contract:

```cmd
npx hardhat compile
```

---

# 🚀 Start Hardhat Local Blockchain

From the `blockchain` directory:

```cmd
npx hardhat node
```

The local blockchain runs at:

```text
http://127.0.0.1:8545
```

The local Hardhat network uses:

```text
Chain ID: 31337
```

Hardhat provides test ETH to its local accounts.

**Important:** The ETH provided by Hardhat is test ETH and has no real monetary value.

---

# 📦 Deploy Smart Contract

With the Hardhat node running, deploy the contract using the project's deployment script.

The deployed contract address should then be configured in the backend and frontend.

Example:

```text
FundTransparency deployed to:
0x5FbDB2315678afecb367f032d93F642f64180aa3
```

> The contract address changes when the Hardhat local blockchain is restarted and the contract is redeployed. Always use the address from the current deployment.

---

# 🌐 Start Django Backend

Open another terminal:

```cmd
cd C:\Users\vikas\OneDrive\Desktop\fund-transparency\backend
```

Activate the environment:

```cmd
env\Scripts\activate
```

Start Django:

```cmd
python manage.py runserver 127.0.0.1:8000
```

Backend:

```text
http://127.0.0.1:8000
```

---

# 💻 Start React Frontend

Open another terminal:

```cmd
cd C:\Users\vikas\OneDrive\Desktop\fund-transparency\frontend
```

Install dependencies:

```cmd
npm install
```

Start the development server:

```cmd
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# 🔄 Running the Complete System

Three services should normally be running.

### Terminal 1 — Blockchain

```cmd
cd blockchain
npx hardhat node
```

### Terminal 2 — Django

```cmd
cd backend
env\Scripts\activate
python manage.py runserver 127.0.0.1:8000
```

### Terminal 3 — React

```cmd
cd frontend
npm run dev
```

System flow:

```text
Hardhat
   │
   │ Blockchain
   ▼
Django Backend
   │
   │ REST API
   ▼
React Frontend
   │
   │ MetaMask
   ▼
User
```

---

# 🦊 MetaMask Configuration

Add the Hardhat Local network to MetaMask.

```text
Network Name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency Symbol: ETH
```

Import one of the test accounts provided by Hardhat if required.

> Hardhat test accounts and private keys are for local development only. Never use them on a real Ethereum network.

---

# 🔐 Environment Variables

Sensitive configuration should be stored in environment variables rather than committed to Git.

Example:

```env
BLOCKCHAIN_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=<CURRENT_CONTRACT_ADDRESS>
GOVERNMENT_PRIVATE_KEY=<LOCAL_TEST_PRIVATE_KEY>
```

Do not commit:

```text
.env
```

to GitHub.

---

# 🔌 API Examples

## Register

```http
POST /api/auth/register/
```

Example request:

```json
{
    "name": "Test User",
    "email": "user@example.com",
    "password": "Password123"
}
```

---

## Login

```http
POST /api/auth/login/
```

Example:

```json
{
    "email": "user@example.com",
    "password": "Password123"
}
```

The backend returns JWT access and refresh tokens.

---

# 🏛️ Government Project Flow

```text
Government Official Login
          ↓
Create Government Project
          ↓
Project stored in MySQL
          ↓
Project created on Blockchain
          ↓
Budget Allocation
          ↓
Expense / Payment
          ↓
Blockchain Transaction
          ↓
Transaction Hash stored in MySQL
          ↓
Public / Auditor Verification
```

---

# 🏢 NGO Fund Flow

```text
NGO Official Login
       ↓
Record Funds Received
       ↓
Record NGO Expense
       ↓
Blockchain Transaction
       ↓
Transaction Hash
       ↓
MySQL Record
       ↓
Auditor Verification
```

---

# 🔍 Transparency

The system separates information according to user roles.

### Government Official

Can:

* Create projects
* Manage project information
* Allocate budgets
* Record project expenses

### NGO Official

Can:

* Record funds received
* Record NGO expenses
* Manage permitted NGO financial information

### Auditor

Can:

* Inspect financial records
* Verify blockchain transactions
* Review transaction history

### Public User

Can:

* View permitted government project information
* View budgets
* View spending information
* View remaining balances
* View public transaction information

### Admin

Can:

* Manage users
* Manage system roles
* Perform administrative operations

---

# 🛡️ Security Considerations

The system implements several security mechanisms:

* Password hashing
* JWT authentication
* Role-based authorization
* Smart contract access control
* Blockchain transaction verification
* Database transaction references
* Input validation
* Budget and expense validation

Private keys should never be exposed in frontend code or committed to GitHub.

---

# 🧪 Testing

### Solidity Tests

Run:

```cmd
cd blockchain
npx hardhat test
```

### Smart Contract Compilation

```cmd
npx hardhat compile
```

### Frontend Build

```cmd
cd frontend
npm run build
```

---

# 📊 Example Government Project

Example project:

```text
Project Name:
Rural Bridge Construction

Approved Budget:
₹30,00,000

Categories:
LABOUR
MATERIAL
EQUIPMENT
CONTRACTOR

Status:
ACTIVE
```

Example expense:

```text
Category:
LABOUR

Amount:
₹5,00,000

Description:
Labour payment for bridge construction

Status:
PAID
```

The transaction can then be recorded on the blockchain and linked to the MySQL expense record using its transaction hash.

---

# 🚧 Current Development Status

The project currently contains:

* React frontend
* Django backend
* MySQL database
* JWT authentication
* Role-based access control
* Solidity smart contract
* Hardhat local blockchain
* MetaMask integration
* Government project functionality
* NGO fund tracking functionality
* Blockchain transaction tracking
* Auditor role
* Public read access

---

# 🔮 Future Enhancements

Possible future improvements include:

* Deployment to an Ethereum testnet
* IPFS document storage
* Advanced audit dashboards
* Automated notifications
* Expense approval workflows
* Government department dashboards
* NGO dashboards
* Advanced blockchain analytics
* Mobile application
* Production cloud deployment
* Multi-signature approval for large transactions

---

# ⚠️ Development Notice

This project currently uses **Hardhat Local** for blockchain development and testing.

Hardhat Local ETH is simulated and has no real-world monetary value.

For production deployment, the system should use a suitable public blockchain/testnet and production-grade security practices.

---

# 👨‍💻 Project

**Fund Transparency System**

A blockchain-based platform for transparent tracking and verification of government and NGO funds.

### Technology Stack

```text
React.js
Django
Django REST Framework
MySQL
Solidity
Hardhat
Web3.py
ethers.js
MetaMask
```

---

## 📄 License

This project is developed for educational, academic, and prototype purposes.
