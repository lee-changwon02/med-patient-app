import { useRef, useState } from 'react';

interface ParsedMed {
  name: string;
  dosage: string;
  period: string;
  category: string;
}

interface Props {
  onImportMeds: (meds: ParsedMed[]) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    Tesseract?: {
      createWorker: (lang: string, oem: number, opts?: object) => Promise<{
        recognize: (img: string) => Promise<{ data: { text: string } }>;
        terminate: () => Promise<void>;
      }>;
    };
  }
}

function parsePrescription(text: string): ParsedMed[] {
  const meds: ParsedMed[] = [];
  const matches = text.match(/([가-힣a-zA-Z][가-힣a-zA-Z0-9\s\-\.]{2,}(?:정|캡슐|mg|Tab|Cap|주사|현탁)[^\n]{0,20})/g) ?? [];
  matches.forEach(m => {
    const name = m.replace(/\s+/g, ' ').trim().substring(0, 40);
    if (name.length > 3 && !meds.find(x => x.name === name)) {
      meds.push({ name, dosage: '', period: '아침', category: '일반약' });
    }
  });
  return meds.length ? meds : [{ name: '약물명을 직접 수정해주세요', dosage: '', period: '아침', category: '일반약' }];
}

export default function OcrImport({ onImportMeds, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [parsed, setParsed] = useState<ParsedMed[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ParsedMed[]>([]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => setImgSrc(e.target?.result as string);
    reader.readAsDataURL(file);
    setParsed(null);
    setError('');
    setEditing([]);
  };

  const runOCR = async () => {
    if (!imgSrc) return;
    if (!window.Tesseract) {
      setError('Tesseract.js가 로드되지 않았습니다. 인터넷 연결을 확인해주세요.');
      return;
    }
    setLoading(true); setProgress(0); setStatusMsg('초기화 중...');
    try {
      const worker = await window.Tesseract.createWorker('kor+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
            setStatusMsg(`인식 중... ${Math.round(m.progress * 100)}%`);
          } else {
            setStatusMsg(m.status.includes('load') ? '언어 데이터 로드 중...' : m.status);
          }
        },
      });
      const { data: { text } } = await worker.recognize(imgSrc);
      await worker.terminate();
      const result = parsePrescription(text.trim());
      setParsed(result);
      setEditing(result.map(r => ({ ...r })));
    } catch {
      setError('인식 실패. 더 선명한 사진으로 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const updateEditing = (i: number, key: keyof ParsedMed, val: string) => {
    setEditing(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m));
  };

  const removeEditing = (i: number) => setEditing(prev => prev.filter((_, idx) => idx !== i));

  const handleConfirm = () => {
    onImportMeds(editing.filter(m => m.name.trim()));
  };

  return (
    <div className="ov" onClick={onClose}>
      <div className="mbox" onClick={e => e.stopPropagation()}>
        <div className="mhdr">
          <span className="mtitle">처방전 OCR 가져오기</span>
          <button className="mclose" onClick={onClose}>✕</button>
        </div>

        <div className="info-box" style={{ marginBottom: 12 }}>
          처방전 사진을 업로드하면 약물명을 자동으로 인식합니다.<br />
          인식 후 직접 확인/수정 후 등록하세요.
        </div>

        {!parsed && (
          <>
            <div
              className="ocr-drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              {imgSrc
                ? <img src={imgSrc} className="ocr-img" alt="처방전" />
                : <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>사진을 탭하거나 드래그</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>JPG, PNG, HEIC</div>
                  </>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {loading && (
              <div style={{ margin: '12px 0' }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>{statusMsg}</div>
                <div className="ocr-prog"><div className="ocr-bar" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            {error && <div style={{ color: '#991B1B', fontSize: 12, margin: '8px 0' }}>{error}</div>}

            <button className="bp" style={{ marginTop: 12 }} disabled={!imgSrc || loading} onClick={runOCR}>
              {loading ? '인식 중...' : 'OCR 인식 시작'}
            </button>
          </>
        )}

        {parsed && editing.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10 }}>
              인식된 약물 목록을 확인/수정 후 등록하세요
            </div>
            {editing.map((med, i) => (
              <div key={i} className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="inp" value={med.name}
                    onChange={e => updateEditing(i, 'name', e.target.value)}
                    placeholder="약물명" style={{ flex: 2 }} />
                  <input className="inp" value={med.dosage}
                    onChange={e => updateEditing(i, 'dosage', e.target.value)}
                    placeholder="용량" style={{ flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select className="inp" value={med.period}
                    onChange={e => updateEditing(i, 'period', e.target.value)} style={{ flex: 1 }}>
                    {['아침', '점심', '저녁', '취침전'].map(p => <option key={p}>{p}</option>)}
                  </select>
                  <button className="bred" onClick={() => removeEditing(i)}>삭제</button>
                </div>
              </div>
            ))}
            <button className="bp" onClick={handleConfirm}>
              {editing.length}개 약물 등록
            </button>
            <button className="bo" style={{ marginTop: 8 }} onClick={() => { setParsed(null); setImgSrc(null); }}>
              다시 촬영
            </button>
          </>
        )}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
