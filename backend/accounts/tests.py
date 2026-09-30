from django.test import RequestFactory, SimpleTestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.permissions import get_authenticated_user, require_role


class JWTAuthorizationTests(SimpleTestCase):
	def setUp(self):
		self.factory = RequestFactory()

	def make_request(self, role="ADMIN"):
		refresh = RefreshToken()
		refresh["user_id"] = 1
		refresh["role"] = role
		refresh["name"] = "Vikas"
		return self.factory.post(
			"/api/projects/",
			HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}",
		)

	def test_valid_access_token_uses_claims_without_orm_user(self):
		user = get_authenticated_user(self.make_request())

		self.assertEqual(
			user,
			{"user_id": 1, "role": "ADMIN", "name": "Vikas"},
		)

	def test_missing_token_is_not_authenticated(self):
		request = self.factory.post("/api/projects/")

		user, error = require_role(request, ["ADMIN"])

		self.assertIsNone(user)
		self.assertEqual(error, {"error": "Authentication required"})

	def test_disallowed_role_is_denied(self):
		user, error = require_role(self.make_request("PUBLIC_USER"), ["ADMIN"])

		self.assertIsNone(user)
		self.assertEqual(
			error,
			{"error": "You do not have permission to perform this action"},
		)


class NGOAuthorizationTests(SimpleTestCase):
	def test_ngo_endpoints_require_an_ngo_jwt(self):
		requests = (
			(self.client.get, "/api/ngo/profile/"),
			(self.client.post, "/api/ngo/funds/"),
			(self.client.post, "/api/ngo/expenses/"),
			(self.client.get, "/api/ngo/balance/"),
			(self.client.get, "/api/ngo/transactions/"),
		)

		for make_request, path in requests:
			with self.subTest(path=path):
				response = make_request(path)
				self.assertEqual(response.status_code, 403)
