import OpenAI from 'openai';

/**
 * Server-side OpenAI client configuration
 * This should NEVER be used on the client side
 */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  return new OpenAI({
    apiKey: apiKey,
  });
}

