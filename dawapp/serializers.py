# serializers.py
from rest_framework import serializers
from .models import Project, MediaFile

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'title', 'project_json', 'owner']
        read_only_fields = ['owner']

class MediaFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaFile
        fields = ['id', 'name', 'file', 'owner']
        read_only_fields = ['owner']
