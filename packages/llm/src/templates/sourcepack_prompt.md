# SourcePack Generation Prompt Template

You are creating comprehensive training content in FULL PROSE format. This content will be used for NotebookLM ingestion and LMS publishing.

## Critical Requirements

### NO OUTLINE FORMAT
- Do NOT use bullet points as the primary content structure
- Write in flowing, professional prose paragraphs
- Bullet points are ONLY allowed inside:
  - Explicitly marked checklists
  - Form field lists
  - Quick reference tables

### Full Prose Content
Each section must contain:
- Multiple complete paragraphs
- Professional, educational tone
- Clear explanations with examples
- Transitions between topics
- Minimum word counts must be met

## Output Format

Generate JSON with this structure for each section:

```json
{
  "id": "section-id",
  "level": 1,
  "heading": "Section Title",
  "fullProseText": "Complete prose paragraphs here. This should be substantial content written in a professional, educational style. Include explanations, examples, context, and transitions. The content should read like a professional training manual, not an outline or summary. Each paragraph should be well-developed with supporting details and clear explanations.\n\nContinue with additional paragraphs...",
  "embeddedScenarios": [
    {
      "scenarioId": "scenario-1",
      "title": "Workplace Scenario",
      "setting": "Description of the setting",
      "characters": [
        {"name": "Alex", "role": "Supervisor", "description": "Experienced team lead"}
      ],
      "dialogue": [
        {"speaker": "Alex", "role": "Supervisor", "text": "Dialogue line", "directions": "Stage direction"}
      ],
      "keyLearningPoints": ["Point 1", "Point 2"]
    }
  ],
  "embeddedChecklists": [
    {
      "artifactId": "checklist-1",
      "title": "Daily Inspection Checklist",
      "introduction": "Prose introduction explaining the checklist",
      "items": [
        {"order": 1, "text": "Check item", "isCritical": true, "notes": "Additional guidance"}
      ],
      "closingNotes": "Prose conclusion"
    }
  ],
  "traceability": [
    {
      "standardName": "OSHA 1910.134",
      "sectionRef": "Section 5.2",
      "howAddressed": "Description of how this section addresses the standard"
    }
  ],
  "wordCount": 1500
}
```

## Writing Guidelines

1. **Tone**: Professional, clear, educational
2. **Depth**: Provide thorough explanations, not summaries
3. **Examples**: Include real-world examples and applications
4. **Context**: Explain the "why" behind requirements
5. **Accessibility**: Use clear language appropriate for the target audience
6. **Engagement**: Use varied sentence structure and transitions
7. **Accuracy**: Ensure technical accuracy and compliance with standards
