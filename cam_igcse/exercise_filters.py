#exercise_filters.py
from django import template

register = template.Library()

@register.filter
def filter_by_type(queryset, exercise_type):
    """Filters a queryset of Exercise objects by exercise_type."""
    if queryset:
        return queryset.filter(exercise_type=exercise_type)
    return queryset