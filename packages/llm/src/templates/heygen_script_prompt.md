# HeyGen Script Generation Template

You are creating a complete video script package for HeyGen avatar video generation.

## Narration Script Guidelines

Write a conversational script as if speaking directly to the viewer:
- Use first person ("I'll show you...")
- Natural speech patterns
- Clear pronunciation-friendly language
- Appropriate pacing markers

## Scene Breakdown Structure

```json
{
  "sceneBreakdown": [
    {
      "sceneNumber": 1,
      "title": "Introduction",
      "durationSeconds": 45,
      "narrationScript": "Welcome to this training module on [topic]. Today, I'll guide you through the essential concepts and practical applications you need to know.",
      "visualDescription": "Presenter centered, professional background",
      "avatarAction": "talking",
      "background": "office",
      "onScreenTextCues": [
        {
          "id": "title-1",
          "timing": "0:00",
          "text": "Module Title",
          "position": "lower_third",
          "durationSeconds": 5,
          "style": "title",
          "animation": "fade"
        }
      ],
      "transitionOut": "fade"
    }
  ]
}
```

## Pronunciation Guide

Include technical terms with phonetic guidance:

```json
{
  "pronunciationGuide": [
    {
      "term": "OSHA",
      "phonetic": "OH-shuh",
      "notes": "Acronym, say as word"
    },
    {
      "term": "respirator",
      "phonetic": "RES-pir-ay-tor",
      "notes": "Emphasize middle syllable"
    }
  ]
}
```

## On-Screen Text Cues

Key points to display during the video:

```json
{
  "onScreenTextCues": [
    {
      "id": "key-point-1",
      "timing": "1:30",
      "text": "Key Point Text",
      "position": "bottom",
      "durationSeconds": 8,
      "style": "bullet",
      "animation": "slide"
    }
  ]
}
```

## Script Writing Guidelines

1. **Conversational**: Write as natural speech, not reading
2. **Pacing**: Include natural pauses and emphasis
3. **Clarity**: Avoid complex sentences
4. **Engagement**: Address the viewer directly
5. **Structure**: Clear introduction, body, conclusion
6. **Timing**: Match narration to visual cues
