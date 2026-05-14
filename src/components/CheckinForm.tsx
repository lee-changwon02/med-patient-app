import { useState } from 'react';
import type { Checkin } from '../types';

const MOODS = ['매우 좋음', '좋음', '보통', '나쁨', '매우 나쁨'];
const SYMPTOMS = ['어지러움', '두통', '피로', '근육통', '소화불편', '메스꺼움', '두근거림', '부종', '기침', '속쓰림', '이상없음'];

interface Props {
  onSave: (data: Omit<Checkin, 'id' | 'date'>) => void;
  onClose: () => void;
  saving?: boolean;
}

export default function CheckinForm({ onSave, onClose, saving }: Props) {
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const toggleSym = (s: string) =>
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleSave = () => {
    if (!mood) return;
    onSave({ mood, symptoms, note });
  };

  return (
    <div className="ov" onClick={onClose}>
      <div className="mbox" onClick={e => e.stopPropagation()}>
        <div className="mhdr">
          <span className="mtitle">오늘 컨디션 기록</span>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>

        <div className="ig">
          <label className="lbl">전반적인 상태</label>
          <div className="pr">
            {MOODS.map(m => (
              <button key={m} className={`pill${mood === m ? ' on' : ''}`} onClick={() => setMood(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="ig">
          <label className="lbl">증상 (복수 선택)</label>
          <div className="pr">
            {SYMPTOMS.map(s => (
              <button key={s} className={`pill${symptoms.includes(s) ? ' on' : ''}`} onClick={() => toggleSym(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="ig">
          <label className="lbl">메모</label>
          <textarea
            className="inp"
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="특이 사항을 입력하세요"
            style={{ resize: 'none' }}
          />
        </div>

        <button className="bp" disabled={!mood || saving} onClick={handleSave}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
