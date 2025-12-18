# student_igcse/urls.py

from django.urls import path
from .views import DashboardView, ModuleDetailView, TopicDetailView, complete_topic # <-- Import new view

app_name = 'student_igcse' 

urlpatterns = [
    # 1. Dashboard
    path('', DashboardView.as_view(), name='dashboard'), 
    
    # 2. Module Detail
    path('<slug:module_slug>/', ModuleDetailView.as_view(), name='module_detail'),
    
    # 3. Topic Completion Action (MUST be before Topic Detail to prevent matching error)
    path('<slug:module_slug>/<slug:topic_slug>/complete/', complete_topic, name='complete_topic'), 
    
    # 4. Topic Detail
    path('<slug:module_slug>/<slug:topic_slug>/', TopicDetailView.as_view(), name='topic_detail'),
]