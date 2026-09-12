import React, { useState } from 'react';
import { StaffMember, Language } from '../types';
import { getT } from '../utils/translations';
import { X, Camera, Save, User, Mail, Phone, Tag, Check } from 'lucide-react';

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  onSaveStaff: (updated: StaffMember) => void;
  language: Language;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
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

  const [name, setName] = useState(staff.name);
  const [title, setTitle] = useState(staff.title);
  const [role, setRole] = useState(staff.role);
  const [email, setEmail] = useState(staff.email);
  const [extension, setExtension] = useState(staff.extension);
  const [avatar, setAvatar] = useState(staff.avatar);
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
              className="h-24 w-24 rounded-3xl object-cover border-4 shadow-xl"
              style={{ borderColor: staff.color }}
            />
            <label className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-center p-1">
              <Camera className="h-6 w-6 text-cyan-300" />
              <span className="text-[10px] font-bold mt-1">Yükle (PNG/JPG)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </label>
          </div>

          <label className="mt-2 text-xs text-cyan-400 hover:underline cursor-pointer font-semibold">
            Bilgisayardan Fotoğraf Seç
            <input
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />
          </label>

          {/* Quick Preset Selector */}
          <div className="flex items-center space-x-2 mt-3 overflow-x-auto max-w-full py-1">
            {PRESET_AVATARS.map((p, idx) => (
              <img
                key={idx}
                src={p}
                alt="preset"
                referrerPolicy="no-referrer"
                onClick={() => setAvatar(p)}
                className={`h-8 w-8 rounded-full object-cover cursor-pointer border-2 transition-all ${
                  avatar === p ? 'border-cyan-400 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              />
            ))}
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
