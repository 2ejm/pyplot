
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
    <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm w-full flex flex-col gap-2 transition-all">
      <div className="flex justify-between items-center border-b border-indigo-50 pb-1.5">
        <h3 className="text-indigo-600 font-black text-[10px] uppercase tracking-widest">
          [ {isDrive ? 'CLOUD DIRECTORY' : 'LOCAL DIRECTORY'} ]
        </h3>
        <span className="text-[8px] font-bold text-gray-400">{files.length} ITEMS</span>
      </div>
      
      <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {files.length > 0 ? (
          files.map((item, idx) => {
            const name = isDrive ? (item as DriveFile).name : (item as File).name;
            const isActive = name === currentFileName;
            
            return (
              <button
                key={isDrive ? (item as DriveFile).id : `${name}-${idx}`}
                onClick={() => isDrive ? onSelectDrive(item as DriveFile) : onSelectLocal(item as File)}
                className={`w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2 group ${
                  isActive 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                    : 'bg-gray-50 border-transparent hover:border-indigo-100 hover:bg-white text-gray-600'
                }`}
              >
                <div className={`flex-shrink-0 ${isActive ? 'text-indigo-200' : 'text-gray-400 group-hover:text-indigo-500'}`}>
                  {isDrive ? (
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[9px] font-black truncate leading-tight ${isActive ? 'text-white' : 'text-gray-700'}`}>
                    {name}
                  </p>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-sm" />
                )}
              </button>
            );
          })
        ) : (
          <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <p className="text-slate-300 italic font-bold text-[9px] uppercase tracking-[0.2em]">
              Source Empty
            </p>
          </div>
        )}
      </div>
      
      <div className="pt-2 mt-1 border-t border-slate-50 flex flex-col items-center gap-1">
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter italic">
          Select target file to sync
        </p>
      </div>
    </div>
  );
};

export default SidebarFileList;
