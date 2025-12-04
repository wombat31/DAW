# ~/mysite/report/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # Main form page (accessible at /report/)
    path('', views.report_home, name='report_home'),
    
    # AJAX endpoint for single report generation
    path('generate-report-single/', views.generate_report_single, name='generate_report_single'),
    
    # Placeholder for the class reporting feature (used in mypReport.html form action)
    path('process-class-report/', views.process_class_report, name='process_class_report'),
]