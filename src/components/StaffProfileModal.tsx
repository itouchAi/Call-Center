import React, { useState, useRef } from 'react';
import { StaffMember, Language } from '../types';
import { getT } from '../utils/translations';
import { INITIAL_STAFF_MEMBERS } from '../data/defaultDatasets';
import { X, Camera, Save, User, Mail, Phone, Tag, Check, RotateCcw, Upload } from 'lucide-react';

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  onSaveStaff: (updated: StaffMember) => void;
  language: Language;
}

const PRESET_ILLUSTRATED_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=tech1&backgroundColor=0284c7',
  'https://api.dicebear.com/7.x/bottts/svg?seed=support2&backgroundColor=7c3aed',
  'https://api.dicebear.com/7.x/bottts/svg?seed=agent3&backgroundColor=059669',
  'https://api.dicebear.com/7.x/bottts/svg?seed=network4&backgroundColor=d97706',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber5&backgroundColor=db2777',
  'https://api.dicebear.com/7.x/bottts/svg?seed=voice6&backgroundColor=2563eb',
  'https://api.dicebear.com/7.x/bottts/svg?seed=datacenter7&backgroundColor=4f46e5',
  'https://api.dicebear.com/7.x/bottts/svg?seed=pulse8&backgroundColor=0d9488',
];

export const StaffProfileModal: React.FC<StaffProfileModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSaveStaff,
  language,
}) => {
  const t = getT(language);
  if (!isOpen || !staff) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find the fixed default photo for this staff member
  const defaultStaffPhoto = INITIAL_STAFF_MEMBERS.find(
    s => s.id === staff.id || s.name.toLowerCase().trim() === staff.name.toLowerCase().trim()
  )?.avatar || staff.avatar;

  const [name, setName] = useState(staff.name);
  const [title, setTitle] = useState(staff.title);
  const [role, setRole] = useState(staff.role);
  const [email, setEmail] = useState(staff.email);
  const [extension, setExtension] = useState(staff.extension);
  const [avatar, setAvatar] = useState(staff.avatar || defaultStaffPhoto);
  const [bio, setBio] = useState(staff.bio || '');
  const [skillsStr, setSkillsStr] = useState(staff.skills.join(', '));
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const updated: StaffMember = {
      ...staff,
      name,
      title,
      role,
      email,
      extension,
      avatar,
      bio,
      skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
    };

    onSaveStaff(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl shadow-cyan-500/20 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-extrabold text-white tracking-tight mb-4 flex items-center space-x-2">
          <User className="h-5 w-5 text-cyan-400" />
          <span>{t.editStaff}: {staff.name}</span>
        </h2>

        {/* Profile Image & Upload Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            <img
              src={avatar}
              alt={name}
              referrerPolicy="no-referrer"
              className="h-24 w-24 rounded-3xl object-cover border-4 shadow-xl cursor-pointer"
              style={{ borderColor: staff.color }}
              onClick={() => fileInputRef.current?.click()}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-center p-1"
            >
              <Camera className="h-6 w-6 text-cyan-300" />
              <span className="text-[10px] font-bold mt-1">Yeni Görsel Yükle</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.jfif,.jpeg,.jpg,.png"
              onChange={handleImageFileChange}
              className="hidden"
            />
          </div>

          <div className="flex items-center space-x-3 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer font-semibold flex items-center space-x-1"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Görsel Yükle (JFIF / JPEG / PNG)</span>
            </button>

            {avatar !== defaultStaffPhoto && (
              <button
                type="button"
                onClick={() => setAvatar(defaultStaffPhoto)}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition-colors"
                title="Temsilcinin orijinal sabit fotoğrafına geri dön"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Orijinal Fotoğraf</span>
              </button>
            )}
          </div>

          {/* Quick Illustrated Non-Human Avatar Presets */}
          <div className="w-full mt-4 pt-3 border-t border-white/10">
            <p className="text-[11px] text-slate-400 text-center mb-2 font-medium">
              Veya Alternatif Dijital Avatar Seçin (Gerçek İnsan İçermez)
            </p>
            <div className="flex items-center justify-center space-x-2 overflow-x-auto max-w-full py-1">
              {/* First option: Original Real Photo */}
              <div
                onClick={() => setAvatar(defaultStaffPhoto)}
                className={`relative shrink-0 cursor-pointer rounded-full transition-all ${
                  avatar === defaultStaffPhoto ? 'ring-2 ring-cyan-400 scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                title="Orijinal Temsilci Fotoğrafı"
              >
                <img
                  src={defaultStaffPhoto}
                  alt="original"
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover border border-cyan-500/50"
                />
              </div>

              {/* Illustrated Presets */}
              {PRESET_ILLUSTRATED_AVATARS.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => setAvatar(p)}
                  className={`relative shrink-0 cursor-pointer rounded-full transition-all ${
                    avatar === p ? 'ring-2 ring-cyan-400 scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                  title="Dijital Robot/Teknoloji Avatarı"
                >
                  <img
                    src={p}
                    alt={`preset-${idx}`}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full bg-slate-800 p-0.5 border border-white/20"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white font-medium focus:outline-hidden focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Unvan</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white font-medium focus:outline-hidden focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Dahili No</label>
              <input
                type="text"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white font-medium focus:outline-hidden focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">E-Posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white font-medium focus:outline-hidden focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Yetkinlikler / Uzmanlık (Virgülle ayırın)</label>
            <input
              type="text"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white font-medium focus:outline-hidden focus:border-cyan-400"
              placeholder="Aginet xDSL, Tapo, Mesh..."
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Personel Açıklaması / Not</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white font-medium focus:outline-hidden focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/30 hover:from-cyan-400 hover:to-blue-500"
          >
            {savedSuccess ? <Check className="h-4 w-4 text-white" /> : <Save className="h-4 w-4 text-white" />}
            <span>{savedSuccess ? 'Kaydedildi!' : 'Değişiklikleri Kaydet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
