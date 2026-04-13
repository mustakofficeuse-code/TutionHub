import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, 
  Loader2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Trophy,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function QuizPlayer() {
  const { quizId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (quizId) fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (timeLeft > 0 && !isFinished) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            finishQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, isFinished]);

  const fetchQuiz = async () => {
    try {
      const docRef = doc(db, 'quizzes', quizId!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQuiz(data);
        setTimeLeft(data.timeLimit * 60);
        setAnswers(new Array(data.questions.length).fill(-1));
      }
    } catch (error) {
      console.error("Error fetching quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = optionIndex;
    setAnswers(newAnswers);
  };

  const finishQuiz = async () => {
    if (isFinished) return;
    setIsFinished(true);

    let finalScore = 0;
    quiz.questions.forEach((q: any, i: number) => {
      if (answers[i] === q.correctAnswerIndex) {
        finalScore++;
      }
    });
    setScore(finalScore);

    try {
      await addDoc(collection(db, 'quiz_results'), {
        quizId,
        studentId: profile?.uid,
        score: finalScore,
        totalQuestions: quiz.questions.length,
        answers,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error saving quiz result:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Not Found</h1>
        <button onClick={() => navigate('/quiz/list')} className="mt-6 text-blue-600 font-bold hover:underline">
          Back to Quiz List
        </button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-10 max-w-md w-full shadow-2xl text-center space-y-6 border border-slate-100 dark:border-slate-800"
        >
          <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-10 h-10 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Quiz Completed!</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Great job on finishing the quiz.</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Your Score</p>
            <p className="text-5xl font-black text-blue-600">{score} <span className="text-2xl text-slate-300">/ {quiz.questions.length}</span></p>
          </div>
          <button 
            onClick={() => navigate('/quiz/list')}
            className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg"
          >
            Back to Quiz List
          </button>
        </motion.div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/quiz/list')} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white line-clamp-1">{quiz.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Question {currentQuestion + 1} of {quiz.questions.length}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold ${
          timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'
        }`}>
          <Clock className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-slate-100 w-full overflow-hidden">
        <motion.div 
          className="h-full bg-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
        />
      </div>

      {/* Question Area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentQuestion}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="space-y-8"
            >
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                {question.question}
              </h2>

              <div className="grid grid-cols-1 gap-4">
                {question.options.map((option: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className={`p-6 rounded-2xl text-left border-2 transition-all flex items-center justify-between group ${
                      answers[currentQuestion] === index 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-white bg-white dark:bg-slate-900 hover:border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="font-semibold">{option}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      answers[currentQuestion] === index 
                        ? 'border-blue-600 bg-blue-600 text-white' 
                        : 'border-slate-200 group-hover:border-slate-300'
                    }`}>
                      {answers[currentQuestion] === index && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-6 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="px-6 py-3 text-slate-600 font-bold flex items-center gap-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" /> Previous
          </button>

          {currentQuestion === quiz.questions.length - 1 ? (
            <button
              onClick={finishQuiz}
              disabled={answers.some(a => a === -1)}
              className="px-10 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-slate-300 disabled:shadow-none"
            >
              Submit Quiz
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(prev => Math.min(quiz.questions.length - 1, prev + 1))}
              disabled={answers[currentQuestion] === -1}
              className="px-10 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg disabled:bg-slate-300"
            >
              Next Question <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
