
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
		  // p-1을 py-0.5로 변경하여 위아래 여백을 더 제거했습니다.
		  className="w-full text-left py-0.5 px-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center gap-3 group"
		>
		  {/* 아이콘 영역: h-3에서 h-5(또는 6)로 텍스트 높이에 맞게 재조정 (너무 낮으면 아이콘이 깨짐) */}
		  {/* 대신 배경색을 빼거나 크기를 더 컴팩트하게 w-6 h-6으로 설정 */}
		  <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors flex-shrink-0 ${isFolder ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'}`}>
		    {isFolder ? (
		      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
		      </svg>
		    ) : (
		      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		      </svg>
		    )}
		  </div>

		  <div className="flex-1 min-w-0 flex flex-row items-center gap-2">
		    {/* 텍스트 크기는 유지, leading-none으로 줄 간격 제거 */}
		    <p className={`text-sm font-bold truncate leading-none ${isFolder ? 'text-slate-800' : 'text-slate-700'}`}>
		      {file.name}
		    </p>
		    {/* 부가 정보(날짜)를 아래가 아닌 옆으로 배치하여 세로 높이를 획기적으로 줄임 */}
		    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter leading-none whitespace-nowrap">
		      {isFolder ? '[DIR]' : `| ${new Date(file.modifiedTime).toLocaleDateString()}`}
		    </p>
		  </div>

		  {/* 오른쪽 화살표 크기 유지하되 leading에 영향 없도록 조정 */}
		  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
		    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
		  </svg>
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
