import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Shield, RefreshCw, Hand } from 'lucide-react';
import { ChatInterface } from './components/ChatInterface';
import { CanvasEditor } from './components/CanvasEditor';
import { Button } from './components/Button';
import { AppStep, ChatMessage, AnalysisData, Rect } from './types';
import { MOCK_DATABASE, searchDatabase } from './services/mockDatabase';
import { estimateHiddenCharacters, analyzeLazyRedaction, generateEvidenceImage } from './utils/analysisUtils';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init',
  sender: 'ai',
  text: "INIT_SEQUENCE_STARTED...\nIdentity verified.\n\nI am your Digital Forensics Assistant. I can help you analyze redacted documents using artifact analysis and public directory cross-referencing.\n\nPlease upload a redacted document to begin.",
  timestamp: Date.now()
};

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [activeTool, setActiveTool] = useState<'redaction' | 'reference' | null>(null);
  
  const [analysisData, setAnalysisData] = useState<AnalysisData>({
    redactionRect: null,
    referenceRect: null,
    referenceText: '',
    imageWidth: 0,
    imageHeight: 0,
    estimatedHiddenChars: 0,
    lazyRedactionDetected: false,
    matchedProfiles: [],
    finalImageUrl: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to add AI message
  const addAiMessage = (text: string, delay = 500) => {
    setIsProcessing(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'ai',
        text,
        timestamp: Date.now()
      }]);
      setIsProcessing(false);
    }, delay);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
        setStep(AppStep.ANALYSIS_SETUP);
        addAiMessage("Document loaded into memory buffer.\n\nWe need to calibrate the font metrics.\n\n1. Select the 'Draw Redaction Box' tool and outline the blacked-out area.\n2. Then select 'Draw Reference Box' and outline a visible word with similar font size nearby.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRedactionDrawn = (rect: Rect) => {
    setAnalysisData(prev => ({ ...prev, redactionRect: rect }));
    
    // Check for lazy redaction immediately
    const canvas = document.querySelector('canvas');
    if (canvas) {
        const isLazy = analyzeLazyRedaction(canvas, rect);
        setAnalysisData(prev => ({ ...prev, lazyRedactionDetected: isLazy }));
        if (isLazy) {
             addAiMessage("ALERT: Artifacts detected in redaction region (Lazy Redaction). High probability of recoverable data remnants.", 800);
        } else {
             addAiMessage("Redaction target locked. Coordinates stored.", 300);
        }
    }
    // Automatically deselect tool after drawing for better mobile UX (optional, but good for workflow)
    // setActiveTool(null); 
  };

  const handleReferenceDrawn = (rect: Rect) => {
    setAnalysisData(prev => ({ ...prev, referenceRect: rect }));
    addAiMessage("Reference region captured.\n\nPlease type the EXACT word contained inside the green reference box into the console below so I can calculate the pixel-per-character ratio.");
    // setActiveTool(null);
  };

  const handleUserMessage = (text: string) => {
    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: Date.now()
    }]);

    // State Machine for Chat
    if (step === AppStep.ANALYSIS_SETUP && analysisData.referenceRect && analysisData.redactionRect) {
        // User is inputting the reference word
        runAnalysis(text);
    } else if (step === AppStep.REVIEW) {
        if (text.toLowerCase().includes('final') || text.toLowerCase().includes('yes')) {
            generateFinalOutput();
        } else {
            addAiMessage("Understood. Updating context. When you are ready for the evidence file, type 'Final Pass'.");
        }
    } else {
        // General fallback
        addAiMessage("Command received. Please follow the current protocol steps or upload a new document.");
    }
  };

  const runAnalysis = (referenceText: string) => {
    setStep(AppStep.ANALYSIS_RUNNING);
    setIsProcessing(true);

    const { redactionRect, referenceRect } = analysisData;
    if (!redactionRect || !referenceRect) return;

    // Simulate Calculation Delay
    setTimeout(() => {
        const estimatedChars = estimateHiddenCharacters(redactionRect.w, referenceRect.w, referenceText.length);
        const matches = searchDatabase(estimatedChars);
        
        setAnalysisData(prev => ({
            ...prev,
            referenceText,
            estimatedHiddenChars: estimatedChars,
            matchedProfiles: matches
        }));

        let report = `ANALYSIS COMPLETE.\n\nMetrics:\n- Reference Density: ${(referenceRect.w / referenceText.length).toFixed(2)} px/char\n- Redaction Width: ${redactionRect.w}px\n- Estimated Hidden Length: ${estimatedChars} characters`;
        
        if (analysisData.lazyRedactionDetected) {
            report += `\n- VULNERABILITY: Non-destructive redaction detected.`;
        }

        report += `\n\nDatabase Cross-Reference Results (${matches.length} matches found):\n`;
        matches.forEach((m, i) => {
            report += `${i+1}. ${m.name} [${m.role}]\n`;
        });

        report += `\nTop candidate: ${matches[0]?.name || 'UNKNOWN'}.\n\nShould I generate the final evidence file with this overlay?`;
        
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: 'ai',
            text: report,
            timestamp: Date.now()
        }]);
        
        setIsProcessing(false);
        setStep(AppStep.REVIEW);
    }, 1500);
  };

  const generateFinalOutput = () => {
      setStep(AppStep.FINAL);
      const canvas = document.querySelector('canvas');
      if (canvas && analysisData.matchedProfiles.length > 0 && analysisData.redactionRect) {
          const finalUrl = generateEvidenceImage(canvas, analysisData.redactionRect, analysisData.matchedProfiles[0]);
          setAnalysisData(prev => ({ ...prev, finalImageUrl: finalUrl }));
          addAiMessage("Evidence file generated successfully. You may download the file from the viewport.");
      }
  };

  const resetApp = () => {
      setStep(AppStep.UPLOAD);
      setImageSrc('');
      setMessages([INITIAL_MESSAGE]);
      setAnalysisData({
        redactionRect: null,
        referenceRect: null,
        referenceText: '',
        imageWidth: 0,
        imageHeight: 0,
        estimatedHiddenChars: 0,
        lazyRedactionDetected: false,
        matchedProfiles: [],
        finalImageUrl: null
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-screen bg-black text-gray-200 overflow-hidden">
      {/* Sidebar / Tools */}
      <div className="w-16 bg-osint-panel border-r border-osint-gray flex flex-col items-center py-4 space-y-4 z-10 shrink-0">
        <div className="w-10 h-10 rounded-full bg-osint-dark border border-osint-green flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-osint-green" />
        </div>
        
        {step !== AppStep.UPLOAD && step !== AppStep.FINAL && (
            <>
                <button 
                    onClick={() => setActiveTool(activeTool === 'redaction' ? null : 'redaction')}
                    className={`p-2 rounded transition-colors ${activeTool === 'redaction' ? 'bg-osint-alert text-black' : 'text-gray-400 hover:text-white'}`}
                    title="Draw Redaction Box (Toggle)"
                >
                    <div className="w-6 h-6 border-2 border-current bg-current opacity-50" />
                </button>
                <button 
                    onClick={() => setActiveTool(activeTool === 'reference' ? null : 'reference')}
                    className={`p-2 rounded transition-colors ${activeTool === 'reference' ? 'bg-osint-green text-black' : 'text-gray-400 hover:text-white'}`}
                    title="Draw Reference Box (Toggle)"
                >
                    <div className="w-6 h-6 border-2 border-current" />
                </button>
                <div className="w-8 border-t border-gray-700 my-2" />
                <button 
                    onClick={() => setActiveTool(null)}
                    className={`p-2 rounded transition-colors ${activeTool === null ? 'bg-osint-gray text-white border border-gray-500' : 'text-gray-400 hover:text-white'}`}
                    title="Pan / Move"
                >
                    <Hand className="w-6 h-6" />
                </button>
            </>
        )}

        <div className="flex-1" />
        <button onClick={resetApp} className="p-2 text-gray-500 hover:text-white">
            <RefreshCw className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-osint-dark border-b border-osint-gray flex items-center justify-between px-4 md:px-6 shrink-0">
            <h1 className="text-xl font-bold tracking-[0.2em] text-white truncate">UNDACTED <span className="text-osint-green text-sm">v1.0.4</span></h1>
            <div className="flex gap-4 shrink-0">
                {step === AppStep.UPLOAD && (
                    <Button onClick={() => fileInputRef.current?.click()} icon={<Upload className="w-4 h-4"/>}>
                        <span className="hidden md:inline">UPLOAD DOCUMENT</span>
                        <span className="md:hidden">UPLOAD</span>
                    </Button>
                )}
                {step === AppStep.FINAL && analysisData.finalImageUrl && (
                    <a href={analysisData.finalImageUrl} download="undacted_evidence.png">
                         <Button icon={<Download className="w-4 h-4"/>}>
                            <span className="hidden md:inline">DOWNLOAD EVIDENCE</span>
                            <span className="md:hidden">SAVE</span>
                        </Button>
                    </a>
                )}
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg"
            />
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Left: Canvas / Image Area */}
            <div className="flex-1 bg-black relative flex flex-col min-h-0 min-w-0">
                <CanvasEditor 
                    imageSrc={imageSrc}
                    activeTool={activeTool}
                    onRedactionDrawn={handleRedactionDrawn}
                    onReferenceDrawn={handleReferenceDrawn}
                    redactionRect={analysisData.redactionRect}
                    referenceRect={analysisData.referenceRect}
                    lazyRedactionDetected={analysisData.lazyRedactionDetected}
                    finalImageUrl={analysisData.finalImageUrl}
                />
            </div>

            {/* Right: Chat Interface */}
            {/* Mobile: Bottom (h-40%), Desktop: Right (w-96) */}
            <div className="w-full h-[40%] md:h-auto md:w-96 border-t md:border-t-0 md:border-l border-osint-gray flex flex-col shadow-2xl z-20 bg-osint-panel shrink-0">
                <ChatInterface 
                    messages={messages} 
                    onSendMessage={handleUserMessage}
                    isProcessing={isProcessing}
                />
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;