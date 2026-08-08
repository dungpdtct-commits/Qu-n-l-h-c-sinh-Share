import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClassItem, Student, Session, StudentSession, Warning } from '../types';

export interface FirestoreClass {
  id?: string;
  name: string;
  schedule: string;
  target: string;
  archived: boolean;
  gradeLevel: number;
  assistantName: string;
  assistantPhone: string;
  classType?: string; // specialized, standard, remedial
  created_at?: string;
  updated_at?: string;
}

export interface FirestoreStudent {
  id?: string;
  classId: string;
  fullName: string;
  parentPhone: string;
  parentName: string;
  status: 'active' | 'paused' | 'dropped';
  currentGradeYear: number;
  gender?: 'Nam' | 'Nữ';
  note?: string;
  leaveReason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FirestoreSession {
  id?: string;
  classId: string;
  date: string;
  knowledgeTag: string;
  lessonTitle: string;
  chapter: string;
  homeworkDesc: string;
  created_at?: string;
}

export interface FirestoreGrade {
  id?: string;
  sessionId: string;
  studentId: string;
  attendance: 'present' | 'excused' | 'unexcused' | 'late';
  homeworkScore: number;
  testScore: number;
  note: string;
  quickPresetComments?: string[];
  updated_at?: string;
}

export const useFirestore = () => {
  const [classes, setClasses] = useState<FirestoreClass[]>([]);
  const [students, setStudents] = useState<FirestoreStudent[]>([]);
  const [sessions, setSessions] = useState<FirestoreSession[]>([]);
  const [grades, setGrades] = useState<FirestoreGrade[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Real-time Listener for Classes
  useEffect(() => {
    const classesRef = collection(db, 'classes');
    const unsubscribe = onSnapshot(classesRef, (snapshot) => {
      const classList: FirestoreClass[] = [];
      snapshot.forEach((doc) => {
        classList.push({ id: doc.id, ...doc.data() } as FirestoreClass);
      });
      setClasses(classList);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Classes listener error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Listener for Students
  useEffect(() => {
    const studentsRef = collection(db, 'students');
    const unsubscribe = onSnapshot(studentsRef, (snapshot) => {
      const studentList: FirestoreStudent[] = [];
      snapshot.forEach((doc) => {
        studentList.push({ id: doc.id, ...doc.data() } as FirestoreStudent);
      });
      setStudents(studentList);
    }, (err) => {
      console.error("Firestore Students listener error:", err);
    });

    return () => unsubscribe();
  }, []);

  // 3. Real-time Listener for Sessions
  useEffect(() => {
    const sessionsRef = collection(db, 'sessions');
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const sessionList: FirestoreSession[] = [];
      snapshot.forEach((doc) => {
        sessionList.push({ id: doc.id, ...doc.data() } as FirestoreSession);
      });
      setSessions(sessionList);
    }, (err) => {
      console.error("Firestore Sessions listener error:", err);
    });

    return () => unsubscribe();
  }, []);

  // 4. Real-time Listener for Grades
  useEffect(() => {
    const gradesRef = collection(db, 'grades');
    const unsubscribe = onSnapshot(gradesRef, (snapshot) => {
      const gradeList: FirestoreGrade[] = [];
      snapshot.forEach((doc) => {
        gradeList.push({ id: doc.id, ...doc.data() } as FirestoreGrade);
      });
      setGrades(gradeList);
    }, (err) => {
      console.error("Firestore Grades listener error:", err);
    });

    return () => unsubscribe();
  }, []);

  // Actions
  const addClass = async (newClass: Omit<FirestoreClass, 'id'>) => {
    const classesRef = collection(db, 'classes');
    const now = new Date().toISOString();
    return await addDoc(classesRef, {
      ...newClass,
      archived: newClass.archived ?? false,
      created_at: now,
      updated_at: now,
    });
  };

  const updateClass = async (classId: string, updatedData: Partial<FirestoreClass>) => {
    const classDocRef = doc(db, 'classes', classId);
    return await updateDoc(classDocRef, {
      ...updatedData,
      updated_at: new Date().toISOString(),
    });
  };

  const archiveClass = async (classId: string, isArchived = true) => {
    const classDocRef = doc(db, 'classes', classId);
    return await updateDoc(classDocRef, {
      archived: isArchived,
      updated_at: new Date().toISOString(),
    });
  };

  // Promote Class: Elevate Grade 8 to Grade 9 students, preserving score history
  const promoteClass = async (classId: string) => {
    const batch = writeBatch(db);
    const classDocRef = doc(db, 'classes', classId);
    const cls = classes.find(c => c.id === classId);
    
    if (cls) {
      const newGradeLevel = cls.gradeLevel < 9 ? cls.gradeLevel + 1 : 9;
      batch.update(classDocRef, {
        gradeLevel: newGradeLevel,
        name: cls.name.replace(`Lớp ${cls.gradeLevel}`, `Lớp ${newGradeLevel}`),
        updated_at: new Date().toISOString(),
      });
    }

    // Find all students in this class
    const classStudents = students.filter(s => s.classId === classId);
    classStudents.forEach(st => {
      if (st.id) {
        const studentRef = doc(db, 'students', st.id);
        const newYear = st.currentGradeYear < 9 ? st.currentGradeYear + 1 : 9;
        batch.update(studentRef, {
          currentGradeYear: newYear,
          note: `Đã kết chuyển từ Lớp ${st.currentGradeYear} lên Lớp ${newYear} năm học mới`,
          updated_at: new Date().toISOString(),
        });
      }
    });

    await batch.commit();
  };

  // Cascade Delete Guard with confirmation requirement
  const deleteClassWithConfirmation = async (
    classId: string,
    typedConfirmationName: string,
    actualClassName: string
  ) => {
    if ((typedConfirmationName || '').trim() !== (actualClassName || '').trim()) {
      throw new Error(`Xác nhận không khớp! Vui lòng gõ chính xác "${actualClassName}" để xóa.`);
    }

    const batch = writeBatch(db);

    // Delete class doc
    const classRef = doc(db, 'classes', classId);
    batch.delete(classRef);

    // Delete related students
    const classStudents = students.filter(s => s.classId === classId);
    classStudents.forEach(st => {
      if (st.id) batch.delete(doc(db, 'students', st.id));
    });

    // Delete related sessions & grades
    const classSessions = sessions.filter(s => s.classId === classId);
    classSessions.forEach(sess => {
      if (sess.id) {
        batch.delete(doc(db, 'sessions', sess.id));
        const sessGrades = grades.filter(g => g.sessionId === sess.id);
        sessGrades.forEach(g => {
          if (g.id) batch.delete(doc(db, 'grades', g.id));
        });
      }
    });

    await batch.commit();
  };

  const addStudent = async (newStudent: Omit<FirestoreStudent, 'id'>) => {
    const studentsRef = collection(db, 'students');
    const now = new Date().toISOString();
    return await addDoc(studentsRef, {
      ...newStudent,
      created_at: now,
      updated_at: now,
    });
  };

  const updateStudent = async (studentId: string, updatedData: Partial<FirestoreStudent>) => {
    const studentRef = doc(db, 'students', studentId);
    return await updateDoc(studentRef, {
      ...updatedData,
      updated_at: new Date().toISOString(),
    });
  };

  const deleteStudent = async (studentId: string) => {
    const studentRef = doc(db, 'students', studentId);
    return await deleteDoc(studentRef);
  };

  const saveSessionAndGrades = async (
    sessionData: Omit<FirestoreSession, 'id'>,
    gradesList: Omit<FirestoreGrade, 'id' | 'sessionId'>[]
  ) => {
    const sessionsRef = collection(db, 'sessions');
    const sessDoc = await addDoc(sessionsRef, {
      ...sessionData,
      created_at: new Date().toISOString(),
    });

    const batch = writeBatch(db);
    const gradesRef = collection(db, 'grades');

    gradesList.forEach((grd) => {
      const newGradeRef = doc(gradesRef);
      batch.set(newGradeRef, {
        ...grd,
        sessionId: sessDoc.id,
        updated_at: new Date().toISOString(),
      });
    });

    await batch.commit();
    return sessDoc.id;
  };

  // Seed Initial Demo Data into Firestore if empty
  const seedFirestoreInitialData = async () => {
    localStorage.setItem('seed_demo_data_done', 'true');
    return;
  };

  return {
    classes,
    students,
    sessions,
    grades,
    warnings,
    loading,
    addClass,
    updateClass,
    archiveClass,
    promoteClass,
    deleteClassWithConfirmation,
    addStudent,
    updateStudent,
    deleteStudent,
    saveSessionAndGrades,
    seedFirestoreInitialData,
  };
};

export default useFirestore;
