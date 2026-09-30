import { network } from "hardhat";

async function main() {

    const { ethers } = await network.connect();

    const accounts = await ethers.getSigners();

    const admin = accounts[0];
    const government = accounts[1];
    const ngo = accounts[2];
    const auditor = accounts[3];

    console.log("Admin:", admin.address);
    console.log("Government:", government.address);
    console.log("NGO:", ngo.address);
    console.log("Auditor:", auditor.address);

    const FundTransparency =
        await ethers.getContractFactory(
            "FundTransparency"
        );

    const fundTransparency =
        await FundTransparency.deploy();

    await fundTransparency.waitForDeployment();

    const contractAddress =
        await fundTransparency.getAddress();

    console.log(
        "FundTransparency deployed to:",
        contractAddress
    );

    const GOVERNMENT_ROLE =
        await fundTransparency.GOVERNMENT_OFFICIAL_ROLE();

    const NGO_ROLE =
        await fundTransparency.NGO_OFFICIAL_ROLE();

    const AUDITOR_ROLE =
        await fundTransparency.AUDITOR_ROLE();

    await fundTransparency.grantRole(
        GOVERNMENT_ROLE,
        government.address
    );

    await fundTransparency.grantRole(
        NGO_ROLE,
        ngo.address
    );

    // The backend signer submits NGO transactions through Web3.py.
    await fundTransparency.grantRole(
        NGO_ROLE,
        government.address
    );

    await fundTransparency.grantRole(
        AUDITOR_ROLE,
        auditor.address
    );

    console.log(
        "Government role granted to:",
        government.address
    );

    console.log(
        "NGO role granted to:",
        ngo.address
    );

    console.log(
        "Auditor role granted to:",
        auditor.address
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});