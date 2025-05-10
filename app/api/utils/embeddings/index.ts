import { OpenAIEmbeddings } from '@langchain/openai';
import { NextResponse } from 'next/server';

export async function loadEmbeddingsModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  try {
    const baseEmbeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-ada-002',
      maxRetries: 3,
      timeout: 60000,
      stripNewLines: true,
      maxConcurrency: 1, // Limit concurrent requests for Edge runtime
    });

    // Create a wrapper that pads the embeddings to 2048 dimensions
    const embeddings = {
      ...baseEmbeddings,
      embedQuery: async (text: string): Promise<number[]> => {
        const embedding = await baseEmbeddings.embedQuery(text);
        return [...embedding, ...Array(2048 - embedding.length).fill(0)];
      },
      embedDocuments: async (texts: string[]): Promise<number[][]> => {
        const embeddings = await baseEmbeddings.embedDocuments(texts);
        return embeddings.map(embedding => [...embedding, ...Array(2048 - embedding.length).fill(0)]);
      }
    };

    // Test the embeddings with a simple query
    try {
      console.log('Testing embeddings with OpenAI...');
      const result = await embeddings.embedQuery('test');
      console.log('Embeddings test successful');
      
      if (!result || result.length === 0) {
        throw new Error('Embeddings returned empty result');
      }
      
      // Validate the embedding dimensions
      if (result.length !== 2048) {
        throw new Error(`Unexpected embedding dimensions: ${result.length}. Expected 2048.`);
      }
    } catch (testError: any) {
      console.error('Embeddings test failed:', testError);
      
      if (testError.response?.status === 401 || testError.message?.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your API key and try again.');
      }
      
      if (testError.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later or upgrade your OpenAI plan.');
      }
      
      if (testError.code === 'ECONNREFUSED' || testError.code === 'ETIMEDOUT') {
        throw new Error('Failed to connect to OpenAI service. Please check your internet connection and try again.');
      }
      
      throw new Error(`Embeddings test failed: ${testError.message}`);
    }

    return embeddings;
  } catch (error: any) {
    console.error('Error initializing embeddings model:', error);
    throw new Error(`Failed to initialize embeddings model: ${error.message}`);
  }
}
