// --- Helper Functions ---

/**
 * Collects and structures all relevant form data into a single object 
 * ready for the backend API call.
 * @param {HTMLFormElement} form - The form element.
 * @returns {Object} Structured data object.
 */
function collectFormData(form) {
    const data = {};
    const formData = new FormData(form);

    // 1. Basic Student Info
    data.student_name = formData.get('student_name') || 'Student';
    data.gender = formData.get('gender') || 'Boy'; // Default to Boy if missing
    data.myp_grade_level = formData.get('myp_grade_level') || '8'; // Default to MYP 8
    data.overall_myp_grade = formData.get('overall_myp_grade') || '4'; // Default to 4

    // 2. Project Details (up to 5 projects)
    data.projects = [];
    const CRITERIA = ['a', 'b', 'c', 'd'];
    
    for (let i = 1; i <= 5; i++) {
        const projectTitle = formData.get(`project_${i}_title`);
        const hasTitle = projectTitle && projectTitle !== `Project ${i}`;
        let hasScore = false;

        const project = {
            title: projectTitle || `Project ${i}`,
            crit_a: parseInt(formData.get(`crit_a_${i}`)) || null,
            crit_b: parseInt(formData.get(`crit_b_${i}`)) || null,
            crit_c: parseInt(formData.get(`crit_c_${i}`)) || null,
            crit_d: parseInt(formData.get(`crit_d_${i}`)) || null,
        };
        
        for (const crit of CRITERIA) {
            if (project[`crit_${crit}`] !== null) {
                hasScore = true;
                break;
            }
        }
        
        if (hasTitle || hasScore) {
            data.projects.push(project);
        }
    }
    
    return data;
}

// --- Main Form Handler ---
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('report-form');
    const outputField = document.getElementById('suggested_text');
    const copyButton = document.getElementById('copy-button');
    const copyMessage = document.getElementById('copy-message');

    form.addEventListener('submit', (e) => {
        e.preventDefault(); 
        
        const payload = collectFormData(form);

        // --- Map numeric overall_myp_grade to string levels ---
        const gradeMap = {1:"LOW",2:"LOW",3:"MID",4:"MID",5:"MID",6:"HIGH",7:"HIGH"};
        const overallGradeNumeric = parseInt(payload.overall_myp_grade) || 4;
        payload.overall_level = gradeMap[overallGradeNumeric] || "MID";
        payload.skill_research_level = gradeMap[overallGradeNumeric] || "MID";

        if (!payload.student_name || payload.projects.length === 0) {
            outputField.value = "Error: Please enter the student's name and at least one project score.";
            return;
        }

        const csrfToken = form.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
        outputField.value = "Generating report, please wait...";
        copyButton.disabled = true;

        fetch('/report/generate-report-single/', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (result.report_text) {
                let finalText = result.report_text;

                // Only include "Strongest projects" if 3 or more projects
                if (payload.projects.length >= 3) {
                    const sortedProjects = [...payload.projects].sort((a, b) => {
                        const sumA = (a.crit_a||0)+(a.crit_b||0)+(a.crit_c||0)+(a.crit_d||0);
                        const sumB = (b.crit_a||0)+(b.crit_b||0)+(b.crit_c||0)+(b.crit_d||0);
                        return sumB - sumA;
                    });
                    const topProjectTitles = sortedProjects.slice(0,2).map(p => p.title);
                    if (topProjectTitles.length > 0) {
                        finalText += ` Strongest projects include: ${topProjectTitles.join('& ')}.`;
                    }
                }

                outputField.value = finalText;
                copyButton.disabled = false;
            } else {
                outputField.value = `Error generating report: ${result.error || 'Unknown error'}. Check console for details.`;
                console.error("Server Error Details:", result.error);
            }
        })
        .catch(error => {
            console.error('Error generating report:', error);
            outputField.value = "Network error or server connection failed. See console for details.";
            copyButton.disabled = true;
        });
    });
    
    copyButton.addEventListener('click', () => {
        if (!outputField.value) return;

        outputField.select();
        outputField.setSelectionRange(0, 99999); 
        try {
            document.execCommand('copy');

            // Show copied message temporarily
            copyMessage.classList.remove('opacity-0');
            copyMessage.classList.add('opacity-100');
            setTimeout(() => {
                copyMessage.classList.remove('opacity-100');
                copyMessage.classList.add('opacity-0');
            }, 1500);

        } catch (err) {
            console.error('Could not copy text: ', err);
        }
    });
});
