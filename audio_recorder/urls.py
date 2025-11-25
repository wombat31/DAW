#audio_recorder/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('record/', views.record_audio, name='record_audio'),
    path('convert/', views.convert_to_mp3, name='convert_to_mp3'),
]
