from django.shortcuts import render
from django.views import View

# Hard-coded educator modules and topics
MODULES = [
    {
        'slug': 'module-1-data-representation',
        'name': 'Module 1: Data Representation',
        'description': 'Teacher resources for teaching binary, images, sound, and data storage.',
        'topics': [
            {
                'slug': 'number-systems',
                'title': 'Number Systems',
                'is_free': True,
                'short_description': 'Binary, decimal, and hexadecimal systems.',
                'objectives': [
                    'Understand decimal and binary systems',
                    'Convert between decimal and binary',
                    'Understand hexadecimal basics'
                ],
                'syllabus_reference': '1.1.1 Number Systems',
                'spark_question': 'How does a computer represent numbers internally?',
                'presentation': '<p>Teacher slides and notes here</p>',
                'collaborative_tasks': '<ul><li>Group task: Practice conversions</li></ul>',
                'solo_tasks': '<ul><li>Worksheet for individual practice</li></ul>',
                'reflection': '<p>Tips on common student misconceptions</p>',
                'personalisation': {
                    'secure': '<p>Challenge: Convert large numbers efficiently</p>',
                    'foundation': '<p>Extra guidance on basic conversions</p>',
                    'support': '<p>Step-by-step worked examples</p>'
                },
                'downloads': [
                    {'name': 'Number Systems Worksheet', 'url': '/media/worksheets/number_systems.pdf'}
                ]
            },
            {
                'slug': 'binary-arithmetic',
                'title': 'Binary Arithmetic',
                'is_free': True,
                'short_description': 'Addition and subtraction in binary.',
                'objectives': ['Learn binary addition', 'Learn binary subtraction'],
                'syllabus_reference': '1.1.2 Binary Arithmetic',
                'spark_question': 'Why does 1+1 in binary equal 10?',
                'presentation': '<p>Slides with examples</p>',
                'collaborative_tasks': '<ul><li>Group binary exercises</li></ul>',
                'solo_tasks': '<ul><li>Individual practice problems</li></ul>',
                'reflection': '<p>Points to highlight common mistakes</p>',
                'personalisation': {
                    'secure': '<p>Extend to 4-bit arithmetic</p>',
                    'foundation': '<p>Practice 2-bit addition</p>',
                    'support': '<p>Guided step-by-step exercises</p>'
                },
                'downloads': []
            }
        ]
    },
    {
        'slug': 'module-2-data-transmission',
        'name': 'Module 2: Data Transmission',
        'description': 'Teacher resources for networking, protocols, and data transfer.',
        'topics': [
            {
                'slug': 'network-basics',
                'title': 'Network Basics',
                'is_free': True,
                'short_description': 'Understanding LAN, WAN, and internet basics.',
                'objectives': ['Explain LAN vs WAN', 'Describe internet architecture'],
                'syllabus_reference': '2.1 Network Basics',
                'spark_question': 'How does data travel across networks?',
                'presentation': '<p>Slides on networking concepts</p>',
                'collaborative_tasks': '<ul><li>Classroom activity: Network mapping</li></ul>',
                'solo_tasks': '<ul><li>Worksheet: Network types</li></ul>',
                'reflection': '<p>Notes for teachers on misconceptions</p>',
                'personalisation': {
                    'secure': '<p>Include packet switching challenge</p>',
                    'foundation': '<p>Focus on LAN/WAN differences</p>',
                    'support': '<p>Provide diagrams and guided explanations</p>'
                },
                'downloads': []
            }
        ]
    }
]

# --- Views ---
class IGCSEDashboardView(View):
    def get(self, request, *args, **kwargs):
        context = {
            'modules': MODULES,
            'course_name': 'Cambridge IGCSE Computer Science'
        }
        return render(request, 'cam_igcse/igcse_dashboard.html', context)


class ModuleDetailView(View):
    def get(self, request, module_slug, *args, **kwargs):
        module = next((m for m in MODULES if m['slug'] == module_slug), None)
        if not module:
            return render(request, '404.html', status=404)
        context = {
            'module': module,
            'all_modules': MODULES  # for navbar
        }
        return render(request, 'learning/module_detail.html', context)


class TopicDetailView(View):
    def get(self, request, module_slug, topic_slug, *args, **kwargs):
        module = next((m for m in MODULES if m['slug'] == module_slug), None)
        if not module:
            return render(request, '404.html', status=404)

        topic = next((t for t in module['topics'] if t['slug'] == topic_slug), None)
        if not topic:
            return render(request, '404.html', status=404)

        context = {
            'module': module,
            'topic': topic,
            'all_modules': MODULES  # for navbar
        }
        return render(request, 'learning/topic_detail.html', context)
