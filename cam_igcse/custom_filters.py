from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter
def linebreaks_to_list_items(value):
    """
    Converts plain text with line breaks into a series of <li> tags.
    Strips initial/final whitespace from each line.
    """
    if not value:
        return ""
    
    # Split the text by line breaks
    lines = value.splitlines()
    
    # Filter out empty lines and wrap remaining lines in <li> tags
    list_items = [f"<li>{line.strip()}</li>" for line in lines if line.strip()]
    
    # Join the list items back into a single string
    return mark_safe('\n'.join(list_items))