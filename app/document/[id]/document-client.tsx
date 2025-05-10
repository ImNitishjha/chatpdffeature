'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import type {
  ToolbarSlot,
  TransformToolbarSlot,
} from '@react-pdf-viewer/toolbar';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { Document } from '@prisma/client';
import Toggle from '@/components/ui/Toggle';
import type { Message } from 'ai';

export default function DocumentClient({
  currentDoc,
  userImage,
}: {
  currentDoc: Document;
  userImage?: string;
}) {
  const toolbarPluginInstance = toolbarPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { renderDefaultToolbar, Toolbar } = toolbarPluginInstance;

  const transform: TransformToolbarSlot = (slot: ToolbarSlot) => ({
    ...slot,
    Download: () => <></>,
    SwitchTheme: () => <></>,
    Open: () => <></>,
  });

  const chatId = currentDoc.id;
  const pdfUrl = currentDoc.fileUrl;

  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>
  >({});
  const [error, setError] = useState('');
  const [chatOnlyView, setChatOnlyView] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');

  // Custom submit handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      id: Date.now().toString(),
    };

    setIsLoading(true);
    setMessages(prev => [...prev, userMessage]);
    setInput(''); // Clear input after sending

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const text = await response.text();
      const assistantMessage: Message = {
        role: 'assistant',
        content: text,
        id: Date.now().toString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // Handle enter key
  const handleEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        const fakeEvent = new Event('submit') as unknown as React.FormEvent<HTMLFormElement>;
        handleSubmit(fakeEvent);
      }
    }
  };

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  let userProfilePic = userImage ? userImage : '/profile-icon.png';

  const extractSourcePageNumber = (source: {
    metadata: Record<string, any>;
  }) => {
    return source.metadata['loc.pageNumber'] ?? source.metadata.loc?.pageNumber;
  };
  return (
    <div className="flex flex-col min-h-screen">
      <Toggle chatOnlyView={chatOnlyView} setChatOnlyView={setChatOnlyView} />
      <div className="flex flex-1 lg:flex-row flex-col gap-4 p-4 h-[calc(100vh-100px)]">
        {/* Left hand side - PDF Viewer */}
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.js">
          <div
            className={`lg:w-1/2 w-full h-full flex flex-col ${
              chatOnlyView ? 'hidden' : 'flex'
            }`}
          >
            <div
              className="bg-[#eeeeee] flex p-1"
              style={{
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>
            </div>
            <div className="flex-1 overflow-auto">
              <Viewer
                fileUrl={pdfUrl as string}
                plugins={[toolbarPluginInstance, pageNavigationPluginInstance]}
              />
            </div>
          </div>
        </Worker>

        {/* Right hand side - Chat Interface */}
        <div className={`lg:w-1/2 w-full h-full flex flex-col`}>
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto bg-white border rounded-md">
            <div className="p-4">
              {messages.length === 0 && (
                <div className="flex justify-center items-center h-32 text-xl text-gray-500">
                  Ask your first question below!
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={`chatMessage-${index}`}
                  className={`mb-4 ${
                    message.role === 'assistant' ? 'bg-gray-50' : ''
                  } rounded-lg p-4`}
                >
                  <div className="flex items-start">
                    <Image
                      src={
                        message.role === 'assistant'
                          ? '/bot-icon.png'
                          : userProfilePic
                      }
                      alt="profile image"
                      width={30}
                      height={30}
                      className="mr-4 rounded-sm"
                      priority
                    />
                    <div className="flex-1">
                      <ReactMarkdown className="prose max-w-none">
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="mt-4">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                className="w-full p-3 pr-12 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                disabled={isLoading}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleEnter}
                ref={textAreaRef}
                placeholder={
                  isLoading ? 'Waiting for response...' : 'Ask me anything...'
                }
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-3 bottom-3 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                {isLoading ? (
                  <LoadingDots color="#000" style="small" />
                ) : (
                  <svg
                    viewBox="0 0 20 20"
                    className="w-6 h-6 transform rotate-90"
                    fill="currentColor"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </form>
          </div>

          {error && (
            <div className="mt-4 p-4 border border-red-400 rounded-md bg-red-50">
              <p className="text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
