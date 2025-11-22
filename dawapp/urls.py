# dawapp/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import effects_list, upload_file, user_uploads, delete_upload

# DRF router for Projects and MediaFiles
router = DefaultRouter()
router.register(r'projects', views.ProjectViewSet, basename='projects')
router.register(r'mediafiles', views.MediaFileViewSet, basename='mediafiles')

urlpatterns = [
    path('', include(router.urls)),
    path('project/<int:pk>/', views.ProjectDAWView.as_view(), name='project_daw'),
    path('export/<int:pk>/', views.export_project, name='export_project'),
    path('project/new/', views.CreateProjectView.as_view(), name='create_project'),
    path('effects/', effects_list, name='effects_list'),
    path('media/upload/', upload_file, name='upload_file'),
    path('media/uploads/', user_uploads, name='user_uploads'),
    path('media/delete/<int:pk>/', delete_upload, name='delete_upload'),
]
