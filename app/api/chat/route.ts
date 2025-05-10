import { NextRequest, NextResponse } from 'next/server';
import type { Message as VercelChatMessage } from 'ai';
import { createRAGChain } from '@/utils/ragChain';
import { HumanMessage, AIMessage, ChatMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { loadRetriever } from '../utils/vector_store';
import { loadEmbeddingsModel } from '../utils/embeddings';

export const runtime = 'edge';

const formatVercelMessages = (message: VercelChatMessage) => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const SYSTEM_PROMPT = `You are a helpful AI assistant that provides clear, well-structured, and detailed answers based on the provided PDF content.

When answering questions:
1. Use proper markdown formatting for better readability
2. Break down complex information into bullet points or numbered lists
3. Use headings (##) to organize different sections
4. Include relevant examples from the PDF when helpful
5. Keep responses concise but informative
6. Format code snippets with proper language tags (e.g. \`\`\`python)
7. Use tables when presenting structured data
8. Always maintain a professional and friendly tone

If you can't find relevant information in the PDF context to answer the question, politely explain that you can only answer questions based on the provided PDF content.

Context: {context}

Question: {question}

Please provide your answer in markdown format:`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedMessages = messages.map(formatVercelMessages);
    const chatId = body.chatId;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    // Initialize the model
    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      streaming: true,
    });

    // Initialize embeddings and retriever
    const embeddings = await loadEmbeddingsModel();
    const { retriever } = await loadRetriever({
      embeddings,
      chatId,
    });

    // Create RAG chain
    const chain = await createRAGChain(model, retriever);

    // Get the last message
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    if (!lastMessage) {
      throw new Error('No messages provided');
    }

    // Invoke the chain with the question
    const response = await chain.invoke({
      question: lastMessage.content,
    });

    // Process the response to handle newlines and remove unnecessary characters
    const processedResponse = response
      .replace(/\\n/g, '\n') // Replace \n with actual newlines
      .replace(/\\/g, '') // Remove remaining backslashes
      .trim();

    return new Response(processedResponse, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error: any) {
    console.error('Chat route error:', error);
    return new Response(
      `I apologize, but an error occurred: ${error.message}. Please try again.`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    );
  }
}
