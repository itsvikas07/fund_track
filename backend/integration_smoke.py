import atexit
import json
import os
import uuid
from decimal import Decimal

import django


TABLES = (
    "users",
    "ngos",
    "government_departments",
    "projects",
    "project_budgets",
    "expenses",
    "blockchain_transactions",
    "ngo_financial_records",
    "documents",
    "notifications",
)


def assert_status(response, expected):
    assert response.status_code == expected, (
        f"Expected HTTP {expected}, got {response.status_code}: {response.content!r}"
    )


def auth_headers(user_id, role, name):
    from rest_framework_simplejwt.tokens import RefreshToken

    token = RefreshToken()
    token["user_id"] = user_id
    token["role"] = role
    token["name"] = name
    return {"HTTP_AUTHORIZATION": f"Bearer {token.access_token}", "HTTP_HOST": "localhost"}


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from config.database import get_db_connection

    source = get_db_connection()
    source_cursor = source.cursor()
    database = f"fund_transparency_it_{uuid.uuid4().hex[:12]}"
    original_database = os.getenv("MYSQL_DATABASE", "fund_transparency")
    created_database = False
    try:
        source_cursor.execute(
            f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        created_database = True

        def cleanup_database():
            if not created_database:
                return
            os.environ["MYSQL_DATABASE"] = original_database
            cleanup_connection = get_db_connection()
            cleanup_cursor = cleanup_connection.cursor()
            try:
                cleanup_cursor.execute(f"DROP DATABASE IF EXISTS `{database}`")
                cleanup_connection.commit()
            finally:
                cleanup_cursor.close()
                cleanup_connection.close()

        atexit.register(cleanup_database)
        for table in TABLES:
            source_cursor.execute(
                f"CREATE TABLE `{database}`.`{table}` LIKE `fund_transparency`.`{table}`"
            )
        source.commit()
    finally:
        source_cursor.close()
        source.close()

    os.environ["MYSQL_DATABASE"] = database
    django.setup()

    from django.contrib.auth.hashers import make_password
    from django.test import Client
    from rest_framework_simplejwt.tokens import RefreshToken

    from blockchain_service import PRIVATE_KEY, contract, web3

    assert web3.is_connected(), "Hardhat RPC is unavailable"
    assert web3.eth.get_code(contract.address) not in (b"", b"\x00"), (
        "FundTransparency is not deployed at the configured address"
    )
    backend_address = web3.eth.account.from_key(PRIVATE_KEY).address
    for role_reader in (contract.functions.GOVERNMENT_OFFICIAL_ROLE, contract.functions.NGO_OFFICIAL_ROLE):
        role = role_reader().call()
        assert contract.functions.hasRole(role, backend_address).call(), (
            "The backend signer lacks a required contract role"
        )

    connection = get_db_connection()
    cursor = connection.cursor()
    password = make_password("local-integration-only")
    cursor.execute(
        "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, 'ADMIN')",
        ("Integration Admin", "admin@example.invalid", password),
    )
    admin_id = cursor.lastrowid
    connection.commit()
    cursor.close()
    connection.close()

    client = Client()
    admin = auth_headers(admin_id, "ADMIN", "Integration Admin")
    first_ngo = client.post(
        "/api/admin/ngos/",
        data=json.dumps({"ngo_name": "Integration NGO One", "registration_number": "IT-ONE"}),
        content_type="application/json",
        **admin,
    )
    assert_status(first_ngo, 201)
    second_ngo = client.post(
        "/api/admin/ngos/",
        data=json.dumps({"ngo_name": "Integration NGO Two", "registration_number": "IT-TWO"}),
        content_type="application/json",
        **admin,
    )
    assert_status(second_ngo, 201)

    client.post(
        "/api/auth/register/",
        data=json.dumps({"name": "NGO One", "email": "ngo-one@example.invalid", "password": "local-integration-only"}),
        content_type="application/json",
        HTTP_HOST="localhost",
    )
    client.post(
        "/api/auth/register/",
        data=json.dumps({"name": "NGO Two", "email": "ngo-two@example.invalid", "password": "local-integration-only"}),
        content_type="application/json",
        HTTP_HOST="localhost",
    )
    client.post(
        "/api/auth/register/",
        data=json.dumps({"name": "Public User", "email": "public@example.invalid", "password": "local-integration-only"}),
        content_type="application/json",
        HTTP_HOST="localhost",
    )

    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT id, email FROM users WHERE role = 'PUBLIC_USER' ORDER BY id")
    user_rows = cursor.fetchall()
    cursor.close()
    connection.close()
    for user_row, ngo in zip(user_rows[:2], (first_ngo.json(), second_ngo.json())):
        response = client.patch(
            f"/api/admin/users/{user_row[0]}/role/",
            data=json.dumps({"role": "NGO_OFFICIAL", "ngo_id": ngo["id"]}),
            content_type="application/json",
            **admin,
        )
        assert_status(response, 200)

    login = client.post(
        "/api/auth/login/",
        data=json.dumps({"email": "ngo-one@example.invalid", "password": "local-integration-only"}),
        content_type="application/json",
        HTTP_HOST="localhost",
    )
    assert_status(login, 200)
    ngo_auth = {"HTTP_AUTHORIZATION": f"Bearer {login.json()['access']}", "HTTP_HOST": "localhost"}
    second_auth = auth_headers(user_rows[1][0], "NGO_OFFICIAL", "NGO Two")

    profile = client.get("/api/ngo/profile/", **ngo_auth)
    assert_status(profile, 200)
    assert profile.json()["profile"]["id"] == first_ngo.json()["id"]
    funds = client.post(
        "/api/ngo/funds/",
        data=json.dumps({"amount": 1000, "description": "Confirmed integration receipt", "record_date": "2026-09-29"}),
        content_type="application/json",
        **ngo_auth,
    )
    assert_status(funds, 201)
    ngo_expense = client.post(
        "/api/ngo/expenses/",
        data=json.dumps({"amount": 250, "category": "PROGRAM", "description": "Confirmed integration expense", "record_date": "2026-09-29"}),
        content_type="application/json",
        **ngo_auth,
    )
    assert_status(ngo_expense, 201)
    overspend = client.post(
        "/api/ngo/expenses/",
        data=json.dumps({"amount": 1000, "category": "PROGRAM", "description": "Rejected overspend", "record_date": "2026-09-29"}),
        content_type="application/json",
        **ngo_auth,
    )
    assert_status(overspend, 400)
    balance = client.get("/api/ngo/balance/", **ngo_auth).json()["balance"]
    assert (Decimal(str(balance["total_funds_received"])), Decimal(str(balance["total_spent"])), Decimal(str(balance["remaining_balance"]))) == (Decimal("1000"), Decimal("250"), Decimal("750"))
    isolated_balance = client.get("/api/ngo/balance/", **second_auth).json()["balance"]
    assert Decimal(str(isolated_balance["total_funds_received"])) == 0
    assert len(client.get("/api/ngo/transactions/", **ngo_auth).json()["transactions"]) == 2

    project_id = f"IT-{uuid.uuid4().hex[:10]}"
    created = client.post(
        "/api/projects/",
        data=json.dumps({"project_id": project_id, "name": "Integration Project", "budget": 10000, "description": "Local integration", "start_date": "2026-09-29"}),
        content_type="application/json",
        **admin,
    )
    assert_status(created, 201)
    project_expenses = {}
    for category in ("LABOUR", "MATERIAL", "EQUIPMENT", "CONTRACTOR", "OTHER"):
        response = client.post(
            f"/api/projects/{project_id}/expenses/",
            data=json.dumps({"category": category, "amount": 10, "description": f"Integration {category.lower()}", "expense_date": "2026-09-29"}),
            content_type="application/json",
            **admin,
        )
        assert_status(response, 201)
        project_expenses[category] = response.json()

    allocation = client.post(
        f"/api/projects/{project_id}/budget/",
        data=json.dumps({"amount": 500, "allocation_date": "2026-09-29", "description": "Integration allocation"}),
        content_type="application/json",
        **admin,
    )
    assert_status(allocation, 201)
    public_project = client.get(f"/api/public/projects/{project_id}/", HTTP_HOST="localhost")
    assert_status(public_project, 200)
    project = public_project.json()["project"]
    assert (Decimal(str(project["budget"])), Decimal(str(project["spent"])), Decimal(str(project["remaining"]))) == (Decimal("10500"), Decimal("50"), Decimal("10450"))
    assert all(Decimal(str(project["categories"][category])) == 10 for category in project_expenses)
    assert all(row["transaction_hash"] and row["block_number"] for row in project["expenses"])
    assert len(project["transactions"]) == 6
    assert any(row["transaction_type"] == "BUDGET_ALLOCATION" for row in project["transactions"])

    auditor = client.get("/api/audit/transactions/", **admin)
    assert_status(auditor, 200)
    assert len(auditor.json()["transactions"]) >= 8
    public_transactions = client.get("/api/public/transactions/", HTTP_HOST="localhost")
    assert_status(public_transactions, 200)
    assert all(row["ngo_id"] is None for row in public_transactions.json()["transactions"])
    assert client.get("/api/ngo/balance/", HTTP_HOST="localhost").status_code == 403
    assert client.post(
        "/api/projects/",
        data=json.dumps({"project_id": "DENIED", "name": "Denied", "budget": 1}),
        content_type="application/json",
        **second_auth,
    ).status_code == 403

    print("NGO ownership, funds, expense, chain receipt, balance and overspend guard: PASS")
    print("Cross-NGO financial isolation and admin role assignment: PASS")
    print("Government project, all five categories, allocation, and public/auditor reads: PASS")
    print("Role denials and signer contract roles: PASS")


if __name__ == "__main__":
    main()