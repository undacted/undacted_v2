import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';
import { Send, Terminal } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-osint-panel">
      <div className="p-4 border-b border-osint-gray bg-osint-dark flex items-center">
        <Terminal className="w-5 h-5 text-osint-green mr-2" />
        <h2 className="text-osint-green font-bold tracking-wider">UNDACTED ANALYSIS LOG</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-sm ${
                msg.sender === 'user'
                  ? 'bg-osint-gray text-white border border-gray-500'
                  : 'bg-osint-black text-osint-green border border-osint-dim'
              }`}
            >
              {msg.sender === 'ai' && <span className="block text-xs text-osint-dim mb-1 opacity-70">SYSTEM &gt;</span>}
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-osint-black text-osint-green border border-osint-dim p-3 rounded-sm">
              <span className="animate-pulse">_ PROCESSING DATA STREAMS...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-osint-gray bg-osint-dark">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter command or response..."
            disabled={isProcessing}
            className="w-full bg-osint-black border border-osint-gray text-white px-4 py-3 pr-12 focus:outline-none focus:border-osint-green font-mono"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="absolute right-2 top-2 p-1 text-osint-dim hover:text-osint-green disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};