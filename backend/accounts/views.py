import json
from datetime import date
from decimal import Decimal, InvalidOperation

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from accounts.mysql_service import (
    create_ngo,
    get_ngo_balance,
    get_ngo_profile_for_user,
    get_ngo_transactions,
    get_mysql_project_id,
    persist_project_expense,
    record_ngo_financial_entry,
    save_blockchain_transaction,
    save_expense,
    save_project,
)
from accounts.permissions import get_authenticated_user, require_role
from blockchain_service import (
    allocate_budget,
    create_project,
    get_project,
    record_fund_received,
    record_ngo_expense,
    record_project_expense,
    web3,
)
from config.database import get_db_connection


VALID_ROLES = ["ADMIN", "NGO_OFFICIAL", "GOVERNMENT_OFFICIAL", "AUDITOR", "PUBLIC_USER"]


def test_database(request):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT DATABASE()")
    result = cursor.fetchone()
    cursor.close(); connection.close()
    return JsonResponse({"database": result[0]})


def _get_user_row(cursor, user_id):
    cursor.execute(
        """
        SELECT u.id, u.name, u.email, u.role, u.wallet_address, u.created_at,
               u.ngo_id, n.ngo_name
        FROM users u LEFT JOIN ngos n ON n.id = u.ngo_id
        WHERE u.id = %s
        """,
        (user_id,),
    )
    row = cursor.fetchone()
    if row is None:
        return None
    return {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "role": row[3],
        "wallet_address": row[4],
        "created_at": row[5].isoformat() if hasattr(row[5], "isoformat") else row[5],
        "ngo_id": row[6],
        "ngo_name": row[7],
    }


@csrf_exempt
def admin_list_users_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)

    user, error = require_role(request, ["ADMIN"])
    if error:
        return JsonResponse(error, status=403)

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT u.id, u.name, u.email, u.role, u.wallet_address, u.created_at,
                   u.ngo_id, n.ngo_name
            FROM users u LEFT JOIN ngos n ON n.id = u.ngo_id
            ORDER BY u.id
            """
        )
        users = []
        for row in cursor.fetchall():
            users.append({
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "role": row["role"],
                "wallet_address": row["wallet_address"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else row["created_at"],
                "ngo_id": row["ngo_id"],
                "ngo_name": row["ngo_name"],
            })
        cursor.close(); connection.close()
        return JsonResponse({"users": users}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
def admin_update_user_role_api(request, user_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "Only PATCH method is allowed"}, status=405)

    user, error = require_role(request, ["ADMIN"])
    if error:
        return JsonResponse(error, status=403)

    try:
        data = json.loads(request.body or '{}')
        new_role = data.get("role")
        if new_role not in VALID_ROLES:
            return JsonResponse({"error": "Role is invalid or not allowed"}, status=400)

        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id, ngo_id FROM users WHERE id = %s FOR UPDATE", (user_id,))
        target_user = cursor.fetchone()
        if target_user is None:
            cursor.close(); connection.close()
            return JsonResponse({"error": "User not found"}, status=404)

        ngo_id = None
        if new_role == "NGO_OFFICIAL":
            ngo_id = data.get("ngo_id") or target_user[1]
            if not ngo_id:
                cursor.close(); connection.close()
                return JsonResponse({"error": "An NGO must be assigned to NGO officials"}, status=400)
            cursor.execute("SELECT id FROM ngos WHERE id = %s", (ngo_id,))
            if cursor.fetchone() is None:
                cursor.close(); connection.close()
                return JsonResponse({"error": "NGO not found"}, status=404)

        cursor.execute("UPDATE users SET role = %s, ngo_id = %s WHERE id = %s", (new_role, ngo_id, user_id))
        connection.commit()
        updated_user = _get_user_row(cursor, user_id)
        cursor.close(); connection.close()
        return JsonResponse({"message": "User role updated successfully", "user": updated_user}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
def admin_ngos_api(request):
    user, error = require_role(request, ["ADMIN"])
    if error:
        return JsonResponse(error, status=403)

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        if request.method == "GET":
            cursor.execute(
                "SELECT id, ngo_name, registration_number, address, contact_email, created_at FROM ngos ORDER BY ngo_name"
            )
            ngos = cursor.fetchall()
            cursor.close(); connection.close()
            for ngo in ngos:
                if hasattr(ngo["created_at"], "isoformat"):
                    ngo["created_at"] = ngo["created_at"].isoformat()
            return JsonResponse({"ngos": ngos}, status=200)

        if request.method != "POST":
            cursor.close(); connection.close()
            return JsonResponse({"error": "Only GET and POST methods are allowed"}, status=405)

        data = json.loads(request.body or "{}")
        ngo_name = str(data.get("ngo_name", "")).strip()
        if not ngo_name:
            cursor.close(); connection.close()
            return JsonResponse({"error": "ngo_name is required"}, status=400)
        cursor.close(); connection.close()
        ngo_id = create_ngo(
            ngo_name,
            data.get("registration_number"),
            data.get("address"),
            data.get("contact_email"),
        )
        return JsonResponse({"id": ngo_id, "ngo_name": ngo_name}, status=201)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
def admin_system_info_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)
    user, error = require_role(request, ["ADMIN"])
    if error:
        return JsonResponse(error, status=403)

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        counts = {}
        for label, table in (("users", "users"), ("ngos", "ngos"), ("projects", "projects"), ("transactions", "blockchain_transactions")):
            cursor.execute(f"SELECT COUNT(*) AS total FROM `{table}`")
            counts[label] = cursor.fetchone()["total"]
        cursor.close(); connection.close()
        return JsonResponse({"counts": counts, "blockchain_connected": web3.is_connected()}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def get_project_api(request, project_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)

    try:
        project = get_project(project_id)
        if not project["exists"]:
            return JsonResponse({"error": "Project not found"}, status=404)

        mysql_project_id = get_mysql_project_id(project_id)
        if mysql_project_id is None:
            return JsonResponse({"error": "Project is not present in MySQL"}, status=404)
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        project_columns = _get_public_project_columns(cursor)
        cursor.execute(
            f"SELECT id, {project_columns['project_id']} AS project_id, "
            f"{project_columns['name']} AS name, {project_columns['budget']} AS budget, "
            f"{project_columns['description']} AS description, "
            f"{project_columns['start_date']} AS start_date, {project_columns['end_date']} AS end_date "
            f"FROM projects WHERE id = %s",
            (mysql_project_id,),
        )
        project_row = cursor.fetchone()
        _attach_project_financials(cursor, project_row, project_columns)
        cursor.close(); connection.close()
        return JsonResponse({
            "project_id": project["project_id"],
            "name": project["name"],
            "allocated_budget": project["allocated_budget"],
            "spent_amount": project["spent_amount"],
            "remaining_budget": project["allocated_budget"] - project["spent_amount"],
            "description": project_row["description"],
            "start_date": project_row["start_date"],
            "end_date": project_row["end_date"],
            "categories": project_row["categories"],
            "expenses": project_row["expenses"],
            "transactions": project_row["transactions"],
        })
    except Exception as error:
        return JsonResponse({"error": str(error)}, status=500)


@csrf_exempt
def create_project_api(request):
    if request.method == "GET":
        user, error = require_role(request, ["ADMIN", "GOVERNMENT_OFFICIAL", "AUDITOR"])
        if error:
            return JsonResponse(error, status=403)
        try:
            connection = get_db_connection()
            cursor = connection.cursor(dictionary=True)
            project_columns = _get_public_project_columns(cursor)
            cursor.execute(
                f"SELECT id, {project_columns['project_id']} AS project_id, "
                f"{project_columns['name']} AS name, {project_columns['budget']} AS budget, "
                f"{project_columns['description']} AS description, "
                f"{project_columns['start_date']} AS start_date, {project_columns['end_date']} AS end_date "
                "FROM projects ORDER BY id DESC"
            )
            projects = cursor.fetchall()
            for project in projects:
                _attach_project_financials(cursor, project, project_columns)
                for key, value in project.items():
                    if hasattr(value, "isoformat"):
                        project[key] = value.isoformat()
            cursor.close(); connection.close()
            return JsonResponse({"projects": projects}, status=200)
        except Exception as exc:
            return JsonResponse({"error": str(exc)}, status=500)

    user, error = require_role(request, ["ADMIN", "GOVERNMENT_OFFICIAL"])
    if error:
        return JsonResponse(error, status=403)
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method is allowed"}, status=405)

    try:
        data = json.loads(request.body)
        project_id = data.get("project_id")
        name = data.get("name")
        budget = data.get("budget")

        if not project_id or not name or budget is None:
            return JsonResponse({"error": "project_id, name and budget are required"}, status=400)

        amount = _validated_amount(budget)
        if get_mysql_project_id(project_id) is not None:
            return JsonResponse({"error": "Project ID already exists in MySQL"}, status=409)
        if get_project(project_id)["exists"]:
            return JsonResponse({"error": "Project ID already exists on the blockchain"}, status=409)

        result = create_project(project_id, name, amount)
        mysql_project_id = save_project(
            project_id,
            name,
            amount,
            str(data.get("description", "")).strip(),
            data.get("start_date"),
            data.get("end_date"),
        )

        return JsonResponse({
            "message": "Project created successfully",
            "project_id": project_id,
            "mysql_project_id": mysql_project_id,
            "transaction_hash": result["transaction_hash"],
            "block_number": result["block_number"],
        }, status=201)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)
    except Exception as error:
        return JsonResponse({"error": str(error)}, status=500)


@csrf_exempt
def create_expense_api(request, project_id):
    user, error = require_role(request, ["ADMIN", "GOVERNMENT_OFFICIAL"])
    if error:
        return JsonResponse(error, status=403)
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method is allowed"}, status=405)

    try:
        data = json.loads(request.body)
        category = data.get("category")
        amount = data.get("amount")
        description = data.get("description")
        expense_date = data.get("expense_date")

        category = str(category or "").strip().upper()
        description = str(description or "").strip()
        if not category or amount is None or not expense_date or not description:
            return JsonResponse({"error": "category, amount and expense_date are required"}, status=400)

        if category not in {"LABOUR", "MATERIAL", "EQUIPMENT", "CONTRACTOR", "OTHER"}:
            return JsonResponse({"error": "Unsupported expense category"}, status=400)

        amount = _validated_amount(amount)
        expense_date = _validated_record_date(expense_date)

        project = get_project(project_id)
        if not project["exists"]:
            return JsonResponse({"error": "Project not found on blockchain"}, status=404)

        mysql_project_id = get_mysql_project_id(project_id)
        if not mysql_project_id:
            return JsonResponse({"error": "Project exists on blockchain but not in MySQL"}, status=404)

        blockchain_result = record_project_expense(project_id, amount, category, description)
        expense_id, transaction_id = persist_project_expense(
            mysql_project_id,
            category,
            amount,
            description,
            expense_date,
            blockchain_result,
        )

        return JsonResponse({
            "message": "Expense recorded successfully",
            "project_id": project_id,
            "mysql_project_id": mysql_project_id,
            "expense_id": expense_id,
            "transaction_id": transaction_id,
            "category": category,
            "amount": amount,
            "transaction_hash": blockchain_result["transaction_hash"],
            "block_number": blockchain_result["block_number"],
            "wallet_address": blockchain_result["wallet_address"],
        }, status=201)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)
    except Exception as error:
        return JsonResponse({"error": str(error)}, status=500)


@csrf_exempt
def allocate_project_budget_api(request, project_id):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method is allowed"}, status=405)
    user, error = require_role(request, ["ADMIN", "GOVERNMENT_OFFICIAL"])
    if error:
        return JsonResponse(error, status=403)

    try:
        data = json.loads(request.body or "{}")
        amount = _validated_amount(data.get("amount"))
        description = str(data.get("description", "")).strip()
        allocation_date = _validated_record_date(data.get("allocation_date"))
        project = get_project(project_id)
        if not project["exists"]:
            return JsonResponse({"error": "Project not found on blockchain"}, status=404)

        mysql_project_id = get_mysql_project_id(project_id)
        if mysql_project_id is None:
            return JsonResponse({"error": "Project is not present in MySQL"}, status=404)

        connection = get_db_connection()
        cursor = connection.cursor()
        connection.start_transaction()
        cursor.execute("SELECT id FROM projects WHERE id = %s FOR UPDATE", (mysql_project_id,))
        if cursor.fetchone() is None:
            connection.rollback(); cursor.close(); connection.close()
            return JsonResponse({"error": "Project is not present in MySQL"}, status=404)

        chain_result = allocate_budget(project_id, amount)
        project_columns = _get_public_project_columns(cursor)
        budget_column = project_columns["budget"]
        cursor.execute(
            f"UPDATE projects SET {budget_column} = {budget_column} + %s WHERE id = %s",
            (amount, mysql_project_id),
        )
        cursor.execute(
            """
            INSERT INTO project_budgets
                (project_id, allocated_amount, allocation_date, allocated_by, description)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (mysql_project_id, amount, allocation_date, user["user_id"], description or None),
        )
        budget_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO blockchain_transactions
                (project_id, budget_id, transaction_type, amount, wallet_address, tx_hash, block_number, status)
            VALUES (%s, %s, 'BUDGET_ALLOCATION', %s, %s, %s, %s, 'CONFIRMED')
            """,
            (
                mysql_project_id,
                budget_id,
                amount,
                chain_result["wallet_address"],
                chain_result["transaction_hash"],
                chain_result["block_number"],
            ),
        )
        transaction_id = cursor.lastrowid
        connection.commit()
        cursor.close(); connection.close()
        return JsonResponse({
            "message": "Project budget allocated successfully",
            "project_id": project_id,
            "amount": amount,
            "transaction_id": transaction_id,
            **{key: chain_result[key] for key in ("transaction_hash", "block_number", "wallet_address")},
        }, status=201)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
def public_projects_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)

    try:
        connection = get_db_connection(); cursor = connection.cursor(dictionary=True)
        project_columns = _get_public_project_columns(cursor)
        cursor.execute(
            f"SELECT id, {project_columns['project_id']} AS project_id, "
            f"{project_columns['name']} AS name, {project_columns['budget']} AS budget, "
            f"{project_columns['description']} AS description, "
            f"{project_columns['start_date']} AS start_date, {project_columns['end_date']} AS end_date "
            "FROM projects ORDER BY id"
        )
        rows = cursor.fetchall()
        for project in rows:
            _attach_project_financials(cursor, project, project_columns)
            for key, value in project.items():
                if hasattr(value, "isoformat"):
                    project[key] = value.isoformat()
        cursor.close(); connection.close()
        return JsonResponse({"projects": rows}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
def public_project_detail_api(request, project_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)

    try:
        connection = get_db_connection(); cursor = connection.cursor(dictionary=True)
        project_columns = _get_public_project_columns(cursor)
        cursor.execute(
            f"SELECT id, {project_columns['project_id']} AS project_id, "
            f"{project_columns['name']} AS name, {project_columns['budget']} AS budget, "
            f"{project_columns['description']} AS description, "
            f"{project_columns['start_date']} AS start_date, {project_columns['end_date']} AS end_date "
            f"FROM projects WHERE {project_columns['project_id']} = %s",
            (project_id,),
        )
        project = cursor.fetchone()
        if not project:
            cursor.close(); connection.close()
            return JsonResponse({"error": "Project not found"}, status=404)
        _attach_project_financials(cursor, project, project_columns)
        for key, value in project.items():
            if hasattr(value, "isoformat"):
                project[key] = value.isoformat()
        cursor.close(); connection.close()
        return JsonResponse({"project": project}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@csrf_exempt
def project_transactions_api(request, project_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)

    try:
        connection = get_db_connection(); cursor = connection.cursor(dictionary=True)
        project_columns = _get_public_project_columns(cursor)
        cursor.execute(
            f"SELECT id FROM projects WHERE {project_columns['project_id']} = %s",
            (project_id,),
        )
        project = cursor.fetchone()
        if not project:
            cursor.close(); connection.close()
            return JsonResponse({"error": "Project not found"}, status=404)
        project_row = {"id": project["id"]}
        _attach_project_financials(cursor, project_row, project_columns)
        rows = project_row["transactions"]
        cursor.close(); connection.close()
        return JsonResponse({"transactions": rows}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def _audit_transaction_rows(public_only=False):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    public_filter = "WHERE tx.ngo_id IS NULL AND tx.project_id IS NOT NULL" if public_only else ""
    cursor.execute(
        f"""
        SELECT tx.id AS mysql_transaction_id, tx.transaction_type, tx.amount,
               tx.wallet_address, tx.tx_hash AS transaction_hash, tx.block_number,
               tx.status, tx.created_at, tx.project_id AS mysql_project_id,
               project.blockchain_project_id AS project_id,
               project.project_name AS project_name, tx.expense_id AS mysql_expense_id,
               COALESCE(expense.category, 'BUDGET') AS category,
               COALESCE(expense.description, budget.description) AS description,
               COALESCE(expense.expense_date, budget.allocation_date) AS expense_date,
               tx.ngo_id, ngo.ngo_name, record.id AS ngo_record_id,
               record.document_hash, record.record_date, record.user_id AS recorded_by_user_id,
               tx.budget_id, budget.allocated_amount
        FROM blockchain_transactions tx
        LEFT JOIN projects project ON project.id = tx.project_id
        LEFT JOIN expenses expense ON expense.id = tx.expense_id
        LEFT JOIN project_budgets budget ON budget.id = tx.budget_id
        LEFT JOIN ngos ngo ON ngo.id = tx.ngo_id
        LEFT JOIN ngo_financial_records record ON record.blockchain_transaction_id = tx.id
        {public_filter}
        ORDER BY tx.id DESC
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    for row in rows:
        for key, value in row.items():
            if hasattr(value, "isoformat"):
                row[key] = value.isoformat()
    return rows


def public_transactions_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)
    try:
        return JsonResponse({"transactions": _audit_transaction_rows(public_only=True)}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def audit_transactions_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)
    user, error = require_role(request, ["ADMIN", "AUDITOR"])
    if error:
        return JsonResponse(error, status=403)
    try:
        return JsonResponse({"transactions": _audit_transaction_rows()}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def _get_public_project_columns(cursor):
    cursor.execute("SHOW COLUMNS FROM projects")
    columns = {
        row["Field"] if isinstance(row, dict) else row[0]
        for row in cursor.fetchall()
    }
    if {"id", "blockchain_project_id", "project_name", "approved_budget"}.issubset(columns):
        return {
            "id": "id",
            "project_id": "blockchain_project_id",
            "name": "project_name",
            "budget": "approved_budget",
            "description": "description" if "description" in columns else "NULL",
            "start_date": "start_date" if "start_date" in columns else "NULL",
            "end_date": "end_date" if "end_date" in columns else "NULL",
        }
    if {"id", "project_id", "name", "budget"}.issubset(columns):
        return {
            "id": "id",
            "project_id": "project_id",
            "name": "name",
            "budget": "budget",
            "description": "description" if "description" in columns else "NULL",
            "start_date": "start_date" if "start_date" in columns else "NULL",
            "end_date": "end_date" if "end_date" in columns else "NULL",
        }
    raise ValueError("Unsupported projects table schema")


def _attach_project_financials(cursor, project, project_columns):
    cursor.execute("SHOW COLUMNS FROM expenses")
    expense_fields = {row["Field"] if isinstance(row, dict) else row[0] for row in cursor.fetchall()}
    payment_status = "payment_status" if "payment_status" in expense_fields else "status" if "status" in expense_fields else None
    paid_clause = f"AND e.{payment_status} = 'PAID'" if payment_status else ""
    cursor.execute(
        f"""
         SELECT e.id AS mysql_expense_id, e.category, e.amount, e.description,
             'PROJECT_EXPENSE' AS transaction_type,
               e.expense_date, {('e.' + payment_status) if payment_status else "'PAID'"} AS status,
               t.tx_hash AS transaction_hash, t.block_number, t.wallet_address,
               t.id AS mysql_transaction_id
        FROM expenses e
        LEFT JOIN blockchain_transactions t ON t.expense_id = e.id
        WHERE e.project_id = %s {paid_clause}
        ORDER BY e.expense_date DESC, e.id DESC
        """,
        (project.get("id", project.get("mysql_project_id")),),
    )
    expenses = cursor.fetchall()
    categories = {"LABOUR": 0, "MATERIAL": 0, "EQUIPMENT": 0, "CONTRACTOR": 0, "OTHER": 0}
    total_spent = 0
    for expense in expenses:
        category = str(expense["category"]).upper()
        amount = expense["amount"]
        total_spent += amount
        categories[category if category in categories else "OTHER"] += amount
        for key, value in expense.items():
            if hasattr(value, "isoformat"):
                expense[key] = value.isoformat()

    cursor.execute(
        """
        SELECT NULL AS mysql_expense_id, 'BUDGET' AS category,
               budget.allocated_amount AS amount, budget.description,
               'BUDGET_ALLOCATION' AS transaction_type,
               budget.allocation_date AS expense_date, tx.status,
               tx.tx_hash AS transaction_hash, tx.block_number, tx.wallet_address,
               tx.id AS mysql_transaction_id
        FROM project_budgets budget
        JOIN blockchain_transactions tx ON tx.budget_id = budget.id
        WHERE budget.project_id = %s
        ORDER BY budget.allocation_date DESC, budget.id DESC
        """,
        (project.get("id", project.get("mysql_project_id")),),
    )
    budget_transactions = cursor.fetchall()
    for transaction in budget_transactions:
        for key, value in transaction.items():
            if hasattr(value, "isoformat"):
                transaction[key] = value.isoformat()
    transactions = sorted(
        expenses + budget_transactions,
        key=lambda item: (item.get("expense_date") or "", item.get("mysql_transaction_id") or 0),
        reverse=True,
    )
    budget = project.get("budget")
    if budget is None:
        budget = project.get("allocated_budget", 0)
    project.update({
        "expenses": expenses,
        "transactions": transactions,
        "categories": categories,
        "spent": total_spent,
        "remaining": budget - total_spent,
    })


@csrf_exempt
def transaction_detail_api(request, transaction_id):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)

    try:
        connection = get_db_connection(); cursor = connection.cursor(dictionary=True)
        user = get_authenticated_user(request)
        can_view_ngo = user and user.get("role") in ("ADMIN", "AUDITOR")
        visibility = "" if can_view_ngo else "AND ngo_id IS NULL"
        cursor.execute(
            f"SELECT * FROM blockchain_transactions WHERE id = %s {visibility}",
            (transaction_id,),
        )
        row = cursor.fetchone(); cursor.close(); connection.close()
        if not row:
            return JsonResponse({"error": "Transaction not found"}, status=404)
        return JsonResponse({"transaction": row}, status=200)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)


def _ngo_request_context(request):
    user, error = require_role(request, ["NGO_OFFICIAL"])
    if error:
        return None, None, JsonResponse(error, status=403)
    profile = get_ngo_profile_for_user(user["user_id"])
    if not profile:
        return None, None, JsonResponse(
            {"error": "Your account is not assigned to an NGO. Contact an administrator."},
            status=409,
        )
    return user, profile, None


def _validated_amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("amount must be a positive whole number")
    if not amount.is_finite() or amount <= 0 or amount != amount.to_integral_value():
        raise ValueError("amount must be a positive whole number")
    return int(amount)


def _validated_record_date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError("record_date must use YYYY-MM-DD format")


def ngo_profile_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)
    user, profile, error = _ngo_request_context(request)
    if error:
        return error
    profile["created_at"] = profile["created_at"].isoformat() if hasattr(profile["created_at"], "isoformat") else profile["created_at"]
    return JsonResponse({"profile": profile}, status=200)


def ngo_balance_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)
    user, profile, error = _ngo_request_context(request)
    if error:
        return error
    return JsonResponse({"balance": get_ngo_balance(profile["id"])}, status=200)


def ngo_transactions_api(request):
    if request.method != "GET":
        return JsonResponse({"error": "Only GET method is allowed"}, status=405)
    user, profile, error = _ngo_request_context(request)
    if error:
        return error
    rows = get_ngo_transactions(profile["id"])
    for row in rows:
        for key, value in row.items():
            if hasattr(value, "isoformat"):
                row[key] = value.isoformat()
    return JsonResponse({"transactions": rows}, status=200)


def _ngo_financial_write(request, transaction_type):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method is allowed"}, status=405)
    user, profile, error = _ngo_request_context(request)
    if error:
        return error

    try:
        data = json.loads(request.body or "{}")
        amount = _validated_amount(data.get("amount"))
        category = "FUND" if transaction_type == "FUND_RECEIVED" else str(data.get("category", "")).strip()
        description = str(data.get("description", "")).strip()
        if not category:
            return JsonResponse({"error": "category is required"}, status=400)
        if not description:
            return JsonResponse({"error": "description is required"}, status=400)
        record_date = _validated_record_date(data.get("record_date"))
        document_hash = str(data.get("document_hash", "")).strip()
        if len(document_hash) > 255:
            return JsonResponse({"error": "document_hash cannot exceed 255 characters"}, status=400)

        def send_to_chain(ngo_id):
            if transaction_type == "FUND_RECEIVED":
                return record_fund_received(ngo_id, amount)
            return record_ngo_expense(ngo_id, amount, category, description, document_hash)

        result = record_ngo_financial_entry(
            user["user_id"],
            transaction_type,
            amount,
            category,
            description,
            record_date,
            document_hash,
            send_to_chain,
        )
        return JsonResponse({"message": "NGO transaction confirmed", **result}, status=201)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except ConnectionError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=502)


@csrf_exempt
def ngo_funds_api(request):
    return _ngo_financial_write(request, "FUND_RECEIVED")


@csrf_exempt
def ngo_expenses_api(request):
    return _ngo_financial_write(request, "NGO_EXPENSE")
