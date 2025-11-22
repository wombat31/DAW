import json
from rest_framework import viewsets, permissions
from .models import Project, MediaFile
from .serializers import ProjectSerializer, MediaFileSerializer
from .permissions import IsOwnerOrTeacherReadOnly
from django.contrib.auth.views import LogoutView as DjangoLogoutView
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView
from django.utils.decorators import method_decorator
from django.shortcuts import redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin
from .audio_utils import mixdown_project
from django.http import FileResponse
from django.views.generic.edit import CreateView
from django.urls import reverse_lazy
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

from django.conf import settings
from pathlib import Path


# -------------------------
# DRF ViewSets
# -------------------------
class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrTeacherReadOnly]

    # NOTE on Querysets:
    # 1. get_queryset is used for list views (GET /api/projects/).
    # 2. get_object is used for detail views (GET/PATCH/DELETE /api/projects/3/).
    #    By default, get_object uses the result of get_queryset.

    # We will define get_queryset for filtering the list view:
    def get_queryset(self):
        """
        Returns the queryset for the list view (GET /api/projects/)
        """
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.is_teacher:
            return Project.objects.all()
        # Students only see their own projects in the list
        return Project.objects.filter(owner=user)

    def get_object(self):
        """
        Returns the queryset for the detail view lookup (PATCH/GET/DELETE /api/projects/3/).
        This must return Project.objects.all() so DRF can find the object,
        and the permission_classes will enforce ownership.
        """
        queryset = Project.objects.all()
        # Perform the lookup using the default logic but on the full queryset
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        obj = get_object_or_404(queryset, **filter_kwargs)

        # Apply permission checking after the object is found (DRF's default behavior)
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class MediaFileViewSet(viewsets.ModelViewSet):
    serializer_class = MediaFileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrTeacherReadOnly]
    queryset = MediaFile.objects.all()

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.is_teacher:
            return MediaFile.objects.all()
        return MediaFile.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# -------------------------
# Home Page
# -------------------------
@method_decorator(login_required, name='dispatch')
class HomeView(TemplateView):
    template_name = 'home.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        context['is_teacher'] = getattr(getattr(user, 'profile', None), 'is_teacher', False)
        return context

    def post(self, request, *args, **kwargs):
        # Placeholder if you want to handle POST from home
        print("POST data received:", request.POST)
        return redirect('home')

# -------------------------
# Logout
# -------------------------
class LogoutViewGet(DjangoLogoutView):
    """
    GET-safe logout view for Django 5+
    """
    http_method_names = ["post", "options", "get"]
    next_page = '/login/'

    def get(self, request, *args, **kwargs):
        print("--- LogoutViewGet GET called ---")
        return self.post(request, *args, **kwargs)

# -------------------------
# Dashboard
# -------------------------
class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        context['is_teacher'] = getattr(getattr(user, 'profile', None), 'is_teacher', False)

        if context['is_teacher']:
            context['projects'] = Project.objects.all()
        else:
            context['projects'] = Project.objects.filter(owner=user)
        return context

# -------------------------
# DAW / Project View
# -------------------------
class ProjectDAWView(LoginRequiredMixin, TemplateView):
    template_name = "daw.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        project_id = self.kwargs['pk']
        # The permission check for view access is here:
        project = get_object_or_404(Project, pk=project_id)

        user = self.request.user
        if not getattr(user.profile, 'is_teacher', False) and project.owner != user:
            # Raise a proper 403 Forbidden error instead of a generic PermissionError
            # A client should not even be able to get this far if dashboard filtering is right.
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this project.")

        context['project'] = project

        # --- CRITICAL FIX 2: Use json.dumps() for valid JSON ---
        project_data = project.project_json

        # If project_json is empty, initialize with 4 tracks
        if not project_data:
            project_data = {"tracks": [{"clips": []} for _ in range(4)]}

        # Serialize the data into a valid JSON string with double quotes
        context['project_json'] = json.dumps(project_data)

        return context

# -------------------------
# Create New Project
# -------------------------
class CreateProjectView(LoginRequiredMixin, CreateView):
    model = Project
    fields = ['title']
    template_name = "create_project.html"

    def form_valid(self, form):
        form.instance.owner = self.request.user
        # Initialize 4 empty tracks
        form.instance.project_json = {"tracks": [{"clips": []} for _ in range(4)]}
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('project_daw', kwargs={'pk': self.object.pk})

# -------------------------
# Export / Mixdown
# -------------------------
def export_project(request, pk):
    project = get_object_or_404(Project, pk=pk)
    mp3_path = mixdown_project(project)
    return FileResponse(open(mp3_path, 'rb'), as_attachment=True, filename=f"{project.title}.mp3")

# ------------------------
# List available sound clips
# ------------------------


def effects_list(request):
    # Hardcode path to effects
    effects_dir = Path(settings.BASE_DIR) / "media" / "effects"  # <-- Correct folder
    clips = []

    if effects_dir.exists():
        for file in effects_dir.glob("*.mp3"):
            clips.append({
                "name": file.stem,
                "file": f"/media/effects/{file.name}"  # matches MEDIA_URL
            })

    else:
        print("Effects directory does not exist:", effects_dir)

    return JsonResponse(clips, safe=False)


from django.views import View
from django.contrib import messages


# -------------------------
# Delete Project
# -------------------------
class DeleteProjectView(LoginRequiredMixin, View):
    """
    Allow a student to delete their own project.
    Teachers cannot delete projects through this view (can be extended if needed).
    """
    def post(self, request, pk, *args, **kwargs):
        project = get_object_or_404(Project, pk=pk)

        # Only allow deletion if user is the owner and not a teacher
        if getattr(request.user.profile, 'is_teacher', False) or project.owner != request.user:
            messages.error(request, "You do not have permission to delete this project.")
            return redirect('dashboard')

        project.delete()
        messages.success(request, f"Project '{project.title}' has been deleted.")
        return redirect('dashboard')


###------------------------
# File upload function
### ------------------------
@login_required
@csrf_exempt
def upload_file(request):
    """
    Handle MP3 uploads - saves to MediaFile model with user ownership.
    Limited to 1 upload per student.
    """
    print("=== UPLOAD DEBUG ===")
    print(f"Method: {request.method}")
    print(f"User: {request.user}")
    print(f"Authenticated: {request.user.is_authenticated}")
    print(f"FILES: {request.FILES}")
    print(f"POST: {request.POST}")

    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid request method'}, status=400)

    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        print("ERROR: No file in request.FILES")
        return JsonResponse({'error': 'No file uploaded'}, status=400)

    # Check if student already has an upload (limit 1)
    is_teacher = getattr(getattr(request.user, 'profile', None), 'is_teacher', False)
    if not is_teacher:
        existing = MediaFile.objects.filter(owner=request.user).count()
        print(f"Existing uploads: {existing}")
        if existing >= 1:
            return JsonResponse({'error': 'Upload limit reached. Delete your existing file first.'}, status=400)

    filename = request.POST.get('filename', uploaded_file.name)
    print(f"Filename: {filename}")

    try:
        media_file = MediaFile.objects.create(
            owner=request.user,
            file=uploaded_file,
            filename=filename
        )
        print(f"Created MediaFile: {media_file.id}")

        return JsonResponse({
            'id': media_file.id,
            'filename': media_file.filename,
            'file_url': media_file.file.url,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
# --------------------------
# Get User's Uploaded Files (ADD this new view)
# --------------------------
@login_required
def user_uploads(request):
    """
    Return list of uploaded files for current user.
    Teachers see all uploads, students see only their own.
    """
    print("=== USER UPLOADS DEBUG ===")
    print(f"User: {request.user}")

    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    user = request.user
    is_teacher = getattr(getattr(user, 'profile', None), 'is_teacher', False)

    if is_teacher:
        files = MediaFile.objects.all().select_related('owner')
    else:
        files = MediaFile.objects.filter(owner=user)

    print(f"Found {files.count()} files")

    data = [{
        'id': f.id,
        'filename': f.filename,
        'file_url': f.file.url,
        'owner': f.owner.username,
    } for f in files]

    return JsonResponse(data, safe=False)

# --------------------------
# Delete a current user upload
# --------------------------
@csrf_exempt
def delete_upload(request, pk):
    """Delete an uploaded file. Only owner can delete."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Invalid method'}, status=400)

    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)

    try:
        media_file = MediaFile.objects.get(pk=pk)
    except MediaFile.DoesNotExist:
        return JsonResponse({'error': 'File not found'}, status=404)

    if media_file.owner != request.user:
        return JsonResponse({'error': 'Permission denied'}, status=403)

    media_file.file.delete(save=False)
    media_file.delete()
    return JsonResponse({'success': True})
