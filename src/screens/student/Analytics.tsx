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

export default function StudentAnalytics({ isEmbedded }: { isEmbedded?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    attendance: 0,
    assignmentRate: 0,
    feeStatus: 'pending'
  });

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

      // Logic changed to focus ONLY on current semester
      const expectedAmount = feeStructure[dept]?.[currentSem] || 0;

      const feeQuery = query(collection(db, 'payments'), 
        where('studentId', 'in', [profile.uid, profile.studentId, profile.id].filter(Boolean)),
        where('semester', '==', currentSem)
      );
      const feeSnap = await getDocs(feeQuery);
      const fees = feeSnap.docs.map(d => d.data());
      const totalPaid = fees
        .filter(f => f.status === 'confirmed')
        .reduce((acc, f) => acc + Number(f.amount || 0), 0);

      const isFullyPaid = expectedAmount > 0 && totalPaid >= expectedAmount;

      setStats({
        attendance: attPercent,
        assignmentRate: assignRate,
        feeStatus: isFullyPaid ? 'Paid' : 'Pending'
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#128c7e', '#e9edef'];

  return (
    <div className={`min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] p-6 transition-colors ${isEmbedded ? '' : 'pb-24 pt-12'}`}>
      {!isEmbedded && (
        <button 
          onClick={() => navigate('/')}
          className="mb-8 flex items-center gap-2 text-[#8696a0] font-semibold hover:text-wa-teal transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </button>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-tight">
            <div className="w-12 h-12 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl flex items-center justify-center">
              <TrendingUp className="text-wa-teal w-7 h-7" />
            </div>
            Performance Hub
          </h1>
          <p className="text-[#8696a0] font-semibold mt-1">Real-time insights into your academic progress</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-wa-teal/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-wa-teal animate-spin" />
            </div>
            <p className="text-[#8696a0] font-black uppercase tracking-[0.2em] text-[10px]">Analyzing Data...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#202c33] p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-wa-teal/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-wa-teal/10 rounded-xl flex items-center justify-center text-wa-teal">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-[#8696a0] uppercase tracking-[0.2em]">Attendance Rate</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-slate-900 dark:text-[#e9edef]">{stats.attendance}</p>
                  <span className="text-xl font-bold text-[#8696a0]">%</span>
                </div>
                <div className="mt-4 h-2 bg-[#f0f2f5] dark:bg-[#111b21] rounded-full overflow-hidden">
                  <div className="h-full bg-wa-teal transition-all duration-1000" style={{ width: `${stats.attendance}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-[#202c33] p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-wa-green/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-wa-green/10 rounded-xl text-wa-green">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-[#8696a0] uppercase tracking-[0.2em]">Assignments Hub</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-slate-900 dark:text-[#e9edef]">{stats.assignmentRate}</p>
                  <span className="text-xl font-bold text-[#8696a0]">%</span>
                </div>
                <div className="mt-4 h-2 bg-[#f0f2f5] dark:bg-[#111b21] rounded-full overflow-hidden">
                  <div className="h-full bg-wa-green transition-all duration-1000" style={{ width: `${stats.assignmentRate}%` }} />
                </div>
              </div>

              <div className="bg-white dark:bg-[#202c33] p-8 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-[#8696a0] uppercase tracking-[0.2em]">Fee Clearance</span>
                </div>
                <p className={`text-4xl font-black tracking-tight ${stats.feeStatus === 'Paid' ? 'text-wa-green' : 'text-orange-500'}`}>
                  {stats.feeStatus}
                </p>
                <p className="text-[10px] font-black text-[#8696a0] mt-3 uppercase tracking-widest">Sem {profile.semester} Status</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Attendance Distribution */}
              <div className="bg-white dark:bg-[#202c33] p-8 rounded-[3rem] shadow-sm border border-slate-50 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-tight">
                    <PieChartIcon className="w-5 h-5 text-wa-teal" />
                    Attendance Summary
                  </h3>
                  <span className="text-[10px] font-black text-[#8696a0] uppercase bg-[#f0f2f5] dark:bg-[#111b21] px-3 py-1 rounded-full">Overall</span>
                </div>
                <div className="h-64 w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: stats.attendance },
                          { name: 'Absent', value: 100 - stats.attendance }
                        ]}
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill="#128c7e" />
                        <Cell fill={profile.theme === 'dark' ? '#111b21' : '#f0f2f5'} className="stroke-slate-100 dark:stroke-white/5" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#202c33', 
                          border: 'none', 
                          borderRadius: '16px',
                          color: '#e9edef',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-900 dark:text-[#e9edef] tracking-tighter">{stats.attendance}%</span>
                    <span className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest">Present</span>
                  </div>
                </div>
                <div className="flex justify-center gap-8 mt-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-wa-teal" />
                    <span className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest">Present</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f0f2f5] dark:bg-[#111b21]" />
                    <span className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest">Absent</span>
                  </div>
                </div>
              </div>

              {/* Assignment Progress Placeholder or Bar Chart */}
              <div className="bg-white dark:bg-[#202c33] p-8 rounded-[3rem] shadow-sm border border-slate-50 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-slate-900 dark:text-[#e9edef] flex items-center gap-3 tracking-tight">
                    <BarChartIcon className="w-5 h-5 text-wa-green" />
                    Resource Tracking
                  </h3>
                  <span className="text-[10px] font-black text-[#8696a0] uppercase bg-[#f0f2f5] dark:bg-[#111b21] px-3 py-1 rounded-full">Academic</span>
                </div>
                <div className="h-64 w-full flex items-center justify-center">
                   <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-wa-green/10 rounded-full flex items-center justify-center mx-auto transition-transform hover:rotate-12">
                         <BarChartIcon className="w-10 h-10 text-wa-green" />
                      </div>
                      <div>
                        <p className="text-4xl font-black text-slate-900 dark:text-[#e9edef] tracking-tighter">{stats.assignmentRate}%</p>
                        <p className="text-[10px] font-black text-[#8696a0] uppercase tracking-widest mt-1">Content Mastery Rate</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
