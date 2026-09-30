import { expect } from "chai";
import { network } from "hardhat";

describe("FundTransparency - Phase 5 Testing", function () {

    async function deployContract() {

        const { ethers } =
            await network.connect();

        const accounts =
            await ethers.getSigners();

        const admin = accounts[0];
        const government = accounts[1];
        const ngo = accounts[2];
        const auditor = accounts[3];

        const FundTransparency =
            await ethers.getContractFactory(
                "FundTransparency"
            );

        const contract =
            await FundTransparency.deploy();

        await contract.waitForDeployment();

        const GOVERNMENT_ROLE =
            await contract.GOVERNMENT_OFFICIAL_ROLE();

        const NGO_ROLE =
            await contract.NGO_OFFICIAL_ROLE();

        const AUDITOR_ROLE =
            await contract.AUDITOR_ROLE();

        await contract.grantRole(
            GOVERNMENT_ROLE,
            government.address
        );

        await contract.grantRole(
            NGO_ROLE,
            ngo.address
        );

        await contract.grantRole(
            AUDITOR_ROLE,
            auditor.address
        );

        return {
            contract,
            accounts,
            admin,
            government,
            ngo,
            auditor,
            ethers
        };
    }


    it("should create Bridge Construction project",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            const project =
                await contract.getProject(
                    "BRIDGE001"
                );

            expect(project[0])
                .to.equal("BRIDGE001");

            expect(project[1])
                .to.equal("Bridge Construction");

            expect(project[2])
                .to.equal(5000000n);

            expect(project[3])
                .to.equal(0n);

            expect(project[4])
                .to.equal(true);
        });


    it("should allocate additional funds",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            await governmentContract.allocateBudget(
                "BRIDGE001",
                1000000
            );

            const project =
                await contract.getProject(
                    "BRIDGE001"
                );

            expect(project[2])
                .to.equal(6000000n);
        });


    it("should record valid labour payment",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            await expect(
                governmentContract.recordLabourPayment(
                    "BRIDGE001",
                    200000,
                    "Labour payment",
                    "labour-document-hash"
                )
            ).to.emit(
                contract,
                "ExpenseRecorded"
            );

            const project =
                await contract.getProject(
                    "BRIDGE001"
                );

            expect(project[3])
                .to.equal(200000n);
        });


    it("should reject invalid zero amount",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            await expect(
                governmentContract.recordProjectExpense(
                    "BRIDGE001",
                    0,
                    "LABOUR",
                    "Invalid payment",
                    "hash"
                )
            ).to.be.revertedWith(
                "Amount must be greater than zero"
            );
        });


    it("should reject unauthorized user",
        async function () {

            const {
                contract,
                accounts,
                ethers
            } = await deployContract();

            const publicUser =
                accounts[4];

            const publicContract =
                contract.connect(publicUser);

            await expect(
                publicContract.createProject(
                    "BRIDGE002",
                    "Unauthorized Project",
                    5000000
                )
            ).to.be.revert(ethers);
        });


    it("should reject non-existent project",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await expect(
                governmentContract.recordProjectExpense(
                    "UNKNOWN",
                    200000,
                    "LABOUR",
                    "Labour payment",
                    "hash"
                )
            ).to.be.revertedWith(
                "Project does not exist"
            );
        });


    it("should reject expense greater than allocation",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            await expect(
                governmentContract.recordProjectExpense(
                    "BRIDGE001",
                    6000000,
                    "MATERIAL",
                    "Too expensive",
                    "hash"
                )
            ).to.be.revertedWith(
                "Expense exceeds project budget"
            );
        });


    it("should store multiple transactions",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            await governmentContract.recordLabourPayment(
                "BRIDGE001",
                200000,
                "Labour payment",
                "hash1"
            );

            await governmentContract.recordMaterialPurchase(
                "BRIDGE001",
                150000,
                "Material purchase",
                "hash2"
            );

            await governmentContract.recordContractorPayment(
                "BRIDGE001",
                100000,
                "Contractor payment",
                "hash3"
            );

            const count =
                await contract.getTransactionCount();

            expect(count)
                .to.equal(3n);

            const transaction =
                await contract.getTransaction(0);

            expect(transaction.amount)
                .to.equal(200000n);

            expect(transaction.category)
                .to.equal("LABOUR");
        });


    it("should retrieve project transactions",
        async function () {

            const {
                contract,
                government
            } = await deployContract();

            const governmentContract =
                contract.connect(government);

            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                5000000
            );

            await governmentContract.recordLabourPayment(
                "BRIDGE001",
                200000,
                "Labour payment",
                "hash1"
            );

            await governmentContract.recordMaterialPurchase(
                "BRIDGE001",
                150000,
                "Material purchase",
                "hash2"
            );

            const transactionIds =
                await contract.getProjectTransactions(
                    "BRIDGE001"
                );

            expect(transactionIds.length)
                .to.equal(2);

            expect(transactionIds[0])
                .to.equal(0n);

            expect(transactionIds[1])
                .to.equal(1n);
        });

});