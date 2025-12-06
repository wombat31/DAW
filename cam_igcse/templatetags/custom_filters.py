from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter
def linebreaks_to_bulleted_text(value):
    """
    Converts plain text with line breaks into a series of paragraphs
    prefixed with a Unicode bullet (•). This bypasses CSS list-style issues.
    """
    if not value:
        return ""
    
    # Define the bullet and space prefix
    bullet_prefix = '<p class="pl-4 text-sm">•&nbsp;' 
    bullet_suffix = '</p>'
    
    lines = value.splitlines()
    
    # Filter out empty lines and wrap remaining lines in bulleted paragraphs
    bulleted_items = [f"{bullet_prefix}{line.strip()}{bullet_suffix}" for line in lines if line.strip()]
    
    return mark_safe('\n'.join(bulleted_items))