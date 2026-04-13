import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  TrendingUp, 
  Users, 
  Trophy, 
  ClipboardList, 
  ArrowLeft,
  Loader2,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Users2,
  CreditCard,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export default function TeacherAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    avgQuizScore: 0,
    feeCollection: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch Courses
      const courseSnap = await getDocs(collection(db, 'courses'));
      const courseList = courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(courseList);

      // 2. Fetch Students
      const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const students = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 3. Fetch Attendance
      const attSnap = await getDocs(collection(db, 'attendance'));
      const attendance = attSnap.docs.map(doc => doc.data());

      // 4. Fetch Quiz Results
      const quizSnap = await getDocs(collection(db, 'quiz_results'));
      const quizResults = quizSnap.docs.map(doc => doc.data());

      // 5. Fetch Fees (Payments)
      const feeSnap = await getDocs(collection(db, 'payments'));
      const fees = feeSnap.docs.map(doc => doc.data());

      // Calculate Course-wise Stats
      const cStats = courseList.map((course: any) => {
        const courseStudents = students.filter((s: any) => s.courseId === course.id);
        const courseAtt = attendance.filter((a: any) => a.courseId === course.id);
        const courseQuizzes = quizResults.filter((r: any) => courseStudents.some((s: any) => s.id === r.studentId));
        
        const attPercent = courseAtt.length > 0 
          ? Math.round((courseAtt.filter(a => a.status === 'present').length / courseAtt.length) * 100) 
          : 0;
          
        const quizAvg = courseQuizzes.length > 0
          ? Math.round((courseQuizzes.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / courseQuizzes.length) * 100)
          : 0;

        return {
          name: course.name,
          attendance: attPercent,
          quizScore: quizAvg,
          students: courseStudents.length
        };
      });
      setCourseStats(cStats);

      // Overall Stats
      const totalAttPercent = attendance.length > 0
        ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
        : 0;
      
      const totalQuizAvg = quizResults.length > 0
        ? Math.round((quizResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0) / quizResults.length) * 100)
        : 0;

      const totalCollected = fees.filter(f => f.status === 'paid').reduce((acc, curr) => acc + (curr.amount || 0), 0);

      setOverallStats({
        totalStudents: students.length,
        avgAttendance: totalAttPercent,
        avgQuizScore: totalQuizAvg,
        feeCollection: totalCollected
      });

    } catch (error) {
      console.error("Error fetching teacher analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 font-semibold hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
      </button>

      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-blue-600 w-7 h-7" />
            Course Performance Insights
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor overall progress and course-wise trends</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <Users2 className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Students</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{overallStats.totalStudents}</p>
                <p className="text-xs text-slate-400 mt-2">Across all courses</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-50 rounded-xl text-green-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Attendance</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{overallStats.avgAttendance}%</p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: `${overallStats.avgAttendance}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-50 rounded-xl text-yellow-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Quiz Score</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{overallStats.avgQuizScore}%</p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${overallStats.avgQuizScore}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fees Collected</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">₹{overallStats.feeCollection.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-2">Total revenue</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Course-wise Attendance */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <BarChartIcon className="w-5 h-5 text-blue-600" />
                  Course-wise Attendance (%)
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={courseStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="attendance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Course-wise Quiz Performance */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Course-wise Quiz Scores (%)
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={courseStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="quizScore" fill="#eab308" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
