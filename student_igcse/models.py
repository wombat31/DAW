from django.db import models
from django.template.defaultfilters import slugify
from django.contrib.auth import get_user_model # Useful if you link progress later

User = get_user_model()

class Module(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=250)
    overview = models.TextField(help_text="A high-level description for the dashboard.")
    
    # Structure/Ordering
    order = models.PositiveSmallIntegerField(unique=True, help_text="The sequence number for the dashboard.") 
    
    # Subscription/Access
    is_free = models.BooleanField(default=False, help_text="Set to True for the first two modules.") 
    
    # Future Features (Placeholders)
    # The practice test will be associated with the module
    # end_of_module_test = models.ForeignKey('Quiz', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['order']
        verbose_name = "Course Module"

    def __str__(self):
        return f"M{self.order}: {self.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)
        
class Topic(models.Model):
    module = models.ForeignKey(
        Module, 
        on_delete=models.CASCADE, 
        related_name='topics', 
        help_text="The module this topic belongs to."
    )
    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=250)
    short_description = models.CharField(max_length=500)
    
    # Structure/Ordering
    order = models.PositiveSmallIntegerField(help_text="The sequence of the topic within the module.")

    class Meta:
        ordering = ['module', 'order']
        verbose_name = "Topic / Lesson"
        unique_together = ('module', 'slug') # Ensures unique URL path

    def __str__(self):
        return f"{self.module.title} - T{self.order}: {self.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            # Ensures the slug is unique *within* the module
            self.slug = slugify(self.title) 
        super().save(*args, **kwargs)
        
class TopicContent(models.Model):
    """Holds the specific materials for a topic, like notes or an interactive page."""
    
    # Defines the type of content stored in the 'content_data' field
    CONTENT_CHOICES = (
        ('notes', 'Student Notes (Rich Text)'),
        ('interactive', 'Interactive HTML/JS/CSS'),
        # ('video', 'Video Embed/Link'), # Future option
    )
    
    topic = models.ForeignKey(
        Topic, 
        on_delete=models.CASCADE, 
        related_name='contents',
        help_text="The topic this content belongs to."
    )
    title = models.CharField(max_length=200, help_text="e.g., 'Key Definitions' or 'Gas Laws Simulator'")
    content_type = models.CharField(max_length=20, choices=CONTENT_CHOICES)
    
    # The actual content storage. Use a TextField for both large notes (Markdown/HTML) 
    # and the full interactive code block.
    content_data = models.TextField(help_text="The raw content: notes (rich text) or the full interactive HTML/JS/CSS.")
    
    order = models.PositiveSmallIntegerField(help_text="The order of the content item on the topic page.")

    class Meta:
        ordering = ['topic', 'order']
        verbose_name = "Topic Content Item"

    def __str__(self):
        return f"{self.topic.title} - {self.title} ({self.get_content_type_display()})"

class UserProgress(models.Model):
    """Tracks which topics a user has completed."""
    
    # Links to the User model
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='topic_progress')
    
    # Links to the Topic model
    topic = models.ForeignKey('Topic', on_delete=models.CASCADE, related_name='user_progress')
    
    # Date/Time when the topic was completed
    completed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        # Ensures a user can only mark a topic complete once
        unique_together = ('user', 'topic') 
        verbose_name_plural = "User Progress"
        ordering = ['completed_at']

    def __str__(self):
        return f"{self.user.username} completed: {self.topic.title}"

        
class FlashcardSet(models.Model):
    """Placeholder for the flashcard app related to a topic or module."""
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, null=True, blank=True, related_name='flashcard_sets')
    module = models.ForeignKey(Module, on_delete=models.CASCADE, null=True, blank=True, related_name='flashcard_sets')
    title = models.CharField(max_length=200)
    
    # Future fields: e.g., 'question', 'answer' (in a separate Flashcard model)
    # ...

    def __str__(self):
        return f"Flashcard Set: {self.title}"

class Quiz(models.Model):
    """Placeholder for the multi-choice practice test."""
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=200)
    
    # Future fields: e.g., 'passing_score', 'time_limit'
    # ...

    def __str__(self):
        return f"Quiz: {self.title}"