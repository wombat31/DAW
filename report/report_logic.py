import random

def get_report_sentence(section, level, student_name, pronoun, possessive, objective, strongest_projects=None):
    """
    Selects a report sentence based on section, performance level (LOW/MID/HIGH),
    and inserts the correct student name, pronouns, and optionally strongest projects.
    Randomly selects from 9 possible sentences per level.
    """

    # Dictionary of comments based on section and level
    COMMENT_DICTIONARY = {
        "Opening_Statement": {
            "HIGH": [
                "{student_name} excelled in Design this semester, showing remarkable creativity and initiative.",
                "Throughout the term, {student_name} consistently demonstrated a high level of skill in Design.",
                "The projects completed by {student_name} reflected superior understanding and innovation.",
                "{student_name} showed mastery of key design concepts with outstanding results.",
                "In all aspects of the Design cycle, {student_name} performed at a very high level.",
                "This semester, {student_name} consistently produced excellent work across all design tasks.",
                "With enthusiasm and dedication, {student_name} achieved exceptional outcomes.",
                "Overall, {student_name}'s performance in Design has been exemplary.",
                "{student_name}'s commitment and creativity in Design were truly impressive."
            ],
            "MID": [
                "{student_name} worked diligently and demonstrated a solid understanding of Design concepts.",
                "Overall, {student_name} completed the Design projects with competence and care.",
                "{student_name} made good progress this term, achieving the expected outcomes.",
                "The projects produced by {student_name} were satisfactory and met the basic criteria.",
                "{student_name} demonstrated consistent effort and engagement in Design activities.",
                "Throughout the term, {student_name} maintained a good level of performance.",
                "{student_name} showed developing understanding and skill in the design process.",
                "Overall, {student_name}'s progress in Design was solid and reliable.",
                "{student_name} met the learning objectives consistently, showing steady progress."
            ],
            "LOW": [
                "{student_name} faced challenges in Design this semester and requires additional support.",
                "Progress in Design has been limited for {student_name}, and more focus is needed.",
                "{student_name} struggled to meet expectations and would benefit from targeted guidance.",
                "The work submitted by {student_name} indicates difficulties in understanding core concepts.",
                "{student_name} needs to prioritize Design skills and time management in future tasks.",
                "Improvement in the Design cycle is necessary for {student_name} to reach expected standards.",
                "{student_name}'s engagement with Design has been inconsistent this term.",
                "Additional effort and support will help {student_name} better achieve Design objectives.",
                "Overall, {student_name} requires further development in understanding and applying Design concepts."
            ]
        },

        "Skill_Research": {
            "HIGH": [
                "{pronoun_cap} excelled at analyzing design problems and developing success criteria.",
                "Research and investigation by {student_name} demonstrated exceptional depth and clarity.",
                "{possessive_cap} inquiry skills were outstanding, consistently identifying clear problems and research criteria.",
                "{pronoun_cap} consistently used inquiry to produce high-quality solutions.",
                "{possessive_cap} ability to gather and interpret information was exemplary.",
                "The quality of {student_name}'s research and analysis was consistently high.",
                "{pronoun_cap} demonstrated advanced understanding in evaluating design challenges.",
                "In all research tasks, {student_name} showed high-level problem-solving and inquiry skills.",
                "Projects such as {strongest_projects} highlighted {possessive} research strengths."
            ],
            "MID": [
                "{pronoun_cap} showed good research skills, though there were some areas for deeper investigation.",
                "{student_name} applied inquiry skills effectively in most tasks, meeting expectations.",
                "Research and analysis were generally sound, with occasional gaps in depth or clarity.",
                "{possessive_cap} problem definition and investigation were satisfactory.",
                "{pronoun_cap} demonstrated a developing ability to plan and conduct research.",
                "Analysis and evaluation were appropriate, though there is room for improvement.",
                "{student_name} met most of the criteria for effective inquiry this term.",
                "{pronoun_cap} demonstrated consistent but moderate research skills.",
                "Overall, {student_name} achieved the expected standard in research tasks."
            ],
            "LOW": [
                "{possessive_cap} research skills require significant development.",
                "{pronoun_cap} often struggled to define problems and justify research methods.",
                "Investigation and analysis were limited, with inconsistencies in applying inquiry skills.",
                "{student_name} found it challenging to conduct thorough research.",
                "The quality of research and problem analysis was below expectations.",
                "{pronoun_cap} needs support to develop effective inquiry skills.",
                "Research planning and execution were inconsistent and required further guidance.",
                "{possessive_cap} ability to investigate and interpret data needs improvement.",
                "Overall, {student_name} requires focused development in research and inquiry."
            ]
        },

        "Skill_Making": {
            "HIGH": [
                "{pronoun_cap} demonstrated excellent technical skills and produced outstanding solutions.",
                "The solutions created by {student_name} were innovative and well-executed.",
                "{pronoun_cap} efficiently managed time and resources to produce high-quality work.",
                "{possessive_cap} design and making skills exceeded expectations this term.",
                "Projects by {student_name} reflected attention to detail and exceptional craftsmanship.",
                "{pronoun_cap} applied design principles creatively and effectively.",
                "The outcomes of {student_name}'s work were consistently impressive and thorough.",
                "Innovation and accuracy in {possessive_cap} making skills were notable strengths.",
                "{pronoun_cap} successfully integrated learning from research into practical solutions."
            ],
            "MID": [
                "Projects by {student_name} were functional and met basic requirements.",
                "{pronoun_cap} showed adequate technical skills and planning.",
                "{possessive_cap} making skills were competent, with room for further development.",
                "The solutions produced were acceptable but could be improved in detail and creativity.",
                "{pronoun_cap} applied design concepts appropriately, achieving satisfactory results.",
                "{student_name} demonstrated consistent but developing making skills.",
                "Execution of projects was generally sound, with minor gaps in precision or planning.",
                "Work was completed effectively but lacked refinement or innovation.",
                "{pronoun_cap} incorporated some of the strongest projects, like {strongest_projects}, effectively."
            ],
            "LOW": [
                "{pronoun_cap} struggled with implementing ideas into functional solutions.",
                "Projects often lacked structure and clear planning.",
                "{possessive_cap} technical skills need significant improvement.",
                "The quality of work submitted by {student_name} was below the expected standard.",
                "{pronoun_cap} experienced difficulties following the design process consistently.",
                "Execution of solutions was inconsistent and required further support.",
                "{possessive_cap} projects showed gaps in planning and organization.",
                "{student_name} needs focused guidance to improve making skills.",
                "Overall, {pronoun} requires development in effectively producing design solutions."
            ]
        },

        "Skill_Evaluating": {
            "HIGH": [
                "{pronoun_cap} evaluated design solutions effectively, showing deep understanding.",
                "Assessment and reflection by {student_name} were insightful and accurate.",
                "{possessive_cap} ability to evaluate outcomes and provide feedback was exemplary.",
                "Evaluation of projects was thorough and demonstrated critical thinking.",
                "{pronoun_cap} consistently identified strengths and areas for improvement.",
                "Analysis of results showed maturity and strong evaluative skills.",
                "{student_name} provided clear, well-justified evaluations.",
                "{possessive_cap} reflection on projects was highly effective.",
                "Overall, {pronoun_cap} demonstrated excellent skills in assessing and improving design outcomes."
            ],
            "MID": [
                "{pronoun_cap} evaluated projects adequately, though there is room for deeper reflection.",
                "Assessment of outcomes was generally correct, with minor gaps.",
                "{student_name} reflected on projects and identified some strengths and weaknesses.",
                "{possessive_cap} evaluative skills are developing steadily.",
                "{pronoun_cap} showed a satisfactory ability to critique and assess designs.",
                "Reflection on project outcomes was consistent but not fully in-depth.",
                "{student_name} met expectations in evaluating design solutions.",
                "{pronoun_cap} demonstrated developing skills in assessment and reflection.",
                "Overall, {student_name}'s evaluative skills were appropriate for the expected standard."
            ],
            "LOW": [
                "{pronoun_cap} needs significant development in evaluating design work.",
                "Assessment and reflection were limited and lacked clarity.",
                "{possessive_cap} ability to critique outcomes requires support.",
                "Evaluation of projects often missed key strengths and weaknesses.",
                "{student_name} struggled to provide meaningful reflections on design tasks.",
                "Analysis and feedback were inconsistent and underdeveloped.",
                "{pronoun_cap} requires guidance to improve evaluative skills.",
                "Project evaluations lacked depth and insight.",
                "Overall, {student_name} needs focused development in assessing and improving work."
            ]
        },

        "Closing_Statement": {
            "HIGH": [
                "Overall, {student_name} earned an excellent final grade and is encouraged to continue excelling in Design.",
                "{student_name} is commended for outstanding achievement and should build on this success.",
                "Moving forward, {pronoun_cap} is encouraged to pursue advanced design challenges.",
                "With sustained effort, {student_name} will continue to thrive in future Design projects.",
                "{pronoun_cap} should continue applying creativity and critical thinking to all design tasks.",
                "The excellent progress made by {student_name} sets a strong foundation for future learning.",
                "Continued innovation and dedication will allow {student_name} to achieve even higher outcomes.",
                "{pronoun_cap} has demonstrated mastery and is well-prepared for more complex design challenges.",
                "Overall, {student_name}'s accomplishments in Design are impressive and commendable."
            ],
            "MID": [
                "{student_name} is encouraged to continue developing Design skills and confidence.",
                "To improve further, {pronoun_cap} should focus on refining techniques and creativity.",
                "With continued effort, {student_name} will enhance outcomes in future projects.",
                "{pronoun_cap} should aim to build on strengths while addressing areas for improvement.",
                "Ongoing engagement with the design process will help {student_name} achieve higher levels.",
                "Focused practice and reflection will support {pronoun_cap} in developing greater mastery.",
                "{student_name} has shown steady progress and is encouraged to maintain consistent effort.",
                "Further development in key areas will help {pronoun_cap} produce stronger Design projects.",
                "Overall, {student_name} has met expectations and can improve through targeted practice."
            ],
            "LOW": [
                "{student_name} must focus on improving Design skills to meet expected standards.",
                "Additional guidance and effort are needed for {pronoun_cap} to progress effectively.",
                "Moving forward, {student_name} should prioritize organization, planning, and practice.",
                "{pronoun_cap} requires focused support to develop key competencies in Design.",
                "Further effort is required to meet learning objectives and produce quality work.",
                "{student_name} is encouraged to reflect on feedback and apply it consistently.",
                "Ongoing support and practice will help {pronoun_cap} achieve better results.",
                "Targeted development in specific skills is essential for {student_name} to succeed.",
                "Overall, {pronoun_cap} needs to build stronger habits and understanding in Design."
            ]
        }
    }

    # Pick a random sentence
    options = COMMENT_DICTIONARY.get(section, {}).get(level, COMMENT_DICTIONARY.get(section, {}).get("LOW", []))
    if not options:
        return "A comment could not be generated."

    sentence = random.choice(options)

    # Ensure pronouns are capitalized safely
    pronoun_cap = pronoun.capitalize() if pronoun in ["he", "she", "they"] else pronoun

    # Insert strongest_projects safely
    sentence = sentence.format(
        student_name=student_name,
        pronoun_cap=pronoun_cap,
        pronoun=pronoun,
        possessive=possessive,
        possessive_cap=possessive.capitalize() if possessive in ["his","her","their"] else possessive,
        objective=objective,
        strongest_projects=", ".join(strongest_projects) if isinstance(strongest_projects, list) else (strongest_projects or "")
    )

    return sentence
