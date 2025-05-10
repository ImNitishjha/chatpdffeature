import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { BaseRetriever } from '@langchain/core/retrievers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { formatDocumentsAsString } from 'langchain/util/document';

const TEMPLATE = `You are a helpful AI assistant that provides accurate answers based on the provided PDF content. Your primary goal is to find and present the exact information from the PDF that answers the user's question.

Important Instructions:
1. ALWAYS look for direct answers in the provided context first
2. If the exact answer exists in the PDF, quote it using ">" markdown syntax
3. If the answer requires combining information from multiple parts, clearly indicate this
4. If you can't find a direct answer, look for related information that might help
5. Never make up information - only use what's in the PDF
6. If you're unsure about something, be explicit about your uncertainty

Formatting Guidelines:
1. Use markdown for better readability
2. Use bullet points or numbered lists for multiple items
3. Use headings (##) to organize sections
4. Quote relevant PDF text using ">" markdown syntax
5. Keep responses clear and well-structured

Context from PDF:
{context}

Question: {question}

Please provide your answer, making sure to quote relevant parts of the PDF when possible:`;

export async function createRAGChain(
  model: BaseLanguageModel,
  retriever: BaseRetriever
) {
  const prompt = ChatPromptTemplate.fromTemplate(TEMPLATE);
  
  const chain = RunnableSequence.from([
    {
      context: async (input: { question: string }) => {
        const docs = await retriever.getRelevantDocuments(input.question);
        return formatDocumentsAsString(docs);
      },
      question: (input: { question: string }) => input.question,
    },
    prompt,
    model,
    new StringOutputParser(),
  ]);

  return chain;
}
