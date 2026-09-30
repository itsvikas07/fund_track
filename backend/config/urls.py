"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from accounts.auth_views import login, register
from accounts.views import (
    admin_list_users_api,
    admin_ngos_api,
    admin_system_info_api,
    admin_update_user_role_api,
    allocate_project_budget_api,
    audit_transactions_api,
    create_expense_api,
    create_project_api,
    get_project_api,
    ngo_balance_api,
    ngo_expenses_api,
    ngo_funds_api,
    ngo_profile_api,
    ngo_transactions_api,
    project_transactions_api,
    public_project_detail_api,
    public_projects_api,
    public_transactions_api,
    test_database,
    transaction_detail_api,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('test-db/', test_database),
    path('api/auth/register/', register),
    path('api/auth/login/', login),
    path('api/admin/users/', admin_list_users_api),
    path('api/admin/users/<int:user_id>/role/', admin_update_user_role_api),
    path('api/admin/ngos/', admin_ngos_api),
    path('api/admin/system/', admin_system_info_api),
    path('api/projects/', create_project_api),
    path('api/projects/<str:project_id>/', get_project_api),
    path('api/projects/<str:project_id>/expenses/', create_expense_api),
    path('api/projects/<str:project_id>/budget/', allocate_project_budget_api),
    path('api/projects/<str:project_id>/transactions/', project_transactions_api),
    path('api/transactions/<int:transaction_id>/', transaction_detail_api),
    path('api/audit/transactions/', audit_transactions_api),
    path('api/ngo/funds/', ngo_funds_api),
    path('api/ngo/expenses/', ngo_expenses_api),
    path('api/ngo/transactions/', ngo_transactions_api),
    path('api/ngo/balance/', ngo_balance_api),
    path('api/ngo/profile/', ngo_profile_api),
    path('api/public/projects/', public_projects_api),
    path('api/public/transactions/', public_transactions_api),
    path('api/public/projects/<str:project_id>/', public_project_detail_api),
]
