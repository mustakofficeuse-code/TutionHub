import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, addDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { sendNotification, subscribeToNotifications, markAsRead } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';
import {
  Search, CheckCheck, ArrowLeft, Loader2, User, Send,
  MessageCircle, Paperclip, FileText, X as XIcon, Shield,
  GraduationCap, Plus, ChevronDown, ChevronRight, Hash
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

// Types
type ChatRoom = {
  id: string; // "group_DEPT_SEM" or "dm_UID1_UID2"
  type: 'group' | 'private';
  name: string;
  department?: string;
  semester?: string;
  participantId?: string; // for private
  avatarUrl?: string; // for private
};

const getDMId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export default function DoubtSection({ isEmbedded }: { isEmbedded?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, any>>({});
  
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const selectedChatRef = useRef<ChatRoom | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMaterial, setViewMaterial] = useState<any>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  const replyInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Accordion state for teacher sidebar
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [showStudentsList, setShowStudentsList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [chatNotifications, setChatNotifications] = useState<any[]>([]);

  // keep ref up to date
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    
    // Also mark related notifications as read when chat opens
    if (selectedChat) {
      chatNotifications.forEach(n => {
        if (n.relatedId === selectedChat.id && n.id) {
          markAsRead(n.id);
        }
      });
    }
  }, [selectedChat, chatNotifications]);

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      const chatId = e.detail?.chatId;
      if (!chatId) return;

      if (chatId.startsWith('group_')) {
        const parts = chatId.split('_');
        const semIndex = parts.length - 1;
        const sem = parts[semIndex];
        const dept = parts.slice(1, semIndex).join('_');
        setSelectedChat({
          id: chatId,
          type: 'group',
          name: `${dept} - Semester ${sem}`,
          department: dept,
          semester: sem
        });
      } else {
        const uids = chatId.split('_');
        const otherUserId = uids.find((id: string) => id !== profile?.uid);
        if (otherUserId) {
          const otherUser = allUsers[otherUserId];
           setSelectedChat({
              id: chatId,
              type: 'private',
              name: otherUser?.name || 'User',
              participantId: otherUserId,
              avatarUrl: otherUser?.avatarUrl
            });
        }
      }
    };
    window.addEventListener('OPEN_CHAT', handleOpenChat);
    return () => window.removeEventListener('OPEN_CHAT', handleOpenChat);
  }, [profile, allUsers]);

  // Fetch initial data
  useEffect(() => {
    if (!profile) return;

    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        uMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setAllUsers(uMap);
      setLoading(false);
    });

    const isStudent = profile.role === 'student';
    const dept = isStudent ? (profile.courseId || profile.courseName || profile.department) : undefined;
    const sem = isStudent ? String(profile.semester) : undefined;
    const unsubNotifs = subscribeToNotifications(profile.uid, profile.role || 'student', (notifs) => {
      const chatNotifs = notifs.filter(n => !n.read && (n.type === 'chat_message' || n.type === 'group_chat_message'));
      setChatNotifications(chatNotifs);
      
      const counts: Record<string, number> = {};
      chatNotifs.forEach(n => {
        // Auto-read if currently open
        if (selectedChatRef.current && n.relatedId === selectedChatRef.current.id) {
          if (n.id) markAsRead(n.id);
          return;
        }
        
        if (n.relatedId) {
          const key = n.relatedId.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    }, dept, sem);

    return () => {
      unsubDepts();
      unsubUsers();
      unsubNotifs();
    };
  }, [profile]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'chat_messages'),
      where('chatId', '==', selectedChat.id)
    );
    const unsub = onSnapshot(q, snap => {
      const fetchedMessages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedMessages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(fetchedMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    return unsub;
  }, [selectedChat]);

  // File Upload
  const uploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File size too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
    }
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const fileName = `chat/${Date.now()}_${file.name}`;
          const response = await fetch('/api/upload-capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, fileName, contentType: file.type })
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Upload failed');
          }
          const { url } = await response.json();
          resolve(url);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !replyFile) || !selectedChat || !profile) return;

    setSubmitting(true);
    try {
      let fileUrl = '';
      if (replyFile) {
        fileUrl = await uploadFile(replyFile);
      }

      let senderNameToUse = profile.name;
      if (profile.role === 'student' && isAnonymous) {
        senderNameToUse = 'Anonymous Student';
      }

      await addDoc(collection(db, 'chat_messages'), {
        chatId: selectedChat.id,
        chatType: selectedChat.type,
        senderId: profile.uid,
        senderName: senderNameToUse,
        senderRole: profile.role,
        isAnonymous: profile.role === 'student' ? isAnonymous : false,
        content: replyText.trim(),
        attachmentUrl: fileUrl,
        attachmentName: replyFile?.name || '',
        attachmentType: replyFile?.type || '',
        createdAt: new Date().toISOString(),
        status: 'sent',
        participants: selectedChat.type === 'private' ? [profile.uid, selectedChat.participantId] : []
      });

      if (selectedChat.type === 'private' && selectedChat.participantId) {
        await sendNotification({
          title: `New Message from ${senderNameToUse}`,
          message: replyText.trim() || 'Sent an attachment',
          type: 'chat_message',
          senderId: profile.uid,
          senderName: senderNameToUse,
          recipientId: selectedChat.participantId,
          relatedId: selectedChat.id,
          isAnonymous: isAnonymous,
        });
      } else if (selectedChat.type === 'group') {
         await sendNotification({
          title: `New Message in ${selectedChat.name}`,
          message: `${senderNameToUse}: ${replyText.trim() || 'Sent an attachment'}`,
          type: 'group_chat_message',
          senderId: profile.uid,
          senderName: senderNameToUse,
          targetRole: 'ALL',
          relatedId: selectedChat.id,
          targetDept: selectedChat.department,
          targetSem: selectedChat.semester,
          isAnonymous: isAnonymous,
        });
      }

      setReplyText('');
      setReplyFile(null);
    } catch (error: any) {
      console.error("Error sending message:", error);
      alert(error.message || "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  const startPrivateChat = (uid: string) => {
    const user = allUsers[uid];
    if (!user) return;
    setSelectedChat({
      id: getDMId(profile!.uid, uid),
      type: 'private',
      name: user.name,
      participantId: uid,
      avatarUrl: user.avatarUrl
    });
    setShowStudentsList(false);
  };

  const renderSidebar = () => {
    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-wa-teal w-6 h-6" /></div>;

    const teacherObj = Object.values(allUsers).find((u: any) => u.role === 'teacher');
    const peers = Object.values(allUsers).filter((u: any) => u.role === 'student' && u.id !== profile?.uid && (u.courseId === profile?.courseId || u.courseId === profile?.courseName || u.courseName === profile?.courseName || u.courseName === profile?.courseId || u.department === profile?.department || u.department === profile?.courseId) && String(u.semester) === String(profile?.semester));
    const allStudentsList = Object.values(allUsers).filter((u: any) => u.role === 'student' && u.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {profile?.role === 'teacher' ? (
          <>
            <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Group Doubts</div>
            <div className="space-y-1">
              {departments.map(dept => (
                <div key={dept.id} className="border-b border-slate-50 dark:border-white/5">
                  <button 
                    onClick={() => setExpandedDept(expandedDept === dept.name ? null : dept.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-all"
                  >
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-wa-teal/10 text-wa-teal rounded-full flex items-center justify-center">
                           <GraduationCap className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-800 dark:text-[#e9edef]">{dept.name}</span>
                     </div>
                    <div className="flex items-center gap-2">
                       {Object.keys(unreadCounts).filter(k => k.startsWith(`group_${dept.name.toLowerCase()}_`)).reduce((acc, k) => acc + unreadCounts[k], 0) > 0 && (
                          <span className="bg-wa-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                            {Object.keys(unreadCounts).filter(k => k.startsWith(`group_${dept.name.toLowerCase()}_`)).reduce((acc, k) => acc + unreadCounts[k], 0)}
                          </span>
                       )}
                       {expandedDept === dept.name ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedDept === dept.name && (
                      <motion.div 
                        initial={{ height: 0 }} 
                        animate={{ height: 'auto' }} 
                        exit={{ height: 0 }} 
                        className="overflow-hidden bg-slate-50 dark:bg-[#111b21]"
                      >
                        {Array.from({ length: dept.totalSemesters || 8 }).map((_, i) => {
                           const chatId = `group_${dept.name}_${i + 1}`;
                           return (
                             <button
                               key={i}
                               onClick={() => setSelectedChat({ id: chatId, type: 'group', name: `${dept.name} - Semester ${i + 1}`, department: dept.name, semester: String(i + 1) })}
                               className={`w-full flex items-center justify-between gap-3 p-3 pl-14 hover:bg-[#ebebeb] dark:hover:bg-[#2a3942] transition-all text-sm font-medium border-b border-slate-100 dark:border-white/5 ${selectedChat?.id === chatId ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : 'text-slate-600 dark:text-slate-300'}`}
                             >
                                <div className="flex items-center gap-3">
                                  <Hash className="w-4 h-4 text-slate-400" /> Semester {i + 1}
                                </div>
                                {unreadCounts[chatId.toLowerCase()] > 0 && (
                                  <span className="bg-wa-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                    {unreadCounts[chatId.toLowerCase()]}
                                  </span>
                                )}
                             </button>
                           )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="px-4 py-4 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
               <span>Direct Messages</span>
               <button onClick={() => setShowStudentsList(!showStudentsList)} className="text-wa-teal hover:bg-wa-teal/10 p-1 rounded"><Plus className="w-4 h-4" /></button>
            </div>
            
            {showStudentsList && (
              <div className="p-2 bg-slate-50 dark:bg-[#202c33]">
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search student..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-lg outline-none text-slate-800 dark:text-white" />
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                  {allStudentsList.map(s => (
                    <button key={s.id} onClick={() => startPrivateChat(s.id)} className="w-full flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-[#2a3942] rounded-lg transition-all text-left">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200">
                        {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-slate-500 m-2" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-[#e9edef] truncate">{s.name}</div>
                        <div className="text-xs text-slate-500 truncate">{s.courseId} - Sem {s.semester}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">My Group</div>
            <button
               onClick={() => setSelectedChat({ 
                id: `group_${profile?.courseId || profile?.courseName || profile?.department}_${profile?.semester}`, 
                 type: 'group', 
                 name: `${profile?.courseId || profile?.courseName || profile?.department} - Semester ${profile?.semester}`,
                 department: profile?.courseId || profile?.courseName || profile?.department || '',
                 semester: String(profile?.semester || '1')
               })}
               className={`w-full flex items-center justify-between gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-all border-b border-slate-50 dark:border-white/5 ${selectedChat?.id === `group_${profile?.courseId || profile?.courseName || profile?.department}_${profile?.semester}` ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : ''}`}
            >
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-wa-teal/10 text-wa-teal rounded-full flex items-center justify-center shrink-0">
                    <Hash className="w-6 h-6" />
                 </div>
                 <div className="text-left">
                   <div className="font-bold text-slate-900 dark:text-[#e9edef]">{profile?.courseId || profile?.courseName || profile?.department} - Semester {profile?.semester}</div>
                   <div className="text-xs text-slate-500">Group Doubt Session</div>
                 </div>
               </div>
               {unreadCounts[`group_${profile?.courseId || profile?.courseName || profile?.department}_${profile?.semester}`.toLowerCase()] > 0 && (
                  <span className="bg-wa-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                     {unreadCounts[`group_${profile?.courseId || profile?.courseName || profile?.department}_${profile?.semester}`.toLowerCase()]}
                  </span>
               )}
            </button>

            <div className="px-4 py-4 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Direct Messages</div>
            {teacherObj && (
              <button
                 onClick={() => startPrivateChat(teacherObj.id)}
                 className={`w-full flex items-center justify-between gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-all border-b border-slate-50 dark:border-white/5 ${selectedChat?.id === getDMId(profile!.uid, teacherObj.id) ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : ''}`}
              >
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-wa-teal">
                      {teacherObj.avatarUrl ? <img src={teacherObj.avatarUrl} className="w-full h-full object-cover" /> : <Shield className="w-6 h-6" />}
                   </div>
                   <div className="text-left">
                     <div className="font-bold text-slate-900 dark:text-[#e9edef]">{teacherObj.name}</div>
                     <div className="text-xs text-slate-500">Teacher</div>
                   </div>
                 </div>
                 {unreadCounts[getDMId(profile!.uid, teacherObj.id).toLowerCase()] > 0 && (
                  <span className="bg-wa-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                     {unreadCounts[getDMId(profile!.uid, teacherObj.id).toLowerCase()]}
                  </span>
                 )}
              </button>
            )}

            {peers.map(peer => (
              <button
                 key={peer.id}
                 onClick={() => startPrivateChat(peer.id)}
                 className={`w-full flex items-center justify-between gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-all ${selectedChat?.id === getDMId(profile!.uid, peer.id) ? 'bg-[#ebebeb] dark:bg-[#2a3942]' : ''}`}
              >
                 <div className="flex items-center gap-3 flex-1 min-w-0">
                   <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-slate-500">
                      {peer.avatarUrl ? <img src={peer.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-6 h-6" />}
                   </div>
                   <div className="text-left flex-1 min-w-0">
                     <div className="font-bold text-slate-900 dark:text-[#e9edef] truncate">{peer.name}</div>
                     <div className="text-xs text-slate-500 truncate">Student</div>
                   </div>
                 </div>
                 {unreadCounts[getDMId(profile!.uid, peer.id).toLowerCase()] > 0 && (
                  <span className="bg-wa-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
                     {unreadCounts[getDMId(profile!.uid, peer.id).toLowerCase()]}
                  </span>
                 )}
              </button>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`${isEmbedded ? 'absolute inset-0' : 'fixed inset-0'} bg-[#f0f2f5] dark:bg-[#0b141a] transition-colors flex ${!isEmbedded ? 'top-16 pb-0' : ''}`}>
      <div className="flex-1 flex max-w-[1600px] mx-auto w-full overflow-hidden">
        
        {/* Left Sidebar */}
        <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21] flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center gap-3">
             <div className="w-10 h-10 bg-wa-teal rounded-full flex items-center justify-center text-white font-bold shrink-0">
                {profile?.name?.charAt(0)}
             </div>
             <h2 className="font-bold text-slate-800 dark:text-[#e9edef]">Doubts & Chat</h2>
          </div>
          {renderSidebar()}
        </div>

        {/* Right Chat Area */}
        <div className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa] dark:bg-[#222e35] border-b-[6px] border-wa-teal">
              <div className="w-64 h-64 bg-slate-100 dark:bg-[#222e35] rounded-full flex items-center justify-center mb-8">
                 <MessageCircle className="w-32 h-32 text-slate-300 dark:text-slate-600" />
              </div>
              <h2 className="text-3xl font-light text-slate-800 dark:text-[#e9edef] mb-3">TuitionHub Chat</h2>
              <p className="text-slate-600 dark:text-slate-300 max-w-md text-base font-medium">
                Communicate with your teacher and peers. Select a group or a contact from the sidebar to start solving doubts.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 bg-[#f0f2f5] dark:bg-[#202c33] px-4 flex items-center gap-3 shrink-0 z-10 border-l border-slate-200 dark:border-slate-700 shadow-sm">
                <button onClick={() => setSelectedChat(null)} className="md:hidden text-slate-500 p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                   <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-wa-teal">
                  {selectedChat.type === 'group' ? <Hash className="w-5 h-5" /> : (
                    selectedChat.avatarUrl ? <img src={selectedChat.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-[#e9edef] truncate">{selectedChat.name}</h3>
                  <p className="text-xs text-slate-500 truncate">
                     {selectedChat.type === 'group' ? 'Group Doubt Chat' : 'Private Conversation'}
                  </p>
                </div>
              </div>

              {/* Chat Window */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-chat-pattern">
                {messages.length === 0 ? (
                  <div className="flex justify-center mt-10">
                     <span className="bg-[#ffeecd] dark:bg-[#182229] text-slate-700 dark:text-slate-300 px-4 py-2 text-sm rounded-lg shadow-sm text-center">
                        This is the beginning of your chat history.
                     </span>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isOwn = m.senderId === profile?.uid;
                    return (
                      <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[85%] sm:max-w-[70%] p-2 px-3 rounded-xl shadow-sm relative ${
                           isOwn ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'
                         }`}>
                            {selectedChat.type === 'group' && !isOwn && (
                               <p className="text-xs font-bold text-wa-teal dark:text-[#53bdeb] mb-1">{m.senderName}</p>
                            )}

                            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isOwn ? 'text-slate-900 dark:text-[#e9edef]' : 'text-slate-700 dark:text-[#d1d7db]'}`}>
                               {m.content}
                            </p>

                            {m.attachmentUrl && (
                               <div className="mt-2 rounded-lg bg-black/5 p-1">
                                  {m.attachmentType.startsWith('image/') ? (
                                    <img 
                                      src={m.attachmentUrl} 
                                      alt="" 
                                      className="w-full max-h-64 object-contain rounded cursor-pointer"
                                      onClick={() => setViewMaterial({ url: m.attachmentUrl, title: m.attachmentName, type: 'image' })}
                                    />
                                  ) : (
                                    <button 
                                      onClick={() => setViewMaterial({ url: m.attachmentUrl, title: m.attachmentName, type: 'pdf' })}
                                      className="flex items-center gap-2 p-2 w-full text-left bg-white dark:bg-[#2a3942] rounded"
                                    >
                                       <FileText className="w-6 h-6 text-wa-teal" />
                                       <span className="text-xs truncate font-medium flex-1">{m.attachmentName}</span>
                                    </button>
                                  )}
                               </div>
                            )}

                            <div className="flex justify-end items-center gap-1 mt-1 opacity-60">
                               <span className="text-[10px]">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               {isOwn && <CheckCheck className="w-3 h-3" />}
                            </div>
                         </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-3 flex flex-col gap-2 shrink-0 transition-all">
                 <div className="flex items-center gap-2 sm:gap-4">
                   <label className="text-slate-500 hover:text-wa-teal transition-colors cursor-pointer p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                      <Paperclip className="w-6 h-6" />
                      <input ref={replyInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && setReplyFile(e.target.files[0])} />
                   </label>
                   
                   <div className="flex-1 relative">
                      <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                         <div className="flex-1 relative bg-white dark:bg-[#2a3942] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm focus-within:border-wa-teal transition-all overflow-hidden flex flex-col">
                            {replyFile && (
                               <div className="bg-slate-50 dark:bg-[#202c33] p-2 sm:p-3 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                                  <div className="flex items-center gap-2 text-xs font-bold text-wa-teal truncate">
                                     <FileText className="w-4 h-4 shrink-0" /> <span className="truncate">{replyFile.name}</span>
                                  </div>
                                  <button type="button" onClick={() => setReplyFile(null)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-[#111b21] p-1 rounded-full"><XIcon className="w-4 h-4" /></button>
                               </div>
                            )}
                            <textarea
                              rows={replyText.split('\n').length > 1 ? Math.min(replyText.split('\n').length, 5) : 1}
                              placeholder="Type your doubt or message..."
                              className="w-full py-3 sm:py-4 px-4 bg-transparent border-none outline-none text-sm text-slate-800 dark:text-[#e9edef] placeholder:text-[#8696a0] resize-none custom-scrollbar"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                 }
                              }}
                            />
                         </div>
                         <button 
                           type="submit"
                           disabled={submitting || (!replyText.trim() && !replyFile)}
                           className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all shrink-0 ${
                             (!replyText.trim() && !replyFile) ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-wa-teal text-white shadow-lg active:scale-95'
                           }`}
                         >
                           {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                         </button>
                      </form>
                   </div>
                 </div>
                 {profile?.role === 'student' && (
                    <div className="flex items-center justify-end px-1 sm:px-[68px]">
                       <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={isAnonymous}
                            onChange={(e) => setIsAnonymous(e.target.checked)}
                            className="w-3.5 h-3.5 rounded-sm border-slate-300 dark:border-slate-600 outline-none accent-wa-teal"
                          />
                          <span>Hide My Identity</span>
                       </label>
                    </div>
                 )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Media Viewer Modal */}
      {viewMaterial && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-4 sm:px-6 bg-gradient-to-b from-black/50 text-white z-10">
             <span className="font-bold truncate text-sm sm:text-base pr-4 opacity-80">{viewMaterial.title}</span>
             <button 
               onClick={() => setViewMaterial(null)}
               className="p-2 hover:bg-white/10 rounded-full transition-all"
               title="Close"
             >
               <XIcon className="w-6 h-6 sm:w-8 sm:h-8" />
             </button>
          </div>
          <div className="w-full h-full p-4 sm:p-12 flex items-center justify-center">
             {viewMaterial.type === 'pdf' ? (
               <iframe src={viewMaterial.url} className="w-full h-full border-none rounded-xl bg-white" />
             ) : (
               <img src={viewMaterial.url} className="max-w-full max-h-full object-contain" />
             )}
          </div>
        </div>
      )}
    </div>
  );
}
