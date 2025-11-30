# pixelmaker/views.py

from django.shortcuts import render



def pixel_designer_view(request):
    """
    Renders the main pixel art designer page.
    Requires user to be logged in.
    """
    # Renders the template located at pixelmaker/templates/pixelmaker/pixelmaker.html
    return render(request, 'pixelmaker/pixelmaker.html', {})