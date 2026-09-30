from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password
import json
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import check_password

from config.database import get_db_connection


@csrf_exempt
def register(request):

    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST method is allowed"},
            status=405
        )

    try:
        data = json.loads(request.body)

        name = data.get("name")
        email = data.get("email")
        password = data.get("password")

        if not name or not email or not password:
            return JsonResponse(
                {"error": "Name, email and password are required"},
                status=400
            )

        # Normal registration always creates a PUBLIC_USER
        role = "PUBLIC_USER"

        connection = get_db_connection()
        cursor = connection.cursor()

        # Check whether email already exists
        cursor.execute(
            "SELECT id FROM users WHERE email = %s",
            (email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            cursor.close()
            connection.close()

            return JsonResponse(
                {"error": "Email already registered"},
                status=409
            )

        # Hash password
        hashed_password = make_password(password)

        # Insert user
        cursor.execute(
            """
            INSERT INTO users
            (name, email, password, role)
            VALUES (%s, %s, %s, %s)
            """,
            (name, email, hashed_password, role)
        )

        connection.commit()

        cursor.close()
        connection.close()

        return JsonResponse(
            {
                "message": "Registration successful",
                "role": "PUBLIC_USER"
            },
            status=201
        )

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )
@csrf_exempt
def login(request):

    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST method is allowed"},
            status=405
        )

    try:
        data = json.loads(request.body)

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return JsonResponse(
                {"error": "Email and password are required"},
                status=400
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        # Find user by email
        cursor.execute(
            """
            SELECT id, name, email, password, role
            FROM users
            WHERE email = %s
            """,
            (email,)
        )

        user = cursor.fetchone()

        if not user:
            cursor.close()
            connection.close()

            return JsonResponse(
                {"error": "Invalid email or password"},
                status=401
            )

        user_id = user[0]
        name = user[1]
        user_email = user[2]
        stored_password = user[3]
        role = user[4]

        # Check password
        if not check_password(password, stored_password):
            cursor.close()
            connection.close()

            return JsonResponse(
                {"error": "Invalid email or password"},
                status=401
            )

        # Create JWT tokens
        refresh = RefreshToken()

        refresh["user_id"] = user_id
        refresh["role"] = role
        refresh["name"] = name

        access_token = refresh.access_token

        cursor.close()
        connection.close()

        return JsonResponse(
            {
                "message": "Login successful",
                "access": str(access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user_id,
                    "name": name,
                    "email": user_email,
                    "role": role
                }
            },
            status=200
        )

    except Exception as e:

        return JsonResponse(
            {"error": str(e)},
            status=500
        )