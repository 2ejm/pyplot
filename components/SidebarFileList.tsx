
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
    <div className="bg-white border border-gray-200 p-6 rounded-[2rem] shadow-sm w-full flex flex-col gap-4 transition-all">
      <div className="flex justify-between items-center border-b border-indigo-50 pb-4">
        <h3 className="text-indigo-600 font-black text-xs uppercase tracking-widest">
          [ {isDrive ? 'CLOUD' : 'LOCAL'} ]
        </h3>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{files.length} Files</span>
      </div>
      
      <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {files.length > 0 ? (
          files.map((item, idx) => {
            const name = isDrive ? (item as DriveFile).name : (item as File).name;
            const isActive = name === currentFileName;
            
            return (
              <button
                key={isDrive ? (item as DriveFile).id : `${name}-${idx}`}
                onClick={() => isDrive ? onSelectDrive(item as DriveFile) : onSelectLocal(item as File)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 group ${
                  isActive 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' 
                    : 'bg-gray-50 border-transparent hover:border-indigo-200 hover:bg-white text-gray-600'
                }`}
              >
                <div className={`flex-shrink-0 ${isActive ? 'text-indigo-100' : 'text-gray-400 group-hover:text-indigo-500'}`}>
                  {isDrive ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-black truncate leading-none uppercase ${isActive ? 'text-white' : 'text-gray-800'}`}>
                    {name}
                  </p>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-md" />
                )}
              </button>
            );
          })
        ) : (
          <div className="py-16 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
            <p className="text-gray-300 italic font-black text-[10px] uppercase tracking-[0.3em]">
              Empty
            </p>
          </div>
        )}
      </div>
      
      <div className="pt-4 mt-2 border-t border-gray-50 flex flex-col items-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic text-center">
          Select target file
        </p>
      </div>
    </div>
  );
};

export default SidebarFileList;
