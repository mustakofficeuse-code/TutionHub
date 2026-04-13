import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Trophy, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Loader2,
  Clock,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  X,
  Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export default function QuizManager() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');
  const [timeLimit, setTimeLimit] = useState('10');
  const [questions, setQuestions] = useState<Question[]>([
    { question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }
  ]);

  useEffect(() => {
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    fetchCourses();
    return () => unsubscribe();
  }, []);

  const fetchCourses = async () => {
    const querySnapshot = await getDocs(collection(db, 'courses'));
    setCourses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.some(q => !q.question || q.options.some(o => !o))) {
      alert('Please fill all questions and options.');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'quizzes'), {
        title,
        description,
        courseId,
        subject,
        timeLimit: Number(timeLimit),
        questions,
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      resetForm();
    } catch (error) {
      console.error("Error adding quiz:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCourseId('');
    setSubject('');
    setTimeLimit('10');
    setQuestions([{ question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
    } catch (error) {
      console.error("Error deleting quiz:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="text-blue-600 w-7 h-7" />
              Quiz Manager
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Create and manage interactive MCQs</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
          >
            <Plus className="w-5 h-5" /> Create New Quiz
          </button>
        </div>

        {/* Quizzes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400">No quizzes created yet.</p>
            </div>
          ) : (
            quizzes.map((q) => {
              const course = courses.find(c => c.id === q.courseId);
              return (
                <div key={q.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden group hover:border-blue-200 transition-all">
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <button 
                        onClick={() => deleteQuiz(q.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg line-clamp-1">{q.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                        {q.subject} • {course?.name || 'All Courses'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <HelpCircle className="w-4 h-4" />
                        <span>{q.questions.length} Questions</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{q.timeLimit} Min</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create New Quiz</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quiz Title</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Java Fundamentals Quiz"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Java"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Course</label>
                    <select
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                    >
                      <option value="">Select Course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time Limit (Minutes)</label>
                    <input
                      type="number"
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-900 dark:text-white">Questions</h4>
                  <button 
                    type="button"
                    onClick={addQuestion}
                    className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                </div>

                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 space-y-4 relative group">
                    <button 
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Question {qIndex + 1}</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="What is the output of...?"
                        value={q.question}
                        onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name={`correct-${qIndex}`}
                            checked={q.correctAnswerIndex === oIndex}
                            onChange={() => updateQuestion(qIndex, 'correctAnswerIndex', oIndex)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            required
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder={`Option ${oIndex + 1}`}
                            value={option}
                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-slate-300"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><Save className="w-5 h-5 inline mr-2" /> Save Quiz</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
