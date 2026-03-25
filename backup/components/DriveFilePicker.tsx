import React from 'react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface DriveFilePickerProps {
  files: DriveFile[];
  onSelect: (file: DriveFile) => void;
  onClose: () => void;
  onBack: () => void;
  canGoBack: boolean;
  loading: boolean;
}

const DriveFilePicker: React.FC<DriveFilePickerProps> = ({ files, onSelect, onClose, onBack, canGoBack, loading }) => {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-0.5">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[60vh]">
        {/* Header: 최소한의 높이 */}
        <div className="px-2 py-0.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-1.5">
            {canGoBack && (
              <button onClick={onBack} className="hover:text-indigo-600 p-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">File Index</h2>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List Body: 여백 최소화 (수직 패딩 거의 없음) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-[10px] font-bold text-slate-300 animate-pulse uppercase">Syncing...</div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {files.map((file, i) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                const dateStr = new Date(file.modifiedTime).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'});
                
                return (
                  <button
                    key={`${file.id}-${i}`}
                    onClick={() => onSelect(file)}
                    // py-0.5 (약 2px)로 극단적 축소, grid 비율 조정
                    className="grid grid-cols-[1fr_auto] w-full text-left py-0.5 px-2 hover:bg-indigo-50 transition-colors group items-center"
                  >
                    {/* 파일명: 14px 유지하되 줄간격 제거 */}
                    <span className={`text-[14px] font-bold truncate leading-none tracking-tight ${
                      isFolder ? 'text-indigo-600' : 'text-slate-700'
                    }`}>
                      {isFolder ? `[DIR] ${file.name}` : file.name}
                    </span>
                    
                    {/* 날짜: 파일명 우측에 작게 밀착 */}
                    <span className="text-[10px] text-slate-300 font-mono font-medium ml-2 group-hover:text-indigo-400">
                      {dateStr}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-[10px] font-bold text-slate-200 uppercase tracking-widest">Empty</div>
          )}
        </div>
        
        {/* Footer: 높이 10px 미만으로 축소 */}
        <div className="py-0.5 bg-slate-50 text-[8px] text-slate-300 font-bold text-center uppercase tracking-widest border-t border-slate-100">
          Root Access Only
        </div>
      </div>
    </div>
  );
};

export default DriveFilePicker;
