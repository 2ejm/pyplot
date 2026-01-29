
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LogEntry } from './types';
import { parseLogFile } from './services/parserService';
import LogChart from './components/LogChart';
import AlarmSummary from './components/AlarmSummary';
import DriveFilePicker from './components/DriveFilePicker';
import FixedAnnotation from './components/FixedAnnotation';
import SidebarFileList from './components/SidebarFileList';

declare var gapi: any;
declare var google: any;

const DEFAULT_SAMPLE_RATE = 10; 

const DURATIONS = [
  { label: '5M', value: 5 * 60 * 1000 },
  { label: '10M', value: 10 * 60 * 1000 },
  { label: '1H', value: 1 * 3600 * 1000 },
  { label: '12H', value: 12 * 3600 * 1000 },
  { label: '24H', value: 24 * 3600 * 1000 },
];

const App: React.FC = () => {
  const [allData, setAllData] = useState<LogEntry[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [duration, setDuration] = useState(DURATIONS[2].value);
  const [searchTime, setSearchTime] = useState("");
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  
  // File Listing State
  const [sourceType, setSourceType] = useState<'drive' | 'local' | null>(null);
  const [availableDriveFiles, setAvailableDriveFiles] = useState<any[]>([]);
  const [availableLocalFiles, setAvailableLocalFiles] = useState<File[]>([]);
  
  // Auth & Picker State
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize GAPI and GIS (Google Identity Services)
  useEffect(() => {
    const initGapi = async () => {
      try {
        // 1. Load the GAPI client and picker library
        await new Promise((resolve) => gapi.load('client:picker', resolve));
        
        // 2. Initialize the GAPI client with discovery docs
        await gapi.client.init({
          apiKey: process.env.API_KEY,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });

        // 3. Initialize the Token Client (GIS)
        // Note: client_id is usually injected or required for OAuth. 
        // We'll use a placeholder or handle the absence gracefully.
        const client = google.accounts.oauth2.initTokenClient({
          client_id: '', // In the real environment, this is usually handled via process.env or configuration
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error("Auth error:", response);
              return;
            }
            setAccessToken(response.access_token);
            createPicker(response.access_token);
          },
        });
        
        setTokenClient(client);
        setApiReady(true);
      } catch (e) {
        console.error("GAPI/GIS Initialization Error:", e);
      }
    };
    initGapi();
  }, []);

  const createPicker = useCallback((token: string) => {
    if (!token) return;

    // View for Folders
    const folderView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes("application/vnd.google-apps.folder");

    // View for Files
    const fileView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes("text/plain,application/octet-stream");

    const picker = new google.picker.PickerBuilder()
      .addView(folderView)
      .addView(fileView)
      .setOAuthToken(token)
      .setDeveloperKey(process.env.API_KEY)
      .setCallback(pickerCallback)
      .setTitle("Select Log Folder or File")
      .build();
    picker.setVisible(true);
  }, []);

  const pickerCallback = async (data: any) => {
    if (data.action === google.picker.Action.PICKED) {
      const doc = data.docs[0];
      if (doc.mimeType === 'application/vnd.google-apps.folder') {
        listFilesInFolder(doc.id);
      } else {
        loadDriveFile(doc);
      }
    }
  };

  const listFilesInFolder = async (folderId: string) => {
    setLoading(true);
    try {
      const q = `'${folderId}' in parents and trashed = false and (mimeType = 'text/plain' or name contains '.log' or name contains '.txt')`;
      const response = await gapi.client.drive.files.list({
        q,
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'name'
      });
      const files = response.result.files || [];
      setAvailableDriveFiles(files);
      setSourceType('drive');
      
      if (files.length > 0) {
        loadDriveFile(files[0]);
      } else {
        alert("No compatible log files found in this folder.");
      }
    } catch (e) {
      console.error("Error listing files", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDriveClick = () => {
    if (!tokenClient) {
      alert("Google Auth is still initializing. Please wait a moment.");
      return;
    }

    if (!accessToken) {
      // This is the call that was causing the TypeError if tokenClient was null
      tokenClient.requestAccessToken();
    } else {
      createPicker(accessToken);
    }
  };

  const loadLocalFile = useCallback((file: File) => {
    setLoading(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseLogFile(content, DEFAULT_SAMPLE_RATE);
      setAllData(parsed);
      if (parsed.length > 0) setStartTime(parsed[0].timestamp);
      setLoading(false);
    };
    reader.onerror = () => {
      setLoading(false);
      alert("Error reading local file.");
    };
    reader.readAsText(file);
  }, []);

  const loadDriveFile = useCallback(async (file: any) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const response = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
      const parsed = parseLogFile(response.body, DEFAULT_SAMPLE_RATE); 
      setAllData(parsed);
      if (parsed.length > 0) setStartTime(parsed[0].timestamp);
      setSourceType('drive');
    } catch (e) {
      console.error("Drive load error", e);
      alert("Failed to load file from Drive. Check permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocalFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
      .filter(f => f.name.toLowerCase().endsWith('.log') || f.name.toLowerCase().endsWith('.txt'));
    
    if (files.length === 0) return;
    
    setAvailableLocalFiles(files);
    setSourceType('local');
    loadLocalFile(files[0]);
  };

  const handleAlarmJump = (timestamp: number) => {
    if (allData.length === 0) return;
    const jumpTime = timestamp - 10000;
    const closest = allData.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - jumpTime) < Math.abs(prev.timestamp - jumpTime) ? curr : prev;
    });
    setStartTime(closest.timestamp);
  };

  const handleSearch = () => {
    if (!searchTime || allData.length === 0) return;
    const [hours, minutes] = searchTime.split(':').map(Number);
    const targetDate = new Date(2022, 1, 21, hours, minutes, 0);
    const targetTs = targetDate.getTime();
    const closest = allData.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - targetTs) < Math.abs(prev.timestamp - targetTs) ? curr : prev;
    });
    setStartTime(closest.timestamp);
  };

  const visibleData = useMemo(() => {
    if (allData.length === 0) return [];
    const endTs = startTime + duration;
    return allData.filter(d => d.timestamp >= startTime && d.timestamp < endTs);
  }, [allData, startTime, duration]);

  const handleReset = () => {
    setAllData([]);
    setFileName("");
    setSourceType(null);
    setAvailableLocalFiles([]);
    setAvailableDriveFiles([]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-50 font-sans selection:bg-indigo-100 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-md font-black text-gray-900 tracking-tight leading-none uppercase">MED-ANALYZER <span className="text-indigo-600">PRO</span></h1>
            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 italic">Enterprise Diagnostic Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLocalFilesSelect} 
            className="hidden" 
            multiple
            accept=".log,.txt"
          />
          
          <button 
            onClick={handleDriveClick} 
            disabled={!apiReady}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border shadow-sm uppercase tracking-tighter flex items-center gap-1.5 ${
              apiReady ? 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200' : 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H5.5z" />
            </svg>
            {apiReady ? 'Google Drive' : 'Initializing...'}
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="px-4 py-1.5 bg-indigo-600 rounded-lg text-[10px] font-black text-white hover:bg-indigo-700 transition-all shadow-md uppercase tracking-tighter"
          >
            Open Local Files
          </button>
          
          {allData.length > 0 && (
            <button onClick={handleReset} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-3 flex flex-col gap-3">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="font-black mt-4 text-gray-400 uppercase tracking-widest text-[9px]">Slicing Telemetry Stream...</p>
          </div>
        ) : allData.length > 0 ? (
          <div className="flex flex-col lg:flex-row h-full gap-3">
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 p-2 shadow-sm relative group overflow-hidden">
                 <LogChart data={visibleData} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">24H Jump Control</span>
                  <div className="flex gap-2">
                    <input 
                      type="time" 
                      step="1"
                      value={searchTime}
                      onChange={(e) => setSearchTime(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button 
                      onClick={handleSearch}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm transition-all"
                    >
                      Jump
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Timeline Scale</span>
                  <div className="grid grid-cols-5 gap-1">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setDuration(d.value)}
                        className={`py-2 text-[10px] font-black rounded-lg transition-all border ${
                          duration === d.value 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:w-80 flex flex-col gap-3 flex-shrink-0 overflow-y-auto pr-1 custom-scrollbar">
              <AlarmSummary data={allData} onAlarmClick={handleAlarmJump} />
              <FixedAnnotation />
              
              <SidebarFileList 
                driveFiles={availableDriveFiles}
                localFiles={availableLocalFiles}
                sourceType={sourceType}
                onSelectDrive={loadDriveFile}
                onSelectLocal={loadLocalFile}
                currentFileName={fileName}
              />
              
              <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mt-auto">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase mb-2 tracking-widest border-b border-indigo-50 pb-1">Session Data</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-gray-400 uppercase tracking-tighter">Samples</span>
                    <span className="text-gray-700">{allData.length}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-gray-400 uppercase tracking-tighter">Active Trace</span>
                    <span className="text-indigo-600 truncate max-w-[120px]">{fileName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-3xl m-2 shadow-sm relative overflow-hidden group">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 border border-gray-100 shadow-inner group-hover:scale-105 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tighter uppercase">Diagnostic Analyzer</h2>
            <p className="text-gray-400 mb-8 max-w-xs text-center text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed">
              Connect to Drive or Local Storage to analyze telemetry logs
            </p>
            <div className="flex gap-3">
               <button 
                 onClick={handleDriveClick} 
                 disabled={!apiReady}
                 className="px-6 py-2.5 bg-indigo-600 rounded-lg font-black text-[10px] text-white hover:bg-indigo-700 shadow-lg uppercase tracking-widest border border-indigo-500 disabled:bg-gray-400 disabled:border-gray-400"
               >
                 {apiReady ? 'Google Drive' : 'Initializing...'}
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg font-black text-[10px] text-gray-600 hover:bg-gray-50 uppercase tracking-widest shadow-sm">Local Files</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
