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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh]">
        {/* Header: py-2로 축소 */}
        <div className="p-2 px-3 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button onClick={onBack} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-sm font-black text-indigo-900 leading-none">Cloud Navigator</h2>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter">Browse Folders & Logs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List Container: 내부 패딩 제거 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Updating...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="flex flex-col">
              {files.map((file) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                return (
                  <button
                    key={file.id}
                    onClick={() => onSelect(file)}
                    // py-1.5로 행 높이 최소화, border-b 색상 연하게
                    className="w-full text-left py-1.5 px-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-[8px] flex-shrink-0 ${isFolder ? 'text-amber-500' : 'text-slate-300'}`}>
                        {isFolder ? '■' : '●'}
                      </span>
                      
                      <p className={`text-sm font-bold truncate leading-tight ${isFolder ? 'text-slate-800' : 'text-slate-600'}`}>
                        {file.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <p className="text-[9px] text-slate-400 font-mono font-bold leading-none">
                        {isFolder ? 'DIR' : new Date(file.modifiedTime).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
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
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <p className="text-[11px] font-bold uppercase">Empty Directory</p>
            </div>
          )}
        </div>
        
        {/* Footer: 높이 최소화 */}
        <div className="py-1 bg-slate-100 text-[10px] text-slate-500 font-black text-center uppercase tracking-tighter border-t border-slate-200">
          Cloud Diagnostic Storage
        </div>
      </div>
    </div>
  );
};

export default DriveFilePicker;
