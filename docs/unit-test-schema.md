# Unit test import schema

Poket School accepts a unit test as JSON or CSV. A DOCX can carry the same JSON: paste the object into the document, or export the document to text. The Content Builder reads `.json`, `.csv`, and `.docx` (the text of the Word file must contain this JSON or the CSV table).

Brand names in learner-facing copy stay **Poket School** and **ET AI**. Levels are Primary, Secondary, IGCSE, and A-Level.

## Pass mark

The course field `unitTestPassMark` defaults to **70**. A module can set `unitTestPassMark` to override that course mark. Leave the unit field empty to keep the course mark.

## JSON

```json
{
  "title": "Living things",
  "passMark": 70,
  "intelligence": "Logical-Mathematical",
  "versionA": [
    {
      "prompt": "Which process lets a plant make food?",
      "options": ["Digestion", "Photosynthesis"],
      "answer": "B",
      "marks": 2,
      "bloom": "Remember",
      "lessonId": "LESSON_ID_FROM_THE_MODULE",
      "explanation": "Plants make food by photosynthesis."
    }
  ],
  "versionB": [
    {
      "prompt": "Which organ pumps blood?",
      "options": ["Lung", "Heart"],
      "answer": "Heart",
      "marks": 3,
      "bloom": "Understand",
      "lessonId": "ANOTHER_LESSON_ID"
    }
  ]
}
```

`answer` may be a letter (`A`–`H`), the option text, or `opt:0` for the first option. `options` may also be `{ "id": "opt:0", "text": "..." }`. `bloom` is one of Remember, Understand, Apply, Analyse, Evaluate, Create. `lessonId` is the lesson a miss should send the learner back to. `marks` defaults to 1.

Version A is attempt 1. Version B is attempt 2. Further retakes alternate.

`intelligence` is optional: Linguistic, Logical-Mathematical, Spatial, Bodily-Kinaesthetic, Musical, Interpersonal, Intrapersonal, or Naturalistic.

## CSV

```csv
version,prompt,optionA,optionB,optionC,optionD,answer,marks,bloom,lessonId,explanation
A,"Which process lets a plant make food?",Digestion,Photosynthesis,,,B,2,Remember,LESSON_ID,Plants make food by photosynthesis.
B,"Which organ pumps blood?",Lung,Heart,,,Heart,3,Understand,LESSON_ID,
```

## What a fail does

The percentage is marks earned divided by marks available. Below the pass mark, the missed questions' `lessonId` values become **Review these lessons**. The unit test stays locked until each of those lessons is completed again. The next paper is the other version. A pass unlocks the next module. Lessons inside a module still unlock one after another.

Every attempt stores the score, each question result, the version, and the time.
