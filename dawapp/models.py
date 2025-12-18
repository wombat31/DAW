from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

def user_upload_path(instance, filename):
    """
    FIXED: Upload to: media/uploads/user_<id>/<filename>
    We only return the relative path from the upload_to root.
    """
    # OLD: return f'uploads/user_{instance.owner.id}/{filename}'
    # NEW: Remove the 'uploads/' prefix to avoid the double nesting.
    return f'user_{instance.owner.id}/{filename}'

class Project(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    project_uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    # JSON data representing the tracks, clips, positions, volume, etc.
    project_json = models.JSONField(default=dict)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.owner.username})"

class MediaFile(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    file = models.FileField(upload_to=user_upload_path)
    filename = models.CharField(max_length=200)
    uploaded = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename} ({self.owner.username})"
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    is_teacher = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} Profile"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, raw=False, **kwargs):
    # Added 'raw=False' to the signature.
    # We skip profile creation if the object is being created (created=True)
    # AND it is coming from a fixture (raw=True).
    if created and not raw:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, raw=False, **kwargs):
    # Added 'raw=False' to the signature.
    # The 'instance.profile.save()' line can sometimes cause an issue when 'loaddata' is running,
    # as the profile object might not exist yet when the user is being loaded.
    # We skip this for fixture loading as well.
    if not raw:
        try:
            instance.profile.save()
        except Profile.DoesNotExist:
            # Handle the case where the profile doesn't exist yet (e.g., first run)
            # or if the user was loaded before its corresponding profile in the fixture.
            pass