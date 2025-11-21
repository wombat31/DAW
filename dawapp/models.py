from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid

def user_upload_path(instance, filename):
    # Upload path: media/projects/<user_id>/<project_uuid>/<filename>
    return f'projects/{instance.owner.id}/{instance.project_uuid}/{filename}'

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
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()