from django.shortcuts import render, get_object_or_404
from django.views import View
from .models import Module, Topic, Exercise, Material
from django.db.models import Prefetch

# --- Helper Query for Navbar and Dashboard ---
def get_all_modules_with_topics():
    """
    Fetches all Modules, prefetches their related Topics for efficiency.
    Used for the dashboard and the global navigation (all_modules context).
    """
    topics_prefetch = Prefetch(
        'topics',
        queryset=Topic.objects.all().order_by('order'),
        to_attr='topic_list' # Stores topics in 'topic_list' attribute
    )

    return Module.objects.all().prefetch_related(topics_prefetch).order_by('order')


# --- Views ---
class IGCSEDashboardView(View):
    def get(self, request, *args, **kwargs):
        all_modules_data = get_all_modules_with_topics()

        context = {
            'modules': all_modules_data,
            'course_name': 'Cambridge IGCSE Computer Science'
        }
        return render(request, 'cam_igcse/igcse_dashboard.html', context)


class ModuleDetailView(View):
    def get(self, request, module_slug, *args, **kwargs):
        # 1. Fetch the specific Module using the slug.
        # We prefetch topics here to avoid another query when rendering the topic list.
        module = get_object_or_404(
            Module.objects.prefetch_related('topics'),
            slug=module_slug
        )

        # 2. Fetch all modules for the navbar context.
        all_modules_data = get_all_modules_with_topics()

        context = {
            'module': module,
            'all_modules': all_modules_data, # for navbar
        }
        return render(request, 'learning/module_detail.html', context)


from django.views import View
from django.shortcuts import render, get_object_or_404
from django.db.models import Prefetch

# Assuming you have imported your models (Topic, Module, Exercise, Material)
# and the utility function get_all_modules_with_topics()

class TopicDetailView(View):
    def get(self, request, module_slug, topic_slug, *args, **kwargs):
        # Define prefetch for related data for efficiency
        exercise_prefetch = Prefetch(
            'exercises',
            queryset=Exercise.objects.all().order_by('order'),
            to_attr='exercise_list'
        )

        material_prefetch = Prefetch(
            'materials',
            queryset=Material.objects.all().order_by('order'),
            to_attr='download_list' # Renamed for template compatibility
        )

        # 1. Fetch the specific Topic
        topic = get_object_or_404(
            Topic.objects.select_related('module').prefetch_related(exercise_prefetch, material_prefetch),
            module__slug=module_slug,  # Ensures the topic belongs to the correct module
            slug=topic_slug
        )

        # 2. Fetch all modules for the navbar context.
        all_modules_data = get_all_modules_with_topics()

        # --- NAVIGATION LOGIC STARTS HERE ---

        # 3. Fetch all topics for the current module, ordered sequentially.
        #    NOTE: The default ordering in your Topic model's Meta class is CRITICAL here.
        all_topics = topic.module.topics.all()

        # Convert QuerySet to list for simple indexing
        topic_list = list(all_topics)

        previous_topic = None
        next_topic = None

        try:
            # 4. Find current topic's index and neighbors
            current_index = topic_list.index(topic)

            if current_index > 0:
                previous_topic = topic_list[current_index - 1]

            if current_index < len(topic_list) - 1:
                next_topic = topic_list[current_index + 1]

        except ValueError:
            # Should not happen if the topic was successfully retrieved
            pass

        # --- NAVIGATION LOGIC ENDS HERE ---

        context = {
            'module': topic.module,      # Use the module related to the topic
            'topic': topic,
            'all_modules': all_modules_data, # for navbar
            'previous_topic': previous_topic, # NEW
            'next_topic': next_topic,         # NEW
        }
        return render(request, 'learning/topic_detail.html', context)