
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-1">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button onClick={onBack} className="p-2 hover:bg-indigo-100 rounded-full text-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-indigo-900">Cloud Navigator</h2>
              <p className="text-[12px] text-indigo-600 font-bold uppercase tracking-widest">Browse Folders & Logs</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-sm text-slate-500 font-medium tracking-tight uppercase tracking-widest text-[12px]">Updating Index...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="space-y-0.5">
              {files.map((file) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                return (
                 <button
  key={file.id}
  onClick={() => onSelect(file)}
  // py-0 (상하 패딩 제거), px-2 (좌우만 유지)
  className="w-full text-left py-0.5 px-2 rounded hover:bg-slate-50 border-b border-gray-50 last:border-0 transition-all flex items-center justify-between group"
>
  <div className="flex items-center gap-2 flex-1 min-w-0">
    {/* 폴더/파일 구분 표시기 (아이콘 대신 작은 점이나 텍스트로 대체) */}
    <span className={`text-[10px] font-black flex-shrink-0 ${isFolder ? 'text-amber-500' : 'text-slate-300'}`}>
      {isFolder ? '●' : '○'}
    </span>
    
    {/* 파일명: 폰트 크기 유지, 높이 최소화 */}
    <p className={`text-sm font-bold truncate leading-tight ${isFolder ? 'text-slate-800' : 'text-slate-700'}`}>
      {file.name}
    </p>
  </div>

  {/* 우측 정보: 날짜를 파일명과 같은 선상에 배치 */}
  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
    <p className="text-[10px] text-slate-400 font-mono font-bold leading-none">
      {isFolder ? 'DIR' : new Date(file.modifiedTime).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit'})}
    </p>
    
    {/* 화살표도 작게 축소 */}
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 group-hover:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  </div>
</button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <p className="text-sm font-medium">Directory is empty.</p>
            </div>
          )}
        </div>
        
        <div className="p-1 bg-slate-50 text-[12px] text-slate-400 font-bold text-center uppercase tracking-widest">
          Cloud Diagnostic Storage
        </div>
      </div>
    </div>
  );
};

export default DriveFilePicker;
