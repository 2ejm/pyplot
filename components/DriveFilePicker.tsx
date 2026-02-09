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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-1">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh]">
        {/* Header: 높이 더 압축 */}
        <div className="p-1.5 px-3 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button onClick={onBack} className="p-0.5 hover:bg-indigo-100 rounded text-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-[13px] font-black text-indigo-900 leading-none">Cloud Navigator</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-0.5 text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Loading...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="flex flex-col">
              {files.map((file) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                return (
                  <button
                    key={file.id}
                    onClick={() => onSelect(file)}
                    // py-1(수직 여백 최소화) 및 border 최소화
                    className="w-full text-left py-1 px-3 hover:bg-indigo-50/50 border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex-1 min-w-0">
                      {/* 아이콘 제거, 텍스트 크기 14px 고정, 줄간격 최대한 압축 */}
                      <p className={`text-[14px] font-bold truncate leading-tight ${isFolder ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {isFolder ? `[DIR] ${file.name}` : file.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {/* 날짜 정보도 텍스트 위주로 작게 표시 */}
                      <p className="text-[10px] text-slate-400 font-mono font-bold leading-none">
                        {!isFolder && new Date(file.modifiedTime).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
                      </p>
                      
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 group-hover:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-[11px] text-slate-400 font-bold uppercase">Empty</div>
          )}
        </div>
        
        {/* Footer */}
        <div className="py-0.5 bg-slate-50 text-[9px] text-slate-400 font-black text-center uppercase border-t border-slate-100">
          Cloud Diagnostic Storage
        </div>
      </div>
    </div>
  );
};
export default DriveFilePicker;
