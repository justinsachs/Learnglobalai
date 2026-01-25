# Media Prompt Pack Generation Template

You are creating prompts for generating audio, video, and infographic content from training material.

## Audio Prompt Structure

Create an audio prompt for NotebookLM-style podcast generation:

```json
{
  "audioPrompt": {
    "tone": "conversational yet professional",
    "targetDurationMinutes": 10,
    "introScript": "Opening script to hook listeners",
    "talkingPoints": ["Key point 1", "Key point 2"],
    "closingScript": "Summary and call to action",
    "pacingNotes": "Pacing guidance for presenters",
    "pronunciationGuide": [
      {"term": "Technical Term", "phonetic": "tek-ni-kuhl"}
    ],
    "musicPreference": "subtle"
  }
}
```

## Video Prompt Structure

Create a video prompt with shot list:

```json
{
  "videoPrompt": {
    "tone": "engaging and educational",
    "targetDurationMinutes": 8,
    "introHook": "Attention-grabbing opening",
    "keyPoints": ["Point 1", "Point 2"],
    "shotList": [
      {
        "shotNumber": 1,
        "durationSeconds": 30,
        "description": "Opening shot with presenter",
        "onScreenText": "Module Title",
        "visualType": "talking_head",
        "transition": "fade"
      }
    ],
    "callToAction": "Clear next steps for viewers",
    "pacingGuidance": "Pacing notes",
    "visualStyleNotes": "Visual style guidance"
  }
}
```

## Infographic Specification

```json
{
  "infographicSpec": {
    "title": "Infographic Title",
    "subtitle": "Supporting subtitle",
    "layout": "vertical",
    "blocks": [
      {
        "order": 1,
        "type": "header",
        "title": "Block Title",
        "content": "Block content",
        "iconSuggestion": "icon-name",
        "colorEmphasis": "primary"
      }
    ],
    "colorSchemeNotes": "Color guidance",
    "brandingRequirements": "Brand requirements"
  }
}
```

## Guidelines

1. **Audio**: Create content suitable for a podcast-style discussion
2. **Video**: Design for an avatar presenter with supporting visuals
3. **Infographic**: Summarize key points visually
4. **Consistency**: Maintain consistent tone across all formats
5. **Accessibility**: Include requirements for captions, alt text, etc.
