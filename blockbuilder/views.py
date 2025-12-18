# blockbuilder/views.py
from django.shortcuts import render

def builder_home(request):
    """The main view for the block builder interface."""
    context = {
        'page_title': 'Block Builder',
        'intro_message': 'Start building your blocks below!',
    }
    return render(request, 'blockbuilder/builder_home.html', context)