
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LogEntry } from './types';
import { parseLogFile } from './services/parserService';
import LogChart from './components/LogChart';
import AlarmSummary from './components/AlarmSummary';
import FixedAnnotation from './components/FixedAnnotation';
import SidebarFileList from './components/SidebarFileList';

declare var gapi: any;
declare var google: any;

// Sample rate during initial file parsing (1 means no loss of data at source)
const LOAD_TIME_SAMPLE_RATE = 1; 

const DURATIONS = [
  { label: '5M', value: 5 * 60 * 1000 },
  { label: '10M', value: 10 * 60 * 1000 },
  { label: '1H', value: 1 * 3600 * 1000 },
  { label: '6H', value: 6 * 3600 * 1000 },
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
  const [highlightedTime, setHighlightedTime] = useState<number | null>(null);
  
  const [sourceType, setSourceType] = useState<'drive' | 'local' | null>(null);
  const [availableDriveFiles, setAvailableDriveFiles] = useState<any[]>([]);
  const [availableLocalFiles, setAvailableLocalFiles] = useState<File[]>([]);
  
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const timeBoundaries = useMemo(() => {
    if (allData.length === 0) return { min: 0, max: 0, total: 0 };
    const first = allData[0];
    const last = allData[allData.length - 1];
    const min = first ? first.timestamp : 0;
    const lastTs = last ? last.timestamp : 0;
    return { min, max: Math.max(min, lastTs - duration), total: lastTs - min };
  }, [allData, duration]);

  const scrollBy = useCallback((percent: number) => {
    const shift = duration * percent;
    setStartTime(prev => {
      const next = prev + shift;
      if (isNaN(next)) return prev;
      return Math.min(Math.max(next, timeBoundaries.min), timeBoundaries.max);
    });
  }, [duration, timeBoundaries]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (allData.length === 0) return;
      if (e.key === 'ArrowLeft') {
        scrollBy(-0.05);
      } else if (e.key === 'ArrowRight') {
        scrollBy(0.05);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allData.length, scrollBy]);

  const jumpToTime = (timeStr: string) => {
    if (!timeStr || allData.length === 0) return;
    try {
      const parts = timeStr.split(':').map(Number);
      const [h, m, s = 0] = parts;
      if (isNaN(h) || isNaN(m)) return;
      
      const targetDate = new Date(allData[0].timestamp);
      targetDate.setHours(h, m, s, 0);
      const targetTs = targetDate.getTime();
      
      const closest = allData.reduce((prev, curr) => 
        Math.abs(curr.timestamp - targetTs) < Math.abs(prev.timestamp - targetTs) ? curr : prev
      );
      setStartTime(Math.min(Math.max(closest.timestamp - duration / 2, timeBoundaries.min), timeBoundaries.max));
    } catch (e) {}
  };

  const initializeGoogleApi = useCallback(async () => {
    setErrorInfo(null);
    setApiReady(false);
    
    try {
      let attempts = 0;
      while ((typeof gapi === 'undefined' || typeof google === 'undefined') && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      if (typeof gapi === 'undefined' || typeof google === 'undefined') {
        throw new Error("Google scripts not loaded.");
      }

      await new Promise((resolve, reject) => {
        gapi.load('client:picker', {
          callback: resolve,
          onerror: () => reject(new Error("Failed to load gapi client:picker")),
          timeout: 5000
        });
      });
      
      await gapi.client.init({
        apiKey: process.env.API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });

      const client = google.accounts.oauth2.initTokenClient({
        client_id: '754877797743-j9m7i6p0m26p0h48h0r6l8q7n8g7e8p0.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error !== undefined) {
            setErrorInfo(`Auth Error: ${response.error_description || response.error}`);
            return;
          }
          setAccessToken(response.access_token);
          createPicker(response.access_token);
        },
      });
      
      setTokenClient(client);
      setApiReady(true);
    } catch (err: any) {
      setErrorInfo(err.message || "Failed to initialize Google API.");
    }
  }, []);

  useEffect(() => {
    initializeGoogleApi();
  }, [initializeGoogleApi]);

  const createPicker = useCallback((token: string) => {
    if (!token || typeof google === 'undefined' || !google.picker) return;
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
    }
  }, []);

  const listFilesInFolder = async (folderId: string) => {
    if (!gapi?.client?.drive) {
      setErrorInfo("Drive API client not ready.");
      return;
    }
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
    if (!gapi?.client?.drive) return;
    setLoading(true);
    setFileName(file.name);
    setHighlightedTime(null);
    try {
      const response = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
      const parsed = parseLogFile(response.body, LOAD_TIME_SAMPLE_RATE); 
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
      initializeGoogleApi();
      return;
    }
    if (!accessToken) {
      if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      createPicker(accessToken);
    }
  };

  const loadLocalFile = useCallback((file: File) => {
    setLoading(true);
    setFileName(file.name);
    setHighlightedTime(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseLogFile(content, LOAD_TIME_SAMPLE_RATE);
        setAllData(parsed);
        if (parsed.length > 0) setStartTime(parsed[0].timestamp);
        setSourceType('local');
      } catch (err) {
        setErrorInfo("Failed to parse local file.");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => setLoading(false);
    reader.readAsText(file);
  }, []);

  const handleFilesAdded = useCallback((files: File[]) => {
    const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.log') || f.name.toLowerCase().endsWith('.txt'));
    if (validFiles.length === 0) return;
    setAvailableLocalFiles(prev => [...prev, ...validFiles]);
    setSourceType('local');
    if (allData.length === 0) loadLocalFile(validFiles[0]);
  }, [allData.length, loadLocalFile]);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.items?.length > 0) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; if (e.dataTransfer.files?.length > 0) handleFilesAdded(Array.from(e.dataTransfer.files)); };

  const handleAlarmJump = (timestamp: number) => {
    if (isNaN(timestamp)) return;
    setHighlightedTime(timestamp);
    const centerStart = timestamp - (duration / 2);
    setStartTime(Math.min(Math.max(centerStart, timeBoundaries.min), timeBoundaries.max));
  };

  /**
   * Optimized Data Filtering & Downsampling
   * This reduces the load on the Recharts renderer by limiting the number of 
   * SVG nodes processed simultaneously.
   */
  const visibleData = useMemo(() => {
    if (!allData || allData.length === 0) return [];
    const endTs = startTime + duration;
    
    // Initial slice by time
    const inRange = allData.filter(d => d.timestamp >= startTime && d.timestamp < endTs);
    
    // Targeted downsampling: 
    // Recharts performs best around 600-800 points. 
    // We sample dynamically based on the current viewport width/duration.
    const TARGET_POINTS = 600;
    if (inRange.length > TARGET_POINTS) {
      const step = Math.ceil(inRange.length / TARGET_POINTS);
      return inRange.filter((_, idx) => idx % step === 0);
    }
    
    return inRange;
  }, [allData, startTime, duration]);

  const handleReset = () => {
    setAllData([]); setFileName(""); setAvailableLocalFiles([]); setAvailableDriveFiles([]); setSourceType(null); setHighlightedTime(null);
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen bg-gray-50 font-sans selection:bg-indigo-100 text-gray-900 relative outline-none"
      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
      tabIndex={-1}
    >
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
            <h1 className="text-md font-black text-gray-900 tracking-tight leading-none uppercase">MED-ANALYZER</h1>
            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1 italic"></p>
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
              <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 p-2 shadow-sm relative overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0">
                  <LogChart data={visibleData} highlightedTime={highlightedTime} />
                </div>
                
                <div className="mt-2 px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      START: {allData[0]?.time || '--'}
                    </span>
                    <span className="text-[9px] font-mono font-black text-indigo-600 uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm">
                      WINDOW POSITION: {isNaN(startTime) ? '--:--:--' : new Date(startTime).toLocaleTimeString('en-GB', { hour12: false })}
                    </span>
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                      END: {allData[allData.length-1]?.time || '--'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <button onClick={() => setStartTime(timeBoundaries.min)} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                      </button>
                      <button onClick={() => scrollBy(-0.25)} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    </div>

                    <div className="flex-1 relative h-6 flex items-center group">
                      <input 
                        type="range" 
                        min={timeBoundaries.min} 
                        max={timeBoundaries.max} 
                        value={isNaN(startTime) ? 0 : startTime} 
                        onChange={(e) => setStartTime(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                      />
                    </div>

                    <div className="flex gap-1">
                      <button onClick={() => scrollBy(0.25)} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                      </button>
                      <button onClick={() => setStartTime(timeBoundaries.max)} className="p-1.5 bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Precise Jump</span>
                  <div className="flex gap-2">
                    <input 
                      type="time" 
                      step="1" 
                      value={searchTime} 
                      onChange={(e) => setSearchTime(e.target.value)} 
                      className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20" 
                    />
                    <button onClick={() => jumpToTime(searchTime)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700">Go</button>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Scale Config (Zoom)</span>
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
            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tighter uppercase text-center px-4">Select Analysis File</h2>
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
