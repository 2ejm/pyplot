import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LogEntry } from './types';
import { parseLogFile } from './services/parserService';
import LogChart from './components/LogChart';
import AlarmSummary from './components/AlarmSummary';
import FixedAnnotation from './components/FixedAnnotation';
import SidebarFileList from './components/SidebarFileList';
// 1. html2canvas 임포트 (npm install html2canvas 필요)
import html2canvas from 'html2canvas';

declare var gapi: any;
declare var google: any;

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
  
  const [leftOffset, setLeftOffset] = useState(0);
  const [leftScale, setLeftScale] = useState(120);
  const [rightOffset, setRightOffset] = useState(0);
  const [rightScale, setRightScale] = useState(120);

  const [sourceType, setSourceType] = useState<'drive' | 'local' | null>(null);
  const [availableDriveFiles, setAvailableDriveFiles] = useState<any[]>([]);
  const [availableLocalFiles, setAvailableLocalFiles] = useState<File[]>([]);
  
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  
  // 1. 그래프 "알맹이"만 참조하기 위한 Ref
  const chartOnlyRef = useRef<HTMLDivElement>(null);

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



  const handleDownloadChart = async () => {
    if (!chartOnlyRef.current) return;
    
    try {
      setLoading(true);
      
      // html2canvas 옵션: 그래프 외곽의 여백이나 버튼을 제외하고 
      // 딱 chartOnlyRef가 감싸는 영역만 캡처합니다.
      const canvas = await html2canvas(chartOnlyRef.current, {
        backgroundColor: '#ffffff', // 배경을 흰색으로 강제 (투명 방지)
        scale: 2,
        logging: false,
        // 만약 특정 클래스(.no-export)를 가진 요소를 제외하고 싶다면 아래 옵션 사용 가능
        ignoreElements: (element) => element.classList.contains('no-export')
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `CHART_${fileName || 'data'}_${new Date().getTime()}.png`;
      link.click();
    } catch (err) {
      setErrorInfo("Failed to export chart image.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (allData.length === 0) return;
      if (e.key === 'ArrowLeft') scrollBy(-0.05);
      else if (e.key === 'ArrowRight') scrollBy(0.05);
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

  // --- Google API Logic (생략/유지) ---
  const initializeGoogleApi = useCallback(async () => {
    setErrorInfo(null);
    setApiReady(false);
    try {
      let attempts = 0;
      while ((typeof gapi === 'undefined' || typeof google === 'undefined') && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }
      if (typeof gapi === 'undefined' || typeof google === 'undefined') throw new Error("Google scripts not loaded.");
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
    setSearchTime("");
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

  const visibleData = useMemo(() => {
    if (!allData || allData.length === 0) return [];
    const endTs = startTime + duration;
    const inRange = allData.filter(d => d.timestamp >= startTime && d.timestamp <= endTs);
    const TARGET_POINTS = 600;
    
    if (inRange.length > TARGET_POINTS) {
      const step = Math.ceil(inRange.length / TARGET_POINTS);
      let sampled = inRange.filter((_, idx) => idx % step === 0);
      if (highlightedTime && highlightedTime >= startTime && highlightedTime <= endTs) {
        const hasPoint = sampled.some(p => p.timestamp === highlightedTime);
        if (!hasPoint) {
          const alarmPoint = inRange.find(p => p.timestamp === highlightedTime);
          if (alarmPoint) {
            sampled.push(alarmPoint);
            sampled.sort((a, b) => a.timestamp - b.timestamp);
          }
        }
      }
      return sampled;
    }
    return inRange;
  }, [allData, startTime, duration, highlightedTime]);

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
        <div className="absolute top-16 left-0 right-0 z-50 px-8 py-3 bg-red-600 text-white flex items-center justify-between shadow-xl animate-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="text-sm font-black uppercase tracking-widest">{errorInfo}</span>
          </div>
          <div className="flex gap-4">
            <button onClick={initializeGoogleApi} className="text-xs font-black border border-white/30 px-5 py-2 rounded-xl hover:bg-white/10 uppercase tracking-tighter transition-all">Retry Auth</button>
            <button onClick={() => setErrorInfo(null)} className="text-xs font-black uppercase tracking-tighter opacity-70 hover:opacity-100">Close</button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none uppercase">MED-ANALYZER</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 다운로드 버튼 추가 */}
          {allData.length > 0 && (
            <button 
              onClick={handleDownloadChart}
              className="px-5 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black transition-all shadow-md hover:bg-emerald-700 active:scale-95 uppercase tracking-widest flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Chart
            </button>
          )}

          <button onClick={handleDriveClick} className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-2xl text-xs font-black transition-all shadow-sm uppercase tracking-widest flex items-center gap-3 hover:bg-gray-50 active:scale-95">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M15.75 14.25L10.5 5.25L5.25 14.25H15.75ZM22.5 14.25H18.75L13.5 5.25H17.25L22.5 14.25ZM9.75 18.75H14.25L19.5 9.75L15 9.75L9.75 18.75ZM1.5 14.25L6.75 5.25H10.5L5.25 14.25H1.5ZM4.5 18.75H9L13.5 9.75H9L4.5 18.75ZM15 18.75H19.5L22.5 14.25H18L15 18.75Z"/></svg>
            Cloud
          </button>
          
          <input type="file" ref={fileInputRef} onChange={(e) => handleFilesAdded(Array.from(e.target.files || []))} className="hidden" multiple accept=".log,.txt" />
          <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-indigo-600 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 transition-all shadow-md uppercase tracking-widest">Import</button>
          
          {allData.length > 0 && (
            <button onClick={handleReset} className="p-3 text-gray-400 hover:text-red-500 bg-white rounded-xl border border-gray-200 shadow-sm transition-colors active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6 flex flex-col gap-6">
        {!allData.length && !loading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded-[2.5rem] shadow-sm group">
            <div className="w-36 h-36 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-10 text-indigo-600 border border-indigo-100 shadow-inner group-hover:scale-110 transition-all duration-700">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-6 tracking-tighter uppercase text-center px-10">System Ready</h2>
            <div className="flex gap-8">
               <button onClick={handleDriveClick} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-2xl hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest border border-indigo-500">Cloud Storage</button>
               <button onClick={() => fileInputRef.current?.click()} className="px-10 py-3 bg-white border border-gray-200 rounded-2xl font-black text-xs text-gray-700 hover:bg-gray-50 transition-all active:scale-95 uppercase tracking-widest shadow-sm">Local Drive</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row h-full gap-6">
            <div className="flex-1 min-h-0 flex flex-col gap-6 relative">
              {loading && (
                <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] rounded-[2rem] flex flex-col items-center justify-center">
                   <div className="w-16 h-16 border-[5px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              )}
              
              {/* 3. chartContainerRef 지정: 이 영역 내부만 이미지로 저장됨 */}
              <div className="flex-1 min-h-0 bg-white rounded-[2rem] border border-gray-200 p-4 shadow-sm relative overflow-hidden flex flex-col">
                <div ref={chartOnlyRef} className="flex-1 min-h-0">
                  <LogChart 
                    data={visibleData} 
                    highlightedTime={highlightedTime}
                    leftOffset={leftOffset}
                    leftScale={leftScale}
                    rightOffset={rightOffset}
                    rightScale={rightScale}
                    onSettingsChange={(settings) => {
                      if (settings.leftOffset !== undefined) setLeftOffset(settings.leftOffset);
                      if (settings.leftScale !== undefined) setLeftScale(settings.leftScale);
                      if (settings.rightOffset !== undefined) setRightOffset(settings.rightOffset);
                      if (settings.rightScale !== undefined) setRightScale(settings.rightScale);
                    }}
                  />
                </div>
                
                <div className="mt-6 px-8 py-2 bg-gray-50 border-t border-gray-100 rounded-b-[2rem] flex flex-col gap-3 no-export">
                  {/* 타임라인 컨트롤 영역 (저장 시 포함됨) */}
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">START: {allData[0]?.time}</span>
                    <span className="text-xs font-mono font-black text-indigo-600 uppercase tracking-tight bg-indigo-100/50 px-5 py-1 rounded-xl border border-indigo-200 shadow-sm">
                      WINDOW: {new Date(startTime).toLocaleTimeString('en-GB', { hour12: false })}
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">END: {allData[allData.length-1]?.time}</span>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <button onClick={() => setStartTime(timeBoundaries.min)} className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex-1 relative h-10 flex items-center">
                      <input 
                        type="range" 
                        min={timeBoundaries.min} 
                        max={timeBoundaries.max} 
                        value={startTime} 
                        onChange={(e) => setStartTime(Number(e.target.value))}
                        className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                      />
                    </div>
                    <button onClick={() => setStartTime(timeBoundaries.max)} className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-1">Precise Jump</span>
                  <div className="flex gap-4">
                    <input 
                      type="time" 
                      step="1" 
                      value={searchTime} 
                      onChange={(e) => setSearchTime(e.target.value)} 
                      className="flex-1 px-5 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-base font-mono font-bold text-indigo-700 outline-none focus:ring-8 focus:ring-indigo-500/10" 
                    />
                    <button onClick={() => jumpToTime(searchTime)} className="px-8 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Go</button>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-1">Scale Config (Window)</span>
                  <div className="grid grid-cols-5 gap-3">
                    {DURATIONS.map((d) => (
                      <button key={d.value} onClick={() => setDuration(d.value)} className={`py-2 text-xs font-black rounded-2xl transition-all border ${duration === d.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{d.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:w-80 flex flex-col gap-2 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar pb-6">
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
        )}
      </main>
    </div>
  );
};

export default App;
