import React, { useState, useRef } from 'react';
import { StaffMember } from '../types';
import { areStaffNamesEquivalent } from '../data/defaultDatasets';
import { X, Upload, CheckCircle2, AlertCircle, Camera, Check, RefreshCw } from 'lucide-react';

interface BulkAvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  onSaveStaffList: (updatedStaff: StaffMember[]) => void;
}

interface FileMatchState {
  file: File;
  fileName: string;
  dataUrl: string;
}

export const BulkAvatarUploadModal: React.FC<BulkAvatarUploadModalProps> = ({
  isOpen,
  onClose,
  staffList,
  onSaveStaffList,
}) => {
  const [matchedAvatars, setMatchedAvatars] = useState<Record<string, FileMatchState>>({});
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Strips file extension and removes unwanted special characters
  const cleanFileName = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, '').trim();
  };

  const processFiles = (files: FileList | File[]) => {
    setIsProcessing(true);
    const newMatches: Record<string, FileMatchState> = { ...matchedAvatars };

    const fileArray = Array.from(files);
    let pendingCount = fileArray.length;

    if (pendingCount === 0) {
      setIsProcessing(false);
      return;
    }

    fileArray.forEach(file => {
      const baseName = cleanFileName(file.name);

      // Find matching staff member using smart equivalence logic
      const matchedStaff = staffList.find(staff => 
        areStaffNamesEquivalent(staff.name, baseName) ||
        baseName.toLowerCase().includes(staff.name.toLowerCase()) ||
        staff.name.toLowerCase().includes(baseName.toLowerCase())
      );

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl && matchedStaff) {
          newMatches[matchedStaff.id] = {
            file,
            fileName: file.name,
            dataUrl,
          };
        }
        pendingCount--;
        if (pendingCount === 0) {
          setMatchedAvatars(newMatches);
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        pendingCount--;
        if (pendingCount === 0) {
          setMatchedAvatars(newMatches);
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleIndividualFileChange = (staffId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setMatchedAvatars(prev => ({
          ...prev,
          [staffId]: {
            file,
            fileName: file.name,
            dataUrl,
          },
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = () => {
    const updatedStaff = staffList.map(member => {
      const match = matchedAvatars[member.id];
      if (match) {
        return {
          ...member,
          avatar: match.dataUrl,
        };
      }
      return member;
    });

    onSaveStaffList(updatedStaff);
    setSuccessMessage('Temsilci fotoğrafları başarıyla sisteme sabitlendi ve kaydedildi!');
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 1200);
  };

  const matchCount = Object.keys(matchedAvatars).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl shadow-cyan-500/20 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-2">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              Temsilci Fotoğraflarını Sabitle & Eşle
            </h2>
            <p className="text-xs text-slate-400">
              Görsellerinizin dosya isimleri temsilcilerin adıyla otomatik eşleştirilir ve kalıcı profil görseli olarak kaydedilir.
            </p>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-cyan-400 bg-cyan-950/40 scale-[1.01]'
              : 'border-slate-800 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-900/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.jfif,.jpeg,.jpg,.png"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-white">
              6 Fotoğrafı Buraya Sürükleyin veya Dosya Seçmek İçin Tıklayın
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              (Örn: <span className="text-cyan-300 font-mono">Oğuzhan Kars.jfif</span>, <span className="text-cyan-300 font-mono">Büşra Yaman Öztürk.jpeg</span>, <span className="text-cyan-300 font-mono">Muhammed Arda.jpeg</span>, <span className="text-cyan-300 font-mono">Zeynep Nur Durmaz.jpeg</span>, <span className="text-cyan-300 font-mono">Feyza Nur Sertkaya.jpeg</span>, <span className="text-cyan-300 font-mono">Aynzeliha Şahin.jpeg</span>)
            </p>
            {isProcessing && (
              <div className="flex items-center space-x-2 text-xs text-cyan-400 animate-pulse pt-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Fotoğraflar analiz ediliyor ve eşleştiriliyor...</span>
              </div>
            )}
          </div>
        </div>

        {/* Staff Match Status List */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Eşleşme Durumu ({matchCount} / {staffList.length} Temsilci)
            </h3>
            {matchCount > 0 && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{matchCount} görsel eşleştirildi</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {staffList.map(member => {
              const match = matchedAvatars[member.id];
              const displayAvatar = match ? match.dataUrl : member.avatar;

              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    match
                      ? 'border-emerald-500/40 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                      : 'border-slate-800/80 bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={displayAvatar}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 rounded-xl object-cover border-2"
                        style={{ borderColor: member.color }}
                      />
                      {match && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{member.name}</h4>
                      <p className="text-[10px] text-slate-400 truncate">{member.role}</p>
                      {match ? (
                        <span className="text-[9px] text-emerald-400 font-mono truncate block">
                          ✓ {match.fileName}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 flex items-center space-x-1">
                          <AlertCircle className="h-2.5 w-2.5" />
                          <span>Henüz eşleşmedi</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <label className="shrink-0 ml-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors">
                    <span>{match ? 'Değiştir' : 'Görsel Seç'}</span>
                    <input
                      type="file"
                      accept="image/*,.jfif,.jpeg,.jpg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleIndividualFileChange(member.id, file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mt-4 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={matchCount === 0}
            className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              matchCount > 0
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="h-4 w-4" />
            <span>Fotoğrafları Sabitle ({matchCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
