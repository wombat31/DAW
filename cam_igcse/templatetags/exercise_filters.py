from django import template

register = template.Library()

@register.filter
def filter_by_type(queryset, exercise_type):
    """
    Filters a QuerySet of Exercise objects by the exercise_type field.
    Usage: {% with solo_tasks=topic.exercises.all|filter_by_type:'solo' %}
    """
    if queryset is not None:
        return queryset.filter(exercise_type=exercise_type)
    return queryset