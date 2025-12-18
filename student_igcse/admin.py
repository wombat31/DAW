# student_igcse/admin.py (CORRECTED)

from django.contrib import admin
from .models import Module, Topic, TopicContent, FlashcardSet, Quiz

# -----------------------------------------------------
# 1. Topic Content Inline
# -----------------------------------------------------
class TopicContentInline(admin.TabularInline):
    model = TopicContent
    extra = 3 
    fields = ('order', 'title', 'content_type', 'content_data')
    
# -----------------------------------------------------
# 2. Topic Inline (FIXED)
# -----------------------------------------------------
# Allows Topics to be edited directly on the Module's admin page
class TopicInline(admin.StackedInline):
    model = Topic
    extra = 1
    
    # *** FIX IS HERE ***
    # You MUST include 'slug' in the fields tuple so that prepopulated_fields 
    # can render the JS necessary for the slug to be created from the title.
    fields = ('order', 'title', 'short_description', 'slug') 
    
    prepopulated_fields = {'slug': ('title',)}

# -----------------------------------------------------
# 3. Module Admin
# -----------------------------------------------------
@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'order', 'is_free', 'get_topic_count')
    list_editable = ('order', 'is_free')
    prepopulated_fields = {'slug': ('title',)}
    search_fields = ('title', 'overview')
    inlines = [TopicInline] # Uses the fixed TopicInline

    @admin.display(description='Topics')
    def get_topic_count(self, obj):
        return obj.topics.count()

# -----------------------------------------------------
# 4. Topic Admin
# -----------------------------------------------------
@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    # This also needs to display the slug for manual editing/check
    list_display = ('title', 'module', 'order', 'slug') 
    list_filter = ('module',)
    search_fields = ('title', 'short_description')
    prepopulated_fields = {'slug': ('title',)}
    inlines = [TopicContentInline]

# -----------------------------------------------------
# 5. Register Standalone Models
# -----------------------------------------------------
@admin.register(TopicContent)
class TopicContentAdmin(admin.ModelAdmin):
    list_display = ('title', 'topic', 'content_type', 'order')
    list_filter = ('content_type', 'topic__module')
    
@admin.register(FlashcardSet)
class FlashcardSetAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'topic')
    list_filter = ('module', 'topic')

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'module')
    list_filter = ('module',)