import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  addDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  CreditCard,
  BookOpen,
  Search,
  Filter,
  CheckCircle,
  Save,
  Edit,
  X,
  ArrowLeft,
  Loader2,
  User,
  MoreVertical,
  Hash,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FeeManagement({
  isEmbedded,
}: {
  isEmbedded?: boolean;
}) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deptSearch, setDeptSearch] = useState<{
    [key: string]: { sem: string; name: string };
  }>({});
  const [expandedDepts, setExpandedDepts] = useState<string[]>([]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentStudent, setPaymentStudent] = useState<any>(null);
  const [paymentSemester, setPaymentSemester] = useState<number>(1);
  const [modalDepartment, setModalDepartment] = useState<string>("");
  const [isManualPayment, setIsManualPayment] = useState(false);
  const [viewDetailsStudent, setViewDetailsStudent] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  const [feeStructure, setFeeStructure] = useState<any>({});

  const [departments, setDepartments] = useState<any[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);
  const [isEditingStructure, setIsEditingStructure] = useState(false);
  const [activeTab, setActiveTab] = useState<"history" | "structure">(
    "history",
  );

  useEffect(() => {
    fetchData();
    fetchFeeStructure();

    const unsubDepts = onSnapshot(collection(db, "departments"), (snap) => {
      const managedDepts = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDepartments(
        (managedDepts as any[]).sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        ),
      );
    });

    return () => unsubDepts();
  }, []); // Only on mount

  const fetchFeeStructure = async () => {
    try {
      const docRef = doc(db, "config", "feeStructure");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFeeStructure(docSnap.data());
      }
    } catch (error) {
      console.error("Error fetching fee structure:", error);
    }
  };

  const handleSaveStructure = async () => {
    setSavingStructure(true);
    try {
      await setDoc(doc(db, "config", "feeStructure"), feeStructure);
      alert("Fee structure updated successfully!");
      setIsEditingStructure(false);
      fetchData();
    } catch (error) {
      console.error("Error saving fee structure:", error);
      alert("Failed to save fee structure.");
    } finally {
      setSavingStructure(false);
    }
  };

  const updateStructureValue = (dept: string, sem: number, value: string) => {
    setFeeStructure((prev: any) => ({
      ...prev,
      [dept]: {
        ...(prev[dept] || {}),
        [sem]: value === "" ? 0 : Number(value),
      },
    }));
  };

  const fetchData = async () => {
    try {
      const userSnap = await getDocs(collection(db, "users"));
      const allUsers = userSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      const studentUsers = allUsers.filter(
        (u) => String(u.role).toLowerCase() === "student" || u.studentId,
      );
      setStudents(studentUsers);

      const courseSnap = await getDocs(collection(db, "courses"));
      setCourses(courseSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const paymentSnap = await getDocs(collection(db, "payments"));
      setPayments(
        paymentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    } catch (error) {
      console.error("Error fetching fee data:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (
    paymentId: string,
    studentId: string,
    amount: number,
  ) => {
    try {
      await updateDoc(doc(db, "payments", paymentId), { status: "confirmed" });
      await addDoc(collection(db, "notifications"), {
        title: "Fee Payment Confirmed",
        message: `Your fee payment of ₹${amount} has been successfully confirmed.`,
        targetRole: "student",
        targetId: studentId,
        timestamp: new Date().toISOString(),
        read: false,
      });
      fetchData();
    } catch (error) {
      console.error("Error confirming payment:", error);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL payment history?"))
      return;
    try {
      setLoading(true);
      const batch = writeBatch(db);

      const paymentsSnap = await getDocs(collection(db, "payments"));
      paymentsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      await batch.commit();
      alert("All payment data successfully wiped!");
      fetchData();
    } catch (error) {
      console.error("Error clearing data:", error);
      alert("Failed to clear data");
      setLoading(false);
    }
  };

  const handleTeacherPaymentReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentStudent || !paymentSemester || !paymentAmount) return;

    try {
      await addDoc(collection(db, "payments"), {
        studentId: paymentStudent.uid || paymentStudent.id,
        semester: paymentSemester,
        courseId:
          paymentStudent.courseId ||
          paymentStudent.department ||
          paymentStudent.courseName ||
          "",
        amount: Number(paymentAmount),
        transactionId:
          "CASH_RECEIPT_" +
          Math.random().toString(36).substring(2, 9).toUpperCase(),
        status: "confirmed",
        teacherReceived: true,
        timestamp: new Date().toISOString(),
      });
      setShowPaymentModal(false);
      setPaymentAmount("");
      fetchData();
    } catch (err) {
      console.error("Failed recording payment:", err);
      alert("Failed recording payment.");
    }
  };

  // Helper to extract clean dept name
  const cleanStr = (str: any) =>
    String(str || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

  const filteredStudents = students.filter((s) => {
    const sName = (s.name || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    if (
      q &&
      !sName.includes(q) &&
      !(s.studentId || "").toLowerCase().includes(q)
    )
      return false;

    if (selectedCourse !== "all" && selectedCourse) {
      const cName = cleanStr(selectedCourse);
      const sDept =
        cleanStr(s.courseId) ||
        cleanStr(s.courseName) ||
        cleanStr(s.department);
      if (sDept !== cName && s.courseId !== selectedCourse) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#111b21] p-4 sm:p-6 sm:p-10 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-4 sm:gap-8 mb-4 sm:mb-8 sm:mb-12">
          {!isEmbedded && (
            <button
              onClick={() => navigate("/")}
              className="w-fit flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-wa-teal transition-all  tracking-normal bg-white dark:bg-[#202c33] px-4 sm:px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> REVERT TO TERMINAL
            </button>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-wa-teal rounded-full animate-pulse" />
              <span className="text-xs font-bold text-wa-teal  tracking-normal">Financial Ops Hub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl sm:text-3xl sm:text-4xl sm:text-5xl font-bold text-slate-800 dark:text-white tracking-normal  leading-none italic">
              REVENUE TERMINAL
            </h1>
            <p className="text-xs font-bold text-slate-400  tracking-normal mt-4 ml-1">System-wide tuition tracking & remittance verification</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPaymentStudent(null);
                setPaymentSemester(1);
                setModalDepartment("");
                setPaymentAmount("");
                setIsManualPayment(true);
                setShowPaymentModal(true);
              }}
              className="w-full sm:w-auto px-5 sm:px-8 py-3 sm:py-5 bg-slate-900 dark:bg-wa-teal text-white rounded-[1.5rem] font-bold  tracking-normal text-xs shadow-xl hover:bg-slate-800 dark:hover:bg-wa-teal/90 transition-all flex items-center justify-center gap-3"
            >
              <CreditCard className="w-4 h-4" /> RECEIVE REMITTANCE
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-[#eeeeee] dark:bg-[#111b21] p-1.5 rounded-[1.8rem] mb-4 sm:mb-8 sm:mb-12 w-fit border border-slate-100 dark:border-white/5">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 sm:px-8 py-4 rounded-[1.4rem] text-[11px] font-bold  tracking-normal transition-all flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-white dark:bg-[#202c33] text-slate-800 dark:text-white shadow-xl"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <Hash className="w-4 h-4" />
            DUES TRACKER
          </button>
          <button
            onClick={() => setActiveTab("structure")}
            className={`px-5 sm:px-8 py-4 rounded-[1.4rem] text-[11px] font-bold  tracking-normal transition-all flex items-center gap-2 ${
              activeTab === "structure"
                ? "bg-white dark:bg-[#202c33] text-slate-800 dark:text-white shadow-xl"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <Edit className="w-4 h-4" />
            FEE CONFIG
          </button>
        </div>

        {activeTab === "history" ? (
          <div className="space-y-12 animate-in fade-in duration-500">
            {/* Filters & Search */}
            <div className="bg-white dark:bg-[#202c33] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 flex flex-col lg:flex-row gap-5 sm:gap-4 sm:gap-8 items-center justify-between">
              <div className="relative w-full lg:w-[500px]">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="SEARCH STUDENT ID OR NAME..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-2xl focus:outline-none focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal text-slate-800 dark:text-white transition-all font-bold text-xs  tracking-normal placeholder:text-slate-300"
                />
              </div>

              <div className="flex gap-4 w-full lg:w-auto">
                <button
                  onClick={() =>
                    setExpandedDepts(
                      expandedDepts.length === departments.length
                        ? []
                        : departments.map((d) => d.name),
                    )
                  }
                  className="flex-1 lg:flex-none px-4 sm:px-6 sm:px-10 py-3 sm:py-5 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-white/10 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-600 dark:text-slate-400 rounded-2xl hover:border-wa-teal hover:text-wa-teal transition-all shadow-sm flex items-center justify-center gap-3"
                >
                  {expandedDepts.length === departments.length ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                  {expandedDepts.length === departments.length ? "COLLAPSE ALL" : "EXPAND VECTORS"}
                </button>
                <button
                  onClick={handleClearData}
                  className="flex-1 lg:flex-none px-4 sm:px-6 sm:px-10 py-3 sm:py-5 border border-rose-100 text-rose-500 dark:border-rose-900/30 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-2xl text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 transition-all"
                >
                  PURGE DATA
                </button>
              </div>
            </div>

            {/* Department Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {departments.map((deptObj) => {
                const dept = deptObj.name;
                const deptCount = students.filter((s) => {
                  const sDept =
                    cleanStr(s.courseId) ||
                    cleanStr(s.courseName) ||
                    cleanStr(s.department);
                  return sDept === dept;
                }).length;

                const isExpanded = expandedDepts.includes(dept);

                return (
                  <button
                    key={dept}
                    disabled={deptCount === 0}
                    onClick={() =>
                      setExpandedDepts((prev) =>
                        prev.includes(dept)
                          ? prev.filter((d) => d !== dept)
                          : [...prev, dept],
                      )
                    }
                    className={`group relative p-4 sm:p-5 sm:p-5 sm:p-6 rounded-3xl border transition-all text-left flex flex-col gap-4 overflow-hidden h-52 outline-none ${
                      isExpanded
                        ? "bg-slate-900 dark:bg-slate-900 border-slate-900 text-white shadow-2xl scale-[1.02]"
                        : deptCount === 0
                          ? "bg-slate-50/50 dark:bg-[#202c33]/50 border-slate-100 dark:border-white/5 opacity-40 cursor-not-allowed"
                          : "bg-white dark:bg-[#202c33] border-slate-100 dark:border-white/5 hover:border-wa-teal dark:hover:border-wa-teal/50 hover:translate-y-[-4px] hover:shadow-2xl shadow-slate-200/50 dark:shadow-none"
                    }`}
                  >
                    <div className="relative z-10 w-full mb-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-4 rounded-2xl transition-all duration-500 ${
                          isExpanded
                            ? "bg-wa-teal text-white rotate-12"
                            : "bg-wa-teal/10 dark:bg-wa-teal/20 text-wa-teal group-hover:rotate-12"
                        }`}>
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <span className={`text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 ${isExpanded ? "text-slate-400" : "text-slate-400"}`}>Department</span>
                      </div>
                      <span className={`text-2xl font-bold tracking-normal  leading-none ${isExpanded ? "text-white" : "text-slate-800 dark:text-white"}`}>
                        {dept}
                      </span>
                    </div>

                    <div className="relative z-10 mt-auto flex items-end justify-between">
                      <div className="flex items-baseline gap-2">
                        <p className={`text-3xl sm:text-4xl sm:text-5xl font-bold italic tracking-normal ${isExpanded ? "text-white" : "text-slate-800 dark:text-white"}`}>
                          {deptCount}
                        </p>
                        <span className={`text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 ${isExpanded ? "text-slate-400" : "text-slate-400"}`}>
                          STUDENTS
                        </span>
                      </div>
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isExpanded ? 'border-white/20' : 'border-slate-100 dark:border-white/10 group-hover:bg-wa-teal group-hover:border-wa-teal group-hover:text-white'}`}>
                        {isExpanded ? <X className="w-4 h-4 text-white" /> : <Edit className="w-4 h-4 text-slate-400 group-hover:text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Department-wise Tables */}
            <div className="space-y-12">
              {departments.map((deptObj) => {
                const dept = deptObj.name;
                const searchConfig = deptSearch[dept] || {
                  sem: "ALL",
                  name: "",
                };
                const isExpanded = expandedDepts.includes(dept);

                let deptFilteredStudents = filteredStudents.filter((s) => {
                  const sDept =
                    cleanStr(s.courseId) ||
                    cleanStr(s.courseName) ||
                    cleanStr(s.department);
                  return sDept === dept;
                });

                if (searchConfig.sem !== "ALL") {
                  deptFilteredStudents = deptFilteredStudents.filter(
                    (s) => (s.semester?.toString() || "1") === searchConfig.sem,
                  );
                }

                if (searchConfig.name.trim()) {
                  const q = searchConfig.name.toLowerCase();
                  deptFilteredStudents = deptFilteredStudents.filter(
                    (s) =>
                      (s.name || "").toLowerCase().includes(q) ||
                      (s.studentId || "").toLowerCase().includes(q),
                  );
                }

                // Auto-expand if general search produces results in this dept
                const shouldShow =
                  isExpanded ||
                  (searchQuery && deptFilteredStudents.length > 0);
                if (
                  !shouldShow ||
                  (deptFilteredStudents.length === 0 &&
                    !searchConfig.name.trim() &&
                    searchConfig.sem === "ALL" &&
                    !searchQuery)
                )
                  return null;

                return (
                  <div
                    key={`registry-${dept}`}
                    className="bg-white dark:bg-[#202c33] rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5 overflow-hidden animate-in slide-in-from-bottom-8 duration-700 relative"
                  >
                    <div className="absolute top-0 left-0 w-2 h-full bg-wa-teal/20" />
                    
                    <div className="px-4 sm:px-6 sm:px-10 py-10 border-b border-slate-100 dark:border-white/5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 sm:gap-4 sm:gap-8 bg-[#fdfdfe] dark:bg-[#202c33]/50 backdrop-blur-xl">
                      <div className="flex items-center gap-5 sm:gap-4 sm:gap-8">
                        <div className="w-20 h-20 bg-white dark:bg-[#111b21] rounded-2xl shadow-xl flex items-center justify-center text-wa-teal border border-slate-100 dark:border-white/5 rotate-[-6deg] shrink-0 transform group-hover:rotate-0 transition-transform">
                          <User className="w-10 h-10" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 bg-wa-teal rounded-full" />
                            <span className="text-xs font-bold text-wa-teal  tracking-normal">Department Students</span>
                          </div>
                          <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-normal  italic">
                            {dept} MASTER LOG
                          </h3>
                          <p className="text-xs font-bold text-slate-400  tracking-normal mt-2">
                             Verification status for {deptFilteredStudents.length} students
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-center">
                        <select
                          value={searchConfig.sem}
                          onChange={(e) =>
                            setDeptSearch((prev) => ({
                              ...prev,
                              [dept]: { ...searchConfig, sem: e.target.value },
                            }))
                          }
                          className="w-full sm:w-auto px-4 sm:px-6 py-4 bg-[#f8f9fa] dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 outline-none focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-800 dark:text-white appearance-none cursor-pointer"
                        >
                          <option value="ALL">All Semesters</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                            <option key={sem} value={String(sem)}>
                              SEMESTER {sem}
                            </option>
                          ))}
                        </select>
                        <div className="relative w-full sm:w-72">
                          <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="SEARCH DEPARTMENT..."
                            value={searchConfig.name}
                            onChange={(e) =>
                              setDeptSearch((prev) => ({
                                ...prev,
                                [dept]: {
                                  ...searchConfig,
                                  name: e.target.value,
                                },
                              }))
                            }
                            className="w-full pl-14 pr-6 py-4 bg-[#f8f9fa] dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 outline-none focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-800 dark:text-white"
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDepts((prev) =>
                              prev.filter((d) => d !== dept),
                            );
                            setDeptSearch((prev) => ({
                              ...prev,
                              [dept]: { sem: "ALL", name: "" },
                            }));
                          }}
                          className="w-14 h-14 flex shrink-0 items-center justify-center bg-white dark:bg-[#111b21] hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-2xl transition-all text-rose-500 shadow-xl border border-slate-100 dark:border-white/5 active:scale-90"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-6 sm:p-10">
                      <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-max text-left border-separate border-spacing-y-4">
                        <thead>
                          <tr>
                            <th className="px-5 sm:px-8 py-4 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-400">Student Details</th>
                            <th className="px-5 sm:px-8 py-4 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-400">VERIFICATION</th>
                            <th className="px-5 sm:px-8 py-4 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-400 text-center">EXPECTED</th>
                            <th className="px-5 sm:px-8 py-4 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-400 text-center">CONFIRMED</th>
                            <th className="px-5 sm:px-8 py-4 text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 text-slate-400 text-right">OPERATIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptFilteredStudents.map((student) => {
                            const studentId = student.uid || student.id;
                            const currentSem = Number(student.semester) || 1;
                            const totalExpected =
                              feeStructure[dept]?.[currentSem] || 0;
                            const allStudentPayments = payments.filter(
                              (p) =>
                                p.studentId === studentId &&
                                Number(p.semester) === currentSem,
                            );
                            const totalPaid = allStudentPayments
                              .filter((p) => p.status === "confirmed")
                              .reduce((sum, p) => sum + Number(p.amount), 0);
                            const amountDue = Math.max(
                              0,
                              totalExpected - totalPaid,
                            );
                            const pendingPayments = allStudentPayments.filter(
                              (p) => p.status === "pending",
                            );

                            let statusText = "Pending Dues";
                            let statusColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";

                            if (totalExpected > 0 && amountDue <= 0) {
                              statusText = "CLEARED";
                              statusColor = "bg-wa-green/10 text-wa-green border-wa-green/20";
                            } else if (totalPaid > 0) {
                              statusText = "Partial";
                              statusColor = "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
                            } else if (totalExpected === 0) {
                              statusText = "No Config";
                              statusColor = "bg-slate-500/10 text-slate-500 border-slate-500/20";
                            }

                            return (
                              <tr
                                key={studentId}
                                className="group transition-all hover:-translate-y-1 duration-300"
                              >
                                <td className="px-5 sm:px-8 py-4 sm:py-6 bg-[#fcfcfd] dark:bg-[#202c33]/30 rounded-l-[2rem] border-y border-l border-slate-100 dark:border-white/5 whitespace-nowrap">
                                  <div className="flex items-center gap-5">
                                    <div
                                      onClick={() =>
                                        student.avatarUrl &&
                                        setZoomedPhoto(student.avatarUrl)
                                      }
                                      className="w-16 h-16 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl transition-transform group-hover:scale-105 shrink-0"
                                    >
                                      {student.avatarUrl ? (
                                        <img
                                          src={student.avatarUrl}
                                          alt=""
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <User className="w-8 h-8 text-slate-300" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-800 dark:text-white text-2xl sm:text-3xl tracking-normal leading-tight italic cursor-pointer transition-all hover:text-wa-teal hover:translate-x-1">
                                        {student.name}
                                      </p>
                                      <p className="text-xs font-bold text-slate-500  tracking-normal mt-1.5 flex items-center gap-2">
                                        PRN {student.studentId || "0000"} <span className="text-slate-200 dark:text-slate-700">|</span> <span className="bg-wa-teal/10 px-2 py-0.5 rounded-lg text-wa-teal text-sm transition-all hover:bg-wa-teal hover:text-white cursor-pointer">SEMESTER {currentSem}</span>
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 bg-[#fcfcfd] dark:bg-[#202c33]/30 border-y border-slate-100 dark:border-white/5 whitespace-nowrap">
                                  <div className="flex flex-col gap-2 items-start">
                                    <span
                                      className={`px-4 py-2 rounded-xl text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 border ${statusColor}`}
                                    >
                                      {statusText}
                                    </span>
                                    {pendingPayments.length > 0 && (
                                      <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 rounded-lg animate-pulse shadow-lg shadow-rose-500/20">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                        <span className="text-[8px] font-bold text-white  tracking-normal">Review Alert</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 bg-[#fcfcfd] dark:bg-[#202c33]/30 border-y border-slate-100 dark:border-white/5 text-center whitespace-nowrap">
                                   <p className="font-bold text-lg text-slate-400 dark:text-slate-500 tracking-normal">₹{totalExpected.toLocaleString()}</p>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 bg-[#fcfcfd] dark:bg-[#202c33]/30 border-y border-slate-100 dark:border-white/5 text-center whitespace-nowrap">
                                   <p className="font-bold text-3xl text-wa-green tracking-normal italic">₹{totalPaid.toLocaleString()}</p>
                                </td>
                                <td className="px-5 sm:px-8 py-4 sm:py-6 bg-[#fcfcfd] dark:bg-[#202c33]/30 rounded-r-[2rem] border-y border-r border-slate-100 dark:border-white/5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() =>
                                      setViewDetailsStudent({
                                        ...student,
                                        expectedAmount: totalExpected,
                                        paidAmount: totalPaid,
                                        amountDue,
                                        semPayments: allStudentPayments,
                                      })
                                    }
                                    className="px-5 sm:px-8 py-4 bg-slate-900 hover:bg-slate-800 dark:bg-wa-teal dark:hover:bg-wa-teal/90 text-white rounded-xl text-[11px] font-bold  tracking-normal shadow-xl hover:shadow-wa-teal/20 active:scale-95 transition-all"
                                  >
                                    SYNC ACCOUNT
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                );
              })}

              {!loading && filteredStudents.length === 0 && (
                <div className="py-40 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 shadow-inner">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-8 animate-bounce">
                    <Search className="w-12 h-12 text-slate-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                    No Student Records Found
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
                    We couldn't locate any matching records for your query. Try
                    broadening your terms.
                  </p>
                </div>
              )}

              {loading && (
                <div className="py-24 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-4 sm:mb-6">
                    <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute inset-0" />
                    <div className="absolute inset-4 bg-blue-600 rounded-full opacity-20 animate-ping" />
                  </div>
                  <p className="text-slate-400 font-bold  tracking-normal text-xs">
                    Processing Database...
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#202c33] rounded-3xl border border-slate-100 dark:border-white/5 p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 space-y-12 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-normal  italic">
                  Fee Configuration Matrix
                </h2>
                <p className="text-xs font-bold text-slate-400  tracking-normal mt-2">
                  Define tuition parameters for all departmental vectors.
                </p>
              </div>
              <button
                onClick={
                  isEditingStructure
                    ? handleSaveStructure
                    : () => setIsEditingStructure(true)
                }
                disabled={savingStructure}
                className={`px-4 sm:px-6 sm:px-10 py-3 sm:py-5 rounded-[1.5rem] text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 flex items-center gap-3 transition-all shadow-xl disabled:opacity-50 ${
                  isEditingStructure
                    ? "bg-wa-green text-white hover:bg-wa-green/90"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {savingStructure ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : isEditingStructure ? (
                  <>
                    <Save className="w-4 h-4" />
                    COMMIT CHANGES
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    MODIFY MATRIX
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 sm:gap-10">
              {departments.map((deptObj) => {
                const dept = deptObj.name;
                const totalSemesters = Number(deptObj.totalSemesters) || 8;
                return (
                  <div
                    key={dept}
                    className="space-y-3 sm:space-y-6 p-4 sm:p-6 sm:p-10 bg-[#fcfcfd] dark:bg-[#111b21] rounded-3xl border border-slate-100 dark:border-white/5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-wa-teal/5 rounded-bl-[4rem]" />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-4  tracking-normal">
                      <BookOpen className="w-6 h-6 text-wa-teal" />
                      {dept} DEPARTMENT
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:gap-6 relative z-10">
                      {Array.from(
                        { length: totalSemesters },
                        (_, i) => i + 1,
                      ).map((sem) => (
                        <div key={sem} className="space-y-2">
                          <label className="text-xs font-bold text-slate-400  tracking-normal pl-1">
                            SEMESTER {sem}
                          </label>
                          <div className="relative group">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                              ₹
                            </span>
                            <input
                              type="number"
                              disabled={!isEditingStructure}
                              className={`w-full pl-10 pr-6 py-4 bg-white dark:bg-[#202c33] border rounded-[1.2rem] text-sm font-bold text-slate-800 dark:text-white shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-wa-teal/10 ${
                                !isEditingStructure
                                  ? "opacity-50 cursor-not-allowed border-slate-100 dark:border-white/5"
                                  : "border-slate-100 dark:border-white/10 hover:border-wa-teal focus:border-wa-teal"
                              }`}
                              value={
                                feeStructure[dept]?.[sem] === undefined ||
                                feeStructure[dept]?.[sem] === 0
                                  ? ""
                                  : feeStructure[dept][sem]
                              }
                              onChange={(e) =>
                                updateStructureValue(dept, sem, e.target.value)
                              }
                              placeholder="0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[120] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl p-4 sm:p-6 sm:p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border border-white/10">
            <div className="flex justify-between items-center mb-4 sm:mb-6 sm:mb-10">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white  tracking-normal italic">
                  Payment Interface
                </h3>
                <p className="text-xs font-bold text-slate-400  tracking-normal mt-1">Manual Remittance Verification</p>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setStudentSearch("");
                  setPaymentStudent(null);
                }}
                className="w-12 h-12 bg-[#f8f9fa] dark:bg-[#111b21] hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-all shadow-sm border border-slate-100 dark:border-white/5"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form
              onSubmit={handleTeacherPaymentReceipt}
              className="space-y-3 sm:space-y-6 text-left"
            >
              {isManualPayment ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400  tracking-normal mb-3 ml-1">
                        Department Filter
                      </label>
                      <select
                        required
                        className="w-full px-5 py-4 bg-[#f8f9fa] dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-2xl focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal outline-none text-[11px] font-bold text-slate-800 dark:text-white transition-all  tracking-normal appearance-none cursor-pointer"
                        value={modalDepartment}
                        onChange={(e) => {
                          setModalDepartment(e.target.value);
                          setPaymentStudent(null);
                          setStudentSearch("");
                        }}
                      >
                        <option value="" disabled>
                          SELECT DEPARTMENT
                        </option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400  tracking-normal mb-3 ml-1">
                        Semester Filter
                      </label>
                      <select
                        required
                        className="w-full px-5 py-4 bg-[#f8f9fa] dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-2xl focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal outline-none text-[11px] font-bold text-slate-800 dark:text-white transition-all  tracking-normal appearance-none cursor-pointer"
                        value={paymentSemester}
                        onChange={(e) => {
                          setPaymentSemester(Number(e.target.value));
                          setPaymentStudent(null);
                          setStudentSearch("");
                        }}
                      >
                        {(() => {
                          const selectedDeptObj = departments.find(
                            (d) => d.name === modalDepartment,
                          );
                          const totalSems = selectedDeptObj?.totalSemesters || 8;
                          return Array.from(
                            { length: totalSems },
                            (_, i) => i + 1,
                          ).map((sem) => (
                            <option key={sem} value={sem}>
                              SEMESTER {sem}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400  tracking-normal mb-3 ml-1">
                      Student Search
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder={
                            !modalDepartment || !paymentSemester
                              ? "Select Dept and Semester first"
                              : "SEARCH BY NAME OR PRN..."
                          }
                          className={`w-full pl-14 pr-6 py-4 bg-[#f8f9fa] dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-2xl focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal outline-none text-[11px] font-bold text-slate-800 dark:text-white transition-all  tracking-normal ${!modalDepartment || !paymentSemester ? "opacity-50 cursor-not-allowed" : ""}`}
                          value={studentSearch}
                          onChange={(e) => {
                            setStudentSearch(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          disabled={!modalDepartment || !paymentSemester}
                        />
                      </div>

                      {showSuggestions &&
                        modalDepartment &&
                        paymentSemester && (
                          <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-[#202c33] border border-slate-100 dark:border-white/10 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto animate-in slide-in-from-top-4 duration-300">
                            {(() => {
                              const filtered = students.filter((s) => {
                                const cIdName =
                                  cleanStr(s.courseId) ||
                                  cleanStr(s.courseName) ||
                                  cleanStr(s.department) ||
                                  "";
                                const sSem =
                                  Number(
                                    String(s.semester || "").replace(/\D/g, ""),
                                  ) || 0;
                                const matchesDept = cIdName === modalDepartment;
                                const matchesSem =
                                  sSem === paymentSemester || !s.semester;
                                if (!matchesDept || !matchesSem) return false;

                                const q = studentSearch.toLowerCase();
                                return (
                                  (s.name || "").toLowerCase().includes(q) ||
                                  (s.studentId || "").toLowerCase().includes(q)
                                );
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-4 sm:p-5 sm:p-5 sm:p-6 text-xs font-bold text-slate-400  tracking-normal text-center">
                                    No Matching Students
                                  </div>
                                );
                              }

                              return filtered.map((s) => (
                                <button
                                  key={s.id || s.uid}
                                  type="button"
                                  className="w-full text-left px-5 sm:px-8 py-3 sm:py-5 hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] border-b border-slate-50 dark:border-white/5 last:border-0 transition-colors"
                                  onClick={() => {
                                    setPaymentStudent(s);
                                    setStudentSearch(s.name);
                                    setShowSuggestions(false);
                                  }}
                                >
                                  <p className="font-bold text-slate-800 dark:text-white tracking-normal  leading-none">
                                    {s.name}
                                  </p>
                                  <p className="text-xs font-bold text-slate-400  tracking-normal mt-2">
                                    PRN: {s.studentId || "0000"}
                                  </p>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                    </div>
                    {paymentStudent && (
                      <div className="mt-4 p-4 sm:p-5 bg-wa-teal/10 dark:bg-wa-teal/20 rounded-2xl border border-wa-teal/20 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="w-10 h-10 bg-wa-teal rounded-full flex items-center justify-center text-white shadow-lg shadow-wa-teal/30">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[#8696a0]  tracking-normal leading-none">Verified Student</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white  tracking-normal mt-1">
                            {paymentStudent.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentStudent(null);
                            setStudentSearch("");
                          }}
                          className="p-2 hover:bg-wa-teal/20 rounded-full transition-colors text-wa-teal"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                paymentStudent && (
                  <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-slate-100 dark:border-white/5 mb-4 sm:mb-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                          <User className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-white  tracking-normal italic">
                            {paymentStudent.name}
                          </p>
                          <p className="text-xs font-bold text-slate-400  tracking-normal mt-1">
                             SEMESTER {paymentSemester} • FEE PAYMENT
                          </p>
                       </div>
                    </div>
                  </div>
                )
              )}

              {paymentStudent &&
                (() => {
                  const studentDept = cleanStr(
                    paymentStudent?.courseId ||
                      paymentStudent?.courseName ||
                      paymentStudent?.department,
                  );
                  const targetDept = isManualPayment
                    ? modalDepartment
                    : studentDept;
                  const targetSemFee =
                    feeStructure[targetDept]?.[paymentSemester] || 0;
                  const totalPaidForSem = payments
                    .filter(
                      (p) =>
                        (p.studentId === paymentStudent?.id ||
                          p.studentId === paymentStudent?.uid) &&
                        Number(p.semester) === paymentSemester &&
                        p.status === "confirmed",
                    )
                    .reduce((sum, p) => sum + Number(p.amount), 0);
                  const maxAllowed = Math.max(
                    0,
                    targetSemFee - totalPaidForSem,
                  );
                  const isFullyPaid = targetSemFee > 0 && maxAllowed <= 0;

                  return (
                    <div className="space-y-4">
                      {isFullyPaid && (
                        <div className="mb-2 p-5 bg-wa-green/10 dark:bg-wa-green/20 border border-wa-green/30 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 duration-500">
                          <div className="w-12 h-12 bg-wa-green text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-wa-green/30">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-wa-green uppercase tracking-wider">Account Fully Cleared</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              Verified: Student has fulfilled all remittance requirements for Semester {paymentSemester}.
                            </p>
                          </div>
                        </div>
                      )}

                      {!isFullyPaid && (
                        <div>
                          <div className="flex justify-between items-end mb-3">
                            <label className="block text-xs font-bold text-slate-400  tracking-normal ml-1">
                              Remittance Amount (₹)
                            </label>
                            {targetSemFee > 0 && (
                              <div className="px-3 py-1 bg-wa-teal/10 rounded-full animate-in zoom-in-50 duration-500">
                                <span className="text-xs font-bold text-wa-teal  tracking-normal leading-none">
                                  Cap: ₹{maxAllowed}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="relative group">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">₹</span>
                            <input
                              type="number"
                              required
                              autoFocus
                              placeholder="00.00"
                              max={targetSemFee > 0 ? maxAllowed : undefined}
                              className="w-full pl-12 pr-6 py-3 sm:py-5 bg-[#f8f9fa] dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-wa-teal/10 focus:border-wa-teal outline-none text-slate-800 dark:text-white transition-all text-2xl font-bold italic tracking-normal"
                              value={paymentAmount}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (targetSemFee > 0 && val > maxAllowed) {
                                  setPaymentAmount(maxAllowed.toString());
                                } else {
                                  setPaymentAmount(e.target.value);
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

              <button
                type="submit"
                disabled={
                  !paymentAmount ||
                  !paymentStudent ||
                  (feeStructure[
                    isManualPayment
                      ? modalDepartment
                      : cleanStr(
                          paymentStudent?.courseId ||
                            paymentStudent?.courseName ||
                            paymentStudent?.department,
                        )
                  ]?.[paymentSemester] > 0 &&
                    Number(paymentAmount) <= 0) ||
                  (feeStructure[
                    isManualPayment
                      ? modalDepartment
                      : cleanStr(
                          paymentStudent?.courseId ||
                            paymentStudent?.courseName ||
                            paymentStudent?.department,
                        )
                  ]?.[paymentSemester] > 0 &&
                    Number(paymentAmount) >
                      Math.max(
                        0,
                        (feeStructure[
                          isManualPayment
                            ? modalDepartment
                            : cleanStr(
                                paymentStudent?.courseId ||
                                  paymentStudent?.courseName ||
                                  paymentStudent?.department,
                              )
                        ]?.[paymentSemester] || 0) -
                          payments
                            .filter(
                              (p) =>
                                (p.studentId === paymentStudent?.id ||
                                  p.studentId === paymentStudent?.uid) &&
                                Number(p.semester) === paymentSemester &&
                                p.status === "confirmed",
                            )
                            .reduce((sum, p) => sum + Number(p.amount), 0),
                      ))
                }
                className="w-full py-4 sm:py-6 bg-slate-900 text-white font-bold  tracking-normal text-xs rounded-[1.5rem] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 disabled:bg-slate-300 disabled:shadow-none mt-4 sm:mt-8 flex items-center justify-center gap-4"
              >
                AUTHORIZE REMITTANCE
                <CheckCircle className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Student Details Modal */}
      {viewDetailsStudent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[120] animate-in fade-in duration-500">
          <div className="bg-white dark:bg-[#202c33] rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10 relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-wa-teal via-indigo-500 to-wa-green" />
            
            <div className="px-4 sm:px-6 sm:px-10 py-10 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white dark:bg-[#202c33] shrink-0">
              <div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-4  tracking-normal italic">
                  <User className="text-wa-teal w-8 h-8" />
                  Student Details
                </h3>
                <p className="text-xs font-bold text-slate-400  tracking-normal mt-2 ml-10">Advanced revenue status diagnostics</p>
              </div>
              <button
                onClick={() => setViewDetailsStudent(null)}
                className="w-14 h-14 bg-[#f8f9fa] dark:bg-[#111b21] hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-full flex items-center justify-center transition-all shadow-sm border border-slate-100 dark:border-white/5"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 sm:p-10 overflow-y-auto flex-1 custom-scrollbar">
              {/* Profile Info */}
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-4 sm:gap-8 items-center mb-4 sm:mb-8 sm:mb-12 bg-[#fcfcfd] dark:bg-[#111b21] p-4 sm:p-6 sm:p-10 rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
                <div
                  onClick={() =>
                    viewDetailsStudent.avatarUrl &&
                    setZoomedPhoto(viewDetailsStudent.avatarUrl)
                  }
                  className="w-32 h-32 bg-white dark:bg-[#202c33] rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 dark:border-white/10 shadow-2xl group relative cursor-zoom-in shrink-0"
                >
                  {viewDetailsStudent.avatarUrl ? (
                    <img
                      src={viewDetailsStudent.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover transform scale-105 group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-12 h-12 text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <Search className="text-white w-8 h-8" />
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white  tracking-normal italic leading-none mb-3">
                    {viewDetailsStudent.name}
                  </h2>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                    <span className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">PRN {viewDetailsStudent.studentId || "0000"}</span>
                    <span className="px-4 py-2 bg-wa-teal/10 text-wa-teal border border-wa-teal/10 rounded-xl text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">DEPT {cleanStr(viewDetailsStudent.department) || "N/A"}</span>
                    <span className="px-4 py-2 bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 rounded-xl text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400">SEMESTER {viewDetailsStudent.semester || 1}</span>
                  </div>
                </div>
              </div>

              {/* Financial Status */}
              <div className="mb-4 sm:mb-8 sm:mb-12">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                  <h4 className="text-xs font-bold text-slate-400  tracking-normal">Current Revenue Metrics</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                  <div className="bg-white dark:bg-[#111b21] p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/5 rounded-bl-[3rem] -mr-6 -mt-4 sm:mt-6" />
                    <p className="text-xs font-bold text-slate-400  tracking-normal mb-4">Total Obligation</p>
                    <p className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white tracking-normal italic">₹{viewDetailsStudent.expectedAmount.toLocaleString()}</p>
                  </div>
                  
                  <div className="bg-wa-green/5 dark:bg-wa-green/10 p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl border border-wa-green/10 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-wa-green/10 rounded-bl-[3rem] -mr-6 -mt-4 sm:mt-6" />
                    <p className="text-xs font-bold text-wa-green  tracking-normal mb-4">Verified Remittance</p>
                    <p className="text-3xl sm:text-4xl font-bold text-wa-green tracking-normal italic">₹{viewDetailsStudent.paidAmount.toLocaleString()}</p>
                  </div>

                  <div className="bg-rose-500/5 dark:bg-rose-500/10 p-4 sm:p-5 sm:p-5 sm:p-6 rounded-2xl border border-rose-500/10 shadow-xl relative overflow-hidden group border-dashed border-2">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-bl-[3rem] -mr-6 -mt-4 sm:mt-6" />
                    <p className="text-xs font-bold text-rose-500  tracking-normal mb-4">Outstanding Vector</p>
                    <p className="text-3xl sm:text-4xl font-bold text-rose-500 tracking-normal italic">₹{viewDetailsStudent.amountDue.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <div className="w-2 h-2 bg-wa-teal rounded-full" />
                  <h4 className="text-xs font-bold text-slate-400  tracking-normal">Transaction Audit Log</h4>
                </div>
                
                {viewDetailsStudent.semPayments.length === 0 ? (
                  <div className="p-4 sm:p-6 sm:p-6 sm:p-5 sm:p-6 bg-slate-50 dark:bg-[#111b21] rounded-2xl border border-dashed border-slate-200 dark:border-white/5 text-center">
                    <p className="text-xs font-bold text-slate-400  tracking-normal italic">No transaction records found in current semester.</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-4">
                    {viewDetailsStudent.semPayments
                      .sort(
                        (a: any, b: any) =>
                          new Date(b.date || b.timestamp).getTime() -
                          new Date(a.date || a.timestamp).getTime(),
                      )
                      .map((p: any) => (
                        <div
                          key={p.id}
                          className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-5 sm:p-5 sm:p-6 bg-white dark:bg-[#111b21] border border-slate-100 dark:border-white/5 rounded-2xl gap-3 sm:gap-6 hover:shadow-2xl transition-all group"
                        >
                          <div className="flex gap-3 sm:gap-6 items-center">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${p.status === "confirmed" ? "bg-wa-green/10 text-wa-green group-hover:bg-wa-green group-hover:text-white" : "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white"}`}>
                               <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-4 mb-1">
                                <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-normal italic">
                                  ₹{Number(p.amount).toLocaleString()}
                                </p>
                                <span
                                  className={`px-3 py-1 rounded-lg text-[8px] font-bold  tracking-normal border ${p.status === "confirmed" ? "bg-wa-green/10 text-wa-green border-wa-green/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}
                                >
                                  {p.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <p className="text-xs font-bold text-slate-400  tracking-normal">
                                  TXID: #{p.transactionId}
                                </p>
                                <p className="text-xs font-bold text-slate-300  tracking-normal">
                                  {new Date(p.date || p.timestamp).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {p.status === "pending" && (
                            <button
                              onClick={() => {
                                confirmPayment(
                                  p.id,
                                  p.studentId || viewDetailsStudent.id,
                                  p.amount,
                                );
                                setViewDetailsStudent((prev: any) => ({
                                  ...prev,
                                  semPayments: prev.semPayments.map((sp: any) =>
                                    sp.id === p.id
                                      ? { ...sp, status: "confirmed" }
                                      : sp,
                                  ),
                                  paidAmount: prev.paidAmount + Number(p.amount),
                                  amountDue: Math.max(
                                    0,
                                    prev.expectedAmount -
                                      (prev.paidAmount + Number(p.amount)),
                                  ),
                                }));
                              }}
                              className="w-full sm:w-auto px-4 sm:px-6 sm:px-10 py-4 bg-wa-green text-white rounded-xl text-xs font-bold  tracking-normal text-slate-500 dark:text-slate-400 shadow-xl hover:shadow-wa-green/20 active:scale-95 transition-all"
                            >
                              VERIFY REMITTANCE
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Zoom Modal */}
      {zoomedPhoto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <button
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={zoomedPhoto}
            alt="Student Profile"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
