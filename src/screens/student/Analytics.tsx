import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  TrendingUp, 
  Calendar, 
  Trophy, 
  ClipboardList, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export default function StudentAnalytics() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    attendance: 0,
    quizAvg: 0,
    assignmentRate: 0,
    feeStatus: 'pending'
  });
  const [quizData, setQuizData] = useState<any[]>([]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const uid = profile.uid;

      // 1. Attendance
      const attQuery = query(collection(db, 'attendance'), where('studentId', '==', uid));
      const attSnap = await getDocs(attQuery);
      const totalDays = attSnap.size;
      const presentDays = attSnap.docs.filter(d => d.data().status === 'present').length;
      const attPercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // 2. Quizzes
      const quizQuery = query(collection(db, 'quiz_results'), where('studentId', '==', uid));
      const quizSnap = await getDocs(quizQuery);
      const quizResults = quizSnap.docs.map(d => d.data());
      const totalQuizScore = quizResults.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0);
      const quizAvg = quizResults.length > 0 ? Math.round((totalQuizScore / quizResults.length) * 100) : 0;
      
      const chartData = quizResults.map((r, i) => ({
        name: `Quiz ${i + 1}`,
        score: Math.round((r.score / r.totalQuestions) * 100)
      }));
      setQuizData(chartData);

      // 3. Assignments
      let totalAssign = 0;
      if (profile.courseId) {
        const assignQuery = query(collection(db, 'assignments'), where('courseId', '==', profile.courseId));
        const assignSnap = await getDocs(assignQuery);
        totalAssign = assignSnap.size;
      }
      
      const subQuery = query(collection(db, 'submissions'), where('studentId', '==', uid));
      const subSnap = await getDocs(subQuery);
      const totalSub = subSnap.size;
      const assignRate = totalAssign > 0 ? Math.round((totalSub / totalAssign) * 100) : 0;

      // 4. Fees
      const feeStructureRef = doc(db, 'config', 'feeStructure');
      const feeStructureSnap = await getDoc(feeStructureRef);
      const feeStructure = feeStructureSnap.exists() ? feeStructureSnap.data() : {};
      
      const cleanStr = (str: string) => String(str || '').toUpperCase().replace(/[^A-Z]/g, '');
      const dept = cleanStr(profile.courseId) || cleanStr(profile.courseName) || cleanStr(profile.department) || 'BCA';
      const currentSem = Number(profile.semester) || 1;

      let totalExpected = 0;
      for (let s = 1; s <= currentSem; s++) {
        totalExpected += feeStructure[dept]?.[s] || 0;
      }

      const feeQuery = query(collection(db, 'payments'), where('studentId', '==', uid));
      const feeSnap = await getDocs(feeQuery);
      const fees = feeSnap.docs.map(d => d.data());
      const totalPaid = fees
        .filter(f => f.status === 'confirmed')
        .reduce((acc, f) => acc + Number(f.amount || 0), 0);

      const isFullyPaid = totalExpected > 0 && totalPaid >= totalExpected;

      setStats({
        attendance: attPercent,
        quizAvg,
        assignmentRate: assignRate,
        feeStatus: isFullyPaid ? 'Paid' : 'Pending'
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#e2e8f0'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 pb-24 transition-colors">
      <button 
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </button>

      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-blue-600 w-7 h-7" />
            Performance Analytics
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Track your learning journey and progress</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.attendance}%</p>
                <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${stats.attendance}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-yellow-600 dark:text-yellow-400">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quiz Avg</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.quizAvg}%</p>
                <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${stats.quizAvg}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-400">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assignments</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.assignmentRate}%</p>
                <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: `${stats.assignmentRate}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600 dark:text-purple-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fee Status</span>
                </div>
                <p className={`text-3xl font-black ${stats.feeStatus === 'Paid' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {stats.feeStatus}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-2">Current Semester</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Quiz Performance Chart */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <BarChartIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Quiz Performance Trend
                </h3>
                <div className="h-64 w-full">
                  {quizData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={quizData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-bg-opacity)' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm italic">
                      No quiz data available yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance Distribution */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Attendance Summary
                </h3>
                <div className="h-64 w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: stats.attendance },
                          { name: 'Absent', value: 100 - stats.attendance }
                        ]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#f1f5f9" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.attendance}%</span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase">Present</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
