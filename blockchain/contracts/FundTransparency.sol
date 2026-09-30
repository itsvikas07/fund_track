// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract FundTransparency is AccessControl {

    // ==========================================
    // ROLES
    // ==========================================

    bytes32 public constant NGO_OFFICIAL_ROLE =
        keccak256("NGO_OFFICIAL_ROLE");

    bytes32 public constant GOVERNMENT_OFFICIAL_ROLE =
        keccak256("GOVERNMENT_OFFICIAL_ROLE");

    bytes32 public constant AUDITOR_ROLE =
        keccak256("AUDITOR_ROLE");


    // ==========================================
    // PROJECT STRUCTURE
    // ==========================================

    struct Project {

        string projectId;

        string name;

        uint256 allocatedBudget;

        uint256 spentAmount;

        bool exists;
    }


    // ==========================================
    // TRANSACTION STRUCTURE
    // ==========================================

    struct Transaction {

        uint256 id;

        string entityId;

        string transactionType;

        uint256 amount;

        string category;

        string description;

        uint256 timestamp;

        string documentHash;

        address recordedBy;
    }


    // ==========================================
    // STORAGE
    // ==========================================

    mapping(string => Project) public projects;

    Transaction[] private transactions;

    mapping(string => uint256[])
        private projectTransactions;


    // ==========================================
    // EVENTS
    // ==========================================

    event ProjectCreated(
        string projectId,
        string name,
        uint256 allocatedBudget
    );

    event BudgetAllocated(
        string projectId,
        uint256 amount
    );

    event FundReceived(
        string entityId,
        uint256 amount
    );

    event ExpenseRecorded(
        uint256 transactionId,
        string projectId,
        uint256 amount,
        string category
    );


    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    constructor() {

        // Account that deploys the contract
        // becomes ADMIN

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    // ==========================================
    // CREATE PROJECT
    // ==========================================

    function createProject(
        string memory projectId,
        string memory name,
        uint256 allocatedBudget
    )
        public
        onlyRole(GOVERNMENT_OFFICIAL_ROLE)
    {

        require(
            bytes(projectId).length > 0,
            "Project ID required"
        );

        require(
            bytes(name).length > 0,
            "Project name required"
        );

        require(
            allocatedBudget > 0,
            "Budget must be greater than zero"
        );

        require(
            !projects[projectId].exists,
            "Project already exists"
        );


        projects[projectId] = Project({

            projectId: projectId,

            name: name,

            allocatedBudget: allocatedBudget,

            spentAmount: 0,

            exists: true
        });


        emit ProjectCreated(
            projectId,
            name,
            allocatedBudget
        );
    }


    // ==========================================
    // ALLOCATE ADDITIONAL BUDGET
    // ==========================================

    function allocateBudget(
        string memory projectId,
        uint256 amount
    )
        public
        onlyRole(GOVERNMENT_OFFICIAL_ROLE)
    {

        require(
            projects[projectId].exists,
            "Project does not exist"
        );

        require(
            amount > 0,
            "Amount must be greater than zero"
        );


        projects[projectId].allocatedBudget += amount;


        emit BudgetAllocated(
            projectId,
            amount
        );
    }


    // ==========================================
    // RECORD FUNDS RECEIVED BY NGO
    // ==========================================

    function recordFundReceived(
        string memory entityId,
        uint256 amount
    )
        public
        onlyRole(NGO_OFFICIAL_ROLE)
    {

        require(
            bytes(entityId).length > 0,
            "Entity ID required"
        );

        require(
            amount > 0,
            "Amount must be greater than zero"
        );

        uint256 transactionId = transactions.length;

        transactions.push(
            Transaction({
                id: transactionId,
                entityId: entityId,
                transactionType: "FUND_RECEIVED",
                amount: amount,
                category: "FUND",
                description: "Funds received",
                timestamp: block.timestamp,
                documentHash: "",
                recordedBy: msg.sender
            })
        );

        projectTransactions[entityId].push(transactionId);

        emit FundReceived(
            entityId,
            amount
        );
    }


    function recordNGOExpense(
        string memory entityId,
        uint256 amount,
        string memory category,
        string memory description,
        string memory documentHash
    )
        public
        onlyRole(NGO_OFFICIAL_ROLE)
    {
        require(
            bytes(entityId).length > 0,
            "Entity ID required"
        );

        require(
            amount > 0,
            "Amount must be greater than zero"
        );

        require(
            bytes(category).length > 0,
            "Category required"
        );

        require(
            bytes(description).length > 0,
            "Description required"
        );

        uint256 transactionId = transactions.length;

        transactions.push(
            Transaction({
                id: transactionId,
                entityId: entityId,
                transactionType: "NGO_EXPENSE",
                amount: amount,
                category: category,
                description: description,
                timestamp: block.timestamp,
                documentHash: documentHash,
                recordedBy: msg.sender
            })
        );

        projectTransactions[entityId].push(transactionId);

        emit ExpenseRecorded(
            transactionId,
            entityId,
            amount,
            category
        );
    }


    // ==========================================
    // RECORD PROJECT EXPENSE
    // ==========================================

    function recordProjectExpense(
        string memory projectId,
        uint256 amount,
        string memory category,
        string memory description,
        string memory documentHash
    )
        public
        onlyRole(GOVERNMENT_OFFICIAL_ROLE)
    {

        require(
            projects[projectId].exists,
            "Project does not exist"
        );

        require(
            amount > 0,
            "Amount must be greater than zero"
        );

        require(
            bytes(category).length > 0,
            "Category required"
        );

        require(
            bytes(description).length > 0,
            "Description required"
        );

        require(
            projects[projectId].spentAmount + amount
            <= projects[projectId].allocatedBudget,
            "Expense exceeds project budget"
        );


        uint256 transactionId =
            transactions.length;


        transactions.push(
            Transaction({

                id: transactionId,

                entityId: projectId,

                transactionType: "EXPENSE",

                amount: amount,

                category: category,

                description: description,

                timestamp: block.timestamp,

                documentHash: documentHash,

                recordedBy: msg.sender
            })
        );


        projects[projectId].spentAmount += amount;


        projectTransactions[projectId]
            .push(transactionId);


        emit ExpenseRecorded(
            transactionId,
            projectId,
            amount,
            category
        );
    }


    // ==========================================
    // LABOUR PAYMENT
    // ==========================================

    function recordLabourPayment(
        string memory projectId,
        uint256 amount,
        string memory description,
        string memory documentHash
    )
        public
        onlyRole(GOVERNMENT_OFFICIAL_ROLE)
    {

        recordProjectExpense(
            projectId,
            amount,
            "LABOUR",
            description,
            documentHash
        );
    }


    // ==========================================
    // MATERIAL PURCHASE
    // ==========================================

    function recordMaterialPurchase(
        string memory projectId,
        uint256 amount,
        string memory description,
        string memory documentHash
    )
        public
        onlyRole(GOVERNMENT_OFFICIAL_ROLE)
    {

        recordProjectExpense(
            projectId,
            amount,
            "MATERIAL",
            description,
            documentHash
        );
    }


    // ==========================================
    // CONTRACTOR PAYMENT
    // ==========================================

    function recordContractorPayment(
        string memory projectId,
        uint256 amount,
        string memory description,
        string memory documentHash
    )
        public
        onlyRole(GOVERNMENT_OFFICIAL_ROLE)
    {

        recordProjectExpense(
            projectId,
            amount,
            "CONTRACTOR",
            description,
            documentHash
        );
    }


    // ==========================================
    // GET PROJECT
    // ==========================================

    function getProject(
        string memory projectId
    )
        public
        view
        returns (
            string memory,
            string memory,
            uint256,
            uint256,
            bool
        )
    {

        Project memory project =
            projects[projectId];


        return (

            project.projectId,

            project.name,

            project.allocatedBudget,

            project.spentAmount,

            project.exists
        );
    }


    // ==========================================
    // GET TRANSACTION
    // ==========================================

    function getTransaction(
        uint256 transactionId
    )
        public
        view
        returns (Transaction memory)
    {

        require(
            transactionId < transactions.length,
            "Transaction does not exist"
        );


        return transactions[transactionId];
    }


    // ==========================================
    // GET PROJECT TRANSACTIONS
    // ==========================================

    function getProjectTransactions(
        string memory projectId
    )
        public
        view
        returns (uint256[] memory)
    {

        return projectTransactions[projectId];
    }


    // ==========================================
    // GET TRANSACTION COUNT
    // ==========================================

    function getTransactionCount()
        public
        view
        returns (uint256)
    {

        return transactions.length;
    }
}