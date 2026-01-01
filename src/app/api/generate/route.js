import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the schema for Jeopardy questions
const QuestionSchema = z.object({
  value: z.number(),
  question: z.string(),
  answer: z.string(),
});

const CategorySchema = z.object({
  name: z.string(),
  questions: z.array(QuestionSchema),
});

const JeopardyGameSchema = z.object({
  categories: z.array(CategorySchema),
});

export async function POST(request) {
  try {
    const { topics, numCategories = 6, questionsPerCategory = 5 } = await request.json();

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'Topics are required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const values = [200, 400, 600, 800, 1000].slice(0, questionsPerCategory);

    const prompt = `Generate a Jeopardy game with exactly ${numCategories} categories based on these topics: ${topics.join(', ')}.

Each category should have exactly ${questionsPerCategory} questions with values: ${values.join(', ')}.

Rules:
- Questions should be phrased as statements (the answer is what makes it a question, like "What is..." or "Who is...")
- Answers should be in the form of a question (e.g., "What is Paris?", "Who is Einstein?")
- Questions should increase in difficulty as the value increases
- Make questions interesting, fun, and appropriate for a group game
- Each category name should be creative and thematic
- If the topics are vague, be creative and make interesting categories

Topics to base categories on: ${topics.join(', ')}`;

    const response = await openai.responses.parse({
      model: 'gpt-5.2',
      input: [
        {
          role: 'system',
          content: 'You are a Jeopardy game show writer. Create engaging, fun, and accurate trivia questions. Always format answers as questions (e.g., "What is X?" or "Who is Y?").',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(JeopardyGameSchema, 'jeopardy_game'),
      },
    });

    const game = response.output_parsed;

    // Ensure each category has the correct values
    game.categories = game.categories.slice(0, numCategories).map(category => ({
      ...category,
      questions: category.questions.slice(0, questionsPerCategory).map((q, idx) => ({
        ...q,
        value: values[idx] || (idx + 1) * 200,
      })),
    }));

    return NextResponse.json(game);
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
