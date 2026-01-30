
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LogEntry } from './types';
import { parseLogFile } from './services/parserService';
import LogChart from './components/LogChart';
import AlarmSummary from './components/AlarmSummary';
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
  const [isDragging, setIsDragging] = useState(false);
  
  // File Sources
  const [sourceType, setSourceType] = useState<'drive' | 'local' | null>(null);
  const [availableDriveFiles, setAvailableDriveFiles] = useState<any[]>([]);
  const [availableLocalFiles, setAvailableLocalFiles] = useState<File[]>([]);
  
  // Auth & API State
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Robust initialization flow
  const initializeGoogleApi = useCallback(async () => {
    setErrorInfo(null);
    setApiReady(false);
    
    try {
      console.log("Checking for Google scripts...");
      
      // Wait for scripts to be available if they are still loading
      let attempts = 0;
      while ((typeof gapi === 'undefined' || typeof google === 'undefined') && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      if (typeof gapi === 'undefined' || typeof google === 'undefined') {
        throw new Error("Google scripts not loaded. Check your internet or script tags.");
      }

      // 1. Load Picker & Client
      await new Promise((resolve, reject) => {
        gapi.load('client:picker', {
          callback: resolve,
          onerror: () => reject(new Error("Failed to load gapi client:picker")),
          timeout: 5000,
          ontimeout: () => reject(new Error("GAPI load timeout"))
        });
      });
      
      // 2. Init Client
      await gapi.client.init({
        apiKey: process.env.API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });

      // 3. Init Identity Services (GIS)
      // Note: You must ensure this Client ID is registered in Google Console for this specific origin
      const client = google.accounts.oauth2.initTokenClient({
        client_id: '754877797743-j9m7i6p0m26p0h48h0r6l8q7n8g7e8p0.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error !== undefined) {
            console.error("GIS Callback Error:", response);
            setErrorInfo(`Auth Error: ${response.error_description || response.error}`);
            return;
          }
          console.log("Access token received.");
          setAccessToken(response.access_token);
          createPicker(response.access_token);
        },
      });
      
      setTokenClient(client);
      setApiReady(true);
      console.log("Google API Initialized successfully.");

    } catch (err: any) {
      console.error("Initialization Error:", err);
      setErrorInfo(err.message || "Failed to initialize Google API.");
    }
  }, []);

  useEffect(() => {
    initializeGoogleApi();
  }, [initializeGoogleApi]);

  const createPicker = useCallback((token: string) => {
    if (!token) return;

    try {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes("application/vnd.google-apps.folder,text/plain");

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(process.env.API_KEY)
        .setCallback(async (data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            if (doc.mimeType === 'application/vnd.google-apps.folder') {
              await listFilesInFolder(doc.id);
            } else {
              loadDriveFile(doc);
            }
          }
        })
        .setTitle("Cloud Repository Explorer")
        .build();
      
      picker.setVisible(true);
    } catch (err) {
      setErrorInfo("Failed to open file picker.");
      console.error(err);
    }
  }, []);

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
      if (files.length > 0) loadDriveFile(files[0]);
    } catch (e) {
      setErrorInfo("Failed to list files in folder.");
    } finally {
      setLoading(false);
    }
  };

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
      setErrorInfo("Error downloading cloud file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDriveClick = () => {
    if (!apiReady) {
      setErrorInfo("Google API is not ready yet. Retrying initialization...");
      initializeGoogleApi();
      return;
    }

    if (!accessToken) {
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        setErrorInfo("Auth client missing. Please refresh.");
      }
    } else {
      createPicker(accessToken);
    }
  };

  const loadLocalFile = useCallback((file: File) => {
    setLoading(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseLogFile(e.target?.result as string, DEFAULT_SAMPLE_RATE);
      setAllData(parsed);
      if (parsed.length > 0) setStartTime(parsed[0].timestamp);
      setSourceType('local');
      setLoading(false);
    };
    reader.readAsText(file);
  }, []);

  const handleFilesAdded = useCallback((files: File[]) => {
    const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.log') || f.name.toLowerCase().endsWith('.txt'));
    if (validFiles.length === 0) return;
    setAvailableLocalFiles(prev => [...prev, ...validFiles]);
    setSourceType('local');
    if (allData.length === 0) loadLocalFile(validFiles[0]);
  }, [allData.length, loadLocalFile]);

  // Drag & Drop
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.items?.length > 0) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; if (e.dataTransfer.files?.length > 0) handleFilesAdded(Array.from(e.dataTransfer.files)); };

  const handleAlarmJump = (timestamp: number) => {
    const jumpTime = timestamp - 10000;
    const closest = allData.reduce((prev, curr) => Math.abs(curr.timestamp - jumpTime) < Math.abs(prev.timestamp - jumpTime) ? curr : prev);
    setStartTime(closest.timestamp);
  };

  const visibleData = useMemo(() => {
    if (!allData || allData.length === 0) return [];
    const endTs = startTime + duration;
    return allData.filter(d => d.timestamp >= startTime && d.timestamp < endTs);
  }, [allData, startTime, duration]);

  const handleReset = () => {
    setAllData([]); setFileName(""); setAvailableLocalFiles([]); setAvailableDriveFiles([]); setSourceType(null);
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen bg-gray-50 font-sans selection:bg-indigo-100 text-gray-900 relative"
      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
    >
      {/* Dynamic Error Status Bar */}
      {errorInfo && (
        <div className="absolute top-14 left-0 right-0 z-50 px-6 py-2 bg-red-600 text-white flex items-center justify-between shadow-xl animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">{errorInfo}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={initializeGoogleApi} className="text-[9px] font-black border border-white/30 px-3 py-1 rounded hover:bg-white/10 uppercase tracking-tighter">Retry Auth</button>
            <button onClick={() => setErrorInfo(null)} className="text-[9px] font-black uppercase tracking-tighter opacity-70">Close</button>
          </div>
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-600/90 backdrop-blur-md flex flex-col items-center justify-center border-8 border-dashed border-white/30 m-4 rounded-3xl pointer-events-none transition-all duration-300">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Release to Analyze</h2>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
          </div>
          <div>
            <h1 className="text-md font-black text-gray-900 tracking-tight leading-none uppercase">MED-ANALYZER <span className="text-indigo-600">PRO</span></h1>
            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 italic">Enterprise Cloud Diagnostic</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleDriveClick} 
            className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all shadow-sm uppercase tracking-widest flex items-center gap-2 border ${
              apiReady ? 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 active:scale-95' : 'bg-gray-100 text-gray-300 border-transparent cursor-wait'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M15.75 14.25L10.5 5.25L5.25 14.25H15.75ZM22.5 14.25H18.75L13.5 5.25H17.25L22.5 14.25ZM9.75 18.75H14.25L19.5 9.75L15 9.75L9.75 18.75ZM1.5 14.25L6.75 5.25H10.5L5.25 14.25H1.5ZM4.5 18.75H9L13.5 9.75H9L4.5 18.75ZM15 18.75H19.5L22.5 14.25H18L15 18.75Z"/></svg>
            {apiReady ? (accessToken ? 'Open Drive' : 'Sync Google Drive') : 'Init Auth...'}
          </button>
          
          <input type="file" ref={fileInputRef} onChange={(e) => handleFilesAdded(Array.from(e.target.files || []))} className="hidden" multiple accept=".log,.txt" />
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 rounded-lg text-[10px] font-black text-white hover:bg-indigo-700 transition-all shadow-md uppercase tracking-widest">Local Import</button>
          
          {allData.length > 0 && (
            <button onClick={handleReset} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-3 flex flex-col gap-3">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="font-black mt-4 text-gray-400 uppercase tracking-widest text-[9px]">Synchronizing Cloud Stream...</p>
          </div>
        ) : allData.length > 0 ? (
          <div className="flex flex-col lg:flex-row h-full gap-3">
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 p-2 shadow-sm relative overflow-hidden"><LogChart data={visibleData} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Precise Jump</span>
                  <div className="flex gap-2">
                    <input type="time" step="1" value={searchTime} onChange={(e) => setSearchTime(e.target.value)} className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    <button onClick={() => {}} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700">Go</button>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Scale Config</span>
                  <div className="grid grid-cols-5 gap-1">
                    {DURATIONS.map((d) => (
                      <button key={d.value} onClick={() => setDuration(d.value)} className={`py-2 text-[10px] font-black rounded-lg transition-all border ${duration === d.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{d.label}</button>
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
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-3xl m-2 shadow-sm relative overflow-hidden group">
            <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center mb-8 text-indigo-600 border border-gray-100 shadow-inner group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-500">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter uppercase text-center px-4">Cloud Diagnostic Sync</h2>
            <p className="text-gray-400 mb-8 max-w-xs text-center text-[10px] font-bold uppercase tracking-[0.4em] leading-relaxed">Choose a telemetry source to begin analysis</p>
            <div className="flex gap-4">
               <button 
                 onClick={handleDriveClick} 
                 className={`px-8 py-4 rounded-xl font-black text-[10px] shadow-xl uppercase tracking-widest border transition-all ${
                   apiReady ? 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700 active:scale-95' : 'bg-gray-200 text-gray-400 border-gray-300 cursor-wait'
                 }`}
               >
                 {apiReady ? 'Google Drive Sync' : 'Initializing...'}
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-white border border-gray-200 rounded-xl font-black text-[10px] text-gray-600 hover:bg-gray-50 uppercase tracking-widest shadow-sm transition-all active:scale-95">Local Logs</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
