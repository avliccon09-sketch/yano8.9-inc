import React, { useState, useEffect } from 'react';
import {
  getDisciplinaryRecords,
  addDisciplinaryRecord,
  deleteDisciplinaryRecord,
  updateDisciplinaryStatus,
  referDisciplinaryRecordToGuidance,
  logActivity,
} from '../../services/storage';
import {
  DisciplinaryRecord,
  IncidentType,
  DisciplinaryReporterRole,
  DisciplinaryActionTaken,
} from '../../types';
import { DisciplinaryActionForm } from './DisciplinaryActionForm';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  AlertOctagon,
  FileText,
  CheckCircle2,
  Calendar,
  Clock,
  Check,
  Search,
  Archive,
  Eye,
  X,
  Plus,
  AlertTriangle,
  FolderOpen,
  Shield,
  Tag,
  HeartHandshake,
  Send,
  AlertCircle,
  Upload,
  Printer,
  User,
  MapPin,
  Paperclip,
} from 'lucide-react';

const INCIDENT_TYPES: IncidentType[] = [
  'Tobacco/Nicotine use',
  'Vaping',
  'Possession of Prohibited Items',
  'Discipline',
  'Others',
];

const REPORTER_ROLES: DisciplinaryReporterRole[] = [
  'OSAS Officer',
  'Security Personnel',
  'Faculty/Staff',
  'Student',
  'Anonymous Reporter',
];

const ACTION_TAKEN_OPTIONS: DisciplinaryActionTaken[] = [
  'Verbal Warning Issued',
  'Written Warning Issued',
  'Others',
];

export const DisciplinaryModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'daf_form' | 'records'>('daf_form');

  const [dafSubmittedSuccess, setDafSubmittedSuccess] = useState(false);

  // Disciplinary Records state
  const [records, setRecords] = useState<DisciplinaryRecord[]>(() => getDisciplinaryRecords());
  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryRecord | null>(null);
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>('ALL');

  // Confirmation & Print Modals
  const [confirmArchiveRecord, setConfirmArchiveRecord] = useState<DisciplinaryRecord | null>(null);
  const [printDisciplinaryRecord, setPrintDisciplinaryRecord] = useState<DisciplinaryRecord | null>(null);

  const refreshAllData = () => {
    setRecords(getDisciplinaryRecords());
  };

  useEffect(() => {
    window.addEventListener('osas_storage_updated', refreshAllData);
    window.addEventListener('storage', refreshAllData);
    return () => {
      window.removeEventListener('osas_storage_updated', refreshAllData);
      window.removeEventListener('storage', refreshAllData);
    };
  }, []);

  const handleStatusChangeForRecord = (recordId: string, newStatus: 'SANCTIONED' | 'COMPLETED') => {
    updateDisciplinaryStatus(recordId, newStatus, 'Princess Ann T. Ruzol (Admin)');
    refreshAllData();
    if (selectedRecord && selectedRecord.id === recordId) {
      setSelectedRecord({ ...selectedRecord, status: newStatus });
    }
  };

  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.studentName.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.studentId.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.offenseType.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.description.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.sanction.toLowerCase().includes(recordSearchQuery.toLowerCase());

    const matchesStatus =
      recordStatusFilter === 'ALL' || (rec.status || 'SANCTIONED') === recordStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-2xl">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                OSAS Disciplinary Action & Conduct Enforcement
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Process walk-in incident forms, enforce sanction compliance, and manage official student disciplinary records
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Official Records & Disciplinary Action Form – Walk-in placed below the title */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('records')}
            className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'records'
                ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Official Records</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                activeTab === 'records' ? 'bg-white text-red-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {records.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('daf_form');
              setDafSubmittedSuccess(false);
            }}
            className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'daf_form'
                ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Disciplinary Action Form – Walk-in</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {dafSubmittedSuccess && (
        <div className="max-w-4xl mx-auto p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase">Walk-in Disciplinary Record Issued</h4>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                The walk-in violation and sanction have been officially posted to Official Records and the student&apos;s portal profile.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDafSubmittedSuccess(false)}
            className="p-1 hover:bg-emerald-200/50 rounded-lg text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: DISCIPLINARY ACTION FORM (WALK-IN) */}
      {activeTab === 'daf_form' && (
        <div className="max-w-4xl mx-auto">
          <DisciplinaryActionForm
            onSuccess={() => {
              refreshAllData();
              setDafSubmittedSuccess(true);
              setActiveTab('records');
            }}
          />
        </div>
      )}

      {/* TAB 2: OFFICIAL RECORDS */}
      {activeTab === 'records' && (
        <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-red-600" />
                Official Disciplinary Records Log ({records.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Official sanctioned and completed student disciplinary records, slips, and guidance referrals
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-[3] sm:flex-none sm:w-60 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 shrink-0" />
                <input
                  type="text"
                  value={recordSearchQuery}
                  onChange={(e) => setRecordSearchQuery(e.target.value)}
                  placeholder="Search student, ID, offense..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={recordStatusFilter}
                onChange={(e) => setRecordStatusFilter(e.target.value)}
                className="flex-[2] sm:flex-none px-2 sm:px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-pointer min-w-0 truncate"
              >
                <option value="ALL">All Statuses</option>
                <option value="SANCTIONED">Sanctioned (Active)</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No official records found.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {records.length === 0
                  ? 'No official disciplinary records have been logged yet.'
                  : 'Adjust filters or search query to find records.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((rec) => {
                const isCompleted = rec.status === 'COMPLETED';

                return (
                  <div
                    key={rec.id}
                    className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between gap-4 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-2xs"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[10px] font-black rounded uppercase bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                          {rec.offenseType}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                            isCompleted
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                              : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300'
                          }`}
                        >
                          {isCompleted ? 'COMPLETED' : 'SANCTIONED (ACTIVE)'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Record #{rec.id} • {rec.dateLogged}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {rec.studentName} <span className="text-xs font-mono text-slate-500">({rec.studentId})</span>
                        </h4>
                        {rec.course && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {rec.course} {rec.yearLevel ? `• ${rec.yearLevel}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Violation:</span>
                        {rec.description}
                      </div>

                      <div className="p-3 bg-red-50/60 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 text-xs space-y-0.5">
                        <span className="text-[10px] font-black text-red-900 dark:text-red-300 uppercase block">
                          Official Imposed Sanction:
                        </span>
                        <p className="font-bold text-red-800 dark:text-red-300">{rec.sanction}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <div>
                          <span className="font-bold">Reported By:</span>{' '}
                          {rec.reportedBy === 'Anonymous Reporter' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                              <Shield className="w-3 h-3" /> Anonymous
                            </span>
                          ) : (
                            rec.reportedBy || 'OSAS Officer'
                          )}
                        </div>
                        <div>
                          <span className="font-bold">Sanction Period:</span> {rec.startDate || rec.dateLogged} to{' '}
                          {rec.completionDate || 'Ongoing'}
                        </div>
                      </div>
                    </div>

                    {/* Actions Row at bottom */}
                    <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-end gap-1.5 sm:gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="w-full sm:w-auto px-1.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" /> <span>Details</span>
                      </button>

                      <button
                        onClick={() => setPrintDisciplinaryRecord(rec)}
                        className="w-full sm:w-auto px-1.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] sm:text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-3.5 h-3.5 shrink-0" /> <span>Print</span>
                      </button>

                      <button
                        onClick={() => setConfirmArchiveRecord(rec)}
                        className="w-full sm:w-auto px-1.5 sm:px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-[11px] sm:text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 border border-amber-200 dark:border-amber-800 whitespace-nowrap"
                      >
                        <Archive className="w-3.5 h-3.5 shrink-0" /> <span>Archive</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: VIEW DETAILED DISCIPLINARY RECORD */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Disciplinary Violation Record - ${selectedRecord.studentName}`}
          subtitle={`Record ID: ${selectedRecord.id}`}
          maxWidth="md"
        >
          <div className="space-y-3 p-2 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-300">Case Status</span>
              <span
                className={`px-3 py-1 text-xs font-black rounded-full ${
                  (selectedRecord.status || 'SANCTIONED') === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {(selectedRecord.status || 'SANCTIONED') === 'COMPLETED' ? 'COMPLETED' : 'SANCTIONED (ACTIVE)'}
              </span>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-200 dark:border-red-900/60 space-y-1">
              <span className="font-bold text-red-900 dark:text-red-300 uppercase text-[10px]">Offense Category</span>
              <p className="font-black text-red-800 dark:text-red-300 text-sm">{selectedRecord.offenseType}</p>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Student Details</span>
              <p className="font-bold text-slate-900 dark:text-white">
                {selectedRecord.studentName} (ID: {selectedRecord.studentId})
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Incident Description</span>
              <p className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed mt-1">
                {selectedRecord.description}
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Imposed Sanction</span>
              <p className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-100 dark:border-red-900/60 mt-1">
                {selectedRecord.sanction}
              </p>
            </div>

            {/* Toggle Status Buttons */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">Update Official Case Status:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChangeForRecord(selectedRecord.id, 'SANCTIONED')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    (selectedRecord.status || 'SANCTIONED') === 'SANCTIONED'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Set Sanctioned (Active)
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChangeForRecord(selectedRecord.id, 'COMPLETED')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    selectedRecord.status === 'COMPLETED'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Set Completed
                </button>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 flex justify-between">
              <span>Date Logged: {selectedRecord.dateLogged}</span>
              <span>Issued By: {selectedRecord.issuedBy}</span>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  const rec = selectedRecord;
                  setSelectedRecord(null);
                  setPrintDisciplinaryRecord(rec);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* PRINT OFFICIAL DISCIPLINARY SLIP MODAL */}
      {printDisciplinaryRecord && (
        <Modal
          isOpen={true}
          onClose={() => setPrintDisciplinaryRecord(null)}
          title={`Disciplinary Record Slip - ${printDisciplinaryRecord.studentName}`}
          subtitle={`Student ID: ${printDisciplinaryRecord.studentId} • Record #${printDisciplinaryRecord.id}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 print:p-0">
            {/* Printable Header Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">Official Disciplinary Slip</h3>
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
            <div id="printable-disciplinary-slip" className="printable-document flex flex-col justify-between min-h-0 sm:min-h-[1020px] print:min-h-screen print:h-full bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
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
                        Student Discipline & Code of Conduct Enforcement
                      </p>
                    </div>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest bg-red-800 text-white py-1 px-4 rounded inline-block">
                    Official Disciplinary Sanction Slip
                  </h2>
                </div>

                {/* Case Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Record ID</span>
                    <span className="font-mono font-bold text-slate-900">#{printDisciplinaryRecord.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date Issued</span>
                    <span className="font-semibold text-slate-800">{printDisciplinaryRecord.dateLogged}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Record Status</span>
                    <span className="font-bold text-slate-800 uppercase">{printDisciplinaryRecord.status || 'SANCTIONED'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>

                {/* Section 1: Student & Offense Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Student Information</p>
                    <p><strong>Full Name:</strong> {printDisciplinaryRecord.studentName}</p>
                    <p><strong>Student ID:</strong> {printDisciplinaryRecord.studentId}</p>
                    <p><strong>Course / Program:</strong> {printDisciplinaryRecord.course || '—'}</p>
                    <p><strong>Year Level:</strong> {printDisciplinaryRecord.yearLevel || '—'}</p>
                  </div>

                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Incident Classification</p>
                    <p><strong>Offense Type:</strong> <span className="text-red-700 font-bold">{printDisciplinaryRecord.offenseType}</span></p>
                    <p><strong>Sanction Period:</strong> {printDisciplinaryRecord.startDate || 'N/A'} to {printDisciplinaryRecord.completionDate || 'N/A'}</p>
                    <p><strong>Issued By:</strong> {printDisciplinaryRecord.issuedBy}</p>
                  </div>
                </div>

                {/* Incident Description */}
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Incident Details</p>
                  <p className="text-slate-800 leading-relaxed italic">&quot;{printDisciplinaryRecord.description}&quot;</p>
                </div>

                {/* Imposed Sanctions */}
                <div className="space-y-1 p-3 bg-red-50/60 rounded-xl border border-red-200 text-xs">
                  <p className="font-black text-[10px] uppercase text-red-900 tracking-wider">Official Imposed Sanction</p>
                  <p className="font-bold text-red-900 leading-relaxed">{printDisciplinaryRecord.sanction}</p>
                </div>

                {/* Remarks if any */}
                {printDisciplinaryRecord.remarks && (
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Administrative Remarks</p>
                    <p className="text-slate-800">{printDisciplinaryRecord.remarks}</p>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="printable-footer-block mt-auto shrink-0 pt-8 border-t border-slate-300">
                <div className="grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
                  <div className="space-y-4">
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      {printDisciplinaryRecord.studentName}
                    </div>
                    <p className="font-bold text-slate-800 text-[11px] uppercase">
                      Student Signature / Conforme
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      Princess Ann T. Ruzol
                    </div>
                    <p className="font-bold text-slate-800 text-[11px] uppercase">
                      OSAS Director / Administrator
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM ARCHIVE RECORD MODAL */}
      {confirmArchiveRecord && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmArchiveRecord(null)}
          onConfirm={() => {
            deleteDisciplinaryRecord(confirmArchiveRecord.id, 'Princess Ann T. Ruzol (Admin)');
            setConfirmArchiveRecord(null);
            if (selectedRecord?.id === confirmArchiveRecord.id) {
              setSelectedRecord(null);
            }
            refreshAllData();
          }}
          title="Are you sure you want to delete this?"
          message={`Are you sure you want to delete/archive the disciplinary record for "${confirmArchiveRecord.studentName}"? It will be moved to System Settings > System Archive.`}
          confirmText="Yes"
          cancelText="No"
          type="danger"
        />
      )}
    </div>
  );
};
