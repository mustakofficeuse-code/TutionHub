import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db, logError } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Loader2,
  User,
  Lock,
  BookOpen,
  Layers,
  Key,
  CheckCircle,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import { deleteDoc } from "firebase/firestore";
import { Logo } from "../../components/Logo";

export default function AuthGateway() {
  const [view, setViewOriginal] = useState<
    | "loading"
    | "teacher-setup"
    | "teacher-login"
    | "student-enroll"
    | "student-login"
    | "student-blocked"
  >("loading");

  const setView = (newView: typeof view) => {
    setViewOriginal(newView);
    if (newView === "teacher-login") {
      localStorage.setItem("preferredLoginView", "teacher-login");
    } else if (newView === "student-login") {
      localStorage.setItem("preferredLoginView", "student-login");
    }
  };
  const [teacherName, setTeacherName] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Student fields
  const [studentName, setStudentName] = useState("");
  const [semester, setSemester] = useState("1");
  const [department, setDepartment] = useState("BCA");
  const [departments, setDepartments] = useState<string[]>(["BCA", "BSC", "BTECH", "MCA"]);
  const [studentInviteCode, setStudentInviteCode] = useState("");
  const [studentRealEmail, setStudentRealEmail] = useState("");
  const [studentPhoneNumber, setStudentPhoneNumber] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [generatedId, setGeneratedId] = useState("");
  const [isExistingStudent, setIsExistingStudent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    if (localStorage.getItem("isExistingStudent") === "true") {
      setIsExistingStudent(true);
    }
    checkSetup();

// Departments listener removed from AuthGateway to prevent early unauthorized reads

    // Auto-recover deleted profile if user is already authenticated
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.email) {
        try {
          const blacklistByEmail = user.email
            ? doc(db, "blacklist", user.email)
            : null;
          const blacklistByUid = doc(db, "blacklist", user.uid);

          const emailSnap = blacklistByEmail
            ? await getDoc(blacklistByEmail)
            : null;
          const uidSnap = await getDoc(blacklistByUid);

          if ((emailSnap && emailSnap.exists()) || uidSnap.exists()) {
            await auth.signOut();
            return;
          }

          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            // Recreate minimum profile
            await setDoc(userDocRef, {
              uid: user.uid,
              name: user.email?.split("@")[0] || "Recovered Student",
              email: user.email,
              role:
                user.email === "teacher@tutionhub.com" ||
                user.email === "admin@tutionhub.com" ||
                user.email === "mustak.office.use@gmail.com"
                  ? "teacher"
                  : "student",
              semester: "1",
              courseName: "BCA",
              courseId: "BCA",
              createdAt: new Date().toISOString(),
              profileComplete: true,
            });
            refreshProfile();
            navigate("/");
          }
        } catch (e: any) {
          // Be very silent about auto-recovery errors unless they aren't auth/network related
          const isExpected =
            e.code?.startsWith("auth/") ||
            e.code === "permission-denied" ||
            e.message?.includes("offline") ||
            e.message?.includes("failed-precondition") ||
            e.message?.includes("Missing or insufficient permissions");

          if (!isExpected) {
            logError("Auto recovery system note:", e);
          }
        }
      }
    }, (e: any) => { /* ignore */ });

    return () => unsubscribe();
  }, [navigate, refreshProfile]);

  const handleResetProject = async () => {
    if (!window.confirm("ARE YOU SURE? This will delete all users, config, and settings from Firestore. You will need to setup the teacher account again.")) return;
    
    setResetting(true);
    try {
      // 1. Delete app settings
      await deleteDoc(doc(db, "config", "appSettings"));
      
      // 2. Delete users (iterate through current local list if possible, or just delete common paths)
      // Since we don't have a list of all users easily, we at least delete the current settings
      // to trigger the setup view.
      
      // Also delete some common collections
      const collectionsToClear = [
        "users", "notifications", "departments", "blacklist", "attendance", "fees", 
        "exams", "notes", "attendance_schedules", "attendance_sessions", "payments", 
        "materials", "announcements", "schedules", "assignments", "submissions", 
        "doubts", "replies", "chat_messages", "sessions", "suspended_users", "blacklist_phones", "blacklist_emails"
      ];
      
      for (const coll of collectionsToClear) {
        try {
          const snap = await getDocs(collection(db, coll));
          for (const d of snap.docs) {
            await deleteDoc(doc(db, coll, d.id));
          }
        } catch (e) {
          console.warn(`Failed to clear collection ${coll}:`, e);
        }
      }

      await signOut(auth);
      window.location.reload();
    } catch (err: any) {
      alert("Reset failed: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  const checkSetup = async () => {
    // Override: allow forcing setup view via URL query parameter '?setup=true'
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "true") {
      console.log("Forcing teacher-setup via URL query param 'setup=true'");
      setView("teacher-setup");
      return;
    }

    try {
      const docRef = doc(db, "config", "appSettings");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTeacherName(data.teacherName || "Barun Maity");
        setTeacherPhone(data.teacherPhone || "");
        setTeacherEmail(data.teacherEmail || "");
        setInviteCode(data.inviteCode || "");

        if (sessionStorage.getItem("wasBlocked") === "true") {
          sessionStorage.removeItem("wasBlocked");
          setView("student-blocked");
        } else {
          const postLogoutView = localStorage.getItem("postLogoutView") || localStorage.getItem("preferredLoginView");
          if (postLogoutView === "teacher-login") {
            setView("teacher-login");
          } else {
            setView("student-login");
          }
        }
      } else {
        console.log("Config not found, showing setup.");
        setView("teacher-setup");
      }
    } catch (err: any) {
      console.warn("Setup check error:", err);
      // Detailed error reporting for the user
      const errMessage = err.message || JSON.stringify(err);
      
      if (errMessage.includes("permission") || errMessage.includes("Insufficient permissions")) {
        setError(`Database permission error: ${errMessage}. This usually means Firestore rules need to propagate or are blocking the connection.`);
        // Don't fall back to login if we can't check setup, stay on loading or show error
      } else {
        // For other errors (like doc not found, which should be handled by .exists()), 
        // fallback to setup as it's likely a new project.
        setView("teacher-setup"); 
      }
    }
  };

  const handleTeacherSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const trimmedName = teacherName.trim();
      const trimmedEmail = teacherEmail.trim().toLowerCase();
      const trimmedPhone = teacherPhone.trim();

      if (!trimmedName) {
        throw new Error("Teacher Name is required");
      }

      if (!trimmedEmail) {
        throw new Error("Email Address is required");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error("Please enter a valid email address");
      }

      if (!trimmedPhone || !/^\d{10}$/.test(trimmedPhone)) {
        throw new Error("Phone Number must be exactly 10 digits");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // Create teacher account
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(
          auth,
          trimmedEmail,
          password,
        );
      } catch (err: any) {
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/invalid-credential"
        ) {
          try {
            userCredential = await createUserWithEmailAndPassword(
              auth,
              trimmedEmail,
              password,
            );
          } catch (createErr: any) {
            if (createErr.code === "auth/email-already-in-use") {
              throw new Error("This email is already registered in your Firebase Authentication. If you are re-setting up or deploying on Vercel: 1. Please enter the correct password matching this email in your Firebase Auth, or 2. Use the Teacher Login screen to log in, or 3. If you forgot the password, delete this user from your Firebase Console (Authentication > Users) and run this Setup again.");
            } else {
              throw createErr;
            }
          }
        } else {
          throw err;
        }
      }

      const user = userCredential.user;

      // Save teacher profile first (making them Admin instantly in firestore.rules)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: trimmedName,
        email: trimmedEmail,
        realEmail: trimmedEmail,
        phoneNumber: trimmedPhone,
        role: "teacher",
        createdAt: new Date().toISOString(),
        profileComplete: true,
      });

      // Generate initial invite code
      const newInviteCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      // Save app settings
      await setDoc(doc(db, "config", "appSettings"), {
        teacherName: trimmedName,
        teacherPhone: trimmedPhone,
        teacherEmail: trimmedEmail,
        setupComplete: true,
        inviteCode: newInviteCode,
      });

      // Seed default departments
      const defaultDepts = [
        { name: "BCA", semesters: 6 },
        { name: "BSC", semesters: 6 },
        { name: "BTECH", semesters: 8 },
        { name: "MCA", semesters: 4 },
      ];

      for (const d of defaultDepts) {
        try {
          await setDoc(doc(db, "departments", d.name), {
            name: d.name,
            totalSemesters: d.semesters,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            teacherId: user.uid,
          });
        } catch (seedErr) {
          console.warn(`Failed seeding department ${d.name}:`, seedErr);
        }
      }

      localStorage.setItem("preferredLoginView", "teacher-login");
      localStorage.removeItem("postLogoutView");
      await refreshProfile();
      navigate("/");
    } catch (err: any) {
      logError("Teacher setup error:", err);
      setError(err.message || "Failed to setup teacher account");
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const emailToUse = teacherEmail.trim().toLowerCase() || "teacher@tutionhub.com";
      const candidates: string[] = [];

      // 1. Add resolved email from Firestore users collection scan
      let resolvedFromUsers = "";
      try {
        const usersRef = collection(db, "users");
        const snap = await getDocs(usersRef);
        snap.forEach((doc) => {
          const u = doc.data();
          if (u.role === "teacher" || u.role === "admin") {
            const docRealEmail = (u.realEmail || "").trim().toLowerCase();
            const docEmail = (u.email || "").trim().toLowerCase();
            if (docRealEmail === emailToUse || docEmail === emailToUse) {
              if (u.email) {
                resolvedFromUsers = u.email.trim().toLowerCase();
              }
            }
          }
        });
      } catch (lookupErr) {
        console.warn("Failed resolving teacher email via users lookup:", lookupErr);
      }
      if (resolvedFromUsers) {
        candidates.push(resolvedFromUsers);
      }

      // 2. Add resolved email from config/appSettings (very reliable, bypasses list users permission)
      try {
        const appSettingsRef = doc(db, 'config', 'appSettings');
        const settingsSnap = await getDoc(appSettingsRef);
        if (settingsSnap.exists()) {
          const s = settingsSnap.data();
          const teacherEmailInSettings = (s.teacherEmail || "").trim().toLowerCase();
          const teacherAuthEmailInSettings = (s.teacherAuthEmail || "").trim().toLowerCase();
          
          if (teacherEmailInSettings === emailToUse && teacherAuthEmailInSettings) {
            candidates.push(teacherAuthEmailInSettings);
          }
        }
      } catch (settingsErr) {
        console.warn("Failed resolving teacher email via appSettings:", settingsErr);
      }

      // 3. Add explicit bidirectional fallback mappings for Barun Maity
      if (emailToUse === "barunmaity@gmail.com") {
        candidates.push("barun@gmail.com");
      } else if (emailToUse === "barun@gmail.com") {
        candidates.push("barunmaity@gmail.com");
      }

      // 4. Always add the input email itself and the default template email
      candidates.push(emailToUse);
      candidates.push("teacher@tutionhub.com");

      // Filter to unique, non-empty candidate emails
      const uniqueCandidates = Array.from(new Set(candidates.map(c => c.trim().toLowerCase()).filter(Boolean)));
      
      console.log("Teacher login email candidates to attempt:", uniqueCandidates);

      let lastErr: any = null;
      let loginSuccess = false;
      let loggedInUser: any = null;

      for (const candidateEmail of uniqueCandidates) {
        try {
          console.log(`Trying login with email: ${candidateEmail}`);
          const userCredential = await signInWithEmailAndPassword(auth, candidateEmail, password);
          loginSuccess = true;
          loggedInUser = userCredential.user;
          break;
        } catch (authErr: any) {
          lastErr = authErr;
          // Keep trying other candidates
        }
      }

      if (!loginSuccess || !loggedInUser) {
        throw lastErr || new Error("Failed to sign in with any resolved credentials.");
      }

      // Heal/recreate profile if missing or has wrong role
      try {
        const userDocRef = doc(db, "users", loggedInUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let needsHealing = false;
        let existingData: any = {};
        
        if (!userDocSnap.exists()) {
          needsHealing = true;
        } else {
          existingData = userDocSnap.data() || {};
          if (existingData.role !== 'teacher' && existingData.role !== 'admin') {
            needsHealing = true;
          }
        }
        
        if (needsHealing) {
          console.log(`[Heal] Healing/recreating teacher profile for UID ${loggedInUser.uid}`);
          
          let healName = existingData.name || "Teacher";
          let healPhone = existingData.phoneNumber || "";
          
          try {
            const settingsSnap = await getDoc(doc(db, "config", "appSettings"));
            if (settingsSnap.exists()) {
              const s = settingsSnap.data();
              if (s.teacherName) healName = s.teacherName;
              if (s.teacherPhone) healPhone = s.teacherPhone;
            }
          } catch (cfgErr) {
            console.warn("Failed fetching appSettings for healing:", cfgErr);
          }
          
          await setDoc(userDocRef, {
            ...existingData,
            uid: loggedInUser.uid,
            name: healName,
            email: loggedInUser.email || emailToUse,
            realEmail: loggedInUser.email || emailToUse,
            phoneNumber: healPhone,
            role: "teacher",
            profileComplete: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          
          console.log("[Heal] Teacher profile healed successfully!");
        }
      } catch (healErr) {
        console.error("Failed to auto-heal teacher profile:", healErr);
      }

      localStorage.setItem("preferredLoginView", "teacher-login");
      localStorage.removeItem("postLogoutView");
      await refreshProfile();
      navigate("/");
    } catch (err: any) {
      logError("Teacher login error:", err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found" ||
        err.message?.includes("auth/invalid-credential") ||
        err.message?.includes("auth/wrong-password")
      ) {
        setError(
          "Invalid email or password. Please check your credentials and try again.",
        );
      } else {
        setError(err.message || "Teacher account not found.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const cleanId = studentId.trim().toLowerCase();
      let emailsToTry: string[] = [];

      // 1. If it's already an email, try it first
      if (cleanId.includes("@")) {
        emailsToTry.push(cleanId);
      }

      // 2. Fallback patterns (deterministic and database lookup)
      if (!emailsToTry.length || !cleanId.includes("@")) {
        // Look up by name in the users collection dynamically
        if (!/^\d+$/.test(cleanId) && !(cleanId.startsWith("th") && /^\d+$/.test(cleanId.substring(2)))) {
          try {
            const usersRef = collection(db, "users");
            const snap = await getDocs(query(usersRef, where("role", "==", "student")));
            snap.forEach(doc => {
              const u = doc.data();
              if (u.name && u.name.toLowerCase().trim() === cleanId && u.email) {
                emailsToTry.push(u.email.toLowerCase().trim());
              }
            });
          } catch (err) {
            console.warn("Failed resolving student by name:", err);
          }
        }

        // If it's just numbers (e.g., 84921) -> th84921
        if (/^\d+$/.test(cleanId)) {
          emailsToTry.push(`th${cleanId}@student.tutionhub.com`);
        }
        // If it's TH + numbers (e.g., th84921) -> th84921
        else if (
          cleanId.startsWith("th") &&
          /^\d+$/.test(cleanId.substring(2))
        ) {
          emailsToTry.push(`${cleanId}@student.tutionhub.com`);
        } else {
          emailsToTry.push(`${cleanId}@student.tutionhub.com`);
          if (!cleanId.startsWith("th")) {
            emailsToTry.push(`th${cleanId}@student.tutionhub.com`);
          }
        }
      }

      // Remove duplicates
      emailsToTry = Array.from(new Set(emailsToTry));

      // Quick blacklist check before authenticating (so wrong password doesn't hide the block)
      for (const email of emailsToTry) {
        const blacklistRef = doc(db, "blacklist", email);
        const blacklistSnap = await getDoc(blacklistRef);
        if (blacklistSnap.exists()) {
          throw new Error(
            "Your access has been revoked by the teacher. Please contact your teacher for permission.",
          );
        }
      }

      let loginSuccess = false;
      let lastError = null;

      for (const email of emailsToTry) {
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            studentPassword,
          );
          const user = userCredential.user;

          // Double check block status by user UID as well
          const blacklistUidRef = doc(db, "blacklist", user.uid);
          const blacklistUidSnap = await getDoc(blacklistUidRef);
          if (blacklistUidSnap.exists()) {
            await auth.signOut();
            throw new Error(
              "Your access has been revoked by the teacher. Please contact your teacher for permission.",
            );
          }

          // Verify user document exists (recreate if deleted mistakenly)
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            const isTeacher = 
              user.email === "teacher@tutionhub.com" || 
              user.email === "admin@tutionhub.com" || 
              user.email === "mustak.office.use@gmail.com";

            await setDoc(userDocRef, {
              uid: user.uid,
              studentId: cleanId.startsWith("th")
                ? cleanId.toUpperCase()
                : cleanId,
              name: isTeacher ? "Teacher" : "Student (Recovered)",
              email: email,
              role: isTeacher ? "teacher" : "student",
              semester: "1",
              courseName: "BCA",
              courseId: "BCA",
              createdAt: new Date().toISOString(),
              profileComplete: true,
            });
          }

          loginSuccess = true;
          break; // Stop trying if successful
        } catch (err: any) {
          lastError = err;
          // If the error is our custom blacklist error, throw it immediately
          if (err.message && err.message.includes("revoked")) {
            throw err;
          }
        }
      }

      if (!loginSuccess) {
        if (
          lastError?.code === "auth/invalid-credential" ||
          lastError?.code === "auth/user-not-found" ||
          lastError?.code === "auth/wrong-password"
        ) {
          throw new Error(
            "Invalid credentials. Please check your Student ID and password.",
          );
        }
        throw lastError || new Error("Invalid Student ID or Password.");
      }

      localStorage.setItem("isExistingStudent", "true");
      localStorage.setItem("preferredLoginView", "student-login");
      localStorage.removeItem("postLogoutView");
      await refreshProfile();
      navigate("/");
    } catch (err: any) {
      // Only log if it's not a common auth error which we handle with UI messages
      if (!err.message || !err.message.includes("revoked")) {
        logError("Student login error:", err);
      } else {
        setView("student-blocked");
        setLoading(false);
        return;
      }
      let userMsg = err.message || "Invalid Student ID or Password.";
      if (
        userMsg.includes("auth/invalid-credential") ||
        userMsg.includes("auth/user-not-found")
      ) {
        userMsg =
          "Invalid credentials. Please check your Student ID and password.";
      }
      setError(userMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const trimmedEmail = studentRealEmail.trim();
      const trimmedPhone = studentPhoneNumber.trim();
      const trimmedName = studentName.trim();

      if (studentInviteCode !== inviteCode) {
        throw new Error("Invalid Invite Code");
      }

      // Basic validation
      if (!/^\d{10}$/.test(trimmedPhone)) {
        throw new Error("Please enter a valid 10-digit phone number");
      }

      // Stronger email regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error(
          "Please enter a valid email address (e.g. name@gmail.com)",
        );
      }

      // 1. Check if name, phone, or email is blacklisted
      const blacklistSnap = await getDocs(collection(db, "blacklist"));
      const isBlacklisted = blacklistSnap.docs.some((doc) => {
        const data = doc.data();
        const nameMatch =
          (data.name || "").toLowerCase() === trimmedName.toLowerCase();
        const phoneMatch =
          trimmedPhone && data.phoneNumber === trimmedPhone;
        const emailMatch =
          trimmedEmail &&
          (data.realEmail || "").toLowerCase() ===
            trimmedEmail.toLowerCase();
        return nameMatch || phoneMatch || emailMatch;
      });

      if (isBlacklisted) {
        throw new Error(
          "Your enrollment has been blocked by the teacher. Please contact your teacher for permission.",
        );
      }

      // 2. Check for duplicate student (already enrolled)
      const studentsSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "student")),
      );
      const isDuplicate = studentsSnap.docs.some((doc) => {
        const data = doc.data();
        return (
          (data.name || "").toLowerCase() === trimmedName.toLowerCase() &&
          data.courseName === department &&
          data.semester === semester
        );
      });

      if (isDuplicate) {
        throw new Error(
          "A student with this name is already enrolled in this department and semester. If you forgot your ID, contact the teacher.",
        );
      }

      // Generate a unique Student ID (e.g., TH84921)
      const uniqueId = "TH" + Math.floor(10000 + Math.random() * 90000);
      const generatedEmail = `${uniqueId.toLowerCase()}@student.tutionhub.com`;

      // Create student account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        generatedEmail,
        studentPassword,
      );
      const user = userCredential.user;

      // Save student profile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        studentId: uniqueId,
        name: trimmedName,
        email: generatedEmail,
        realEmail: trimmedEmail || null,
        phoneNumber: trimmedPhone || null,
        role: "student",
        semester,
        courseName: department,
        courseId: department.toUpperCase(),
        createdAt: new Date().toISOString(),
        profileComplete: true,
      });

      // Ensure the department exists in the departments collection
      try {
        const deptRef = doc(db, "departments", department.toUpperCase());
        const deptSnap = await getDoc(deptRef);
        if (!deptSnap.exists()) {
          let defaultSem = 6;
          if (department.toUpperCase() === "BTECH") defaultSem = 8;
          if (department.toUpperCase() === "MCA") defaultSem = 4;
          await setDoc(deptRef, {
            name: department.toUpperCase(),
            totalSemesters: defaultSem,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (deptErr) {
        console.warn("Auto-creating department document failed:", deptErr);
      }

      // Create notification for teacher
      const notifId = `enroll_${user.uid}`;
      await setDoc(doc(db, "notifications", notifId), {
        title: "New Student Enrolled",
        message: `${studentName} has joined ${department}, Sem ${semester}.`,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        read: false,
        type: "new_student",
        senderId: user.uid,
        senderName: studentName,
        targetRole: "ALL",
        targetDept: department,
        targetSem: semester,
      });

      localStorage.setItem("isExistingStudent", "true");
      setGeneratedId(uniqueId);
      // We don't navigate immediately, we let them see their ID first.
    } catch (err: any) {
      if (
        !err.message ||
        (!err.message.includes("blocked by the teacher") &&
          !err.message.includes("revoked"))
      ) {
        logError("Student enroll error:", err);
      } else {
        setView("student-blocked");
        setLoading(false);
        return;
      }
      setError(err.message || "Failed to enroll");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAfterEnroll = async () => {
    await refreshProfile();
    navigate("/");
  };

  if (view === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Connection Error</h2>
            <p className="text-red-500 text-sm">{error}</p>
            <div className="flex gap-4 mt-4">
              <button 
                onClick={() => { setError(""); setView("teacher-setup"); }} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Force Setup View
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm hover:bg-slate-300"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="w-28 h-28 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform duration-300">
            <Logo size="100%" />
          </div>
        </div>
        {view === "teacher-setup" && (
          <>
            <div className="text-center mb-4 sm:mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Teacher Setup
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Initialize TuitionHub
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleTeacherSetup} className="space-y-2 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Teacher Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Barun Maity"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. teacher@tutionhub.com"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit number"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={teacherPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 10) {
                        setTeacherPhone(val);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Create Dashboard"
                )}
              </button>
            </form>
          </>
        )}

        {view === "teacher-login" && (
          <>
            <div className="text-center mb-4 sm:mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Teacher Login
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Welcome back, {teacherName}
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleTeacherLogin} className="space-y-2 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. teacher@tutionhub.com"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Login"
                )}
              </button>
              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setView("student-login")}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                >
                  Student Login
                </button>
                <button
                  type="button"
                  onClick={() => setView("student-enroll")}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                >
                  Enroll New Student
                </button>
              </div>
            </form>
          </>
        )}

        {view === "student-login" && (
          <>
            <div className="text-center mb-4 sm:mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Student Login
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Access your TuitionHub dashboard
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleStudentLogin} className="space-y-2 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Student ID or Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. TH8492 or Your Name"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Login"
                )}
              </button>
              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setView("student-enroll")}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                >
                  New Student? Enroll Here
                </button>
                <button
                  type="button"
                  onClick={() => setView("teacher-login")}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
                >
                  Teacher Login
                </button>
              </div>
            </form>
          </>
        )}

        {view === "student-enroll" && !generatedId && (
          <>
            <div className="text-center mb-4 sm:mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Enroll in TuitionHub
              </h1>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                Teacher: {teacherName}
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleStudentEnroll} className="space-y-2 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Student Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={studentPhoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 10) setStudentPhoneNumber(val);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email (Gmail)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="email"
                      required
                      placeholder="student@gmail.com"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={studentRealEmail}
                      onChange={(e) => setStudentRealEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Sem {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-12 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Set a secure password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Invite Code
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none "
                    value={studentInviteCode}
                    onChange={(e) =>
                      setStudentInviteCode(e.target.value.toUpperCase())
                    }
                    placeholder="Enter code from teacher"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Enroll Now"
                )}
              </button>
            </form>
            <div className="flex justify-between mt-4 sm:mt-6">
              <button
                onClick={() => setView("student-login")}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Already have an ID? Login
              </button>
              <button
                onClick={() => setView("teacher-login")}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Teacher Login
              </button>
            </div>
          </>
        )}

        {view === "student-enroll" && generatedId && (
          <div className="text-center space-y-3 sm:space-y-6 py-4">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Enrollment Successful!
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 sm:p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Your unique Student ID is:
              </p>
              <p className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 tracking-normal">
                {generatedId}
              </p>
              <p className="text-xs text-red-500 font-bold mt-4">
                ⚠️ Please save this ID. You will need it to login.
              </p>
            </div>
            <button
              onClick={handleContinueAfterEnroll}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
        {view === "student-blocked" && (
          <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Lock className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Access Revoked
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4 sm:mb-6">
              You have been blocked by {teacherName}. Please contact{" "}
              {teacherName} directly for permission to access the platform.
            </p>
            {(teacherPhone || teacherEmail) && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-4 sm:mb-6">
                {teacherPhone && (
                  <div className="flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300">
                    <Phone className="w-4 h-4" />
                    <span>{teacherPhone}</span>
                  </div>
                )}
                {teacherEmail && (
                  <div className="flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300">
                    <Mail className="w-4 h-4" />
                    <span>{teacherEmail}</span>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setView("student-login")}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-semibold transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>

      {auth.currentUser?.email === "mustak.office.use@gmail.com" && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            onClick={handleResetProject}
            disabled={resetting}
            className="flex items-center gap-2 text-xs text-red-500/50 hover:text-red-500 transition-colors"
          >
            {resetting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Nuclear Reset (Developer Only)
          </button>
          <p className="text-[10px] text-slate-400">
            Visible only to {auth.currentUser.email}
          </p>
        </div>
      )}
    </div>
  );
}
