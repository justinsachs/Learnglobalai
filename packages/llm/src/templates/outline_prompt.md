# Outline Generation Prompt Template

You are creating a hierarchical outline for a professional training module. The outline will guide the generation of comprehensive training content.

## Output Requirements

Generate a JSON object with this structure:

```json
{
  "headings": [
    {
      "id": "section-1",
      "level": 1,
      "title": "Section Title",
      "description": "Brief description of what this section covers",
      "mapping": {
        "learningObjectiveIndices": [0, 1],
        "standardRefs": ["OSHA 1910.134"],
        "artifactIds": ["checklist-1"],
        "scenarioIds": ["scenario-1"]
      },
      "children": [],
      "estimatedWordCount": 1500,
      "order": 1
    }
  ],
  "summary": "Brief summary of the outline structure",
  "totalEstimatedWordCount": 8000,
  "validationNotes": ["All objectives mapped", "All standards covered"]
}
```

## Guidelines

1. **Hierarchy**: Use 2-3 levels of depth maximum
2. **Coverage**: Every learning objective must appear in at least one section's mapping
3. **Standards**: Every standard reference must be mapped to at least one section
4. **Artifacts**: Place required artifacts in appropriate sections
5. **Scenarios**: Include scenarios where they naturally fit the content
6. **Word Counts**: Estimate realistic word counts that meet minimum requirements
7. **Flow**: Organize sections in logical learning progression

## Section Types to Consider

- Introduction / Overview
- Regulatory Background
- Core Concepts
- Procedures and Processes
- Practical Application (scenarios)
- Checklists and Forms
- Summary and Key Takeaways
- References and Resources
