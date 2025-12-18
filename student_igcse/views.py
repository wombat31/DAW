# student_igcse/views.py

from django.shortcuts import get_object_or_404, redirect
from django.views.generic import ListView, DetailView
from django.http import Http404 
from django.views.decorators.http import require_POST 
from django.contrib.auth.decorators import login_required 
from django.db import IntegrityError # Import for handling unique_together constraint

from .models import Module, Topic, UserProgress # <-- IMPORTANT: Import UserProgress
import markdown2 

# --- Helper Function for Basic Access Control ---
def check_module_access(request, module):
    if module.is_free:
        return True
    if request.user.is_authenticated:
        # TODO: Implement actual subscription/payment check here
        return True 
    return False

# -------------------------------------------------------------------
# A. Dashboard View (Lists all modules)
# -------------------------------------------------------------------
class DashboardView(ListView):
    model = Module
    template_name = 'student_igcse/dashboard.html'
    context_object_name = 'modules'
    
# -------------------------------------------------------------------
# B. Module Detail View (Lists topics and checks progress)
# -------------------------------------------------------------------
class ModuleDetailView(DetailView):
    model = Module
    template_name = 'student_igcse/module_detail.html'
    slug_url_kwarg = 'module_slug'
    context_object_name = 'module'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        module = self.get_object()
        
        if check_module_access(self.request, module):
            context['access_granted'] = True
            
            topics = module.topics.all().order_by('order')

            # 1. Get a list of completed Topic IDs for the current user
            if self.request.user.is_authenticated:
                # Optimized query: only fetch IDs for topics in this module
                completed_topic_ids = self.request.user.topic_progress.filter(
                    topic__module=module
                ).values_list('topic_id', flat=True)
                
                # Attach completion status to each topic object
                for topic in topics:
                    topic.is_completed = topic.id in completed_topic_ids
            else:
                for topic in topics:
                    topic.is_completed = False
                    
            context['topics'] = topics
        else:
             context['access_granted'] = False
             context['login_url'] = f"/login/?next={self.request.path}" 
             
        return context

# -------------------------------------------------------------------
# C. Topic Detail View (Displays content, applies Markdown)
# -------------------------------------------------------------------
class TopicDetailView(DetailView):
    model = Topic
    template_name = 'student_igcse/topic_detail.html'
    slug_url_kwarg = 'topic_slug'
    context_object_name = 'topic'

    def get_object(self, queryset=None):
        module_slug = self.kwargs.get('module_slug')
        topic_slug = self.kwargs.get('topic_slug')
        
        # Prefetch contents and related user progress (for the completion status check in template)
        return get_object_or_404(
            Topic.objects.select_related('module')
                         .prefetch_related('contents', 'user_progress'), 
            module__slug=module_slug,
            slug=topic_slug
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        topic = self.get_object()
        module = topic.module
        
        if check_module_access(self.request, module):
             context['access_granted'] = True
             
             content_list = []
             for item in topic.contents.all().order_by('order'):
                 
                 # MARKDOWN CONVERSION LOGIC
                 if item.content_type == 'notes':
                     rendered_content = markdown2.markdown(
                         item.content_data, 
                         extras=["fenced-code-blocks", "tables", "footnotes"]
                     )
                     item.content_data = rendered_content 
                     
                 content_list.append(item)
                 
             context['content'] = content_list

        else:
             context['access_granted'] = False
             context['content'] = []
             context['login_url'] = f"/login/?next={self.request.path}" 

        context['module'] = module
        context['flashcard_sets'] = topic.flashcard_sets.all()
        
        return context
        
# -------------------------------------------------------------------
# D. Topic Completion Handler (Action View)
# -------------------------------------------------------------------
@require_POST
@login_required
def complete_topic(request, module_slug, topic_slug):
    """Marks a topic as complete for the logged-in user."""
    
    try:
        topic = Topic.objects.get(module__slug=module_slug, slug=topic_slug)
    except Topic.DoesNotExist:
        raise Http404("Topic not found.") 
        
    # Check access before allowing completion
    if not check_module_access(request, topic.module):
        return redirect('student_igcse:module_detail', module_slug=module_slug) 

    # Create or get the UserProgress entry
    try:
        # Create a new record
        UserProgress.objects.create(user=request.user, topic=topic)
    except IntegrityError:
        # Already complete, no need to do anything
        pass
        
    # Redirect back to the module overview to see the checkmark
    return redirect('student_igcse:module_detail', module_slug=module_slug)