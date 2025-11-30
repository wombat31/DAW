from django.urls import path
from .views import IGCSEDashboardView, ModuleDetailView, TopicDetailView

app_name = 'cam_igcse'

urlpatterns = [
    path('', IGCSEDashboardView.as_view(), name='dashboard'),
    path('module/<slug:module_slug>/', ModuleDetailView.as_view(), name='module_detail'),
    path('module/<slug:module_slug>/<slug:topic_slug>/', TopicDetailView.as_view(), name='topic_detail'),
]
