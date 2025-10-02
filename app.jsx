import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileUp, MessageSquare, Briefcase, ChevronRight, X, Clock, Target, Search, BarChart3, User, Mail, Phone, RefreshCw, AlertTriangle, Play, Pause, ListTodo } from 'lucide-react';

// --- CONFIGURATION CONSTANTS ---
const APP_NAME = "AI Interview Assistant";
const PERSIST_KEY = 'ai-interview-assistant-data';
const QUESTIONS_CONFIG = [
  { id: 1, difficulty: 'Easy', time: 20 },
  { id: 2, difficulty: 'Easy', time: 20 },
  { id: 3, difficulty: 'Medium', time: 60 },
  { id: 4, difficulty: 'Medium', time: 60 },
  { id: 5, difficulty: 'Hard', time: 120 },
  { id: 6, difficulty: 'Hard', time: 120 },
];

const INITIAL_CANDIDATE_STATE = {
  id: crypto.randomUUID(),
  name: '',
  email: '',
  phone: '',
  resumeFileName: '',
  status: 'UPLOAD', // UPLOAD, MISSING_INFO, INTERVIEWING, PAUSED, COMPLETED
  score: null, // Final calculated score
  summary: '', // Final AI summary
  currentQuestionIndex: 0, // 0 before first question is asked, 1 to 6 during interview
  timeRemaining: 0, // Timer for the current question
  history: [], // Stores both AI questions (with score) and user answers
};

// --- MOCK API FUNCTIONS (Replace with actual Gemini/OCR/Backend calls) ---

/**
 * Mocks resume parsing. In a real app, this would use the Gemini API (multimodal) or an OCR service.
 * @param {File} file
 * @returns {Promise<{ name: string, email: string, phone: string }>}
 */
const mockParseResume = async (file) => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay

  // Simple logic to simulate missing data based on filename for demo purposes
  const fileName = file.name.toLowerCase();
  let mockData = { name: 'Alex Johnson', email: 'alex@example.com', phone: '555-0101' };

  if (fileName.includes('missing')) {
    mockData = { name: 'Jamie Doe', email: 'jamie@example.com', phone: '' };
  } else if (fileName.includes('no-contact')) {
    mockData = { name: 'Chris Lee', email: '', phone: '' };
  }

  return mockData;
};

/**
 * Mocks AI question generation. Use the Gemini API here in the final version with a system instruction.
 * @param {string} difficulty - Easy, Medium, Hard
 * @returns {Promise<string>} The question text
 */
const mockGenerateQuestion = async (difficulty) => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
  const questions = {
    Easy: [
      "Explain the difference between state and props in React.",
      "What is event bubbling in JavaScript and how can you prevent it?"
    ],
    Medium: [
      "Describe the concept of 'lifting state up' in React and when you would use it.",
      "How do you secure a REST API built with Node.js/Express against common vulnerabilities like XSS and CSRF?"
    ],
    Hard: [
      "Design a scalable state management architecture for a large-scale e-commerce application using React and a context-based pattern.",
      "You notice a memory leak in your Node.js application. Detail the steps and tools you would use to diagnose and fix it."
    ],
  };
  const questionPool = questions[difficulty] || questions.Medium;
  return questionPool[Math.floor(Math.random() * questionPool.length)];
};

/**
 * Mocks AI answer evaluation and final summary generation. Use the Gemini API here with structured output (JSON schema).
 * @param {string} question - The question asked
 * @param {string} answer - The candidate's answer
 * @returns {Promise<{score: number, rationale: string}>}
 */
const mockScoreAnswer = async (question, answer) => {
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate scoring delay

    if (answer.includes('TIMEOUT')) {
        return { score: 0, rationale: 'Answer automatically submitted due to timeout.' };
    }

    // Simple heuristic for mock scoring
    const lengthScore = Math.min(100, 30 + (answer.length / 2));
    const randomAdjustment = Math.floor(Math.random() * 20) - 10;
    const finalScore = Math.min(95, Math.max(50, Math.round(lengthScore + randomAdjustment)));

    const rationale = `The response was generally ${finalScore > 80 ? 'strong and concise' : finalScore > 60 ? 'adequate but lacked depth' : 'brief or missed key points'}.`;

    return { score: finalScore, rationale };
};


/**
 * Mocks final AI summary generation.
 * @param {Array<Object>} history - Interview history
 * @returns {Promise<{finalScore: number, summary: string}>}
 */
const mockGenerateFinalReport = async (history) => {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

  const scoredAnswers = history.filter(h => h.role === 'ai' && h.score !== null);
  const totalScore = scoredAnswers.reduce((sum, q) => sum + q.score, 0);
  const finalScore = Math.round(totalScore / scoredAnswers.length);

  const strongAnswers = scoredAnswers.filter(q => q.score >= 80).length;
  const summary = `The candidate scored an average of ${finalScore}/100 across 6 questions. They demonstrated ${strongAnswers >= 3 ? 'strong mastery' : 'foundational understanding'} in technical areas. The timed nature of the interview resulted in ${scoredAnswers.filter(q => q.timeSpent < QUESTIONS_CONFIG[q.questionId - 1].time / 2).length} quick submissions, indicating confidence in some areas.`;

  return { finalScore, summary };
};

// --- HELPER COMPONENTS ---

const ChatMessage = ({ role, content, score, rationale }) => (
  <div className={`flex ${role === 'ai' ? 'justify-start' : 'justify-end'} mb-4`}>
    <div className={`max-w-[75%] p-3 rounded-xl shadow-md ${
      role === 'ai'
        ? 'bg-blue-100 text-gray-800 rounded-bl-none border border-blue-200'
        : 'bg-indigo-600 text-white rounded-br-none'
    }`}>
      <p className="text-xs font-medium opacity-80 mb-1">
        {role === 'ai' ? 'AI Interviewer' : 'You'}
      </p>
      <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>
      {score !== undefined && score !== null && (
        <div className="mt-2 pt-2 border-t border-white/20">
            <span className="text-xs font-bold">
                Score: <span className={score >= 80 ? 'text-green-300' : score >= 60 ? 'text-yellow-300' : 'text-red-300'}>
                    {score}/100
                </span>
            </span>
            {rationale && <p className="text-xs italic mt-1 opacity-75">{rationale}</p>}
        </div>
      )}
    </div>
  </div>
);

const LoadingIndicator = ({ text = "AI thinking..." }) => (
  <div className="flex justify-start items-center py-2">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
    <span className="ml-3 text-sm text-gray-500 italic">{text}</span>
  </div>
);

const ProgressBar = ({ current, total }) => {
  const percentage = (current / total) * 100;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

// --- INTERVIEWEE TAB COMPONENTS ---

const ResumeUploadStep = ({ onUpload, isProcessing }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      if (!uploadedFile.name.match(/\.(pdf|docx)$/i)) {
        setError('Invalid file type. Please upload a PDF or DOCX file.');
        setFile(null);
        return;
      }
      setError('');
      setFile(uploadedFile);
    }
  };

  const handleStart = () => {
    if (file) {
      setError('');
      onUpload(file);
    } else {
      setError('Please select a resume file first.');
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-2xl max-w-lg mx-auto mt-12 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <FileUp className="w-6 h-6 mr-2 text-indigo-600" />
        Start Your Interview
      </h2>
      <p className="text-gray-600 mb-6">
        Welcome! Please upload your resume (PDF or DOCX) to extract your details and begin the interview.
      </p>

      <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition duration-200 ${
        file ? 'border-green-400' : 'border-gray-300 hover:border-indigo-500'
      }`}
           onClick={() => !isProcessing && document.getElementById('resume-upload').click()}>
        <input
          type="file"
          id="resume-upload"
          accept=".pdf,.docx"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        {isProcessing ? (
          <LoadingIndicator text="Parsing Resume..." />
        ) : file ? (
          <p className="text-green-600 font-semibold">{file.name} uploaded successfully!</p>
        ) : (
          <div>
            <p className="text-gray-500">Drag & drop your resume here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">(PDF or DOCX required)</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      <button
        onClick={handleStart}
        disabled={!file || isProcessing}
        className="w-full mt-8 p-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition duration-200 disabled:bg-indigo-400 flex items-center justify-center"
      >
        {isProcessing ? 'Processing...' : 'Process Resume and Start Chat'}
      </button>
    </div>
  );
};

const MissingInfoStep = ({ candidate, onUpdateInfo }) => {
  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [phone, setPhone] = useState(candidate.phone);
  const [error, setError] = useState('');

  const requiredFields = useMemo(() => {
    const fields = [];
    // Only show fields that were originally empty after parsing
    if (!candidate.name) fields.push({ key: 'name', label: 'Full Name', state: name, setter: setName });
    if (!candidate.email) fields.push({ key: 'email', label: 'Email', state: email, setter: setEmail, type: 'email' });
    if (!candidate.phone) fields.push({ key: 'phone', label: 'Phone Number', state: phone, setter: setPhone, type: 'tel' });
    return fields;
  }, [candidate, name, email, phone]);

  const handleSubmit = () => {
    setError('');

    // Simple validation for newly entered fields
    if (requiredFields.find(f => !f.state.trim())) {
        return setError('Please fill in all required fields.');
    }

    onUpdateInfo({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-2xl max-w-lg mx-auto mt-12 border border-gray-100">
      <h2 className="text-2xl font-bold text-red-600 mb-4 flex items-center">
        <AlertTriangle className="w-6 h-6 mr-2" />
        Missing Information
      </h2>
      <p className="text-gray-700 mb-6">
        We couldn't extract the following required fields from your resume. Please provide them to start the interview.
      </p>
      <div className="space-y-4">
        {requiredFields.map(({ key, label, state, setter, type = 'text' }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
              type={type}
              value={state}
              onChange={(e) => setter(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      <button
        onClick={handleSubmit}
        className="w-full mt-6 p-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
      >
        Confirm and Start Interview
      </button>
    </div>
  );
};

const InterviewChat = ({ candidate, setCandidate, onInterviewComplete, onPause, isProcessing }) => {
  const [input, setInput] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const totalQuestions = QUESTIONS_CONFIG.length;
  const currentQuestionConfig = QUESTIONS_CONFIG[candidate.currentQuestionIndex - 1]; // Use index 0-5
  const isInterviewActive = candidate.status === 'INTERVIEWING' && candidate.currentQuestionIndex <= totalQuestions;
  const lastQuestion = candidate.history.findLast(h => h.role === 'ai' && h.questionId === candidate.currentQuestionIndex);
  const isQuestionPending = isInterviewActive && lastQuestion && lastQuestion.score === null;

  const getQuestionConfig = (index) => QUESTIONS_CONFIG[index];

  // --- Core Logic: Ask Question / Score Answer / Complete Interview ---

  const askNextQuestion = useCallback(async (nextIndex) => {
    if (nextIndex > totalQuestions) {
      // Interview Complete flow
      setIsScoring(true);
      const { finalScore, summary } = await mockGenerateFinalReport(candidate.history);
      setIsScoring(false);
      onInterviewComplete(finalScore, summary);
      return;
    }

    const nextConfig = getQuestionConfig(nextIndex - 1);
    setIsScoring(true);
    const questionText = await mockGenerateQuestion(nextConfig.difficulty);
    setIsScoring(false);

    const newQuestion = {
      role: 'ai',
      questionId: nextConfig.id,
      content: questionText,
      score: null,
      rationale: null,
      timeSpent: nextConfig.time, // This holds the max time limit initially
    };

    setCandidate(prev => ({
      ...prev,
      currentQuestionIndex: nextIndex,
      timeRemaining: nextConfig.time,
      history: [...prev.history, newQuestion]
    }));
  }, [candidate.history, totalQuestions, onInterviewComplete, setCandidate]);


  const handleSendMessage = useCallback(async (text, isTimeout = false) => {
    if (!text && !isTimeout) return;
    if (!isQuestionPending && !isTimeout) return; // Only process if a question is pending
    const answer = isTimeout ? text : input;

    // 1. Calculate time spent
    const timeSpent = currentQuestionConfig.time - candidate.timeRemaining;

    // 2. Prepare user message and update AI question
    const { score, rationale } = await mockScoreAnswer(currentQuestionConfig.content, answer);

    const userMessage = {
      role: 'user',
      content: answer,
      questionId: currentQuestionConfig.id,
      timeSpent: timeSpent,
    };

    // Update the last AI question with the score and rationale
    const updatedHistory = candidate.history.map(h => {
        if (h.role === 'ai' && h.questionId === currentQuestionConfig.id && h.score === null) {
            return {
                ...h,
                score: score,
                rationale: rationale,
                timeSpent: timeSpent, // Time taken to answer
            };
        }
        return h;
    });

    // 3. Update state and reset input/timer
    setCandidate(prev => ({
      ...prev,
      history: [...updatedHistory, userMessage],
      timeRemaining: 0,
    }));

    setInput('');
    setIsScoring(true);

    // 4. Ask the next question after scoring
    await askNextQuestion(currentQuestionConfig.id + 1);
    setIsScoring(false);

  }, [candidate.history, candidate.timeRemaining, currentQuestionConfig, input, isQuestionPending, setCandidate, askNextQuestion]);


  // --- Timer Logic (Timeout is handled here) ---
  useEffect(() => {
    if (candidate.status !== 'INTERVIEWING' || !isQuestionPending || isScoring || candidate.currentQuestionIndex > totalQuestions) {
      return;
    }

    const interval = setInterval(() => {
        setCandidate(prev => {
            if (prev.timeRemaining <= 1) {
                clearInterval(interval);
                // Trigger timeout submission
                handleSendMessage('TIMEOUT: No answer submitted.', true);
                return { ...prev, timeRemaining: 0 };
            }
            return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
    }, 1000);

    return () => clearInterval(interval); // Cleanup interval on unmount or dependency change
  }, [candidate.status, candidate.timeRemaining, candidate.currentQuestionIndex, isQuestionPending, isScoring, totalQuestions, handleSendMessage, setCandidate]);


  // --- Initial Question Load ---
  useEffect(() => {
    // Status is INTERVIEWING, and no questions have been asked yet (history is only the welcome message)
    if (candidate.status === 'INTERVIEWING' && candidate.currentQuestionIndex === 1 && candidate.history.filter(h => h.role === 'ai' && h.questionId > 0).length === 0) {
      askNextQuestion(1);
    }
  }, [candidate.status, candidate.currentQuestionIndex, candidate.history.length, askNextQuestion]);


  const isInputDisabled = !isQuestionPending || isScoring || candidate.status !== 'INTERVIEWING';

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl border border-gray-100 p-4">
      <div className="flex justify-between items-center p-3 border-b border-gray-200">
        <div className='flex items-center'>
            <Target className="w-5 h-5 mr-2 text-indigo-600" />
            <span className="text-md font-semibold text-gray-700">
                Question {candidate.currentQuestionIndex > totalQuestions ? totalQuestions : candidate.currentQuestionIndex} / {totalQuestions}
            </span>
            <span className={`ml-4 px-3 py-1 text-xs font-bold rounded-full text-white ${
                currentQuestionConfig?.difficulty === 'Easy' ? 'bg-green-500' :
                currentQuestionConfig?.difficulty === 'Medium' ? 'bg-yellow-500' : currentQuestionConfig?.difficulty === 'Hard' ? 'bg-red-500' : 'bg-gray-500'
            }`}>
                {currentQuestionConfig?.difficulty || 'N/A'}
            </span>
        </div>
        <div className="flex items-center">
          <Clock className="w-5 h-5 mr-2 text-red-500" />
          <span className="text-lg font-bold text-red-600 min-w-[50px] text-right">
            {isQuestionPending ? `${candidate.timeRemaining}s` : '--'}
          </span>
          <button
            onClick={onPause}
            disabled={!isQuestionPending}
            className="ml-4 p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition disabled:opacity-50"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <ProgressBar current={candidate.currentQuestionIndex > totalQuestions ? totalQuestions : candidate.currentQuestionIndex - 1} total={totalQuestions} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {candidate.history.map((msg, index) => (
          <ChatMessage key={index} {...msg} />
        ))}
        {isScoring && <LoadingIndicator text="AI Scoring Answer..." />}
        {candidate.status === 'COMPLETED' && (
             <div className="p-4 bg-green-100 rounded-lg text-center text-green-700 font-semibold mt-4">
                Interview Completed! Final score and summary are available on the Interviewer Dashboard.
            </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && e.preventDefault() && !isInputDisabled && input.trim() && handleSendMessage(input)}
            placeholder={candidate.status === 'COMPLETED' ? 'Interview finished.' : (isInputDisabled ? 'Waiting for AI question...' : 'Type your answer here... (Shift+Enter for new line)')}
            disabled={isInputDisabled}
            rows={2}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 resize-none"
          />
          <button
            onClick={() => handleSendMessage(input)}
            disabled={isInputDisabled || !input.trim()}
            className="p-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-indigo-400"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// --- INTERVIEWER TAB COMPONENTS ---

const InterviewerDashboard = ({ candidates, onViewDetails, onClearData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  const completedCandidates = candidates.filter(c => c.status === 'COMPLETED');

  const filteredCandidates = useMemo(() => {
    return completedCandidates
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        let valA = a[sortBy] || 0;
        let valB = b[sortBy] || 0;

        if (sortBy === 'score') {
          return sortOrder === 'desc' ? valB - valA : valA - valB;
        }
        // Sort by name/email alphabetically
        return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
  }, [completedCandidates, searchTerm, sortBy, sortOrder]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder(key === 'score' ? 'desc' : 'asc'); // Default descending for score
    }
  };

  const getSortIcon = (key) => {
    if (sortBy !== key) return <ListTodo className='w-4 h-4 ml-1 opacity-50'/>;
    return sortOrder === 'asc' ? <span className='ml-1'>▲</span> : <span className='ml-1'>▼</span>;
  };

  if (completedCandidates.length === 0) {
    return (
      <div className="p-12 bg-white rounded-xl shadow-2xl max-w-lg mx-auto mt-12 text-center border border-gray-100">
        <BarChart3 className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800">No Completed Interviews</h2>
        <p className="text-gray-600 mt-2">Completed interview data will appear here after a candidate finishes their 6 questions.</p>
        <button
            onClick={() => window.confirm("Are you sure you want to clear ALL app data (current and completed candidates)?") && onClearData()}
            className="mt-6 p-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            Clear All App Data
          </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-2xl border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Briefcase className="w-6 h-6 mr-2 text-indigo-600" />
          Interviewer Dashboard
        </h2>
        <button
            onClick={() => window.confirm("Are you sure you want to clear ALL app data (current and completed candidates)?") && onClearData()}
            className="p-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            <RefreshCw className='w-4 h-4 inline mr-1'/> Clear All App Data
          </button>
      </div>

      <div className="mb-4 flex space-x-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {['name', 'email', 'score'].map((key) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition flex items-center"
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)} {getSortIcon(key)}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCandidates.map((c) => (
              <tr key={c.id} className="hover:bg-indigo-50 transition">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                  <span className={c.score >= 80 ? 'text-green-600' : c.score >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                    {c.score}/100
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onViewDetails(c.id)}
                    className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end"
                  >
                    View Details <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredCandidates.length === 0 && searchTerm && (
        <p className="text-center text-gray-500 mt-4">No candidates found matching "{searchTerm}".</p>
      )}
    </div>
  );
};

const CandidateDetailView = ({ candidate, onBack }) => {
  const interviewHistory = candidate.history.filter(h => h.role === 'ai' || h.role === 'user');

  return (
  <div className="p-6 bg-white rounded-xl shadow-2xl border border-gray-100 h-full flex flex-col">
    <div className="flex justify-between items-center border-b pb-4 mb-4">
      <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 flex items-center font-medium">
        &larr; Back to Dashboard
      </button>
      <h2 className="text-2xl font-bold text-gray-800">{candidate.name}'s Interview Report</h2>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div className="p-4 bg-indigo-50 rounded-lg">
        <div className="font-semibold text-indigo-700 flex items-center"><User className='w-4 h-4 mr-2'/> Candidate Name:</div>
        <p className="text-gray-800 font-medium">{candidate.name}</p>
      </div>
      <div className="p-4 bg-indigo-50 rounded-lg">
        <div className="font-semibold text-indigo-700 flex items-center"><Mail className='w-4 h-4 mr-2'/> Email:</div>
        <p className="text-gray-800 font-medium">{candidate.email}</p>
      </div>
      <div className="p-4 bg-indigo-50 rounded-lg">
        <div className="font-semibold text-indigo-700 flex items-center"><BarChart3 className='w-4 h-4 mr-2'/> Final Score:</div>
        <p className={`text-2xl font-bold ${candidate.score >= 80 ? 'text-green-600' : candidate.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
          {candidate.score}/100
        </p>
      </div>
    </div>

    <h3 className="text-xl font-bold text-gray-800 mt-4 mb-3 border-b pb-2">AI Summary</h3>
    <p className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-700 italic">
      {candidate.summary}
    </p>

    <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3 border-b pb-2">Full Chat History</h3>
    <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar">
      {/* Group AI question and User answer */}
      {interviewHistory.map((msg, index) => {
        if (msg.role === 'ai') {
          // Find the subsequent user answer
          const userAnswer = interviewHistory[index + 1] && interviewHistory[index + 1].role === 'user' ? interviewHistory[index + 1] : null;

          return (
            <div key={msg.questionId} className="border-b border-gray-200 pb-4 mb-4">
              <div className="text-sm font-semibold text-indigo-700 mb-2">
                Q{msg.questionId}. {QUESTIONS_CONFIG[msg.questionId - 1].difficulty} ({QUESTIONS_CONFIG[msg.questionId - 1].time}s Limit)
              </div>
              <ChatMessage {...msg} rationale={msg.rationale} />
              {userAnswer && (
                  <>
                      <ChatMessage {...userAnswer} />
                      <div className="text-xs text-right text-gray-500 mt-[-10px] pr-2">
                        Time to Answer: {userAnswer.timeSpent}s
                      </div>
                  </>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  </div>
)};


// --- WELCOME BACK MODAL ---
const WelcomeBackModal = ({ candidate, onResume, onNewInterview }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm w-full text-center">
        <RefreshCw className="w-10 h-10 text-indigo-600 mx-auto mb-4 animate-spin-slow" />
        <h2 className="text-xl font-bold mb-2">Welcome Back, {candidate.name || 'Candidate'}!</h2>
        <p className="text-gray-600 mb-6">
          You have an unfinished interview session from Q{candidate.currentQuestionIndex}. Do you want to continue or start a new one?
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={onNewInterview}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            Start New
          </button>
          <button
            onClick={onResume}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition flex items-center"
          >
            <Play className='w-4 h-4 mr-2'/> Resume Interview
          </button>
        </div>
      </div>
    </div>
);


// --- MAIN APP COMPONENT ---

const App = () => {
  const [activeTab, setActiveTab] = useState('interviewee'); // 'interviewee' or 'interviewer'
  const [candidate, setCandidate] = useState(INITIAL_CANDIDATE_STATE);
  const [allCandidates, setAllCandidates] = useState([]);
  const [showWelcomeBackModal, setShowWelcomeBackModal] = useState(false);
  const [detailedCandidateId, setDetailedCandidateId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);


  // --- Persistence Logic (Load State on Mount) ---
  useEffect(() => {
    try {
      const persistedState = localStorage.getItem(PERSIST_KEY);
      if (persistedState) {
        const { currentCandidate, completedCandidates } = JSON.parse(persistedState);
        setAllCandidates(completedCandidates || []);

        if (currentCandidate) {
            setCandidate(currentCandidate);
            // Show modal if session was in progress (INTERVIEWING status means it was paused or page closed mid-question)
            if (currentCandidate.status === 'PAUSED' || (currentCandidate.status === 'INTERVIEWING' && currentCandidate.history.length > 1)) {
                setShowWelcomeBackModal(true);
                // Immediately set status to paused if it was INTERVIEWING mid-question to stop the timer on load
                if (currentCandidate.status === 'INTERVIEWING') {
                     setCandidate(prev => ({ ...prev, status: 'PAUSED' }));
                }
            }
        }
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
    }
  }, []);

  // --- Persistence Logic (Save State on Change) ---
  useEffect(() => {
    try {
      const stateToPersist = {
        currentCandidate: candidate,
        completedCandidates: allCandidates,
      };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(stateToPersist));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [candidate, allCandidates]);


  const clearAllData = () => {
      localStorage.removeItem(PERSIST_KEY);
      setAllCandidates([]);
      setCandidate(INITIAL_CANDIDATE_STATE);
      setShowWelcomeBackModal(false);
      setDetailedCandidateId(null);
  };


  // --- Interviewee Handlers ---

  const handleResumeUpload = async (file) => {
    setIsProcessing(true);
    setCandidate(prev => ({ ...prev, status: 'PROCESSING', resumeFileName: file.name }));
    const data = await mockParseResume(file);
    setIsProcessing(false);

    // Check for missing fields
    const missingName = !data.name;
    const missingEmail = !data.email;
    const missingPhone = !data.phone;

    if (missingName || missingEmail || missingPhone) {
      setCandidate(prev => ({
        ...prev,
        status: 'MISSING_INFO',
        name: data.name,
        email: data.email,
        phone: data.phone,
      }));
    } else {
      setCandidate(prev => ({
        ...prev,
        status: 'INTERVIEWING',
        name: data.name,
        email: data.email,
        phone: data.phone,
        history: [{ role: 'ai', content: `Hello, ${data.name}. Welcome to the interview for the Full Stack (React/Node) role. Let's begin with the first question.`, score: null, timeSpent: 0, questionId: 0 }],
        currentQuestionIndex: 1, // Will trigger first question load in InterviewChat useEffect
      }));
    }
  };

  const handleUpdateMissingInfo = (info) => {
    setCandidate(prev => ({
      ...prev,
      ...info,
      status: 'INTERVIEWING',
      history: [{ role: 'ai', content: `Thank you, ${info.name}. We've confirmed your contact details. Let's begin the interview for the Full Stack (React/Node) role.`, score: null, timeSpent: 0, questionId: 0 }],
      currentQuestionIndex: 1, // Will trigger first question load in InterviewChat useEffect
    }));
  };

  const handleInterviewComplete = (finalScore, finalSummary) => {
    // 1. Finalize the current candidate record
    const finalCandidate = {
        ...candidate,
        status: 'COMPLETED',
        score: finalScore,
        summary: finalSummary,
        currentQuestionIndex: QUESTIONS_CONFIG.length + 1 // Ensure index is past the last question
    };

    // 2. Add completed candidate to the permanent list
    setAllCandidates(prev => [...prev, finalCandidate]);

    // 3. Reset the current candidate state for a new session
    setCandidate({ ...INITIAL_CANDIDATE_STATE, id: crypto.randomUUID() });
  };

  const handlePause = () => {
    setCandidate(prev => ({ ...prev, status: 'PAUSED' }));
    setShowWelcomeBackModal(true);
  };

  const handleResume = () => {
    setCandidate(prev => ({ ...prev, status: 'INTERVIEWING' }));
    setShowWelcomeBackModal(false);
  };

  const handleNewInterview = () => {
    // Save the old session as 'abandoned' if it was mid-interview
    if (candidate.status === 'PAUSED' || candidate.status === 'INTERVIEWING') {
        const abandonedCandidate = {
             ...candidate,
             status: 'ABANDONED',
             summary: 'Interview abandoned by candidate.',
             score: 0,
        };
        // Only save if history contains more than just the welcome message
        if (abandonedCandidate.history.filter(h => h.questionId > 0).length > 0) {
            setAllCandidates(prev => [...prev, abandonedCandidate]);
        }
    }
    setCandidate({ ...INITIAL_CANDIDATE_STATE, id: crypto.randomUUID() });
    setShowWelcomeBackModal(false);
  };

  // --- Render logic based on status ---

  let intervieweeContent;
  switch (candidate.status) {
    case 'UPLOAD':
    case 'PROCESSING':
      intervieweeContent = <ResumeUploadStep onUpload={handleResumeUpload} isProcessing={isProcessing} />;
      break;
    case 'MISSING_INFO':
      intervieweeContent = <MissingInfoStep candidate={candidate} onUpdateInfo={handleUpdateMissingInfo} />;
      break;
    case 'INTERVIEWING':
    case 'PAUSED':
    case 'COMPLETED':
    case 'ABANDONED':
      intervieweeContent = (
        <InterviewChat
          candidate={candidate}
          setCandidate={setCandidate}
          onInterviewComplete={handleInterviewComplete}
          onPause={handlePause}
          isProcessing={isProcessing}
        />
      );
      break;
    default:
      intervieweeContent = <p className="text-center p-8 text-red-500">Error: Unknown application state.</p>;
  }

  // --- Main Render ---

  const currentDetailedCandidate = allCandidates.find(c => c.id === detailedCandidateId);

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 md:p-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        /* Custom Scrollbar for better UX */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        /* Custom animation for refresh button in modal */
        @keyframes spin-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 2s linear infinite;
        }
      `}</style>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-indigo-800 text-center">
            {APP_NAME} <span className="text-indigo-400 text-sm">| Full Stack Role</span>
        </h1>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex justify-center space-x-2 mb-6 p-1 bg-white rounded-xl shadow-lg">
          <button
            onClick={() => { setActiveTab('interviewee'); setDetailedCandidateId(null); }}
            className={`flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'interviewee'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-5 h-5 mr-2" /> Interviewee (Chat)
          </button>
          <button
            onClick={() => setActiveTab('interviewer')}
            className={`flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'interviewer'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Briefcase className="w-5 h-5 mr-2" /> Interviewer (Dashboard)
          </button>
        </div>

        {/* Tab Content */}
        <div className="h-[75vh]">
          {activeTab === 'interviewee' && (
            <div className="h-full">
              {intervieweeContent}
            </div>
          )}

          {activeTab === 'interviewer' && (
            <div className="h-full">
              {detailedCandidateId && currentDetailedCandidate ? (
                <CandidateDetailView
                  candidate={currentDetailedCandidate}
                  onBack={() => setDetailedCandidateId(null)}
                />
              ) : (
                <InterviewerDashboard
                  candidates={allCandidates}
                  onViewDetails={setDetailedCandidateId}
                  onClearData={clearAllData}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Welcome Back Modal */}
      {showWelcomeBackModal && (
          <WelcomeBackModal
              candidate={candidate}
              onResume={handleResume}
              onNewInterview={handleNewInterview}
          />
      )}
    </div>
  );
};

export default App;
