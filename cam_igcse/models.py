from django.db import models
from django.utils.text import slugify

class Module(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Topic(models.Model):
    module = models.ForeignKey(Module, related_name='topics', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    short_description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=1)
    is_free = models.BooleanField(default=False)

    learning_objectives = models.TextField(blank=True)
    syllabus_snapshot = models.TextField(blank=True)
    spark_question = models.TextField(blank=True)
    teacher_presentation = models.TextField(blank=True)

    personalisation_secure = models.TextField(blank=True)
    personalisation_foundation = models.TextField(blank=True)
    personalisation_support = models.TextField(blank=True)

    class Meta:
        ordering = ['order']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.module.name} - {self.title}"

class Material(models.Model):
    MATERIAL_TYPE_CHOICES = [
        ('lesson_plan', 'Lesson Plan'),
        ('teaching_strategy', 'Teaching Strategy'),
        ('student_task', 'Student Task'),
        ('personalisation_support', 'Personalisation Support'),
    ]
    topic = models.ForeignKey(Topic, related_name='materials', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='learning_materials/')
    material_type = models.CharField(max_length=50, choices=MATERIAL_TYPE_CHOICES)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.topic.title} - {self.title}"

class Exercise(models.Model):
    EXERCISE_TYPE_CHOICES = [
        ('collaborative', 'Collaborative'),
        ('solo', 'Solo'),
        ('reflection', 'Reflection'),
    ]
    topic = models.ForeignKey(Topic, related_name='exercises', on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    exercise_type = models.CharField(max_length=20, choices=EXERCISE_TYPE_CHOICES)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.topic.title} - {self.title}"
