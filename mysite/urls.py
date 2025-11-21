# mysite/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.contrib.auth import views as auth_views

from dawapp.views import (
    LogoutViewGet,
    HomeView,
    DashboardView,
    ProjectDAWView,
    effects_list,  # Make sure this view is imported
)

urlpatterns = [
    path('', RedirectView.as_view(url='/home/', permanent=False)),  # redirect root to /home/
    path('home/', HomeView.as_view(), name='home'),
    path('admin/', admin.site.urls),

    # Include API URLs from app
    path('api/', include('dawapp.urls')),

    # Auth
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('logout/', LogoutViewGet.as_view(), name='logout'),

    # Dashboard / DAW
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('dashboard/<int:pk>/', ProjectDAWView.as_view(), name='project_daw'),

    # Effects API endpoint
    path('api/effects/', effects_list, name='effects_list'),  # matches JS fetch
]

# Serve media files in DEBUG mode
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
