from config.database import get_db_connection


def _get_schema_columns(table_name):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(f"SHOW COLUMNS FROM `{table_name}`")
    columns = [row[0] for row in cursor.fetchall()]
    cursor.close()
    connection.close()
    return columns


def save_project(blockchain_project_id, project_name, budget, description="", start_date=None, end_date=None):
    connection = get_db_connection()
    cursor = connection.cursor()
    columns = _get_schema_columns("projects")

    if "blockchain_project_id" in columns:
        fields = ["blockchain_project_id", "project_name", "approved_budget"]
        values = [blockchain_project_id, project_name, budget]
        for field, value in (("description", description), ("start_date", start_date), ("end_date", end_date)):
            if field in columns:
                fields.append(field)
                values.append(value or None)
        query = f"INSERT INTO projects ({', '.join(fields)}) VALUES ({', '.join(['%s'] * len(fields))})"
        cursor.execute(query, values)
    elif {"project_id", "name", "budget"}.issubset(set(columns)):
        fields = ["project_id", "name", "budget"]
        values = [blockchain_project_id, project_name, budget]
        for field, value in (("description", description), ("start_date", start_date), ("end_date", end_date)):
            if field in columns:
                fields.append(field)
                values.append(value or None)
        query = f"INSERT INTO projects ({', '.join(fields)}) VALUES ({', '.join(['%s'] * len(fields))})"
        cursor.execute(query, values)
    else:
        cursor.close()
        connection.close()
        raise ValueError("Unsupported projects table schema")

    connection.commit()
    project_id = cursor.lastrowid
    cursor.close()
    connection.close()
    return project_id


def get_mysql_project_id(blockchain_project_id):
    connection = get_db_connection()
    cursor = connection.cursor()
    columns = _get_schema_columns("projects")

    if "blockchain_project_id" in columns:
        cursor.execute(
            "SELECT id FROM projects WHERE blockchain_project_id = %s",
            (blockchain_project_id,),
        )
    elif "project_id" in columns:
        cursor.execute(
            "SELECT id FROM projects WHERE project_id = %s",
            (blockchain_project_id,),
        )
    else:
        cursor.close()
        connection.close()
        return None

    result = cursor.fetchone()
    cursor.close()
    connection.close()
    return result[0] if result else None


def save_expense(project_id, category, amount, description, expense_date, blockchain_tx_hash):
    connection = get_db_connection()
    cursor = connection.cursor()
    columns = _get_schema_columns("expenses")

    if "blockchain_tx_hash" in columns:
        query = """
            INSERT INTO expenses
            (project_id, category, amount, description, expense_date, payment_status, blockchain_tx_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (project_id, category, amount, description, expense_date, "PAID", blockchain_tx_hash))
    elif "tx_hash" in columns:
        query = """
            INSERT INTO expenses
            (project_id, category, amount, description, expense_date, status, tx_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (project_id, category, amount, description, expense_date, "PAID", blockchain_tx_hash))
    else:
        cursor.close(); connection.close()
        raise ValueError("Unsupported expenses table schema")

    connection.commit()
    expense_id = cursor.lastrowid
    cursor.close(); connection.close()
    return expense_id


def save_blockchain_transaction(project_id, expense_id, transaction_type, amount, wallet_address, tx_hash, block_number):
    connection = get_db_connection()
    cursor = connection.cursor()
    columns = _get_schema_columns("blockchain_transactions")

    if "tx_hash" in columns:
        query = """
            INSERT INTO blockchain_transactions
            (project_id, expense_id, transaction_type, amount, wallet_address, tx_hash, block_number, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (project_id, expense_id, transaction_type, amount, wallet_address, tx_hash, block_number, "CONFIRMED"))
    elif "transaction_hash" in columns:
        query = """
            INSERT INTO blockchain_transactions
            (project_id, expense_id, transaction_type, amount, wallet_address, transaction_hash, block_number, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (project_id, expense_id, transaction_type, amount, wallet_address, tx_hash, block_number, "CONFIRMED"))
    else:
        cursor.close(); connection.close()
        raise ValueError("Unsupported blockchain_transactions table schema")

    connection.commit()
    transaction_id = cursor.lastrowid
    cursor.close(); connection.close()
    return transaction_id


def persist_project_expense(project_id, category, amount, description, expense_date, blockchain_result):
    connection = get_db_connection()
    cursor = connection.cursor()
    try:
        connection.start_transaction()
        cursor.execute("SHOW COLUMNS FROM expenses")
        expense_columns = {row[0] for row in cursor.fetchall()}
        if "blockchain_tx_hash" in expense_columns:
            cursor.execute(
                """
                INSERT INTO expenses
                    (project_id, category, amount, description, expense_date, payment_status, blockchain_tx_hash)
                VALUES (%s, %s, %s, %s, %s, 'PAID', %s)
                """,
                (project_id, category, amount, description, expense_date, blockchain_result["transaction_hash"]),
            )
        elif "tx_hash" in expense_columns:
            cursor.execute(
                """
                INSERT INTO expenses
                    (project_id, category, amount, description, expense_date, status, tx_hash)
                VALUES (%s, %s, %s, %s, %s, 'PAID', %s)
                """,
                (project_id, category, amount, description, expense_date, blockchain_result["transaction_hash"]),
            )
        else:
            raise ValueError("Unsupported expenses table schema")
        expense_id = cursor.lastrowid

        cursor.execute("SHOW COLUMNS FROM blockchain_transactions")
        transaction_columns = {row[0] for row in cursor.fetchall()}
        if {"project_id", "expense_id", "tx_hash", "status"}.issubset(transaction_columns):
            cursor.execute(
                """
                INSERT INTO blockchain_transactions
                    (project_id, expense_id, transaction_type, amount, wallet_address, tx_hash, block_number, status)
                VALUES (%s, %s, 'PROJECT_EXPENSE', %s, %s, %s, %s, 'CONFIRMED')
                """,
                (
                    project_id,
                    expense_id,
                    amount,
                    blockchain_result["wallet_address"],
                    blockchain_result["transaction_hash"],
                    blockchain_result["block_number"],
                ),
            )
        elif {"project_id", "transaction_hash", "recorded_by"}.issubset(transaction_columns):
            cursor.execute(
                """
                INSERT INTO blockchain_transactions
                    (project_id, transaction_type, amount, category, description,
                     transaction_hash, block_number, recorded_by)
                VALUES (%s, 'PROJECT_EXPENSE', %s, %s, %s, %s, %s, %s)
                """,
                (
                    project_id,
                    amount,
                    category,
                    description,
                    blockchain_result["transaction_hash"],
                    blockchain_result["block_number"],
                    blockchain_result["wallet_address"],
                ),
            )
        else:
            raise ValueError("Unsupported blockchain_transactions table schema")
        transaction_id = cursor.lastrowid
        connection.commit()
        return expense_id, transaction_id
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def create_ngo(ngo_name, registration_number=None, address=None, contact_email=None):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(
        "INSERT INTO ngos (ngo_name, registration_number, address, contact_email) VALUES (%s, %s, %s, %s)",
        (ngo_name, registration_number or None, address or None, contact_email or None),
    )
    connection.commit()
    ngo_id = cursor.lastrowid
    cursor.close()
    connection.close()
    return ngo_id


def get_ngo_profile_for_user(user_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT n.id, n.ngo_name, n.registration_number, n.address,
               n.contact_email, n.created_at
        FROM users u
        JOIN ngos n ON n.id = u.ngo_id
        WHERE u.id = %s AND u.role = 'NGO_OFFICIAL'
        """,
        (user_id,),
    )
    profile = cursor.fetchone()
    cursor.close()
    connection.close()
    return profile


def get_ngo_balance(ngo_id):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN transaction_type = 'FUND_RECEIVED'
                AND status = 'CONFIRMED' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN transaction_type = 'NGO_EXPENSE'
                AND status = 'CONFIRMED' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN transaction_type = 'NGO_EXPENSE'
                AND status = 'PENDING' THEN amount ELSE 0 END), 0)
        FROM ngo_financial_records WHERE ngo_id = %s
        """,
        (ngo_id,),
    )
    funds_received, total_spent, pending_expenses = cursor.fetchone()
    cursor.close()
    connection.close()
    return {
        "total_funds_received": funds_received,
        "total_spent": total_spent,
        "remaining_balance": funds_received - total_spent,
        "available_balance": funds_received - total_spent - pending_expenses,
        "pending_expenses": pending_expenses,
    }


def get_ngo_transactions(ngo_id):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT record.id AS record_id, record.transaction_type, record.amount,
               record.category, record.description, record.document_hash,
               record.record_date, record.status, record.created_at,
               tx.id AS mysql_transaction_id, tx.tx_hash AS transaction_hash,
               tx.block_number, tx.wallet_address, tx.status AS chain_status,
               user.name AS recorded_by
        FROM ngo_financial_records record
        JOIN blockchain_transactions tx ON tx.id = record.blockchain_transaction_id
        JOIN users user ON user.id = record.user_id
        WHERE record.ngo_id = %s
        ORDER BY record.id DESC
        """,
        (ngo_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    connection.close()
    return rows


def record_ngo_financial_entry(
    user_id,
    transaction_type,
    amount,
    category,
    description,
    record_date,
    document_hash,
    blockchain_operation,
):
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        connection.start_transaction()
        cursor.execute(
            "SELECT ngo_id FROM users WHERE id = %s AND role = 'NGO_OFFICIAL' FOR UPDATE",
            (user_id,),
        )
        user = cursor.fetchone()
        if not user or not user["ngo_id"]:
            raise ValueError("This NGO official is not assigned to an NGO")

        ngo_id = user["ngo_id"]
        cursor.execute("SELECT id FROM ngos WHERE id = %s FOR UPDATE", (ngo_id,))
        if not cursor.fetchone():
            raise ValueError("Assigned NGO was not found")

        cursor.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN transaction_type = 'FUND_RECEIVED'
                    AND status = 'CONFIRMED' THEN amount ELSE 0 END), 0) AS funds,
                COALESCE(SUM(CASE WHEN transaction_type = 'NGO_EXPENSE'
                    AND status IN ('CONFIRMED', 'PENDING') THEN amount ELSE 0 END), 0) AS spent
            FROM ngo_financial_records WHERE ngo_id = %s
            """,
            (ngo_id,),
        )
        totals = cursor.fetchone()
        if transaction_type == "NGO_EXPENSE" and amount > totals["funds"] - totals["spent"]:
            raise ValueError("Expense exceeds the available NGO balance")

        cursor.execute(
            """
            INSERT INTO blockchain_transactions
                (ngo_id, transaction_type, amount, status)
            VALUES (%s, %s, %s, 'PENDING')
            """,
            (ngo_id, transaction_type, amount),
        )
        mysql_transaction_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO ngo_financial_records
                (ngo_id, user_id, blockchain_transaction_id, transaction_type,
                 amount, category, description, document_hash, record_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDING')
            """,
            (
                ngo_id,
                user_id,
                mysql_transaction_id,
                transaction_type,
                amount,
                category,
                description,
                document_hash or None,
                record_date,
            ),
        )
        record_id = cursor.lastrowid

        try:
            chain_result = blockchain_operation(ngo_id)
        except Exception:
            cursor.execute(
                "UPDATE blockchain_transactions SET status = 'FAILED' WHERE id = %s",
                (mysql_transaction_id,),
            )
            cursor.execute(
                "UPDATE ngo_financial_records SET status = 'FAILED' WHERE id = %s",
                (record_id,),
            )
            connection.commit()
            raise

        cursor.execute(
            """
            UPDATE blockchain_transactions
            SET wallet_address = %s, tx_hash = %s, block_number = %s, status = 'CONFIRMED'
            WHERE id = %s
            """,
            (
                chain_result["wallet_address"],
                chain_result["transaction_hash"],
                chain_result["block_number"],
                mysql_transaction_id,
            ),
        )
        cursor.execute(
            "UPDATE ngo_financial_records SET status = 'CONFIRMED' WHERE id = %s",
            (record_id,),
        )
        connection.commit()
        return {
            "ngo_id": ngo_id,
            "record_id": record_id,
            "mysql_transaction_id": mysql_transaction_id,
            **chain_result,
        }
    except Exception:
        if connection.in_transaction:
            connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()