import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Trophy, 
  Clock, 
  HelpCircle, 
  ArrowLeft, 
  Loader2, 
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QuizList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.courseId) {
      const q = query(
        collection(db, 'quizzes'), 
        where('courseId', '==', profile.courseId)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const quizzesData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        setQuizzes(quizzesData);
        setLoading(false);
      });

      fetchResults();
      return () => unsubscribe();
    }
  }, [profile?.courseId]);

  const fetchResults = async () => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'quiz_results'), where('studentId', '==', profile.uid));
    const querySnapshot = await getDocs(q);
    setResults(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="text-blue-600 w-7 h-7" />
              Interactive Quizzes
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Test your knowledge and track your progress</p>
          </div>
        </div>

        {/* Quizzes List */}
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No quizzes available for your course yet.</p>
            </div>
          ) : (
            quizzes.map((q) => {
              const result = results.find(r => r.quizId === q.id);
              return (
                <div key={q.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      result ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <Trophy className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{q.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        {q.subject} • {q.questions.length} Questions • {q.timeLimit} Min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {result ? (
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">Score: {result.score}/{result.totalQuestions}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Completed</p>
                      </div>
                    ) : (
                      <button 
                        onClick={() => navigate(`/quiz/player/${q.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                      >
                        Start Quiz <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
