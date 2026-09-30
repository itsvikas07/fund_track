from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

def get_authenticated_user(request):
    """
    Validate the JWT token and return the user information
    stored inside the token payload.
    """
    jwt_auth = JWTAuthentication()
    try:
        # Properly validates token signature, expiration, and header
        validated_token = jwt_auth.get_validated_token(jwt_auth.get_raw_token(jwt_auth.get_header(request)))
        
        return {
            "user_id": validated_token.get("user_id"),
            "role": validated_token.get("role"),
            "name": validated_token.get("name")
        }
    except (InvalidToken, AuthenticationFailed, AttributeError):
        return None


def require_role(request, allowed_roles):
    """
    Check whether the request contains a valid JWT
    and whether the user's role is allowed.
    """
    user = get_authenticated_user(request)

    if user is None:
        return None, {
            "error": "Authentication required"
        }

    if user.get("role") not in allowed_roles:
        return None, {
            "error": "You do not have permission to perform this action"
        }

    return user, None