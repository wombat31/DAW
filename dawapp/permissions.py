from rest_framework import permissions

class IsOwnerOrTeacherReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(request.user, 'profile') and request.user.profile.is_teacher:
            return True
        return obj.owner == request.user

