#pixelmaker/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.pixel_designer_view, name='pixel_designer_view'),

]