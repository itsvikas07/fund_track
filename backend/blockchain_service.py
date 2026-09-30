from dotenv import load_dotenv
import os
import json
import threading
from pathlib import Path
from web3 import Web3

load_dotenv()

BLOCKCHAIN_URL = os.getenv("BLOCKCHAIN_URL")
PRIVATE_KEY = os.getenv("GOVERNMENT_PRIVATE_KEY")

CONTRACT_ADDRESS = os.getenv(
    "CONTRACT_ADDRESS",
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
)

ABI_PATH = (
    Path(__file__).resolve().parent.parent
    / "blockchain/artifacts/contracts/FundTransparency.sol/FundTransparency.json"
)


# Connect to blockchain
web3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_URL))


# Load contract ABI
with open(ABI_PATH, "r") as file:
    contract_data = json.load(file)

abi = contract_data["abi"]


# Load smart contract
contract = web3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=abi
)

_transaction_lock = threading.Lock()


def _send_transaction(function_call):
    if not PRIVATE_KEY:
        raise RuntimeError("The backend transaction signer is not configured")
    if not web3.is_connected():
        raise ConnectionError("The configured blockchain RPC is unavailable")

    account = web3.eth.account.from_key(PRIVATE_KEY)
    with _transaction_lock:
        transaction = function_call.build_transaction({
            "from": account.address,
            "nonce": web3.eth.get_transaction_count(account.address, "pending"),
            "chainId": web3.eth.chain_id,
            "gasPrice": web3.eth.gas_price,
        })
        transaction["gas"] = web3.eth.estimate_gas(transaction) + 50000
        signed_transaction = web3.eth.account.sign_transaction(transaction, PRIVATE_KEY)
        tx_hash = web3.eth.send_raw_transaction(signed_transaction.raw_transaction)
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

    if receipt.status != 1:
        raise RuntimeError("The blockchain transaction reverted")

    return {
        "transaction_hash": tx_hash.hex(),
        "block_number": receipt.blockNumber,
        "wallet_address": account.address,
        "receipt": receipt,
    }


def create_project(project_id, name, budget):
    """
    Create a new government project on the blockchain.
    """

    result = _send_transaction(contract.functions.createProject(
        project_id,
        name,
        budget,
    ))
    return {key: result[key] for key in ("transaction_hash", "block_number")}


def allocate_budget(project_id, amount):
    return _send_transaction(contract.functions.allocateBudget(project_id, amount))


def get_project(project_id):
    """
    Read a project from the blockchain.
    """

    project = contract.functions.getProject(project_id).call()

    return {
        "project_id": project[0],
        "name": project[1],
        "allocated_budget": project[2],
        "spent_amount": project[3],
        "exists": project[4]
    }
if __name__ == "__main__":

    print("Blockchain connected:", web3.is_connected())

    project = get_project("BRIDGE001")

    print("Project:")
    print(project)

def record_project_expense(
    project_id,
    amount,
    category,
    description,
    document_hash=""
):
    """
    Record a government project expense on the blockchain.
    """

    category = category.upper()
    payment_functions = {
        "LABOUR": lambda: contract.functions.recordLabourPayment(
            project_id, amount, description, document_hash,
        ),
        "MATERIAL": lambda: contract.functions.recordMaterialPurchase(
            project_id, amount, description, document_hash,
        ),
        "CONTRACTOR": lambda: contract.functions.recordContractorPayment(
            project_id, amount, description, document_hash,
        ),
    }
    function_call = payment_functions.get(category, lambda: contract.functions.recordProjectExpense(
        project_id,
        amount,
        category,
        description,
        document_hash,
    ))()
    result = _send_transaction(function_call)
    return {key: result[key] for key in ("transaction_hash", "block_number", "wallet_address")}


def record_fund_received(ngo_id, amount):
    result = _send_transaction(contract.functions.recordFundReceived(str(ngo_id), amount))
    return {key: result[key] for key in ("transaction_hash", "block_number", "wallet_address")}


def record_ngo_expense(ngo_id, amount, category, description, document_hash=""):
    result = _send_transaction(contract.functions.recordNGOExpense(
        str(ngo_id), amount, category, description, document_hash,
    ))
    return {key: result[key] for key in ("transaction_hash", "block_number", "wallet_address")}


def get_project_transactions(project_id):
    transaction_ids = contract.functions.getProjectTransactions(project_id).call()
    return [get_transaction(transaction_id) for transaction_id in transaction_ids]


def get_transaction_count():
    return contract.functions.getTransactionCount().call()
def get_transaction(transaction_id):
    """
    Read a transaction from the blockchain.
    """

    transaction = contract.functions.getTransaction(
        transaction_id
    ).call()

    return {
        "id": transaction[0],
        "entity_id": transaction[1],
        "transaction_type": transaction[2],
        "amount": transaction[3],
        "category": transaction[4],
        "description": transaction[5],
        "timestamp": transaction[6],
        "document_hash": transaction[7],
        "recorded_by": transaction[8]
    }