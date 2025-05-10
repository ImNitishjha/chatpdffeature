import { Embeddings } from '@langchain/core/embeddings';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from '@langchain/core/documents';

export async function loadRetriever({
  embeddings,
  chatId,
}: {
  embeddings: Embeddings;
  chatId: string;
}) {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not set');
  }

  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('PINECONE_INDEX_NAME is not set');
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: chatId,
  });

  const retriever = vectorStore.asRetriever({
    k: 8,
    searchType: "similarity",
    
  });

  return { retriever };
}

// For document ingestion
export async function loadVectorStore({
  namespace,
  embeddings,
}: {
  namespace: string;
  embeddings: Embeddings;
}) {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not set');
  }

  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('PINECONE_INDEX_NAME is not set');
  }

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    // Initialize with an empty array of documents
    const vectorStore = await PineconeStore.fromDocuments(
      [],
      embeddings,
      {
        pineconeIndex,
        namespace,
      }
    );

    return { vectorStore };
  } catch (error) {
    console.error('Error creating vector store:', error);
    throw new Error(`Failed to create vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
