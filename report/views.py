import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .report_logic import get_report_sentence


def report_home(request):
    """Serves the main report writer HTML page (mypReport.html)."""
    return render(request, 'reports/mypReport.html')


@csrf_exempt
@require_http_methods(["POST"])
def generate_report_single(request):
    """
    Handles the AJAX POST request for generating a single report.
    Calculates strongest project(s) and passes them to the report logic.
    """
    try:
        data = json.loads(request.body)

        # 1. Extract student info
        student_name = data.get('student_name', 'The student')
        gender = data.get('gender', 'They')

        # 2. Determine pronouns
        if gender == "Boy":
            subject = "he"
            possessive = "his"
            objective = "him"
        elif gender == "Girl":
            subject = "she"
            possessive = "her"
            objective = "her"
        else:
            subject = "they"
            possessive = "their"
            objective = "them"

        # 3. Map levels safely
        grade_map = {"LOW": "LOW", "MID": "MID", "HIGH": "HIGH"}
        overall_level = data.get('overall_level')
        if overall_level not in grade_map:
            overall_level = "MID"

        skill_research_level = data.get('skill_research_level')
        if skill_research_level not in grade_map:
            skill_research_level = overall_level  # fallback to overall

        # 4. Determine strongest project(s)
        strongest_projects = []
        if 'projects' in data and data['projects']:
            # Calculate total score for each project
            scored_projects = []
            for project in data['projects']:
                total = sum([
                    v if isinstance(v, int) else 0
                    for k, v in project.items() if k.startswith("crit_")
                ])
                scored_projects.append((project.get("title", "Untitled"), total))
            # Find max score
            if scored_projects:
                max_score = max(score for _, score in scored_projects)
                # List all projects with max score
                strongest_projects = [title for title, score in scored_projects if score == max_score]

        # 5. Generate report text
        try:
            report_parts = [
                get_report_sentence("Opening_Statement", overall_level, student_name, subject, possessive, objective, strongest_projects),
                get_report_sentence("Skill_Research", skill_research_level, student_name, subject, possessive, objective, strongest_projects),
                get_report_sentence("Skill_Making", overall_level, student_name, subject, possessive, objective, strongest_projects),
                get_report_sentence("Skill_Evaluating", overall_level, student_name, subject, possessive, objective, strongest_projects),
                get_report_sentence("Closing_Statement", overall_level, student_name, subject, possessive, objective, strongest_projects)
            ]
        except Exception as e:
            print(f"Error in report_logic: {e}")
            return JsonResponse({'error': 'Failed to generate report. Check server logs.'}, status=200)

        # Join sentences into final paragraph
        final_report = " ".join(report_parts)

        return JsonResponse({'report_text': final_report})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format in request body.'}, status=400)
    except Exception as e:
        # General catch-all prevents 500
        print(f"Server Error in generate_report_single: {e}")
        return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=200)


@csrf_exempt
def process_class_report(request):
    """Placeholder for the future class report processing view."""
    return JsonResponse({'status': 'Functionality will be implemented here!'}, status=200)
