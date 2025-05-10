import { NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { loadEmbeddingsModel } from '../utils/embeddings';
import { loadVectorStore } from '../utils/vector_store';

export async function POST(request: Request) {
  let doc = null;

  try {
    console.log('Starting PDF ingestion process...');
    const { fileUrl, fileName } = await request.json();
    console.log('Received file:', { fileName, fileUrl });

    const { userId } = getAuth(request as any);
    console.log('User ID:', userId);

    if (!userId) {
      console.log('No user ID found');
      return NextResponse.json({ error: 'You must be logged in to ingest data' }, { status: 401 });
    }

    // Create the document first
    try {
      doc = await prisma.document.create({
        data: {
          fileName,
          fileUrl,
          userId,
        },
      });
      console.log('Document created in database:', doc);
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to create document in database');
    }

    /* load from remote pdf URL */
    console.log('Fetching PDF from URL...');
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error('Failed to fetch PDF:', response.status, response.statusText);
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    console.log('Converting PDF to blob...');
    const buffer = await response.blob();
    
    console.log('Loading PDF with PDFLoader...');
    const loader = new PDFLoader(buffer);
    const rawDocs = await loader.load();
    console.log('PDF loaded successfully, pages:', rawDocs.length);

    /* Split text into chunks */
    console.log('Splitting text into chunks...');
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", " ", ""],
    });
    
    const splitDocs = await textSplitter.splitDocuments(rawDocs);
    console.log('Text split into chunks:', splitDocs.length);

    for (const splitDoc of splitDocs) {
      splitDoc.metadata.docstore_document_id = doc.id;
    }

    console.log('Initializing embeddings model...');
    const embeddings = await loadEmbeddingsModel();

    console.log('Creating vector store...');
    const store = await loadVectorStore({
      namespace: doc.id,
      embeddings,
    });
    
    if (!store || !store.vectorStore) {
      throw new Error('Failed to create vector store');
    }

    console.log('Adding documents to vector store...');
    try {
      await store.vectorStore.addDocuments(splitDocs);
      console.log('Documents successfully added to vector store');
    } catch (error) {
      console.error('Error adding documents to vector store:', error);
      throw new Error(`Failed to add documents to vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      id: doc.id,
      message: 'Successfully embedded pdf'
    });

  } catch (error) {
    console.error('Error in PDF ingestion:', error);
    console.error('Full error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // If document was created but processing failed, clean it up
    if (doc?.id) {
      try {
        await prisma.document.delete({
          where: { id: doc.id }
        });
        console.log('Cleaned up failed document:', doc.id);
      } catch (deleteError) {
        console.error('Error cleaning up document:', deleteError);
      }
    }

    return NextResponse.json({ 
      error: 'Failed to process your PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
