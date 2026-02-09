import React from 'react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface SidebarFileListProps {
  driveFiles: DriveFile[];
  localFiles: File[];
  sourceType: 'drive' | 'local' | null;
  onSelectDrive: (file: DriveFile) => void;
  onSelectLocal: (file: File) => void;
  currentFileName: string;
}

const SidebarFileList: React.FC<SidebarFileListProps> = ({ 
  driveFiles,
  localFiles, 
  sourceType,
  onSelectDrive,
  onSelectLocal, 
  currentFileName 
}) => {
  const isDrive = sourceType === 'drive';
  const files = isDrive ? driveFiles : localFiles;

  return (
    <div className="bg-white border border-gray-100 p-1.5 rounded-xl shadow-sm w-full flex flex-col transition-all">
      {/* Header: 여백 최소화 및 텍스트 강조 */}
      <div className="flex justify-between items-center border-b border-slate-50 px-2 pb-1.5 mb-1">
        <h3 className="text-indigo-600 font-black text-[14px] uppercase tracking-tighter">
          [ {isDrive ? 'Cloud Index' : 'Local'} ]
        </h3>
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          {files.length} ITEMS
        </span>
      </div>
      
      {/* List Body: space-y-[1px]로 밀착 배치 */}
      <div className="max-h-[350px] overflow-y-auto space-y-[2px] custom-scrollbar">
        {files.length > 0 ? (
          files.map((item, idx) => {
            const name = isDrive ? (item as DriveFile).name : (item as File).name;
            const isActive = name === currentFileName;
            
            return (
              <button
                key={isDrive ? (item as DriveFile).id : `${name}-${idx}`}
                onClick={() => isDrive ? onSelectDrive(item as DriveFile) : onSelectLocal(item as File)}
                // 아이콘 제거, py-1(알람 리스트와 동일), text-[14px] 적용
                className={`w-full text-left py-1 px-3 rounded-lg border-b border-transparent transition-all flex items-center justify-between group active:scale-[0.98] ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md z-10' 
                    : 'bg-transparent hover:bg-indigo-50 text-slate-600 border-slate-50/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] font-bold truncate leading-none ${isActive ? 'text-white' : 'text-slate-700'}`}>
                    {name}
                  </p>
                </div>

                {/* 활성화 상태일 때만 작은 인디케이터 표시 */}
                {isActive ? (
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse ml-2" />
                ) : (
                  <span className="text-[10px] text-slate-300 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    SELECT
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="py-10 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-100 mx-1">
            <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest">
              No Files
            </p>
          </div>
        )}
      </div>
      
      {/* Footer: 높이 최소화 */}
      <div className="mt-1 pt-1 border-t border-slate-50 flex justify-center">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter italic">
          System Storage Navigator
        </p>
      </div>
    </div>
  );
};

export default SidebarFileList;
