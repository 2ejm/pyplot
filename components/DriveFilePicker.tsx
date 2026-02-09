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

// ... 상단 인터페이스 동일

const DriveFilePicker: React.FC<DriveFilePickerProps> = ({ files, onSelect, onClose, onBack, canGoBack, loading }) => {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-1">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="p-1.5 px-3 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button onClick={onBack} className="p-0.5 hover:bg-white rounded text-indigo-600 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-[13px] font-black text-indigo-900 uppercase tracking-tight">Cloud Navigator</h2>
          </div>
          <button onClick={onClose} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List Body: 이모지 없이 텍스트로만 구성 */}
        <div className="flex-1 overflow-y-auto space-y-[1px] p-1 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-[12px] font-black text-indigo-300 animate-pulse uppercase tracking-widest">
              Indexing...
            </div>
          ) : files.length > 0 ? (
            files.map((file, i) => {
              const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
              const dateStr = new Date(file.modifiedTime).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'});
              
              return (
                <button
                  key={`${file.id}-${i}`}
                  onClick={() => onSelect(file)}
                  className={`grid grid-cols-[2fr_0.8fr_0.8fr_auto] w-full text-left text-[14px] font-bold border-b border-gray-50 py-1 hover:bg-indigo-50/50 transition-all px-3 active:scale-[0.98] group items-center ${
                    isFolder ? 'text-indigo-600' : 'text-slate-700'
                  }`}
                >
                  {/* 1열: 파일/폴더명 (이모지 제거) */}
                  <span className="truncate pr-2 group-hover:translate-x-1 transition-transform">
                    {file.name}
                  </span>
                  
                  {/* 2열: 타입 (폴더일 경우 더 강조) */}
                  <span className={`text-[10px] uppercase tracking-tighter ${isFolder ? 'text-indigo-500 font-black' : 'text-gray-400 font-medium'}`}>
                    {isFolder ? 'Directory' : 'File'}
                  </span>
                  
                  {/* 3열: 날짜 */}
                  <span className="text-[11px] text-gray-400 font-mono font-medium">
                    {dateStr}
                  </span>
                  
                  {/* 4열: 화살표 */}
                  <span className="flex justify-end ml-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-200 group-hover:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-gray-300 italic font-black uppercase tracking-widest text-[12px]">
              No Data Found
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="py-1 bg-slate-50 text-[9px] text-slate-400 font-black text-center uppercase border-t border-slate-100">
          Terminal Storage Index
        </div>
      </div>
    </div>
  );
};

export default DriveFilePicker;
