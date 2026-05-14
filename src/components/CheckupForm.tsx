import { useState } from 'react';
import type { Checkup } from '../types';
import { emptyCheckup } from '../store';

interface Props {
  initial?: Partial<Checkup>;
  onSave: (data: Omit<Checkup, 'id'>) => void;
  onClose: () => void;
  saving?: boolean;
}

type CheckupDraft = Omit<Checkup, 'id'>;

const SECTIONS: { title: string; fields: { key: keyof CheckupDraft; label: string; unit?: string }[] }[] = [
  {
    title: '기본 정보',
    fields: [
      { key: 'date', label: '검진 날짜' },
      { key: 'inst', label: '검진 기관' },
    ],
  },
  {
    title: '기본 측정',
    fields: [
      { key: 'ht', label: '신장', unit: 'cm' },
      { key: 'wt', label: '체중', unit: 'kg' },
      { key: 'bmi', label: 'BMI' },
      { key: 'waist', label: '허리둘레', unit: 'cm' },
    ],
  },
  {
    title: '혈압/맥박',
    fields: [
      { key: 'sbp', label: '수축기혈압', unit: 'mmHg' },
      { key: 'dbp', label: '이완기혈압', unit: 'mmHg' },
      { key: 'pulse', label: '맥박', unit: 'bpm' },
    ],
  },
  {
    title: '혈당',
    fields: [
      { key: 'gl', label: '공복혈당', unit: 'mg/dL' },
      { key: 'hba1c', label: 'HbA1c', unit: '%' },
    ],
  },
  {
    title: '지질',
    fields: [
      { key: 'chol', label: '총콜레스테롤', unit: 'mg/dL' },
      { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
      { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
      { key: 'tri', label: '중성지방', unit: 'mg/dL' },
    ],
  },
  {
    title: '간기능',
    fields: [
      { key: 'ast', label: 'AST', unit: 'U/L' },
      { key: 'alt', label: 'ALT', unit: 'U/L' },
      { key: 'ggt', label: 'GGT', unit: 'U/L' },
      { key: 'alp', label: 'ALP', unit: 'U/L' },
      { key: 'bili', label: 'Bilirubin', unit: 'mg/dL' },
    ],
  },
  {
    title: '신장',
    fields: [
      { key: 'cr', label: 'Creatinine', unit: 'mg/dL' },
      { key: 'egfr', label: 'eGFR', unit: 'mL/min' },
      { key: 'bun', label: 'BUN', unit: 'mg/dL' },
      { key: 'uprotein', label: '요단백' },
    ],
  },
  {
    title: '혈액',
    fields: [
      { key: 'wbc', label: 'WBC', unit: '×10³/μL' },
      { key: 'rbc', label: 'RBC', unit: '×10⁶/μL' },
      { key: 'hb', label: 'Hb', unit: 'g/dL' },
      { key: 'hct', label: 'Hct', unit: '%' },
      { key: 'platelet', label: 'Platelet', unit: '×10³/μL' },
    ],
  },
  {
    title: '염증',
    fields: [
      { key: 'crp', label: 'CRP', unit: 'mg/L' },
      { key: 'esr', label: 'ESR', unit: 'mm/hr' },
    ],
  },
  {
    title: '전해질',
    fields: [
      { key: 'na', label: 'Na', unit: 'mEq/L' },
      { key: 'k', label: 'K', unit: 'mEq/L' },
      { key: 'cl', label: 'Cl', unit: 'mEq/L' },
    ],
  },
  {
    title: '갑상선',
    fields: [
      { key: 'tsh', label: 'TSH', unit: 'mIU/L' },
      { key: 'ft4', label: 'Free T4', unit: 'ng/dL' },
    ],
  },
  {
    title: '종양표지자',
    fields: [
      { key: 'cea', label: 'CEA', unit: 'ng/mL' },
      { key: 'ca199', label: 'CA19-9', unit: 'U/mL' },
      { key: 'afp', label: 'AFP', unit: 'ng/mL' },
      { key: 'psa', label: 'PSA', unit: 'ng/mL' },
    ],
  },
  {
    title: '소변검사 / 영상·내시경',
    fields: [
      { key: 'urine', label: '소변검사' },
      { key: 'imaging', label: '영상/내시경 메모' },
    ],
  },
  {
    title: '소견',
    fields: [{ key: 'comment', label: '담당의 소견/메모' }],
  },
];

export default function CheckupForm({ initial, onSave, onClose, saving }: Props) {
  const [form, setForm] = useState<CheckupDraft>({
    ...emptyCheckup(),
    ...(initial ?? {}),
  });

  const set = (key: keyof CheckupDraft, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.date) return;
    // auto-calc BMI
    const ht = parseFloat(form.ht);
    const wt = parseFloat(form.wt);
    const bmi = ht > 0 && wt > 0 ? String((wt / Math.pow(ht / 100, 2)).toFixed(1)) : form.bmi;
    onSave({ ...form, bmi });
  };

  return (
    <div className="ov" onClick={onClose}>
      <div className="mbox" onClick={e => e.stopPropagation()}>
        <div className="mhdr">
          <span className="mtitle">건강검진 결과 입력</span>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>

        {SECTIONS.map(sec => (
          <div key={sec.title} style={{ marginBottom: 16 }}>
            <div className="card-hd">{sec.title}</div>
            <div className="cu-grid">
              {sec.fields.map(f => (
                <div key={f.key} className="cu-field">
                  <span className="cu-lbl">{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                  {f.key === 'comment' || f.key === 'imaging' || f.key === 'urine' ? (
                    <textarea
                      className="inp-sm"
                      value={form[f.key]}
                      onChange={e => set(f.key, e.target.value)}
                      rows={2}
                      style={{ resize: 'none', textAlign: 'left', gridColumn: 'span 2' }}
                    />
                  ) : (
                    <input
                      type={f.key === 'date' ? 'date' : 'text'}
                      className="inp-sm"
                      value={form[f.key]}
                      onChange={e => set(f.key, e.target.value)}
                      inputMode="decimal"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button className="bp" disabled={!form.date || saving} onClick={handleSave}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
