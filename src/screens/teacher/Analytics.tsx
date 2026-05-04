import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, onSnapshot } from 'firebase/firestore';
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

export default function TeacherAnalytics({ isEmbedded }: { isEmbedded?: boolean }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalStudents: 0,
    avgAttendance: 0,
    feeCollection: 0
  });

  useEffect(() => {
    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      const deptList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDepartments(deptList);
      fetchData(deptList);
    });

    return () => unsubDepts();
  }, []);

  const fetchData = async (deptList: any[]) => {
    try {
      // 2. Fetch Students
      const studentSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const students = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 3. Fetch Attendance
      const attSnap = await getDocs(collection(db, 'attendance'));
      const attendance = attSnap.docs.map(doc => doc.data());

      // 5. Fetch Fees (Payments)
      const feeSnap = await getDocs(collection(db, 'payments'));
      const fees = feeSnap.docs.map(doc => doc.data());

      // Calculate Department-wise Stats
      const cStats = deptList.map((dept: any) => {
        const deptStudents = students.filter((s: any) => {
          const sDept = String(s.courseId || s.courseName || s.department || '').toUpperCase();
          return sDept === dept.name.toUpperCase();
        });
        
        const deptAtt = attendance.filter((a: any) => {
           const aDept = String(a.courseId || a.courseName || a.department || '').toUpperCase();
           return aDept === dept.name.toUpperCase();
        });
        
        const attPercent = deptAtt.length > 0 
          ? Math.round((deptAtt.filter(a => a.status === 'present').length / deptAtt.length) * 100) 
          : 0;

        return {
          name: dept.name,
          attendance: attPercent,
          students: deptStudents.length
        };
      });
      setCourseStats(cStats);

      // Overall Stats
      const totalAttPercent = attendance.length > 0
        ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
        : 0;
      
      const totalCollected = fees.filter(f => f.status === 'paid').reduce((acc, curr) => acc + (curr.amount || 0), 0);

      setOverallStats({
        totalStudents: students.length,
        avgAttendance: totalAttPercent,
        feeCollection: totalCollected
      });

    } catch (error) {
      console.error("Error fetching teacher analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] p-4 sm:p-6 sm:p-10 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-6 mb-4 sm:mb-8 sm:mb-12">
          {!isEmbedded && (
            <button 
              onClick={() => navigate('/')}
              className="w-fit flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-wa-teal transition-all  tracking-normal bg-white dark:bg-[#202c33] px-4 sm:px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5"
            >
              <ArrowLeft className="w-4 h-4" /> REVERT TO TERMINAL
            </button>
          )}

          <div className={`${isEmbedded ? '' : 'flex-1'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-wa-teal rounded-full animate-pulse" />
              <span className="text-xs font-bold text-wa-teal  tracking-normal">Live Intelligence Feed</span>
            </div>
            <h1 className="text-3xl sm:text-4xl sm:text-3xl sm:text-4xl sm:text-5xl font-bold text-slate-800 dark:text-white tracking-normal leading-none italic">
              OPS ANALYTICS
            </h1>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-normal mt-4 ml-1">Real-time performance metrics & system diagnostics</p>
          </div>
        </div>

        {loading ? (
          <div className="py-32 text-center">
            <div className="relative inline-block">
              <Loader2 className="w-16 h-16 text-wa-teal animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-wa-teal rounded-full animate-ping" />
              </div>
            </div>
            <p className="text-xs font-bold text-slate-400  tracking-[0.5em] mt-4 sm:mt-8">Decrypting Data Stream...</p>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-white dark:bg-[#202c33] p-4 sm:p-6 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-wa-teal/5 rounded-bl-[5rem] -mr-10 -mt-4 sm:mt-6 sm:mt-10 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-5 mb-4 sm:mb-8 relative z-10">
                  <div className="w-14 h-14 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl flex items-center justify-center">
                    <Users2 className="w-7 h-7 text-wa-teal" />
                  </div>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Population Matrix</span>
                </div>
                <div className="relative z-10">
                  <p className="text-3xl sm:text-6xl font-bold text-slate-800 dark:text-white tracking-normal italic leading-none">{overallStats.totalStudents}</p>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-normal mt-4">TOTAL STUDENTS</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#202c33] p-4 sm:p-6 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-wa-green/5 rounded-bl-[5rem] -mr-10 -mt-4 sm:mt-6 sm:mt-10 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-5 mb-4 sm:mb-8 relative z-10">
                  <div className="w-14 h-14 bg-wa-green/10 dark:bg-wa-green/20 rounded-2xl flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-wa-green" />
                  </div>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Overall Attendance</span>
                </div>
                <div className="relative z-10">
                  <div className="flex items-end gap-3">
                    <p className="text-3xl sm:text-6xl font-bold text-slate-800 dark:text-white tracking-normal italic">{overallStats.avgAttendance}%</p>
                    <div className="mb-2 w-3 h-3 bg-wa-green rounded-full animate-pulse" />
                  </div>
                  <div className="mt-4 sm:mt-6 h-2 bg-slate-100 dark:bg-[#111b21] rounded-full overflow-hidden">
                    <div className="h-full bg-wa-green shadow-[0_0_15px_rgba(37,211,102,0.5)] transition-all duration-1000" style={{ width: `${overallStats.avgAttendance}%` }} />
                  </div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-normal mt-5">SYSTEM ATTENDANCE VECTOR</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#202c33] p-4 sm:p-6 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[5rem] -mr-10 -mt-4 sm:mt-6 sm:mt-10 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-5 mb-4 sm:mb-8 relative z-10">
                  <div className="w-14 h-14 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-7 h-7 text-indigo-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-normal">Revenue Stream</span>
                </div>
                <div className="relative z-10">
                  <p className="text-3xl sm:text-6xl font-bold text-slate-800 dark:text-white tracking-normal italic leading-none">₹{overallStats.feeCollection.toLocaleString()}</p>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-normal mt-4">TOTAL REVENUE OPTIMIZED</p>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 sm:p-6 sm:p-6 sm:p-5 sm:p-6 rounded-3xl shadow-2xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-wa-teal via-indigo-500 to-wa-green" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 mb-4 sm:mb-8 sm:mb-12">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-normal flex items-center gap-4  leading-none">
                    <BarChartIcon className="w-6 h-6 text-wa-teal" />
                    Department Students
                  </h3>
                  <p className="text-xs font-bold text-slate-400  tracking-normal mt-3 ml-1">Departmental performance distribution analytics</p>
                </div>
                
                <div className="flex gap-2">
                  <div className="px-4 py-2 bg-[#f8f9fa] dark:bg-[#111b21] rounded-xl border border-slate-100 dark:border-white/5 flex items-center gap-2">
                    <div className="w-2 h-2 bg-wa-teal rounded-full" />
                    <span className="text-xs font-bold text-slate-400  tracking-normal leading-none">Attendance %</span>
                  </div>
                </div>
              </div>

              <div className="h-[400px] w-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={courseStats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#128c7e" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#128c7e" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#f1f5f9" opacity={0.5} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8', letterSpacing: '0.1em' }} 
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                      domain={[0, 100]} 
                      dx={-10}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc', radius: 24 }}
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                        backgroundColor: '#111b21',
                        padding: '20px'
                      }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 900, textTransform: '', letterSpacing: '0.1em' }}
                      labelStyle={{ color: '#128c7e', fontSize: '10px', fontWeight: 900, marginBottom: '8px', textTransform: '', letterSpacing: '0.2em' }}
                    />
                    <Bar 
                      dataKey="attendance" 
                      fill="url(#barGradient)" 
                      radius={[15, 15, 15, 15]} 
                      barSize={40}
                    >
                      {courseStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} style={{ filter: 'drop-shadow(0 4px 6px rgba(18, 140, 126, 0.2))' }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
