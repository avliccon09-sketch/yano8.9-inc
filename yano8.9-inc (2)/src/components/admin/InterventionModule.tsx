import React, { useState, useEffect, useMemo } from 'react';
import {
  InterventionRecord,
  InterventionReferrerType,
  InterventionReasonType,
  InterventionStrategyType,
  InterventionStatus,
  InterventionUrgency,
  Appointment,
  AppointmentStatus,
  User,
} from '../../types';
import {
  getInterventionRecords,
  addInterventionRecord,
  updateInterventionRecord,
  archiveInterventionRecord,
  referInterventionRecordToGuidance,
  getUsers,
  getAppointments,
  updateAppointmentByAdmin,
  markAppointmentDoneByAdmin,
  reApproveAppointment,
  archiveAppointment,
  checkAppointmentConflict,
  referAppointmentToGuidance,
  getGuidanceWalkInRecords,
} from '../../services/storage';
import { CollegeLogo } from '../common/CollegeLogo';
import { ConfirmModal } from '../common/ConfirmModal';
import { Modal } from '../common/Modal';
import {
  HeartHandshake,
  Plus,
  Search,
  Eye,
  Printer,
  Archive,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  User as UserIcon,
  Calendar,
  FileText,
  CheckSquare,
  ArrowRight,
  ChevronRight,
  Edit3,
  Shield,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

export type InterventionTab = 'grievances' | 'intervention-form' | 'intervention-records' | 'guidance-walkin-records';

interface InterventionModuleProps {
  currentUser?: User;
  initialTab?: InterventionTab;
}

const formatTime24h = (time12: string): string => {
  if (!time12) return '10:00';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '10:00';
  let [_, hStr, mStr, ampm] = match;
  let h = parseInt(hStr, 10);
  if (ampm && ampm.toUpperCase() === 'PM' && h < 12) h += 12;
  if (ampm && ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mStr}`;
};

const formatTime12h = (time24: string): string => {
  if (!time24) return '10:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

const getRemainingExpirationText = (completedAt?: string) => {
  if (!completedAt) return '1 week expiration';
  const completedTime = new Date(completedAt).getTime();
  if (isNaN(completedTime)) return '1 week expiration';
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const msLeft = completedTime + oneWeek - Date.now();
  if (msLeft <= 0) return 'Expiring to Vault now';
  const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (daysLeft > 0) {
    return `Expires in ${daysLeft}d ${hoursLeft}h (➔ Archive Vault)`;
  }
  return `Expires in ${hoursLeft}h (➔ Archive Vault)`;
};

const REASON_OPTIONS: InterventionReasonType[] = [
  'Academic Concerns',
  'Behavioral Issues',
  'Mental Health Concerns',
  'Financial Concerns',
  'Family Problems',
  'Substance Use',
  'Attendance/Absenteeism',
  'Peer Conflict',
  'Others',
];

const POPUP_REASON_OPTIONS = [
  'Academic concerns',
  'Behavioral issues',
  'Mental health concern',
  'Financial concern',
  'Family problems',
  'Substance use',
  'Attendance/absenteeism',
  'Peer conflict',
  'Others',
];

const STRATEGY_OPTIONS: InterventionStrategyType[] = [
  'Academic Advising',
  'Counseling Services',
  'Referral to Guidance Counselor',
  'Peer Mediation',
  'Parent/Guardian Conference',
  'Financial Assistance Referral',
  'Monitoring and Follow-up',
  'Others',
];

const REFERRER_OPTIONS: InterventionReferrerType[] = [
  'Faculty',
  'Counselor',
  'Parents/Guardian',
  'Self',
  'Peer',
  'Others',
];

export const InterventionModule: React.FC<InterventionModuleProps> = ({ currentUser, initialTab = 'grievances' }) => {
  // Exactly 3 Blue Tabs: 1. Student Grievances, 2. Intervention Form, 3. Intervention Records
  const [activeTab, setActiveTab] = useState<InterventionTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Shared Users State
  const [students, setStudents] = useState<User[]>([]);

  // ==========================================
  // TAB 1: STUDENT GRIEVANCES STATE & LOGIC
  // ==========================================
  const [appointments, setAppointments] = useState<Appointment[]>(() => getAppointments('ADMIN'));
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [selectedWalkInRecord, setSelectedWalkInRecord] = useState<Appointment | null>(null);
  const [printApp, setPrintApp] = useState<Appointment | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [confirmArchiveApp, setConfirmArchiveApp] = useState<Appointment | null>(null);
  const [confirmReferId, setConfirmReferId] = useState<string | null>(null);

  // Strict Conflict Modal State
  const [conflictModalData, setConflictModalData] = useState<{
    isOpen: boolean;
    candidateStudent: string;
    conflictStudent: string;
    conflictStudentId?: string;
    date: string;
    time: string;
    message: string;
  } | null>(null);

  const [grievanceSearchQuery, setGrievanceSearchQuery] = useState('');
  const [grievanceStatusFilter, setGrievanceStatusFilter] = useState<string>('ALL');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('02:00 PM');
  const [adminNotes, setAdminNotes] = useState('');

  // ==========================================
  // TAB 2 & 3: INTERVENTION RECORDS & FORM STATE
  // ==========================================
  const [records, setRecords] = useState<InterventionRecord[]>([]);

  // Search & Filter State for Intervention Records
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReason, setFilterReason] = useState<string>('ALL');
  const [filterReferrer, setFilterReferrer] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals for Intervention Records
  const [selectedRecord, setSelectedRecord] = useState<InterventionRecord | null>(null);
  const [activeMetricModal, setActiveMetricModal] = useState<'TOTAL' | 'ACTIVE' | 'FOLLOW_UP_REQUIRED' | 'RESOLVED' | null>(null);
  const [printRecord, setPrintRecord] = useState<InterventionRecord | null>(null);
  const [editRecord, setEditRecord] = useState<InterventionRecord | null>(null);
  const [archiveConfirmRecord, setArchiveConfirmRecord] = useState<InterventionRecord | null>(null);
  const [referToGuidanceRecord, setReferToGuidanceRecord] = useState<InterventionRecord | null>(null);

  // Refer to Guidance 9-Point Form Popup States
  const [popupDateOfReferral, setPopupDateOfReferral] = useState(new Date().toISOString().split('T')[0]);
  const [popupReferredByPersonnel, setPopupReferredByPersonnel] = useState('Princess Ann T. Ruzol (OSAS Officer)');
  const [popupReferredByDesignation, setPopupReferredByDesignation] = useState('OSAS Administrator');
  const [popupReasonForReferral, setPopupReasonForReferral] = useState('');
  const [popupReasons, setPopupReasons] = useState<string[]>([]);
  const [popupReasonsOther, setPopupReasonsOther] = useState('');
  const [popupRecommendedDesignation] = useState('Guidance and Counseling Services');
  const [popupActionTakenSummary, setPopupActionTakenSummary] = useState('');
  const [popupUrgencyOfReferral, setPopupUrgencyOfReferral] = useState('Within 3 days');
  const [popupAttachmentsType, setPopupAttachmentsType] = useState('None / Not Applicable');
  const [popupAttachmentsOther, setPopupAttachmentsOther] = useState('');
  const [popupOsasApprovalName, setPopupOsasApprovalName] = useState('Princess Ann T. Ruzol');
  const [popupOsasApprovalDate, setPopupOsasApprovalDate] = useState(new Date().toISOString().split('T')[0]);
  const [popupApprovedBy, setPopupApprovedBy] = useState('OSAS Administrator');
  const [popupReceivedByName, setPopupReceivedByName] = useState('Maria Mel B. Glemao');
  const [popupReceivedByPosition, setPopupReceivedByPosition] = useState('Registered Guidance Counselor (RGC)');
  const [popupReceivedDate, setPopupReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [popupReceivedActionRemarks, setPopupReceivedActionRemarks] = useState(
    'Acknowledged and received by Guidance and Counseling Office for intake counseling and case management.'
  );
  const [popupError, setPopupError] = useState<string | null>(null);

  // Intervention Form Fields State
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [selectedStudentUser, setSelectedStudentUser] = useState<User | null>(null);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  const [dateOfReferral, setDateOfReferral] = useState(new Date().toISOString().split('T')[0]);
  const [referredBy, setReferredBy] = useState<InterventionReferrerType>('Faculty');
  const [referredByOther, setReferredByOther] = useState('');
  const [nameOfReferrer, setNameOfReferrer] = useState('');
  const [relationshipToStudent, setRelationshipToStudent] = useState('');

  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [reasonsOther, setReasonsOther] = useState('');
  const [descriptionOfConcerns, setDescriptionOfConcerns] = useState('');

  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [strategiesOther, setStrategiesOther] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [responsibleParties, setResponsibleParties] = useState('OSAS Administrator, Guidance Counselor');
  const [status, setStatus] = useState<InterventionStatus>('ACTIVE');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // REAL-TIME DATA LOADING & SYNCHRONIZATION
  // ==========================================
  const loadData = () => {
    setRecords(getInterventionRecords('ADMIN'));
    const freshApps = getAppointments('ADMIN');
    setAppointments(freshApps);
    setSelectedApp((prev) => {
      if (!prev) return null;
      const updated = freshApps.find((a) => a.id === prev.id);
      return updated || prev;
    });

    try {
      const allUsers = getUsers();
      setStudents(allUsers.filter((u) => u.role === 'STUDENT'));
    } catch {
      setStudents([]);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    window.addEventListener('osas_storage_updated', loadData);
    window.addEventListener('storage', loadData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('osas_storage_updated', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, []);

  // ==========================================
  // STUDENT GRIEVANCES ACTION HANDLERS
  // ==========================================
  const handleApproveAppointment = (id: string) => {
    const conflict = checkAppointmentConflict(id);
    if (conflict.hasConflict) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Ibang Estudyante',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: conflict.formattedConflictDate || target?.preferredDate || '',
        time: conflict.formattedConflictTime || target?.preferredTime || '',
        message:
          conflict.message ||
          `Mayroon nang aprubadong appointment sa parehong petsa at oras. Bawal ang duplicate approval.`,
      });
      return;
    }

    try {
      const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
      const note = 'Approved by OSAS Admin';
      updateAppointmentByAdmin(id, 'APPROVED', undefined, undefined, note, actorName);
      loadData();
    } catch (err: any) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: 'Existing Approved Appointment',
        date: target?.preferredDate || '',
        time: target?.preferredTime || '',
        message: err.message || 'Hindi maaprubahan ang appointment dahil sa schedule conflict.',
      });
    }
  };

  const handleConfirmRejectAppointment = () => {
    if (!confirmRejectId) return;
    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    const note = 'Appointment request declined by OSAS Admin. Please re-schedule or contact OSAS office.';
    updateAppointmentByAdmin(
      confirmRejectId,
      'REJECTED',
      undefined,
      undefined,
      note,
      actorName
    );
    loadData();
    setConfirmRejectId(null);
  };

  const handleConfirmReferAppointment = () => {
    if (!confirmReferId) return;
    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    referAppointmentToGuidance(
      confirmReferId,
      'Referred from OSAS Admin for guidance evaluation and counseling.',
      actorName
    );
    loadData();
    setConfirmReferId(null);
  };

  const handleReApproveAppointment = (id: string) => {
    const conflict = checkAppointmentConflict(id);
    if (conflict.hasConflict) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Ibang Estudyante',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: conflict.formattedConflictDate || target?.preferredDate || '',
        time: conflict.formattedConflictTime || target?.preferredTime || '',
        message:
          conflict.message ||
          `Mayroon nang aprubadong appointment sa parehong petsa at oras. Bawal ang duplicate approval.`,
      });
      return;
    }

    try {
      const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
      reApproveAppointment(id, actorName);
      loadData();
    } catch (err: any) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: 'Existing Approved Appointment',
        date: target?.preferredDate || '',
        time: target?.preferredTime || '',
        message: err.message || 'Hindi maaprubahan ang appointment dahil sa schedule conflict.',
      });
    }
  };

  const handleConfirmArchiveAppointment = () => {
    if (!confirmArchiveApp) return;
    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    archiveAppointment(confirmArchiveApp.id, actorName);
    loadData();
    setConfirmArchiveApp(null);
    setSelectedApp(null);
  };

  const handleRescheduleSubmit = (id: string) => {
    if (selectedApp?.status === 'REFERRED_TO_GUIDANCE' || selectedApp?.referredToGuidance) {
      alert('This appointment has been referred to the Guidance Admin. Only the Guidance Admin is authorized to reschedule it.');
      return;
    }

    if (!rescheduleDate) {
      alert('Please select a preferred date for rescheduling.');
      return;
    }

    const conflict = checkAppointmentConflict(id, rescheduleDate, rescheduleTime);
    if (conflict.hasConflict) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Ibang Estudyante',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: rescheduleDate,
        time: rescheduleTime,
        message: `Hindi maaaring ilipat sa ${rescheduleDate} nang ${rescheduleTime} dahil mayroon nang kasalukuyang aprubadong appointment si ${conflict.conflictingAppointment?.studentName}. Mangyaring pumili ng ibang bakanteng petsa o oras.`,
      });
      return;
    }

    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    updateAppointmentByAdmin(
      id,
      'RESCHEDULED',
      rescheduleDate,
      rescheduleTime,
      adminNotes || 'Rescheduled by OSAS Admin due to conflict/session availability.',
      actorName,
      'ADMIN'
    );
    loadData();
  };

  const handleMarkAppointmentDone = (id: string) => {
    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    markAppointmentDoneByAdmin(id, actorName);
    loadData();
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const matchesSearch =
        (a.studentName || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase()) ||
        (a.studentId || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase()) ||
        (a.studentEmail || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase()) ||
        (a.description || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase());

      const matchesStatus = grievanceStatusFilter === 'ALL' || a.status === grievanceStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, grievanceSearchQuery, grievanceStatusFilter]);

  const rejectTargetApp = confirmRejectId ? appointments.find((a) => a.id === confirmRejectId) : null;
  const referTargetApp = confirmReferId ? appointments.find((a) => a.id === confirmReferId) : null;

  // ==========================================
  // INTERVENTION FORM & RECORDS HANDLERS
  // ==========================================
  const togglePopupReason = (reason: string) => {
    setPopupReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const openReferToGuidancePopup = (rec: InterventionRecord) => {
    setReferToGuidanceRecord(rec);
    setSelectedRecord(null);
    setPopupDateOfReferral(new Date().toISOString().split('T')[0]);
    setPopupReferredByPersonnel('Princess Ann T. Ruzol (OSAS Officer)');
    setPopupReferredByDesignation('OSAS Administrator');
    setPopupReasonForReferral(
      rec.reasonForReferral || rec.descriptionOfConcerns || ''
    );

    const initialReasons: string[] = [];
    (rec.reasons || []).forEach((r) => {
      const match = POPUP_REASON_OPTIONS.find(
        (opt) => opt.toLowerCase() === r.toLowerCase()
      );
      if (match && !initialReasons.includes(match)) {
        initialReasons.push(match);
      } else if (!match && r && !initialReasons.includes('Others')) {
        initialReasons.push('Others');
      }
    });
    if (initialReasons.length === 0) {
      initialReasons.push('Behavioral issues');
    }
    setPopupReasons(initialReasons);
    setPopupReasonsOther(rec.reasonsOther || '');

    setPopupActionTakenSummary(
      rec.actionTakenSummary ||
      rec.summaryOfActionTaken ||
      (rec.strategies && rec.strategies.length > 0
        ? `Strategies applied: ${rec.strategies.join(', ')}. Next steps: ${rec.nextSteps || 'Initial consultation completed.'}`
        : 'Initial intake interview and preliminary observations completed by OSAS.')
    );

    setPopupUrgencyOfReferral(
      rec.urgencyOfReferral || 'Within 3 days'
    );

    setPopupAttachmentsType(rec.attachmentsType || 'None / Not Applicable');
    setPopupAttachmentsOther(rec.attachmentsOther || '');

    setPopupOsasApprovalName(rec.osasApprovalName || currentUser?.fullName || 'Princess Ann T. Ruzol');
    setPopupOsasApprovalDate(new Date().toISOString().split('T')[0]);
    setPopupApprovedBy(rec.approvedBy || 'OSAS Administrator');

    setPopupReceivedByName(rec.receivedByName || 'Maria Mel B. Glemao');
    setPopupReceivedByPosition(rec.receivedByPosition || 'Registered Guidance Counselor (RGC)');
    setPopupReceivedDate(new Date().toISOString().split('T')[0]);
    setPopupReceivedActionRemarks(
      rec.receivedActionRemarks ||
      'Acknowledged and received by Guidance and Counseling Office for intake counseling and case management.'
    );
    setPopupError(null);
  };

  const handleConfirmReferral = () => {
    if (!referToGuidanceRecord) return;
    if (!popupReasonForReferral.trim()) {
      setPopupError('Please provide a brief description or summary of concerns for the referral.');
      return;
    }
    if (popupReasons.length === 0) {
      setPopupError('Please select at least one Reason for Intervention from the checklist.');
      return;
    }
    if (popupReasons.includes('Others') && !popupReasonsOther.trim()) {
      setPopupError('Please specify the other reason for intervention.');
      return;
    }
    if (popupAttachmentsType === 'Others' && !popupAttachmentsOther.trim()) {
      setPopupError('Please specify the other attachment details.');
      return;
    }

    let urgencyLevel: InterventionUrgency = 'MEDIUM';
    if (popupUrgencyOfReferral.startsWith('Immediate')) {
      urgencyLevel = 'URGENT';
    } else if (popupUrgencyOfReferral.startsWith('Within 3')) {
      urgencyLevel = 'HIGH';
    } else if (popupUrgencyOfReferral.startsWith('Within 1')) {
      urgencyLevel = 'MEDIUM';
    } else {
      urgencyLevel = 'LOW';
    }

    referInterventionRecordToGuidance(referToGuidanceRecord.id, {
      dateOfReferral: popupDateOfReferral,
      referredByPersonnel: popupReferredByPersonnel,
      referredBy: popupReferredByPersonnel,
      referredByDesignation: popupReferredByDesignation,
      reasonForReferral: popupReasonForReferral,
      descriptionOfConcerns: popupReasonForReferral,
      reasons: popupReasons,
      reasonsOther: popupReasons.includes('Others') ? popupReasonsOther : undefined,
      recommendedDesignation: popupRecommendedDesignation,
      actionTakenSummary: popupActionTakenSummary,
      summaryOfActionTaken: popupActionTakenSummary,
      urgencyOfReferral: popupUrgencyOfReferral,
      urgency: urgencyLevel,
      urgencyLevel: urgencyLevel,
      attachmentsType: popupAttachmentsType,
      attachmentsOther: popupAttachmentsType === 'Others' ? popupAttachmentsOther : undefined,
      osasApprovalName: popupOsasApprovalName,
      osasApprovalDate: popupOsasApprovalDate,
      approvedBy: popupApprovedBy,
      receivedByName: popupReceivedByName,
      receivedByPosition: popupReceivedByPosition,
      receivedDate: popupReceivedDate,
      receivedActionRemarks: popupReceivedActionRemarks,
      notes: `${popupReasonForReferral}\n\nSummary of Action Taken by OSAS:\n${popupActionTakenSummary}`,
    });

    setReferToGuidanceRecord(null);
    loadData();
  };

  const studentSuggestions = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const q = studentSearchInput.toLowerCase().trim();
    return students.filter(
      (s) =>
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        s.fullName.toLowerCase().includes(q) ||
        (s.course && s.course.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [students, studentSearchInput]);

  const handleSelectStudent = (student: User) => {
    setSelectedStudentUser(student);
    setStudentSearchInput(`${student.fullName} (${student.studentId || 'No ID'})`);
    setStudentId(student.studentId || student.id);
    setStudentName(student.fullName);
    setCourse(student.course || 'BS Information Technology');
    setYearLevel(student.yearLevel || '1st Year');
    setContactNumber(student.contactNumber || '09171234567');
    setAddress(student.address || 'Dingalan, Aurora');
    setEmail(student.email || '');
    setShowStudentSuggestions(false);
    setFormError(null);
  };

  const handleClearSelectedStudent = () => {
    setSelectedStudentUser(null);
    setStudentSearchInput('');
    setStudentId('');
    setStudentName('');
    setCourse('');
    setYearLevel('');
    setContactNumber('');
    setAddress('');
    setEmail('');
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const toggleStrategy = (strategy: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(strategy) ? prev.filter((s) => s !== strategy) : [...prev, strategy]
    );
  };

  const resetForm = () => {
    handleClearSelectedStudent();
    setDateOfReferral(new Date().toISOString().split('T')[0]);
    setReferredBy('Faculty');
    setReferredByOther('');
    setNameOfReferrer('');
    setRelationshipToStudent('');
    setSelectedReasons([]);
    setReasonsOther('');
    setDescriptionOfConcerns('');
    setSelectedStrategies([]);
    setStrategiesOther('');
    setNextSteps('');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setFollowUpDate(d.toISOString().split('T')[0]);
    setResponsibleParties('OSAS Administrator, Guidance Counselor');
    setStatus('ACTIVE');
    setFormError(null);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!studentName.trim() || !studentId.trim()) {
      setFormError('Please select or enter valid Student Information (Student ID and Full Name are required).');
      return;
    }

    if (referredBy === 'Others' && !referredByOther.trim()) {
      setFormError('Please specify the Specific Referrer.');
      return;
    }

    if (selectedReasons.length === 0 && !reasonsOther.trim()) {
      setFormError('Please select at least one Reason for Intervention.');
      return;
    }

    if (!descriptionOfConcerns.trim()) {
      setFormError('Please provide a narrative description of the concerns and observations.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdByName = currentUser?.fullName || 'OSAS Administrator';
      addInterventionRecord(
        {
          studentId: studentId.trim(),
          studentName: studentName.trim(),
          course: course.trim() || 'N/A',
          yearLevel: yearLevel.trim() || 'N/A',
          contactNumber: contactNumber.trim() || 'N/A',
          address: address.trim() || 'N/A',
          email: email.trim() || undefined,
          dateOfReferral,
          referredBy,
          referredByOther: referredBy === 'Others' ? referredByOther.trim() : undefined,
          nameOfReferrer: nameOfReferrer.trim() || undefined,
          relationshipToStudent: relationshipToStudent.trim() || undefined,
          reasons: selectedReasons,
          reasonsOther: selectedReasons.includes('Others') ? reasonsOther.trim() : undefined,
          descriptionOfConcerns: descriptionOfConcerns.trim(),
          strategies: selectedStrategies,
          strategiesOther: selectedStrategies.includes('Others') ? strategiesOther.trim() : undefined,
          nextSteps: nextSteps.trim() || 'Scheduled for follow-up and monitoring.',
          followUpDate: followUpDate || undefined,
          responsibleParties: responsibleParties.trim() || 'OSAS Administrator, Guidance Counselor',
          status,
          urgencyLevel: 'MEDIUM',
        },
        createdByName
      );

      resetForm();
      loadData();
      setActiveTab('intervention-records');
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = (record: InterventionRecord) => {
    const adminName = currentUser?.fullName || 'OSAS Administrator';
    archiveInterventionRecord(record.id, adminName);
    setArchiveConfirmRecord(null);
    setSelectedRecord(null);
    loadData();
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const recReasons = Array.isArray(rec.reasons) ? rec.reasons : [];
      const matchesSearch =
        searchQuery.trim() === '' ||
        (rec.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.course || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.referredBy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.nameOfReferrer && rec.nameOfReferrer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        recReasons.some((r) => r && r.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rec.descriptionOfConcerns || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesReason =
        filterReason === 'ALL' || recReasons.includes(filterReason as any);

      const matchesReferrer =
        filterReferrer === 'ALL' || rec.referredBy === filterReferrer;

      const matchesStatus =
        filterStatus === 'ALL' || rec.status === filterStatus;

      return Boolean(matchesSearch && matchesReason && matchesReferrer && matchesStatus);
    });
  }, [records, searchQuery, filterReason, filterReferrer, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      active: records.filter((r) => r.status === 'ACTIVE').length,
      followUp: records.filter((r) => r.status === 'FOLLOW_UP_REQUIRED').length,
      resolved: records.filter((r) => r.status === 'RESOLVED').length,
    };
  }, [records]);

  const handlePrintSlip = (record: InterventionRecord) => {
    setPrintRecord(record);
  };

  const getStatusBadge = (recStatus: InterventionStatus) => {
    switch (recStatus) {
      case 'REFERRED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 w-fit">
            <Clock className="w-3 h-3 text-amber-600" />
            Referred to Guidance
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
            Intake Received
          </span>
        );
      case 'IN_PROGRESS':
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            In Progress (Counseling)
          </span>
        );
      case 'FOLLOW_UP':
      case 'FOLLOW_UP_REQUIRED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 w-fit">
            <Clock className="w-3 h-3 text-purple-600" />
            Follow-up Required
          </span>
        );
      case 'COMPLETED':
      case 'RESOLVED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed / Concluded
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700">
            {recStatus}
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency?: InterventionUrgency) => {
    switch (urgency) {
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            🚨 Urgent Priority
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            ⚡ High Priority
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Medium Priority
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Low Priority
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Background content (hidden during print when print modals are open) */}
      <div className={`space-y-6 ${printRecord || printApp ? 'print:hidden' : ''}`}>
        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-2xl text-blue-600 dark:text-blue-400">
                <HeartHandshake className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Student Intervention Module
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Comprehensive student grievances, case referrals, behavioral assessment, counseling strategies, and academic follow-up management.
                </p>
              </div>
            </div>
          </div>

          {/* Exactly 3 Blue Tabs Using the Same Blue Tab Style as Existing Student Grievances */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Tab 1: Student Grievances */}
            <button
              type="button"
              onClick={() => setActiveTab('grievances')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'grievances'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Student Grievances</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'grievances' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {appointments.length}
              </span>
            </button>

            {/* Tab 2: Intervention Form */}
            <button
              type="button"
              onClick={() => setActiveTab('intervention-form')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'intervention-form'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Intervention Form</span>
            </button>

            {/* Tab 3: Intervention Records */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('intervention-records');
                resetForm();
              }}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'intervention-records'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Intervention Records</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'intervention-records' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {records.length}
              </span>
            </button>

            {/* Tab 4: Guidance Walk-In Records */}
            <button
              type="button"
              onClick={() => setActiveTab('guidance-walkin-records')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'guidance-walkin-records'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Guidance Walk-In Records</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'guidance-walkin-records' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {getAppointments('GUIDANCE_ADMIN').length}
              </span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 4: GUIDANCE WALK-IN RECORDS (VIEW-ONLY)              */}
        {/* ======================================================== */}
        {activeTab === 'guidance-walkin-records' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Guidance Walk-In Records (View-Only)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Official records submitted and logged by the Guidance Office via Student Grievance Form – Walk-In
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {getGuidanceWalkInRecords().length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-xs font-medium">
                  No guidance walk-in records found.
                </p>
              ) : (
                getGuidanceWalkInRecords().map((app) => {
                  const displayStatus = app.status;

                  return (
                    <div
                      key={app.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-xs"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {app.studentName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            (ID: {app.studentId || 'N/A'}) • {app.studentEmail}
                          </span>
                          <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200">
                            {displayStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">Reason / Concern / Purpose:</span> {app.description || 'No description provided'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          {app.preferredDate || 'N/A'} ({app.preferredTime || 'N/A'})
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setSelectedWalkInRecord(app)}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* View-Only Modal for Guidance Walk-In Records */}
        {selectedWalkInRecord && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedWalkInRecord(null)}
            title={`Guidance Walk-In Record - ${selectedWalkInRecord.studentName}`}
            subtitle={`Record ID: #${selectedWalkInRecord.id}`}
            maxWidth="lg"
          >
            <div className="space-y-4 p-2 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Student Number</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedWalkInRecord.studentId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedWalkInRecord.studentName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Course / Academic Program</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.course || selectedWalkInRecord.academicProgram || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Year Level</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.yearLevel || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Number</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.contactNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {(() => {
                        const allInt = getInterventionRecords('ADMIN');
                        const match = allInt.find(inv => inv.studentId === selectedWalkInRecord.studentId || inv.studentId === selectedWalkInRecord.id);
                        return match?.status || selectedWalkInRecord.status;
                      })()}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Complete Address</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.completeAddress || 'N/A'}</span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Reason / Concern / Purpose
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                    {selectedWalkInRecord.description}
                  </p>
                </div>

                {selectedWalkInRecord.actionTaken && (
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Action Taken
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 font-semibold">
                      {selectedWalkInRecord.actionTaken}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <span className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider block text-[10px]">
                      Submitted Date & Time
                    </span>
                    <p className="font-mono text-blue-700 dark:text-blue-300 font-bold mt-0.5">
                      {selectedWalkInRecord.preferredDate} @ {selectedWalkInRecord.preferredTime}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedWalkInRecord(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close (View-Only)
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* TAB 1: STUDENT GRIEVANCES (RECORDS LAYOUT/DESIGN)        */}
        {/* ======================================================== */}
        {activeTab === 'grievances' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-2xl">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Student Grievances Records
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage student grievances, consultation sessions, and scheduling approvals
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={grievanceSearchQuery}
                    onChange={(e) => setGrievanceSearchQuery(e.target.value)}
                    placeholder="Search grievance..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <select
                  value={grievanceStatusFilter}
                  onChange={(e) => setGrievanceStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="REFERRED_TO_GUIDANCE">Referred to Guidance</option>
                  <option value="APPROVED">Approved</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Appointments Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3.5">Student Details</th>
                    <th className="p-3.5">Concern / Purpose</th>
                    <th className="p-3.5">Schedule</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        No student grievances found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((a) => {
                      const isCompleted = a.status === 'COMPLETED';
                      const isRejected = a.status === 'REJECTED';
                      const isReferred = a.status === 'REFERRED_TO_GUIDANCE' || a.referredToGuidance;

                      return (
                        <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <span className="font-black text-slate-900 dark:text-white block">{a.studentName}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
                              {a.studentId} • {a.studentEmail}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-xs">
                            <p className="line-clamp-2 text-slate-700 dark:text-slate-300">{a.description}</p>
                          </td>

                          <td className="p-3.5 font-mono text-[11px] text-blue-700 dark:text-blue-400 font-bold">
                            <div>
                              {a.preferredDate} ({a.preferredTime})
                            </div>
                            {a.adminPreferredDate && (
                              <div className="text-purple-700 dark:text-purple-400 text-[10px] mt-0.5">
                                ↳ Resched: {a.adminPreferredDate} @ {a.adminPreferredTime}
                              </div>
                            )}
                            {/* Real-time Conflict Alert Badge in Table */}
                            {a.status !== 'APPROVED' && a.status !== 'COMPLETED' && (() => {
                              const conflictCheck = checkAppointmentConflict(a.id);
                              if (!conflictCheck.hasConflict || !conflictCheck.conflictingAppointment) return null;
                              return (
                                <div className="mt-1">
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black rounded-md bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                    title={`May conflict sa approved appointment ni ${conflictCheck.conflictingAppointment.studentName}`}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                    Conflict: {conflictCheck.conflictingAppointment.studentName}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="p-3.5">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${
                                  isCompleted
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                                    : isRejected
                                    ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300'
                                    : a.status === 'APPROVED'
                                    ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300'
                                    : a.status === 'RESCHEDULED'
                                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300'
                                    : isReferred
                                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                                }`}
                              >
                                {a.status === 'REFERRED_TO_GUIDANCE' ? 'REFERRED TO GUIDANCE' : a.status}
                              </span>

                              {/* 1-Week Auto Expiration Indicator for Completed Appointments */}
                              {isCompleted && a.completedAt && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500" /> {getRemainingExpirationText(a.completedAt)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedApp(a);
                                setRescheduleDate(a.adminPreferredDate || a.preferredDate);
                                setRescheduleTime(a.adminPreferredTime || a.preferredTime);
                                setAdminNotes(a.adminNotes || '');
                              }}
                              className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: INTERVENTION FORM (EXACT EXISTING FORM)          */}
        {/* ======================================================== */}
        {activeTab === 'intervention-form' && (
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-8">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  Student Support Services
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  New Student Intervention Record
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Log behavioral, academic, or personal support cases for proactive follow-up and monitoring.
                </p>
              </div>
            </div>

            {formError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-8">
              {/* Section 1: Student Information */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      1
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Student Information *
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Search student to auto-populate record details
                      </p>
                    </div>
                  </div>
                  {selectedStudentUser && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Filled
                    </span>
                  )}
                </div>

                {/* Student Lookup Searchbox */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Search by Student ID or Full Name *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={studentSearchInput}
                      onChange={(e) => {
                        setStudentSearchInput(e.target.value);
                        setShowStudentSuggestions(true);
                      }}
                      onFocus={() => setShowStudentSuggestions(true)}
                      placeholder="Type student name or ID (e.g., Juan Dela Cruz, 2024-0101)..."
                      className="w-full pl-10 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {studentSearchInput && (
                      <button
                        type="button"
                        onClick={handleClearSelectedStudent}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Suggestions Dropdown */}
                  {showStudentSuggestions && studentSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Matching Registered Students (Click to Select)
                      </div>
                      {studentSuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="w-full px-4 py-2.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {s.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              ID: {s.studentId || s.id} • {s.course || 'BSIT'} ({s.yearLevel || '1st Year'})
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                            Select ➔
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Student Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Student ID Number *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!!selectedStudentUser}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. 2024-0101"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono font-bold ${
                        selectedStudentUser
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Student Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!!selectedStudentUser}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Full name of student..."
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-bold ${
                        selectedStudentUser
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Course / Academic Program *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!!selectedStudentUser}
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. BS Information Technology"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                        selectedStudentUser
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Year Level *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!!selectedStudentUser}
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      placeholder="e.g. 3rd Year"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                        selectedStudentUser
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Contact Number *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!!selectedStudentUser}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. 09171234567"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                        selectedStudentUser
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Complete Address *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={!!selectedStudentUser}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Brgy. Dingalan, Aurora"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                        selectedStudentUser
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Referral & Context Information */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Referral & Context Information *
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Source and background details of the intervention
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Date of Referral *
                      </label>
                      <span className="text-[10px] text-slate-400 font-semibold">(Automatic)</span>
                    </div>
                    <input
                      type="date"
                      required
                      readOnly
                      value={dateOfReferral}
                      className="w-full h-10 px-3.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold cursor-not-allowed focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Referred By *
                    </label>
                    <select
                      value={referredBy}
                      onChange={(e) => {
                        const val = e.target.value as InterventionReferrerType;
                        setReferredBy(val);
                        if (val !== 'Others') {
                          setReferredByOther('');
                        }
                      }}
                      className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {REFERRER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === 'Faculty'
                            ? 'Faculty / Instructor'
                            : opt === 'Counselor'
                            ? 'Guidance Counselor'
                            : opt === 'Parents/Guardian'
                            ? 'Parents / Guardian'
                            : opt === 'Self'
                            ? 'Self Referral'
                            : opt === 'Peer'
                            ? 'Peer / Classmate'
                            : opt}
                        </option>
                      ))}
                    </select>

                    {referredBy === 'Others' && (
                      <div className="pt-2 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Specific Referrer *
                        </label>
                        <input
                          type="text"
                          required
                          value={referredByOther}
                          onChange={(e) => setReferredByOther(e.target.value)}
                          placeholder="Enter specific referrer..."
                          className="w-full h-10 px-3.5 text-xs border border-blue-300 dark:border-blue-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Name of Referrer (Optional)
                    </label>
                    <input
                      type="text"
                      value={nameOfReferrer}
                      onChange={(e) => setNameOfReferrer(e.target.value)}
                      placeholder="e.g. Prof. Santos"
                      className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Relationship to Student
                    </label>
                    <input
                      type="text"
                      value={relationshipToStudent}
                      onChange={(e) => setRelationshipToStudent(e.target.value)}
                      placeholder="e.g. Program Adviser"
                      className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Reason for Intervention */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      3
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Reason for Intervention *
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Check all applicable areas of concern
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-bold">
                    {selectedReasons.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {REASON_OPTIONS.map((reason) => {
                    const isChecked = selectedReasons.includes(reason);
                    return (
                      <label
                        key={reason}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleReason(reason)}
                          className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold leading-tight">{reason}</span>
                      </label>
                    );
                  })}
                </div>

                {selectedReasons.includes('Others') && (
                  <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-1">
                    <label className="block text-xs font-bold text-blue-900 dark:text-blue-200">
                      Specify Other Reason for Intervention *
                    </label>
                    <input
                      type="text"
                      required
                      value={reasonsOther}
                      onChange={(e) => setReasonsOther(e.target.value)}
                      placeholder="Enter specific concern or other reason..."
                      className="w-full px-3.5 py-2 text-xs border border-blue-300 dark:border-blue-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Section 4: Description and Concerns */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    4
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Description and Concerns *
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Comprehensive narrative and observation details of student concerns
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Narrative Description of Concerns & Observations *
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={descriptionOfConcerns}
                    onChange={(e) => setDescriptionOfConcerns(e.target.value)}
                    placeholder="Provide comprehensive details regarding the student's behavior, academic issues, and observed situation..."
                    className="w-full p-4 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Section 5: Intervention Strategies */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      5
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Intervention Strategies *
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Action strategies and intervention modalities planned for this case
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-bold">
                    {selectedStrategies.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {STRATEGY_OPTIONS.map((strat) => {
                    const isChecked = selectedStrategies.includes(strat);
                    return (
                      <label
                        key={strat}
                        className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-bold shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStrategy(strat)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>{strat}</span>
                      </label>
                    );
                  })}
                </div>

                {selectedStrategies.includes('Others') && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                    <label className="block text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
                      Specify Other Strategy *
                    </label>
                    <input
                      type="text"
                      required
                      value={strategiesOther}
                      onChange={(e) => setStrategiesOther(e.target.value)}
                      placeholder="Specify other intervention strategy..."
                      className="w-full px-3.5 py-2 text-xs border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* Section 6: Follow-up Plan */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    6
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Follow-up Plan *
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Post-intervention action plan, timeline, and monitoring schedule
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Follow-up Date *
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Responsible Parties
                    </label>
                    <input
                      type="text"
                      value={responsibleParties}
                      onChange={(e) => setResponsibleParties(e.target.value)}
                      placeholder="e.g. OSAS Administrator, Guidance Counselor"
                      className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Case Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as InterventionStatus)}
                      className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE (Under Ongoing OSAS Monitoring)</option>
                      <option value="REFERRED">REFERRED (Forwarded to Guidance Counselor)</option>
                      <option value="FOLLOW_UP_REQUIRED">FOLLOW_UP_REQUIRED (Requires Follow-up Session)</option>
                      <option value="RESOLVED">RESOLVED (Resolved / Completed)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Follow-up Action Plan / Next Steps *
                  </label>
                  <textarea
                    rows={4}
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    placeholder="Detail the specific follow-up action plan, scheduled evaluation sessions, and expected milestones..."
                    className="w-full p-4 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Form Submit Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl transition-colors cursor-pointer"
                >
                  Clear Form
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving Record...' : 'Save Intervention Record'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: INTERVENTION RECORDS (EXISTING RECORDS & WORKFLOW) */}
        {/* ======================================================== */}
        {activeTab === 'intervention-records' && (
          <div className="space-y-6">
            {/* Search and Filters Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search Bar */}
                <div className="relative col-span-2 sm:col-span-2 lg:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search student, ID, referrer, reason..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Reason Filter */}
                <div className="col-span-2 sm:col-span-2 lg:col-span-1">
                  <select
                    value={filterReason}
                    onChange={(e) => setFilterReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                  >
                    <option value="ALL">All Reasons for Intervention</option>
                    {REASON_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Referrer Filter */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                  <select
                    value={filterReferrer}
                    onChange={(e) => setFilterReferrer(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                  >
                    <option value="ALL">All Referrers</option>
                    {REFERRER_OPTIONS.map((ref) => (
                      <option key={ref} value={ref}>
                        Referred by: {ref}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-1">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Cases</option>
                    <option value="FOLLOW_UP_REQUIRED">Follow-up Required</option>
                    <option value="RESOLVED">Resolved Cases</option>
                  </select>
                </div>
              </div>

              {/* Records List Display */}
              {filteredRecords.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <HeartHandshake className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    No intervention records found.
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery || filterReason !== 'ALL' || filterReferrer !== 'ALL' || filterStatus !== 'ALL'
                      ? 'No records match your selected filter criteria.'
                      : 'Click "Intervention Form" tab to log your first case referral.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-5 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl transition-all shadow-2xs hover:shadow-md space-y-4"
                    >
                      {/* Top Row: Student info & Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-sm">
                            {rec.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                {rec.studentName}
                              </h3>
                              <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold">
                                ID: {rec.studentId}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {rec.course} • {rec.yearLevel}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {getStatusBadge(rec.status)}
                        </div>
                      </div>

                      {/* Middle Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* Column 1: Referral Meta */}
                        <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Referral Information
                          </span>
                          <div className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>Referred By: <strong className="text-slate-900 dark:text-white">{rec.referredBy === 'Others' ? rec.referredByOther || 'Others' : rec.referredBy}</strong></span>
                          </div>
                          {rec.nameOfReferrer && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Name: {rec.nameOfReferrer} ({rec.relationshipToStudent || 'Referrer'})
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Date of Referral: <strong>{rec.dateOfReferral}</strong></span>
                          </div>
                        </div>

                        {/* Column 2: Reasons */}
                        <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Reasons for Intervention
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(rec.reasons || []).map((reason) => (
                              <span
                                key={reason}
                                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-200/60 dark:border-blue-800/40"
                              >
                                {reason === 'Others' && rec.reasonsOther ? `Other: ${rec.reasonsOther}` : reason}
                              </span>
                            ))}
                            {(!rec.reasons || rec.reasons.length === 0) && (
                              <span className="text-[10px] text-slate-400 italic">None specified</span>
                            )}
                          </div>
                        </div>

                        {/* Column 3: Strategies */}
                        <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Intervention Strategies
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(rec.strategies || []).map((strat) => (
                              <span
                                key={strat}
                                className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold border border-indigo-200/60 dark:border-indigo-800/40"
                              >
                                {strat === 'Others' && rec.strategiesOther ? `Other: ${rec.strategiesOther}` : strat}
                              </span>
                            ))}
                            {(!rec.strategies || rec.strategies.length === 0) && (
                              <span className="text-[10px] text-slate-400 italic">None specified</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Concern Description Excerpt */}
                      <div className="text-xs bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 italic line-clamp-2">
                        &quot;{rec.descriptionOfConcerns}&quot;
                      </div>

                      {/* Bottom Actions Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                        <span className="text-[10px] text-slate-400">
                          Logged on: {new Date(rec.createdAt).toLocaleDateString()} by {rec.createdBy}
                        </span>

                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(rec)}
                            className="w-full sm:w-auto min-h-[38px] px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 whitespace-nowrap shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>View Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditRecord(rec)}
                            className="w-full sm:w-auto min-h-[38px] px-3 sm:px-4 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-amber-200 dark:border-amber-800 whitespace-nowrap shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Update Status</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT GRIEVANCES DETAILED MODAL                        */}
        {/* ======================================================== */}
        {selectedApp && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedApp(null)}
            title={`Appointment Review - ${selectedApp.studentName}`}
            subtitle={`Appointment ID: #${selectedApp.id}`}
            maxWidth="lg"
          >
            <div className="space-y-4 p-2 text-xs">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Consultation Case Review</span>
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedApp;
                    setSelectedApp(null);
                    setPrintApp(target);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Official Slip
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Student Profile
                    </span>
                    <p className="font-black text-slate-900 dark:text-white text-sm">
                      {selectedApp.studentName}{' '}
                      <span className="text-slate-500 font-mono text-xs font-normal">({selectedApp.studentId})</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedApp.studentEmail}</p>
                  </div>
                  <span className={`px-3 py-1 text-[11px] font-black rounded-full border ${
                    selectedApp.status === 'COMPLETED'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                      : selectedApp.status === 'REJECTED'
                      ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300'
                      : selectedApp.status === 'APPROVED'
                      ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300'
                      : selectedApp.status === 'RESCHEDULED'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300'
                      : selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                  }`}>
                    Status: {selectedApp.status === 'REFERRED_TO_GUIDANCE' ? 'REFERRED TO GUIDANCE' : selectedApp.status}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Concern / Purpose of Counseling
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                    {selectedApp.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <span className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider block text-[10px]">
                      Student Preferred Schedule
                    </span>
                    <p className="font-mono text-blue-700 dark:text-blue-300 font-bold mt-0.5">
                      {selectedApp.preferredDate} @ {selectedApp.preferredTime}
                    </p>
                  </div>

                  {selectedApp.adminPreferredDate && (
                    <div className="p-2.5 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/40">
                      <span className="font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider block text-[10px]">
                        Admin Rescheduled Schedule
                      </span>
                      <p className="font-mono text-purple-700 dark:text-purple-300 font-bold mt-0.5">
                        {selectedApp.adminPreferredDate} @ {selectedApp.adminPreferredTime}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Referred to Guidance Banner inside Modal */}
              {(selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance) && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block text-[11px]">
                      Referred to Guidance Office
                    </span>
                    {selectedApp.guidanceReferralDate && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                        • {new Date(selectedApp.guidanceReferralDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-indigo-800 dark:text-indigo-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900 text-xs">
                    {selectedApp.guidanceReferralNotes || 'Referred for specialized guidance counseling evaluation.'}
                  </p>
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium pt-1">
                    ℹ️ Ang appointment na ito ay nasa ilalim na ng Guidance Admin para sa kanilang counseling review at aksyon (Approve / Reject).
                  </p>
                </div>
              )}

              {/* Live Conflict Warning Banner inside Modal */}
              {selectedApp.status !== 'APPROVED' && selectedApp.status !== 'COMPLETED' && (() => {
                const conflict = checkAppointmentConflict(selectedApp.id);
                if (!conflict.hasConflict || !conflict.conflictingAppointment) return null;
                return (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-900 dark:text-rose-200">
                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <strong className="block font-black text-rose-900 dark:text-rose-200 text-xs sm:text-sm">
                        ⚠️ Schedule Conflict: Duplicate Approval Blocked
                      </strong>
                      <p className="leading-relaxed">
                        Mayroon nang kasalukuyang <strong>APPROVED</strong> na appointment sa parehong petsa at oras:
                      </p>
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 font-mono text-[11px] text-rose-950 dark:text-rose-200 space-y-0.5">
                        <div><strong>Schedule:</strong> {conflict.formattedConflictDate} @ {conflict.formattedConflictTime}</div>
                        <div><strong>Naka-aprubang Estudyante:</strong> {conflict.conflictingAppointment.studentName} ({conflict.conflictingAppointment.studentId || '#' + conflict.conflictingAppointment.id})</div>
                      </div>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">
                        Hindi maaaring aprubahan ito habang may conflict. Mangyaring gamitin ang Reschedule sa ibaba upang magtakda ng bagong libreng oras.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Reschedule Notes if present */}
              {(selectedApp.adminNotes || selectedApp.rescheduleReason) && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-1">
                  <span className="font-black text-purple-900 dark:text-purple-300 block text-[11px]">
                    Reschedule Reason &amp; Admin Notes:
                  </span>
                  <p className="text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900 text-xs">
                    {selectedApp.adminNotes || selectedApp.rescheduleReason}
                  </p>
                </div>
              )}

              {/* Reschedule Section (Only if not COMPLETED & not REJECTED) */}
              {selectedApp.status !== 'COMPLETED' && selectedApp.status !== 'REJECTED' && (() => {
                const isReferredToGuidance = selectedApp.status === 'REFERRED_TO_GUIDANCE' || !!selectedApp.referredToGuidance;
                const isRescheduleDisabled = isReferredToGuidance;

                return (
                  <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900 dark:text-purple-300 block flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        Reschedule Appointment (Set Date &amp; Time)
                      </span>
                    </div>

                    {isRescheduleDisabled && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Appointment referred to Guidance Counselor. Only the Guidance Admin is authorized to reschedule this appointment.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">Set Date</label>
                        <input
                          type="date"
                          disabled={isRescheduleDisabled}
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className={`w-full px-3 py-2 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                            isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">Set Time</label>
                        <input
                          type="time"
                          disabled={isRescheduleDisabled}
                          value={formatTime24h(rescheduleTime)}
                          onChange={(e) => setRescheduleTime(formatTime12h(e.target.value))}
                          className={`w-full px-3 py-2 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono ${
                            isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      disabled={isRescheduleDisabled}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={
                        isRescheduleDisabled
                          ? 'Rescheduling locked: Handled exclusively by Guidance Admin'
                          : 'Optional admin note / reason for reschedule...'
                      }
                      className={`w-full px-3 py-1.5 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                        isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                );
              })()}

              {selectedApp.status === 'COMPLETED' && (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Appointment Fully Completed &amp; Verified
                      </span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                        Completed: {selectedApp.completedAt ? new Date(selectedApp.completedAt).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const target = selectedApp;
                        setSelectedApp(null);
                        setPrintApp(target);
                      }}
                      className="px-3 py-1.5 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900 transition-colors flex items-center gap-1 cursor-pointer w-fit"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Copy
                    </button>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-amber-900 dark:text-amber-200">
                      <span className="font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        1-Week Expiration Policy: {getRemainingExpirationText(selectedApp.completedAt)}
                      </span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                        Completed appointments automatically expire after 1 week and move to <strong>System Settings &gt; System Archive Vault</strong>.
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmArchiveApp(selectedApp)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 w-fit"
                    >
                      <Archive className="w-3.5 h-3.5" /> Move to Vault Now
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons Footer based on Status Rules */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                {selectedApp.status === 'COMPLETED' ? null : selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={true}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-slate-300 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reschedule (Disabled)
                    </button>
                    <button
                      type="button"
                      disabled={true}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-slate-300 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                    >
                      <Check className="w-4 h-4" />
                      Approve (Disabled)
                    </button>
                  </div>
                ) : selectedApp.status === 'APPROVED' ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleRescheduleSubmit(selectedApp.id)}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkAppointmentDone(selectedApp.id)}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Done
                    </button>
                  </div>
                ) : (
                  /* Pending or Rescheduled */
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleRescheduleSubmit(selectedApp.id)}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveAppointment(selectedApp.id)}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* INTERVENTION DETAILED VIEW MODAL                         */}
        {/* ======================================================== */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Intervention Case Details
                    </h3>
                    <p className="text-[11px] text-slate-500">Record ID: {selectedRecord.id}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
                {/* Student Summary */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Student Profile
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedRecord.urgency && selectedRecord.urgency !== 'LOW' && getUrgencyBadge(selectedRecord.urgency)}
                      {getStatusBadge(selectedRecord.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Full Name:</span>
                      <strong className="text-slate-900 dark:text-white">{selectedRecord.studentName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Student ID:</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{selectedRecord.studentId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Course &amp; Year:</span>
                      <span>{selectedRecord.course} - {selectedRecord.yearLevel}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Contact:</span>
                      <span>{selectedRecord.contactNumber}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 text-[10px] block">Address:</span>
                      <span>{selectedRecord.address}</span>
                    </div>
                  </div>
                </div>





                {/* Referral Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Referral Details
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Date of Referral:</span>
                      <strong>{selectedRecord.dateOfReferral}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Referred By:</span>
                      <strong>{selectedRecord.referredBy === 'Others' ? selectedRecord.referredByOther : selectedRecord.referredBy}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Referrer Name:</span>
                      <span>{selectedRecord.nameOfReferrer || 'Not specified'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 text-[10px] block">Relationship:</span>
                      <span>{selectedRecord.relationshipToStudent || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* Reasons & Strategies */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                    <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider">
                      Identified Reasons
                    </span>
                    <ul className="space-y-1">
                      {(selectedRecord.reasons || []).map((r) => (
                        <li key={r} className="flex items-center gap-1.5 font-bold text-blue-950 dark:text-blue-200">
                          <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{r === 'Others' && selectedRecord.reasonsOther ? `Other: ${selectedRecord.reasonsOther}` : r}</span>
                        </li>
                      ))}
                      {(!selectedRecord.reasons || selectedRecord.reasons.length === 0) && (
                        <li className="text-xs text-slate-400 italic">None specified</li>
                      )}
                    </ul>
                  </div>

                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                    <span className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-300 tracking-wider">
                      Strategies Implemented
                    </span>
                    <ul className="space-y-1">
                      {(selectedRecord.strategies || []).map((s) => (
                        <li key={s} className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{s === 'Others' && selectedRecord.strategiesOther ? `Other: ${selectedRecord.strategiesOther}` : s}</span>
                        </li>
                      ))}
                      {(!selectedRecord.strategies || selectedRecord.strategies.length === 0) && (
                        <li className="text-xs text-slate-400 italic">None specified</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Concern Narrative */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Description of Concerns
                  </span>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedRecord.descriptionOfConcerns}
                  </div>
                </div>

                {/* Follow-up Plan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Follow-up Plan
                      </span>
                      {selectedRecord.followUpDate && (
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-200/60 dark:border-blue-800/40">
                          Date: {selectedRecord.followUpDate}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {selectedRecord.nextSteps}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Responsible Parties
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {selectedRecord.responsibleParties}
                    </p>
                  </div>
                </div>

                {/* Guidance Tracking & Outcome Card (Moved to bottom) */}
                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-indigo-600" /> Guidance Counseling Progress &amp; Status
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                      Stage: {selectedRecord.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Step Flow */}
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[
                      { label: 'Referred', key: 'REFERRED' },
                      { label: 'Received', key: 'RECEIVED' },
                      { label: 'In Progress', key: 'IN_PROGRESS' },
                      { label: 'Follow-up', key: 'FOLLOW_UP' },
                      { label: 'Completed', key: 'COMPLETED' },
                    ].map((step, idx) => {
                      const statusOrder = ['REFERRED', 'RECEIVED', 'IN_PROGRESS', 'FOLLOW_UP', 'COMPLETED'];
                      const currentIdx = statusOrder.indexOf(
                        selectedRecord.status === 'ACTIVE'
                          ? 'IN_PROGRESS'
                          : selectedRecord.status === 'FOLLOW_UP_REQUIRED'
                          ? 'FOLLOW_UP'
                          : selectedRecord.status === 'RESOLVED'
                          ? 'COMPLETED'
                          : selectedRecord.status
                      );
                      const isPassed = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;
                      return (
                        <div key={step.key} className="text-center">
                          <div
                            className={`h-2 rounded-full mb-1 transition-colors ${
                              isCurrent
                                ? 'bg-indigo-600 ring-2 ring-indigo-300'
                                : isPassed
                                ? 'bg-emerald-500'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                          <span
                            className={`text-[9px] font-bold block truncate ${
                              isCurrent
                                ? 'text-indigo-900 dark:text-indigo-200'
                                : isPassed
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-indigo-200 dark:border-indigo-900/40 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Counselor Assigned:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{selectedRecord.guidanceCounselorAssigned || 'Guidance Staff'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Sessions Conducted:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{selectedRecord.guidanceSessionsCount || 0} Session(s)</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Last Status Update:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{selectedRecord.dateOfReferral}</strong>
                    </div>
                  </div>

                  {/* Outcome Summary */}
                  {selectedRecord.guidanceOutcomeSummary && (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 block mb-0.5">
                        Guidance Outcome Summary
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 font-medium">
                        {selectedRecord.guidanceOutcomeSummary}
                      </p>
                    </div>
                  )}

                  {/* Privacy Badge */}
                  <div className="flex items-center gap-2 p-2 bg-indigo-100/60 dark:bg-indigo-900/30 rounded-xl text-[10px] text-indigo-900 dark:text-indigo-300">
                    <Shield className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                    <span>
                      Confidential session notes and clinical assessments remain strictly restricted to the Guidance Office under Student Privacy Protocol.
                    </span>
                  </div>
                </div>
              </div>

              {/* View Details Actions: Print Official Slip, Refer to Guidance, Archive */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const rec = selectedRecord;
                      setSelectedRecord(null);
                      handlePrintSlip(rec);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Official Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const rec = selectedRecord;
                      openReferToGuidancePopup(rec);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>Refer to Guidance</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const rec = selectedRecord;
                      setSelectedRecord(null);
                      setArchiveConfirmRecord(rec);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-red-200 dark:border-red-800 transition-colors"
                  >
                    <Archive className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Archive</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* REFER TO GUIDANCE 9-POINT FORM POPUP MODAL               */}
        {/* ======================================================== */}
        {referToGuidanceRecord && (
          <Modal
            isOpen={true}
            onClose={() => setReferToGuidanceRecord(null)}
            title="OSAS Student Intervention Referral to Guidance Office"
            subtitle={`Case: #${referToGuidanceRecord.id} • ${referToGuidanceRecord.studentName} (${referToGuidanceRecord.studentId})`}
            maxWidth="3xl"
          >
            <div className="space-y-4 p-1 text-xs">
              {popupError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{popupError}</span>
                </div>
              )}

              {/* 1. Student Information */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Student Information
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Auto-filled from student record (Non-editable)
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                    Non-editable
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Student ID</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.studentId}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono font-bold cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Student Full Name</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.studentName}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Course / Academic Program</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.course}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Year Level</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.yearLevel}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Contact Number</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.contactNumber || 'On Record'}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Complete Address</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.address || 'Campus Residence / On Record'}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Referral Information */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Referral Information
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Originator details, position, referral date, and concern summary
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Date of Referral (Automatic) *
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={popupDateOfReferral}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Referred by OSAS Personnel (Dropdown) *
                    </label>
                    <select
                      value={popupReferredByPersonnel}
                      onChange={(e) => setPopupReferredByPersonnel(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Princess Ann T. Ruzol (OSAS Officer)">Princess Ann T. Ruzol (OSAS Officer)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Designation / Position (Dropdown) *
                    </label>
                    <select
                      value={popupReferredByDesignation}
                      onChange={(e) => setPopupReferredByDesignation(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="OSAS Administrator">OSAS Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Reason for Referral (Brief Description / Summary of Concerns) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={popupReasonForReferral}
                    onChange={(e) => setPopupReasonForReferral(e.target.value)}
                    placeholder="Provide brief description or summary of concerns..."
                    className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 3. Reason for Intervention (Checklist) */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Reason for Intervention (Check all that apply) *
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Check all categories triggering this referral
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {popupReasons.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {POPUP_REASON_OPTIONS.map((item) => {
                    const isChecked = popupReasons.includes(item);
                    return (
                      <label
                        key={item}
                        className={`p-2 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePopupReason(item)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="capitalize">{item}</span>
                      </label>
                    );
                  })}
                </div>

                {popupReasons.includes('Others') && (
                  <div className="pt-1 space-y-1">
                    <label className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
                      Specify Other Reason *
                    </label>
                    <input
                      type="text"
                      required
                      value={popupReasonsOther}
                      onChange={(e) => setPopupReasonsOther(e.target.value)}
                      placeholder="Specify other reason for intervention..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 4. Recommended Referral Designation */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Recommended Referral Designation *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Designated service unit
                    </p>
                  </div>
                </div>

                <select
                  value={popupRecommendedDesignation}
                  disabled
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold cursor-not-allowed select-none"
                >
                  <option value="Guidance and Counseling Services">Guidance and Counseling Services</option>
                </select>
              </div>

              {/* 5. Summary of Action Taken by OSAS */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    5
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Summary of Action Taken by OSAS *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      List any interventions, interviews, or observations completed
                    </p>
                  </div>
                </div>

                <textarea
                  rows={3}
                  required
                  value={popupActionTakenSummary}
                  onChange={(e) => setPopupActionTakenSummary(e.target.value)}
                  placeholder="List any interventions, interviews, or observations completed by OSAS..."
                  className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* 6. Urgency of Referral */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    6
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Urgency of Referral *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Intake urgency prioritization
                    </p>
                  </div>
                </div>

                <select
                  value={popupUrgencyOfReferral}
                  onChange={(e) => setPopupUrgencyOfReferral(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Immediate (safety/high risk concern)">Immediate (safety/high risk concern)</option>
                  <option value="Within 3 days">Within 3 days</option>
                  <option value="Within 1 week">Within 1 week</option>
                  <option value="For monitoring/consultation">For monitoring/consultation</option>
                </select>
              </div>

              {/* 7. Attachments, if applicable */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    7
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Attachments, if applicable
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Supporting case documentation
                    </p>
                  </div>
                </div>

                <select
                  value={popupAttachmentsType}
                  onChange={(e) => setPopupAttachmentsType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="None / Not Applicable">None / Not Applicable</option>
                  <option value="Incident reports">Incident reports</option>
                  <option value="Medical report">Medical report</option>
                  <option value="Counseling notes">Counseling notes</option>
                  <option value="Academic records">Academic records</option>
                  <option value="Others">Others</option>
                </select>

                {popupAttachmentsType === 'Others' && (
                  <div className="pt-1 space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Specify Other Attachments *
                    </label>
                    <input
                      type="text"
                      required
                      value={popupAttachmentsOther}
                      onChange={(e) => setPopupAttachmentsOther(e.target.value)}
                      placeholder="Specify other document details..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 8. OSAS Authorization and Signature */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    8
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      OSAS Authorization and Signature *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Formal authorization by OSAS officer
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      OSAS Officer Approval Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={popupOsasApprovalName}
                      onChange={(e) => setPopupOsasApprovalName(e.target.value)}
                      placeholder="Princess Ann T. Ruzol"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Date of Approval (Automatic) *
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={popupOsasApprovalDate}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Approved by *
                    </label>
                    <select
                      value={popupApprovedBy}
                      onChange={(e) => setPopupApprovedBy(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="OSAS Administrator">OSAS Administrator</option>
                      <option value="Dean of Student Affairs">Dean of Student Affairs</option>
                      <option value="Head of Student Welfare">Head of Student Welfare</option>
                      <option value="Intervention Supervisor">Intervention Supervisor</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 9. Receive Unit Acknowledgement */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                    9
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                      Receive Unit Acknowledgement (Guidance Office)
                    </h4>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400">
                      Guidance receiving office endorsement acknowledgement
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                      Received by Name
                    </label>
                    <input
                      type="text"
                      value={popupReceivedByName}
                      onChange={(e) => setPopupReceivedByName(e.target.value)}
                      placeholder="Guidance Counselor"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                      Position
                    </label>
                    <input
                      type="text"
                      value={popupReceivedByPosition}
                      onChange={(e) => setPopupReceivedByPosition(e.target.value)}
                      placeholder="Registered Guidance Counselor (RGC)"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                      Date of Receive (Automatic)
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={popupReceivedDate}
                      className="w-full px-3 py-2 text-xs bg-indigo-100/70 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                    Action Taken / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={popupReceivedActionRemarks}
                    onChange={(e) => setPopupReceivedActionRemarks(e.target.value)}
                    placeholder="Initial action taken or receiving remarks..."
                    className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReferToGuidanceRecord(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReferral}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Confirm &amp; Submit Referral to Guidance</span>
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* UPDATE INTERVENTION STATUS MODAL                         */}
        {/* ======================================================== */}
        {editRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span>Update Intervention Status</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                Updating case status for <strong>{editRecord.studentName}</strong> ({editRecord.studentId}).
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Case Status
                </label>
                <select
                  value={editRecord.status}
                  onChange={(e) =>
                    setEditRecord({ ...editRecord, status: e.target.value as InterventionStatus })
                  }
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE (Ongoing counseling &amp; monitoring)</option>
                  <option value="FOLLOW_UP_REQUIRED">FOLLOW_UP_REQUIRED (Pending milestone check)</option>
                  <option value="RESOLVED">RESOLVED (Intervention successfully closed)</option>
                </select>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={editRecord.followUpDate || ''}
                    onChange={(e) => setEditRecord({ ...editRecord, followUpDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Follow-up Notes / Progress Updates
                  </label>
                  <textarea
                    rows={3}
                    value={editRecord.nextSteps}
                    onChange={(e) => setEditRecord({ ...editRecord, nextSteps: e.target.value })}
                    className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const adminName = currentUser?.fullName || 'OSAS Administrator';
                    updateInterventionRecord(
                      editRecord.id,
                      {
                        status: editRecord.status,
                        nextSteps: editRecord.nextSteps,
                        followUpDate: editRecord.followUpDate,
                      },
                      adminName
                    );
                    setEditRecord(null);
                    loadData();
                  }}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CONFIRMATION MODALS (GRIEVANCES & INTERVENTIONS)         */}
        {/* ======================================================== */}
        {/* Confirm Refer Appointment to Guidance */}
        <ConfirmModal
          isOpen={!!confirmReferId}
          onClose={() => setConfirmReferId(null)}
          onConfirm={handleConfirmReferAppointment}
          title="Refer Appointment to Guidance"
          message={
            referTargetApp
              ? `Sigurado ka ba na gusto mong i-refer sa Guidance Admin ang appointment request ni "${referTargetApp.studentName}"? Ito ay mai-forward sa Guidance Admin → Referred Appointments para sa counseling review at evaluation.`
              : 'Sigurado ka ba na gusto mong i-refer ang appointment na ito sa Guidance Admin?'
          }
          confirmText="Oo, I-forward sa Guidance"
          cancelText="Kanselahin"
          type="info"
          icon="info"
        />

        {/* Confirm Reject Appointment */}
        <ConfirmModal
          isOpen={!!confirmRejectId}
          onClose={() => setConfirmRejectId(null)}
          onConfirm={handleConfirmRejectAppointment}
          title="Are you sure you want to reject this appointment?"
          message={
            rejectTargetApp
              ? `Sigurado ka ba na gusto mong i-reject ang appointment request na ito ni "${rejectTargetApp.studentName}"?`
              : 'Sigurado ka ba na gusto mong i-reject ang appointment request na ito?'
          }
          confirmText="Yes"
          cancelText="No"
          type="danger"
          icon="alert"
        />

        {/* Confirm Archive Appointment */}
        {confirmArchiveApp && (
          <ConfirmModal
            isOpen={true}
            onClose={() => setConfirmArchiveApp(null)}
            onConfirm={handleConfirmArchiveAppointment}
            title="Are you sure you want to delete this?"
            message={`Are you sure you want to delete/archive the rejected appointment record for "${confirmArchiveApp.studentName}" (${confirmArchiveApp.studentId})? It will be moved to System Settings > System Archive.`}
            confirmText="Yes"
            cancelText="No"
            type="danger"
            icon="trash"
          />
        )}

        {/* Confirm Archive Intervention Record */}
        {archiveConfirmRecord && (
          <ConfirmModal
            isOpen={true}
            onClose={() => setArchiveConfirmRecord(null)}
            onConfirm={() => {
              handleArchive(archiveConfirmRecord);
              setArchiveConfirmRecord(null);
            }}
            title="Are you sure you want to delete this?"
            message={`Are you sure you want to delete/archive the intervention record for "${archiveConfirmRecord.studentName}" (${archiveConfirmRecord.studentId})? It will be moved to System Settings > System Archive.`}
            confirmText="Yes"
            cancelText="No"
            type="danger"
            icon="trash"
          />
        )}
      </div>

      {/* ======================================================== */}
      {/* STRICT APPOINTMENT SCHEDULE CONFLICT MODAL               */}
      {/* ======================================================== */}
      {conflictModalData && (
        <Modal
          isOpen={conflictModalData.isOpen}
          onClose={() => setConflictModalData(null)}
          title="Bawal ang Duplicate Approval: Schedule Conflict"
          subtitle="Strict Conflict Prevention Check"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/60 rounded-xl text-rose-600 dark:text-rose-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-rose-900 dark:text-rose-100 text-sm">
                  Na-block ang Approval dahil sa Duplicate Schedule
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                  Mayroon nang kasalukuyang <strong>APPROVED</strong> na appointment sa eksaktong petsa at oras na ito. Upang maiwasan ang conflict at double-booking sa counseling session, hindi pinapayagan ang dalawang aprubadong appointment sa iisang slot.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Conflict Petsa at Oras:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                  {conflictModalData.date} @ {conflictModalData.time}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Kasalukuyang Naka-Apruba:</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  {conflictModalData.conflictStudent} {conflictModalData.conflictStudentId ? `(${conflictModalData.conflictStudentId})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Hinihiling na Estudyante:</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {conflictModalData.candidateStudent}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              💡 <strong>Rekomendasyon:</strong> Gamitin ang <strong>Reschedule</strong> tool sa appointment details upang bigyan ng ibang libreng petsa o oras ang estudyante bago ito aprubahan.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setConflictModalData(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Isara (Cancel Approval)
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OFFICIAL APPOINTMENT PRINT SLIP MODAL                    */}
      {/* ======================================================== */}
      {printApp && (
        <Modal
          isOpen={true}
          onClose={() => setPrintApp(null)}
          title={`Appointment Slip - ${printApp.studentName}`}
          subtitle={`Appointment ID: #${printApp.id} • Schedule: ${printApp.adminPreferredDate || printApp.preferredDate}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 print:p-0">
            {/* Printable Header Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Official Guidance &amp; Appointment Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Appointment Slip
              </button>
            </div>

            {/* Printable Document Body */}
            <div id="printable-appointment-slip" className="printable-document flex flex-col justify-between min-h-[95vh] sm:min-h-[1020px] print:min-h-screen print:h-full p-4 sm:p-6 bg-white text-slate-900 rounded-xl border border-slate-200 print:border-none print:p-0">
              <div className="space-y-4 shrink-0">
                {/* Institutional Header */}
                <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                  <div className="flex items-center justify-center gap-3 mb-1.5">
                    <CollegeLogo className="w-12 h-12" />
                    <div>
                      <h2 className="text-base font-black tracking-wide uppercase text-slate-900 leading-tight">
                        Dingalan Community College
                      </h2>
                      <p className="text-xs font-bold text-slate-700">Office of Student Affairs and Services (OSAS)</p>
                      <p className="text-[11px] text-slate-500 font-medium">Guidance, Counseling &amp; Student Welfare Unit</p>
                    </div>
                  </div>
                  <div className="inline-block bg-slate-100 border border-slate-300 px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Official Guidance &amp; Consultation Appointment Slip
                  </div>
                </div>

                {/* Slip Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Appointment ID</span>
                    <span className="font-mono font-bold text-slate-900">#{printApp.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date Filed</span>
                    <span className="font-semibold text-slate-800">{new Date(printApp.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Case Status</span>
                    <span className="font-bold text-slate-800 uppercase">{printApp.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>
              </div>

              {/* Main Content Body */}
              <div className="printable-body flex-1 space-y-3 my-3">
                {/* Student Information */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    1. Student Client Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Student Full Name</span>
                      <span className="font-bold text-slate-900">{printApp.studentName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Student ID Number</span>
                      <span className="font-mono font-bold text-slate-900">{printApp.studentId}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Email Address</span>
                      <span className="font-medium text-slate-800">{printApp.studentEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Consultation Schedule Information */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-2 bg-blue-50/20">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    2. Appointment Schedule Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Confirmed Date</span>
                      <span className="font-bold text-slate-900">{printApp.adminPreferredDate || printApp.preferredDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Confirmed Time Slot</span>
                      <span className="font-bold text-slate-900">{printApp.adminPreferredTime || printApp.preferredTime}</span>
                    </div>
                  </div>
                </div>

                {/* Purpose / Concern */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    3. Purpose of Appointment &amp; Consultation Concern
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printApp.description}
                  </p>
                </div>

                {/* Admin / Counselor Notes */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    4. Guidance Counselor Findings &amp; Action Remarks
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printApp.adminNotes || 'Scheduled for in-person consultation session at the OSAS Guidance Office.'}
                  </p>
                </div>

                {/* Completion & Verification Details */}
                <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span><strong>OSAS Authority Status:</strong> {printApp.status === 'COMPLETED' ? 'Session Completed' : printApp.status}</span>
                    {printApp.completedAt && (
                      <span><strong>Completion Date:</strong> {new Date(printApp.completedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Signatures & Footer Block */}
              <div className="printable-footer-block mt-auto shrink-0 pt-6 space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div className="grid grid-cols-3 gap-6 text-center text-xs items-end">
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">{printApp.studentName}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Student Conforme</p>
                  </div>
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">Guidance Counselor / Admin</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Attending Guidance Personnel</p>
                  </div>
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">OSAS Director / Head</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Office of Student Affairs &amp; Services</p>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-200">
                  Dingalan Community College • OSAS Guidance &amp; Consultation System • Official Transaction Slip
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OFFICIAL INTERVENTION CASE PRINT SLIP MODAL              */}
      {/* ======================================================== */}
      {printRecord && (
        <Modal
          isOpen={true}
          onClose={() => setPrintRecord(null)}
          title={`Intervention Case Slip - ${printRecord.studentName}`}
          subtitle={`Student ID: ${printRecord.studentId} • ${printRecord.course} - ${printRecord.yearLevel}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 print:p-0">
            {/* Printable Header Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Official Intervention Case Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Slip
              </button>
            </div>

            {/* Printable Document Body */}
            <div id="printable-intervention-slip" className="printable-document flex flex-col justify-between min-h-0 sm:min-h-[1020px] print:min-h-screen print:h-full bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
              <div className="printable-body flex-1 space-y-4">
                {/* Institutional Header */}
                <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                  <div className="flex items-center justify-center gap-3 mb-1.5">
                    <CollegeLogo className="w-12 h-12" />
                    <div>
                      <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
                        Dingalan Community College
                      </h1>
                      <p className="text-xs font-bold text-slate-700 uppercase">
                        Office of Student Affairs and Services (OSAS)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Guidance and Counseling Center • Student Support Services
                      </p>
                    </div>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest bg-slate-900 text-white py-1 px-4 rounded inline-block">
                    Student Intervention &amp; Case Referral Record
                  </h2>
                </div>

                {/* Case Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Case Number</span>
                    <span className="font-mono font-bold text-slate-900">#{printRecord.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Referral</span>
                    <span className="font-semibold text-slate-800">{printRecord.dateOfReferral}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Case Status</span>
                    <span className="font-bold text-slate-800 uppercase">{printRecord.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>

                {/* Section 1: Student & Referral Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Student Profile</p>
                    <p><strong>Full Name:</strong> {printRecord.studentName}</p>
                    <p><strong>Student ID:</strong> {printRecord.studentId}</p>
                    <p><strong>Program &amp; Year:</strong> {printRecord.course} - {printRecord.yearLevel}</p>
                    <p><strong>Contact Number:</strong> {printRecord.contactNumber || '—'}</p>
                    <p><strong>Address:</strong> {printRecord.address || '—'}</p>
                  </div>

                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Referral Details</p>
                    <p><strong>Date of Referral:</strong> {printRecord.dateOfReferral}</p>
                    <p><strong>Referred By:</strong> {printRecord.referredBy === 'Others' ? (printRecord.referredByOther || 'Others') : printRecord.referredBy}</p>
                    <p><strong>Name of Referrer:</strong> {printRecord.nameOfReferrer || '—'}</p>
                    <p><strong>Relationship:</strong> {printRecord.relationshipToStudent || '—'}</p>
                    <p><strong>Case Status:</strong> <span className="font-bold uppercase text-blue-600">{printRecord.status}</span></p>
                  </div>
                </div>

                {/* Section 2: Reasons Checklist */}
                <div className="space-y-1 text-xs">
                  <p className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                    Identified Reasons for Intervention:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {REASON_OPTIONS.map((reason) => {
                      const isChecked = (printRecord.reasons || []).includes(reason);
                      return (
                        <div key={reason} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-xs">{isChecked ? '☒' : '☐'}</span>
                          <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-500'}>
                            {reason === 'Others' && printRecord.reasonsOther ? `Other: ${printRecord.reasonsOther}` : reason}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: Description Narrative */}
                <div className="space-y-1 text-xs">
                  <p className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                    Description of Concerns / Clinical Observations:
                  </p>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {printRecord.descriptionOfConcerns}
                  </p>
                </div>

                {/* Section 4: Strategies Implemented */}
                <div className="space-y-1 text-xs">
                  <p className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                    Intervention Strategies Implemented:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {STRATEGY_OPTIONS.map((strategy) => {
                      const isChecked = (printRecord.strategies || []).includes(strategy);
                      return (
                        <div key={strategy} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-xs">{isChecked ? '☒' : '☐'}</span>
                          <span className={isChecked ? 'font-bold text-slate-900' : 'text-slate-500'}>
                            {strategy === 'Others' && printRecord.strategiesOther ? `Other: ${printRecord.strategiesOther}` : strategy}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 5: Follow-up Plan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Follow-up Plan &amp; Next Steps</p>
                      {printRecord.followUpDate && (
                        <span className="text-[10px] font-bold text-blue-600">
                          Target Date: {printRecord.followUpDate}
                        </span>
                      )}
                    </div>
                    <p>{printRecord.nextSteps}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Responsible Parties</p>
                    <p>{printRecord.responsibleParties}</p>
                  </div>
                </div>
              </div>

              {/* Signatures Block in printable-footer-block */}
              <div className="printable-footer-block mt-auto shrink-0 pt-8 border-t border-slate-300">
                <div className="grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
                  <div>
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      {printRecord.studentName}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">Student Signature / Conforme</p>
                  </div>

                  <div>
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      Princess Ann T. Ruzol
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">OSAS Administrator</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InterventionModule;
