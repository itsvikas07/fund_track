import { expect } from "chai";
import { network } from "hardhat";

describe("FundTransparency - Phase 4 Security", function () {

    async function deployContract() {

        const { ethers } = await network.connect();

        const accounts = await ethers.getSigners();

        const FundTransparency =
            await ethers.getContractFactory(
                "FundTransparency"
            );

        const contract =
            await FundTransparency.deploy();

        await contract.waitForDeployment();

        return {
            contract,
            accounts,
            ethers,
        };
    }


    it("should allow government official to create project",
        async function () {

            const { contract, accounts } =
                await deployContract();

            const admin = accounts[0];

            const government = accounts[1];

            const GOVERNMENT_ROLE =
                await contract.GOVERNMENT_OFFICIAL_ROLE();


            await contract.grantRole(
                GOVERNMENT_ROLE,
                government.address
            );


            const governmentContract =
                contract.connect(government);


            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                1000000
            );


            const project =
                await contract.getProject(
                    "BRIDGE001"
                );


            expect(project[0])
                .to.equal("BRIDGE001");

            expect(project[2])
                .to.equal(1000000n);
        });


    it("should reject public user from creating project",
        async function () {

            const { contract, accounts,ethers } =
                await deployContract();

            const publicUser =
                accounts[1];


            const governmentRole =
                await contract
                    .GOVERNMENT_OFFICIAL_ROLE();


            // We intentionally do NOT give
            // publicUser the government role.


            const publicContract =
                contract.connect(publicUser);


            await expect(
                publicContract.createProject(
                    "BRIDGE001",
                    "Bridge Construction",
                    1000000
                )
            ).to.be.revert(ethers);
        });


    it("should allow NGO official to record funds received",
        async function () {

            const { contract, accounts } =
                await deployContract();

            const ngo =
                accounts[1];


            const NGO_ROLE =
                await contract
                    .NGO_OFFICIAL_ROLE();


            await contract.grantRole(
                NGO_ROLE,
                ngo.address
            );


            const ngoContract =
                contract.connect(ngo);


            await expect(
                ngoContract.recordFundReceived(
                    "NGO001",
                    500000
                )
            ).to.emit(
                contract,
                "FundReceived"
            );
        });


    it("should reject unauthorized user from recording NGO funds",
        async function () {

            const { contract, accounts,ethers } =
                await deployContract();

            const publicUser =
                accounts[1];


            const publicContract =
                contract.connect(publicUser);


            await expect(
                publicContract.recordFundReceived(
                    "NGO001",
                    500000
                )
            ).to.be.revert(ethers);
        });


    it("should reject unauthorized user from recording project expense",
        async function () {

            const { contract, accounts, ethers } =
                await deployContract();

            const publicUser =
                accounts[1];


            const publicContract =
                contract.connect(publicUser);


            await expect(
                publicContract.recordProjectExpense(
                    "BRIDGE001",
                    100000,
                    "LABOUR",
                    "Labour payment",
                    "documentHash"
                )
            ).to.be.revert(ethers);
        });


    it("should reject zero expense amount",
        async function () {

            const { contract, accounts } =
                await deployContract();

            const government =
                accounts[1];


            const GOVERNMENT_ROLE =
                await contract
                    .GOVERNMENT_OFFICIAL_ROLE();


            await contract.grantRole(
                GOVERNMENT_ROLE,
                government.address
            );


            const governmentContract =
                contract.connect(government);


            await governmentContract.createProject(
                "BRIDGE001",
                "Bridge Construction",
                1000000
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


    it("should reject expense when project does not exist",
        async function () {

            const { contract, accounts } =
                await deployContract();

            const government =
                accounts[1];


            const GOVERNMENT_ROLE =
                await contract
                    .GOVERNMENT_OFFICIAL_ROLE();


            await contract.grantRole(
                GOVERNMENT_ROLE,
                government.address
            );


            const governmentContract =
                contract.connect(government);


            await expect(
                governmentContract.recordProjectExpense(
                    "UNKNOWN",
                    100000,
                    "LABOUR",
                    "Labour payment",
                    "hash"
                )
            ).to.be.revertedWith(
                "Project does not exist"
            );
        });

});