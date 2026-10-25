import React, { useState, useEffect, useMemo } from 'react';
import {
  addDisciplinaryRecord,
  createDisciplinaryRecordFromReport,
  getUsers,
} from '../../services/storage';
import {
  DisciplinaryRecord,
  IncidentType,
  DisciplinaryReporterRole,
  DisciplinaryActionTaken,
  User,
} from '../../types';
import {
  AlertOctagon,
  FileText,
  MapPin,
  Tag,
  Paperclip,
  Check,
  X,
  AlertCircle,
  Shield,
  User as UserIcon,
  Send,
  Search,
} from 'lucide-react';

export const INCIDENT_TYPES: IncidentType[] = [
  'Tobacco/Nicotine use',
  'Vaping',
  'Possession of Prohibited Items',
  'Discipline',
  'Others',
];

export const REPORTER_ROLES: DisciplinaryReporterRole[] = [
  'OSAS Officer',
  'Security Personnel',
  'Faculty/Staff',
  'Student',
  'Anonymous Reporter',
];

export const ACTION_TAKEN_OPTIONS: DisciplinaryActionTaken[] = [
  'Verbal Warning Issued',
  'Written Warning Issued',
  'Others',
];

export interface DisciplinaryActionFormInitialData {
  reportedByRole?: DisciplinaryReporterRole;
  reporterName?: string;
  reporterId?: string;
  reporterCourse?: string;
  contactNumber?: string;
  reportedStudentName?: string;
  reportedStudentId?: string;
  reportedStudentCourse?: string;
  incidentType?: IncidentType;
  location?: string;
  actionTaken?: DisciplinaryActionTaken;
  actionTakenOther?: string;
  description?: string;
  sanction?: string;
  startDate?: string;
  endDate?: string;
  remarks?: string;
  evidenceFileName?: string;
  evidenceUrl?: string;
  declarationAccepted?: boolean;
}

export interface DisciplinaryActionFormProps {
  initialData?: DisciplinaryActionFormInitialData;
  sourceReportId?: string;
  isModal?: boolean;
  onSuccess?: (createdRecord: DisciplinaryRecord) => void;
  onCancel?: () => void;
}

export const DisciplinaryActionForm: React.FC<DisciplinaryActionFormProps> = ({
  initialData,
  sourceReportId,
  isModal = false,
  onSuccess,
  onCancel,
}) => {
  const [dafReporterRole, setDafReporterRole] = useState<DisciplinaryReporterRole>(
    initialData?.reportedByRole || 'OSAS Officer'
  );
  const [dafReporterName, setDafReporterName] = useState(
    initialData?.reporterName || 'Princess Ann T. Ruzol (OSAS Admin)'
  );
  const [dafReporterId, setDafReporterId] = useState(initialData?.reporterId || 'ADMIN-01');
  const [dafReporterCourse, setDafReporterCourse] = useState(
    initialData?.reporterCourse || 'OSAS Administration'
  );
  const [dafContactNumber, setDafContactNumber] = useState(initialData?.contactNumber || '');
  const [dafReportedStudentName, setDafReportedStudentName] = useState(
    initialData?.reportedStudentName || ''
  );
  const [dafReportedStudentId, setDafReportedStudentId] = useState(
    initialData?.reportedStudentId || ''
  );
  const [dafReportedStudentCourse, setDafReportedStudentCourse] = useState(
    initialData?.reportedStudentCourse || ''
  );

  const [studentsList, setStudentsList] = useState<User[]>([]);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentUser, setSelectedStudentUser] = useState<User | null>(null);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [dafYearLevel, setDafYearLevel] = useState('1st Year');
  const [dafAcademicProgram, setDafAcademicProgram] = useState('');
  const [dafAddress, setDafAddress] = useState('');

  useEffect(() => {
    try {
      const allUsers = getUsers();
      setStudentsList(allUsers.filter((u) => u.role === 'STUDENT'));
    } catch {
      setStudentsList([]);
    }
  }, []);

  const studentSuggestions = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const q = studentSearchInput.toLowerCase().trim();
    return studentsList.filter(
      (s) =>
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        s.fullName.toLowerCase().includes(q) ||
        (s.course && s.course.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [studentsList, studentSearchInput]);

  const handleSelectStudentForDaf = (s: User) => {
    setSelectedStudentUser(s);
    setStudentSearchInput(`${s.fullName} (${s.studentId || 'No ID'})`);
    setDafReportedStudentName(s.fullName);
    setDafReportedStudentId(s.studentId || s.id);
    setDafReportedStudentCourse(s.course || 'BS Information Technology');
    setDafAcademicProgram(s.course || 'BS Information Technology');
    setDafYearLevel(s.yearLevel || '1st Year');
    setDafContactNumber(s.contactNumber || '09171234567');
    setDafAddress(s.permanentAddress || s.address || 'Dingalan, Aurora');
    setShowStudentSuggestions(false);
  };

  const handleClearStudentForDaf = () => {
    setSelectedStudentUser(null);
    setStudentSearchInput('');
    setDafReportedStudentName('');
    setDafReportedStudentId('');
    setDafReportedStudentCourse('');
    setDafAcademicProgram('');
    setDafYearLevel('1st Year');
    setDafContactNumber('');
    setDafAddress('');
  };
  const [dafIncidentType, setDafIncidentType] = useState<IncidentType>(
    initialData?.incidentType || 'Vaping'
  );
  const [dafLocation, setDafLocation] = useState(initialData?.location || 'DCC Main Campus');
  const [dafActionTaken, setDafActionTaken] = useState<string>(
    initialData?.actionTaken || 'Written Warning Issued'
  );
  const [isCustomAction, setIsCustomAction] = useState<boolean>(
    initialData?.actionTaken === 'Others' || (initialData?.actionTaken && !['Verbal Warning Issued', 'Written Warning Issued'].includes(initialData.actionTaken)) || false
  );
  const [dafDescription, setDafDescription] = useState(initialData?.description || '');
  const [dafSanction, setDafSanction] = useState(
    initialData?.sanction || 'Campus Service & OSAS Guidance Session'
  );
  const [dafStartDate, setDafStartDate] = useState(
    initialData?.startDate || new Date().toISOString().split('T')[0]
  );
  const [dafEndDate, setDafEndDate] = useState(
    initialData?.endDate || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]
  );
  const [dafRemarks, setDafRemarks] = useState(
    initialData?.remarks ||
      (sourceReportId
        ? `Filed officially from Report #${sourceReportId}.`
        : 'Walk-in report filed directly at OSAS Office.')
  );
  const [dafEvidenceFileName, setDafEvidenceFileName] = useState(
    initialData?.evidenceFileName || ''
  );
  const [dafEvidenceUrl, setDafEvidenceUrl] = useState(initialData?.evidenceUrl || '');
  const [dafDeclarationAccepted, setDafDeclarationAccepted] = useState(
    initialData?.declarationAccepted || false
  );
  const [dafFormError, setDafFormError] = useState('');
  const [dafIsSubmitting, setDafIsSubmitting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDafEvidenceFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDafEvidenceUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearFile = () => {
    setDafEvidenceFileName('');
    setDafEvidenceUrl('');
  };

  const handleSubmitDafForm = (e: React.FormEvent) => {
    e.preventDefault();
    setDafFormError('');

    if (!dafReportedStudentName.trim()) {
      setDafFormError('Please enter the reported student full name.');
      return;
    }

    if (!dafReportedStudentId.trim()) {
      setDafFormError('Please provide the student ID number.');
      return;
    }

    if (!dafLocation.trim()) {
      setDafFormError('Please provide the campus location of the incident.');
      return;
    }

    if (!dafDescription.trim() || dafDescription.trim().length < 10) {
      setDafFormError('Please provide a detailed violation description (minimum 10 characters).');
      return;
    }

    if (!dafSanction.trim()) {
      setDafFormError('Please specify the imposed sanction or required disciplinary action.');
      return;
    }

    if (!dafDeclarationAccepted) {
      setDafFormError('Please certify the administrative declaration before issuing this record.');
      return;
    }

    setDafIsSubmitting(true);

    try {
      const isAnon = dafReporterRole === 'Anonymous Reporter';
      let record: DisciplinaryRecord;

      if (sourceReportId) {
        record = createDisciplinaryRecordFromReport(
          sourceReportId,
          {
            studentId: dafReportedStudentId.trim(),
            studentName: dafReportedStudentName.trim(),
            course: dafReportedStudentCourse.trim() || undefined,
            offenseType: dafIncidentType,
            description: dafDescription.trim(),
            sanction: dafSanction.trim(),
            reportedBy: isAnon ? 'Anonymous Reporter' : dafReporterRole,
            actionTaken: dafActionTaken.trim(),
            actionTakenOther: isCustomAction ? dafActionTaken.trim() : undefined,
            startDate: dafStartDate,
            completionDate: dafEndDate,
            remarks: dafRemarks.trim(),
            location: dafLocation.trim(),
            evidenceFileName: dafEvidenceFileName || undefined,
            evidenceUrl: dafEvidenceUrl || undefined,
            status: 'SANCTIONED',
          },
          'Princess Ann T. Ruzol (OSAS Admin)'
        );
      } else {
        record = addDisciplinaryRecord(
          {
            studentId: dafReportedStudentId.trim(),
            studentName: dafReportedStudentName.trim(),
            course: dafReportedStudentCourse.trim() || undefined,
            offenseType: dafIncidentType,
            description: dafDescription.trim(),
            sanction: dafSanction.trim(),
            reportedBy: isAnon ? 'Anonymous Reporter' : dafReporterRole,
            actionTaken: dafActionTaken.trim(),
            actionTakenOther: isCustomAction ? dafActionTaken.trim() : undefined,
            startDate: dafStartDate,
            completionDate: dafEndDate,
            remarks: dafRemarks.trim(),
            location: dafLocation.trim(),
            evidenceFileName: dafEvidenceFileName || undefined,
            evidenceUrl: dafEvidenceUrl || undefined,
            status: 'SANCTIONED',
          },
          'Princess Ann T. Ruzol (OSAS Admin)'
        );
      }

      if (onSuccess) {
        onSuccess(record);
      }
    } catch (err: any) {
      setDafFormError(err?.message || 'Failed to issue disciplinary action.');
    } finally {
      setDafIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl ${isModal ? 'p-1' : 'border border-slate-200 dark:border-slate-800 shadow-xs p-6'} space-y-6`}>
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="p-2 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-xl">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {sourceReportId ? `Disciplinary Action Form - Report #${sourceReportId}` : 'Disciplinary Action Form (Walk-in)'}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {sourceReportId
              ? 'Official OSAS Disciplinary Action & Conduct Enforcement Filing Form'
              : 'Official OSAS Disciplinary Action Filing Form for walk-in cases'}
          </p>
        </div>
      </div>

      {dafFormError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{dafFormError}</span>
        </div>
      )}

      <form onSubmit={handleSubmitDafForm} className="space-y-6">
        {/* Section 1: Reporter Information */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Reporting Officer / Intake Source
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Reported By:
              </label>
              <select
                value={dafReporterRole}
                onChange={(e) => setDafReporterRole(e.target.value as DisciplinaryReporterRole)}
                className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-red-500"
              >
                {REPORTER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {dafReporterRole === 'Anonymous Reporter' ? (
            <div className="p-4 bg-slate-900 text-white dark:bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
              <div className="p-2.5 bg-slate-800 rounded-xl text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-black text-white flex items-center gap-2">
                  <span>Anonymous Reporter Protected</span>
                </h5>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Reporter identity is masked in records and marked as &quot;Anonymous Reporter&quot;.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Officer ID / Staff ID
                </label>
                <input
                  type="text"
                  value={dafReporterId}
                  onChange={(e) => setDafReporterId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Full Name / Officer Name
                </label>
                <input
                  type="text"
                  value={dafReporterName}
                  onChange={(e) => setDafReporterName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Department / Office
                </label>
                <input
                  type="text"
                  value={dafReporterCourse}
                  onChange={(e) => setDafReporterCourse(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Reported Student Information */}
        <div className="p-4 bg-red-50/40 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h4 className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
              Reported Student (Offender) Information *
            </h4>
          </div>

          {/* Student Search & Selection (Reference: Intervention Form) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Student Search & Selection (Reference: Intervention Form) *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search student by name, student ID, or course..."
                value={studentSearchInput}
                onChange={(e) => {
                  setStudentSearchInput(e.target.value);
                  setShowStudentSuggestions(true);
                }}
                onFocus={() => setShowStudentSuggestions(true)}
                className="w-full pl-10 pr-10 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              {studentSearchInput && (
                <button
                  type="button"
                  onClick={handleClearStudentForDaf}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}

              {showStudentSuggestions && studentSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {studentSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStudentForDaf(s)}
                      className="w-full p-2.5 text-left hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {s.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{s.fullName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{s.studentId || 'No ID'} • {s.course || ''}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-red-600">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Student Number *</label>
              <input
                type="text"
                required
                readOnly={!!selectedStudentUser}
                value={dafReportedStudentId}
                onChange={(e) => setDafReportedStudentId(e.target.value)}
                placeholder="Student ID"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono font-bold ${
                  selectedStudentUser
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                required
                readOnly={!!selectedStudentUser}
                value={dafReportedStudentName}
                onChange={(e) => setDafReportedStudentName(e.target.value)}
                placeholder="Full Name"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-bold ${
                  selectedStudentUser
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Course / Academic Program</label>
              <input
                type="text"
                readOnly={!!selectedStudentUser}
                value={dafReportedStudentCourse}
                onChange={(e) => setDafReportedStudentCourse(e.target.value)}
                placeholder="Course / Academic Program"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                  selectedStudentUser
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Year Level</label>
              <input
                type="text"
                readOnly={!!selectedStudentUser}
                value={dafYearLevel}
                onChange={(e) => setDafYearLevel(e.target.value)}
                placeholder="Year Level"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                  selectedStudentUser
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Number</label>
              <input
                type="text"
                readOnly={!!selectedStudentUser}
                value={dafContactNumber}
                onChange={(e) => setDafContactNumber(e.target.value)}
                placeholder="Contact Number"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono ${
                  selectedStudentUser
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Complete Address</label>
              <input
                type="text"
                readOnly={!!selectedStudentUser}
                value={dafAddress}
                onChange={(e) => setDafAddress(e.target.value)}
                placeholder="Complete Address"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl ${
                  selectedStudentUser
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Incident & Sanction Details */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type of Violation *
              </label>
              <input
                type="text"
                list="incident-types-options"
                required
                value={dafIncidentType}
                onChange={(e) => setDafIncidentType(e.target.value as IncidentType)}
                placeholder="Select or type specific violation..."
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
              />
              <datalist id="incident-types-options">
                {INCIDENT_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Campus Location *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={dafLocation}
                  onChange={(e) => setDafLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Immediate Action Taken *
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                {isCustomAction ? (
                  <input
                    type="text"
                    required
                    value={dafActionTaken}
                    onChange={(e) => setDafActionTaken(e.target.value)}
                    placeholder="Type custom action..."
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                ) : (
                  <select
                    value={['Verbal Warning Issued', 'Written Warning Issued'].includes(dafActionTaken) ? dafActionTaken : 'Others'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Others') {
                        setIsCustomAction(true);
                        setDafActionTaken('');
                      } else {
                        setDafActionTaken(val);
                      }
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold cursor-pointer"
                  >
                    <option value="Verbal Warning Issued">Verbal Warning Issued</option>
                    <option value="Written Warning Issued">Written Warning Issued</option>
                    <option value="Others">Others</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Violation Narrative & Circumstances *
            </label>
            <textarea
              rows={3}
              required
              value={dafDescription}
              onChange={(e) => setDafDescription(e.target.value)}
              placeholder="Describe the incident narrative, confession, or physical findings..."
              className="w-full p-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Imposed Disciplinary Sanction / Corrective Measure *
            </label>
            <input
              type="text"
              required
              value={dafSanction}
              onChange={(e) => setDafSanction(e.target.value)}
              placeholder="e.g. 15 Hours Campus Service + Guidance Counseling"
              className="w-full px-3.5 py-2.5 text-xs border border-red-300 dark:border-red-700 rounded-xl bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sanction Start Date *
              </label>
              <input
                type="date"
                required
                value={dafStartDate}
                onChange={(e) => setDafStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sanction Completion Deadline *
              </label>
              <input
                type="date"
                required
                value={dafEndDate}
                onChange={(e) => setDafEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Official Administrative Remarks
            </label>
            <textarea
              rows={2}
              value={dafRemarks}
              onChange={(e) => setDafRemarks(e.target.value)}
              className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          {/* Supporting Document */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Supporting Document / Evidence Slip (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-red-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-2xs">
                <Paperclip className="w-4 h-4 text-red-600" />
                <span>Attach Slip / File...</span>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {dafEvidenceFileName ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-xs">{dafEvidenceFileName}</span>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">No document attached (optional)</span>
              )}
            </div>
          </div>

          {/* Administrative Declaration Checkbox */}
          <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/60 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={dafDeclarationAccepted}
                onChange={(e) => setDafDeclarationAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Administrative Certification:</strong> I hereby certify that this disciplinary action form has been duly verified, administered with due process, and will be logged into the Official Disciplinary Records. *
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            {isModal && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={dafIsSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{dafIsSubmitting ? 'Issuing Record...' : 'Issue Official Disciplinary Action'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
