# /home/podcastmaker/mysite/blockbuilder/urls.py

from django.urls import path
from . import views


app_name = 'blockbuilder' 

urlpatterns = [
    # This URL pattern is now referenced as 'blockbuilder:builder_home'
    path('', views.builder_home, name='builder_home'),
]