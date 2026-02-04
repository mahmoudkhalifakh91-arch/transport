
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { transportService } from './firebase';
import { TransportRecord, MasterData, Release, AppUser, OperationStatus, FactoryBalance } from './types';
import TransportForm from './components/TransportForm';
import SoyTransportForm from './components/SoyTransportForm';
import SiteBalancesDashboard from './components/SiteBalancesDashboard';
import FactoryBalanceView from './components/FactoryBalanceView';
import ReleasesManager from './components/ReleasesManager';
import PeriodicReport from './components/PeriodicReport';
import MasterDataUpload from './components/MasterDataUpload';
import AIInsights from './components/AIInsights';
import StatCards from './components/StatCards';
import Toast, { ToastType } from './components/Toast';
import { translations, Language } from './utils/translations';

type ViewType = 'home' | 'dashboard' | 'factory_balance' | 'add' | 'releases' | 'reports' | 'ai' | 'settings';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('appUser');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [records, setRecords] = useState<TransportRecord[]>(() => {
    const saved = localStorage.getItem('records_cache');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [releases, setReleases] = useState<Release[]>(() => {
    const saved = localStorage.getItem('releases_cache');
    return saved ? JSON.parse(saved) : [];
  });

  const [factoryBalances, setFactoryBalances] = useState<FactoryBalance[]>(() => {
    const saved = localStorage.getItem('factoryBalances_cache');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [masterData, setMasterData] = useState<MasterData>(() => {
    const cached = localStorage.getItem('masterData_cache');
    const defaultData = { 
      drivers: [], cars: [], loadingSites: [], unloadingSites: [], 
      goodsTypes: [], orderNumbers: [], contractors: [], users: [], items: [] 
    };
    if (cached) {
      try {
        return { ...defaultData, ...JSON.parse(cached) };
      } catch (e) {
        return defaultData;
      }
    }
    return defaultData;
  });
  
  const [activeTab, setActiveTab] = useState<ViewType>('home');
  const [selectedMaterial, setSelectedMaterial] = useState<'soy' | 'maize' | null>(null);
  const [lang, setLang] = useState<Language>('ar');
  const [pin, setPin] = useState('');
  const [editingRecord, setEditingRecord] = useState<TransportRecord | null>(null);
  
  const [showWelcomeHeader, setShowWelcomeHeader] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({
    home: 16, dashboard: 14, factory_balance: 14, add: 16, releases: 14, reports: 14, ai: 15, settings: 14
  });

  const [connectionStatus, setConnectionStatus] = useState<'online' | 'syncing' | 'offline'>('online');
  const SYNC_INTERVAL_SEC = 5;
  const [syncCountdown, setSyncCountdown] = useState(SYNC_INTERVAL_SEC);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean; id: number }>({
    message: '', type: 'info', isVisible: false, id: 0
  });

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true, id: Date.now() });
  }, []);

  const t = translations[lang];
  const isFetchingRef = useRef(false);

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'editor';

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setConnectionStatus('syncing');

    try {
      const data = await transportService.getAllData();
      if (data.transports) setRecords(data.transports);
      if (data.releases) setReleases(data.releases);
      if (data.factoryBalances) setFactoryBalances(data.factoryBalances);
      if (data.masterData) setMasterData(data.masterData);
      
      setConnectionStatus('online');
    } catch (e: any) { 
      setConnectionStatus('offline');
    } finally { 
      isFetchingRef.current = false;
      setIsInitialLoading(false);
      setSyncCountdown(SYNC_INTERVAL_SEC);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(() => {
      setSyncCountdown(prev => {
        if (prev <= 1) {
          fetchData();
          return SYNC_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentUser, fetchData]);

  useEffect(() => {
    (document.documentElement.style as any).zoom = `${zoom}%`;
  }, [zoom]);

  useEffect(() => {
    if (showWelcomeHeader) {
        const timer = setTimeout(() => setShowWelcomeHeader(false), 3000);
        return () => clearTimeout(timer);
    }
  }, [showWelcomeHeader]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const inputPin = pin.trim();
    if (!inputPin) return;
    const users = masterData.users || [];
    const user = users.find(u => String(u.pin).trim() === inputPin);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('appUser', JSON.stringify(user));
      setPin('');
      setShowWelcomeHeader(true);
      if (user.allowedMaterials === 'صويا') setSelectedMaterial('soy');
      else if (user.allowedMaterials === 'ذرة') setSelectedMaterial('maize');
      notify(`مرحباً ${user.name}`, 'success');
    } else { 
      notify('PIN غير صحيح', 'error');
    }
  };

  const handleOptimisticAdd = async (newRecord: TransportRecord) => {
    const updated = [newRecord, ...records];
    setRecords(updated);
    localStorage.setItem('records_cache', JSON.stringify(updated));
    try {
      await transportService.addRecord(newRecord);
      notify('تم الحفظ بنجاح', 'success');
      setTimeout(() => fetchData(), 1000);
    } catch (err) {
      notify('جاري المزامنة في الخلفية', 'info');
    }
  };

  const handleOptimisticUpdate = async (updatedRecord: TransportRecord) => {
    const updatedList = records.map(r => r.autoId === updatedRecord.autoId ? updatedRecord : r);
    setRecords(updatedList);
    localStorage.setItem('records_cache', JSON.stringify(updatedList));
    try {
      await transportService.updateRecord(updatedRecord);
      notify('تم التحديث بنجاح', 'success');
      setTimeout(() => fetchData(), 1000);
    } catch (err) {
      notify('جاري التحديث في الخلفية', 'info');
    }
  };

  const handleStatusChange = async (autoId: string, newStatus: OperationStatus) => {
    if (!canEdit) return;
    const record = records.find(r => r.autoId === autoId);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    handleOptimisticUpdate(updated);
  };

  const handleDeleteRecord = async (autoId: string, goodsType: string) => {
    if (!canEdit) return;
    if (window.confirm('هل تريد حذف هذه النقلة نهائياً؟')) {
      const updated = records.filter(r => r.autoId !== autoId);
      setRecords(updated);
      localStorage.setItem('records_cache', JSON.stringify(updated));
      try {
        await transportService.deleteRecord(autoId, goodsType);
        notify('تم الحذف بنجاح', 'success');
      } catch (err) {
        notify('سيم الحذف عند عودة الاتصال', 'warning');
      }
    }
  };

  const handleEditRecord = (record: TransportRecord) => {
    setEditingRecord(record);
    setActiveTab('add');
  };

  const filteredRecords = useMemo(() => {
    if (!selectedMaterial) return [];
    const keyword = selectedMaterial === 'soy' ? 'صويا' : 'ذرة';
    return records.filter(r => String(r.goodsType).includes(keyword));
  }, [records, selectedMaterial]);

  const filteredReleases = useMemo(() => {
    if (!selectedMaterial) return [];
    const keyword = selectedMaterial === 'soy' ? 'صويا' : 'ذرة';
    return releases.filter(r => String(r.goodsType).includes(keyword));
  }, [releases, selectedMaterial]);

  const extraStats = useMemo(() => {
    if (!selectedMaterial) return { transit: 0, stopped: 0, remaining: 0 };
    const transit = filteredRecords.reduce((sum, r) => r.status === OperationStatus.IN_PROGRESS ? sum + Number(r.weight || 0) : sum, 0);
    const stopped = filteredRecords.reduce((sum, r) => r.status === OperationStatus.STOPPED ? sum + Number(r.weight || 0) : sum, 0);
    const consumedMap: Record<string, number> = {};
    filteredRecords.forEach(r => {
      if (r.status === OperationStatus.DONE || r.status === OperationStatus.IN_PROGRESS) {
        const site = String(r.unloadingSite || '').trim();
        const order = String(r.orderNo || '').trim();
        const key = `${site}||${order}`;
        consumedMap[key] = (consumedMap[key] || 0) + Number(r.weight || 0);
      }
    });
    const releaseMap: Record<string, number> = {};
    filteredReleases.forEach(rel => {
      const site = String(rel.siteName || '').trim();
      const order = String(rel.orderNo || '').trim();
      const key = `${site}||${order}`;
      releaseMap[key] = (releaseMap[key] || 0) + Number(rel.totalQuantity || 0);
    });
    let remaining = 0;
    Object.keys(releaseMap).forEach(key => {
      remaining += Math.max(0, releaseMap[key] - (consumedMap[key] || 0));
    });
    return { transit, stopped, remaining };
  }, [filteredRecords, filteredReleases, selectedMaterial]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanDate.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return cleanDate;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-['Cairo']">
        <Toast {...toast} onClose={hideToast} />
        <div className="w-full max-w-sm">
          <form onSubmit={handleLogin} className="bg-white/5 backdrop-blur-3xl p-12 rounded-[50px] border border-white/10 text-center shadow-2xl animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-indigo-50 rounded-[28px] flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-indigo-500/20"><i className={`fas ${isInitialLoading ? 'fa-spinner fa-spin' : 'fa-shield-alt'} text-3xl`}></i></div>
            <h1 className="text-2xl font-black text-white mb-2">منصة النقل الذكي</h1>
            <input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" className="w-full p-5 rounded-3xl bg-black/40 text-white text-center text-4xl outline-none focus:ring-2 ring-indigo-500 mb-8 font-mono tracking-[0.4em] border border-white/5" />
            <button disabled={isInitialLoading} className="w-full bg-indigo-600 p-5 rounded-3xl text-white font-black text-lg hover:bg-indigo-500 transition-all">دخول</button>
          </form>
        </div>
      </div>
    );
  }

  if (!selectedMaterial) {
    const isAllowedSoy = currentUser.allowedMaterials === 'صويا' || currentUser.allowedMaterials === 'الكل';
    const isAllowedMaize = currentUser.allowedMaterials === 'ذرة' || currentUser.allowedMaterials === 'الكل';
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-white font-['Cairo']">
        <Toast {...toast} onClose={hideToast} />
        <div className="text-center mb-16 animate-in slide-in-from-top duration-700">
          <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">مرحباً، {currentUser.name}</h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">اختر القسم للمتابعة</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {isAllowedSoy && (
            <button onClick={() => { setSelectedMaterial('soy'); setShowWelcomeHeader(true); }} className="bg-white/5 p-12 rounded-[50px] border border-white/5 hover:bg-emerald-500/10 transition-all text-center group shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-6 group-hover:scale-110 transition-transform"><i className="fas fa-leaf text-3xl"></i></div>
              <span className="text-2xl font-black block">قسم الصويا</span>
            </button>
          )}
          {isAllowedMaize && (
            <button onClick={() => { setSelectedMaterial('maize'); setShowWelcomeHeader(true); }} className="bg-white/5 p-12 rounded-[50px] border border-white/5 hover:bg-amber-500/10 transition-all text-center group shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 mx-auto mb-6 group-hover:scale-110 transition-transform"><i className="fas fa-wheat-awn text-3xl"></i></div>
              <span className="text-2xl font-black block">قسم الذرة</span>
            </button>
          )}
        </div>
        <button onClick={() => { setCurrentUser(null); localStorage.removeItem('appUser'); }} className="mt-16 text-slate-500 hover:text-red-400 transition-colors text-xs font-black flex items-center gap-2"><i className="fas fa-power-off"></i> خروج</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-['Cairo'] text-right flex flex-col overflow-x-auto" style={{ fontSize: `${fontSizes[activeTab]}px` }}>
      <Toast {...toast} onClose={hideToast} />
      
      {/* Wrapper to ensure sticky elements span full content width if content is wider than screen */}
      <div className="min-w-fit flex flex-col min-h-screen">
        <header className={`p-4 sticky top-0 z-50 text-white shadow-2xl ${selectedMaterial === 'soy' ? 'bg-emerald-900' : 'bg-amber-900'} flex justify-between items-center transition-all w-full`}>
          <button onClick={() => setSelectedMaterial(null)} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all no-print flex-shrink-0"><i className="fas fa-chevron-right"></i></button>
          
          <div className="flex flex-col items-center gap-1 flex-1 px-4 text-center">
            <h1 className="text-lg md:text-xl font-black tracking-tight mb-0.5 animate-in slide-in-from-top duration-700">حركة نقل الخامات الرئيسية</h1>
            {showWelcomeHeader && (
              <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-lg flex items-center gap-3 animate-in fade-in duration-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="text-[10px] font-black whitespace-nowrap">مرحباً {currentUser.name}</span>
              </div>
            )}
            <span className="text-[8px] font-black tracking-widest opacity-70">تحديث: {syncCountdown}ث | {connectionStatus === 'online' ? 'متصل' : 'مزامنة'}</span>
          </div>

          <div className="flex items-center gap-3 no-print flex-shrink-0">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-lg border border-white/10 shadow-inner">{currentUser.name[0]}</div>
          </div>
        </header>

        <nav className="bg-white border-b sticky top-[72px] z-40 px-4 shadow-sm no-print w-full">
          <div className="max-w-7xl mx-auto flex gap-2 py-3 overflow-x-auto no-scrollbar">
            {[
              { id: 'home', label: 'الأرصدة', icon: 'fa-chart-pie' },
              { id: 'dashboard', label: 'السجل', icon: 'fa-list-ul' },
              { id: 'factory_balance', label: 'رصيد المصانع', icon: 'fa-industry' },
              { id: 'add', label: 'إضافة', icon: 'fa-plus-circle', hide: currentUser.role === 'viewer' },
              { id: 'releases', label: 'الإفراجات', icon: 'fa-file-invoice-dollar', hide: currentUser.role === 'viewer' },
              { id: 'reports', label: 'التقارير', icon: 'fa-chart-line' },
              { id: 'ai', label: 'AI', icon: 'fa-brain' },
              { id: 'settings', label: 'الإعدادات', icon: 'fa-sliders', hide: currentUser.role !== 'admin' }
            ].filter(tab => !tab.hide).map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as ViewType); if(tab.id !== 'add') setEditingRecord(null); }} className={`px-4 py-3 rounded-2xl text-[11px] font-black flex items-center gap-2.5 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <i className={`fas ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto">
          {activeTab === 'home' && <SiteBalancesDashboard releases={filteredReleases} records={filteredRecords} t={t} lang={lang} />}
          {activeTab === 'factory_balance' && (
            <FactoryBalanceView 
              releases={filteredReleases} 
              records={filteredRecords} 
              factoryBalances={factoryBalances}
              onNotify={notify}
              canEdit={canEdit}
              lang={lang} 
              selectedMaterial={selectedMaterial}
            />
          )}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <StatCards t={t} stats={{ totalWeight: filteredRecords.reduce((s, r) => r.status === OperationStatus.DONE ? s + Number(r.weight || 0) : s, 0), totalTrips: filteredRecords.length, carStats: {}, driverStats: {} }} extra={extraStats} />
              <div className="bg-white rounded-[40px] shadow-sm overflow-hidden border border-slate-100">
                <div className="p-6 border-b bg-white flex justify-between items-center">
                  <h3 className="font-black text-slate-800 text-lg">سجل العمليات التفصيلي</h3>
                  <button onClick={fetchData} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors"><i className="fas fa-sync-alt text-xs"></i></button>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-center border-collapse min-w-[1200px]">
                    <thead className="text-slate-400 text-[10px] font-black uppercase bg-slate-50">
                      <tr>
                        <th className="p-5 border-b">التاريخ</th>
                        <th className="p-5 border-b">رقم السيارة</th>
                        <th className="p-5 border-b">السائق</th>
                        <th className="p-5 border-b">التعتيق</th>
                        <th className="p-5 border-b">التوريد</th>
                        <th className="p-5 border-b">الوزن (طن)</th>
                        <th className="p-5 border-b">المقاول</th>
                        <th className="p-5 border-b">البوليصة</th>
                        <th className="p-5 border-b">الحالة</th>
                        {canEdit && <th className="p-5 border-b">الإجراءات</th>}
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 divide-y divide-slate-50">
                      {filteredRecords.map((r) => (
                        <tr key={r.autoId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-5 font-bold text-[10px] whitespace-nowrap text-slate-500">{formatDate(r.date)}</td>
                          <td className="p-5 font-black text-slate-800">{r.carNumber}</td>
                          <td className="p-5 font-bold text-xs text-slate-700">{r.driverName}</td>
                          <td className="p-5 font-bold text-indigo-500 whitespace-nowrap">{r.unloadingSite}</td>
                          <td className="p-5 font-bold text-amber-600 whitespace-nowrap">{r.orderNo}</td>
                          <td className="p-5 font-black text-slate-900">{Number(r.weight || 0).toLocaleString()}</td>
                          <td className="p-5 font-bold text-[10px] text-slate-500">{r.contractorName}</td>
                          <td className="p-5 font-bold text-[10px] text-slate-500">{r.waybillNo}</td>
                          <td className="p-5">
                            <div className="flex justify-center">
                              {canEdit ? (
                                <div className={`relative px-3 py-1 rounded-full text-[10px] font-black ${r.status === OperationStatus.DONE ? 'bg-emerald-50 text-emerald-600' : r.status === OperationStatus.STOPPED ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {r.status}
                                  <select 
                                    value={r.status} 
                                    onChange={(e) => handleStatusChange(r.autoId, e.target.value as OperationStatus)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  >
                                    <option value={OperationStatus.DONE}>{OperationStatus.DONE}</option>
                                    <option value={OperationStatus.IN_PROGRESS}>{OperationStatus.IN_PROGRESS}</option>
                                    <option value={OperationStatus.STOPPED}>{OperationStatus.STOPPED}</option>
                                  </select>
                                </div>
                              ) : (
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${r.status === OperationStatus.DONE ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {r.status}
                                </span>
                              )}
                            </div>
                          </td>
                          {canEdit && (
                            <td className="p-5">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => handleEditRecord(r)} className="text-indigo-400 hover:text-indigo-600"><i className="fas fa-edit text-xs"></i></button>
                                <button onClick={() => handleDeleteRecord(r.autoId, r.goodsType)} className="text-rose-300 hover:text-rose-500"><i className="fas fa-trash-alt text-xs"></i></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'add' && (
            selectedMaterial === 'soy' ? 
            <SoyTransportForm existingData={filteredRecords} masterData={masterData} releases={filteredReleases} t={t} lang={lang} editRecord={editingRecord} onOptimisticAdd={handleOptimisticAdd} onOptimisticUpdate={handleOptimisticUpdate} onCancel={() => { setActiveTab('dashboard'); setEditingRecord(null); }} /> :
            <TransportForm existingData={filteredRecords} masterData={masterData} releases={filteredReleases} t={t} lang={lang} selectedMaterial={selectedMaterial} editRecord={editingRecord} onOptimisticAdd={handleOptimisticAdd} onOptimisticUpdate={handleOptimisticUpdate} onCancel={() => { setActiveTab('dashboard'); setEditingRecord(null); }} />
          )}
          {activeTab === 'releases' && <ReleasesManager releases={filteredReleases} records={filteredRecords} masterData={masterData} t={t} lang={lang} selectedMaterial={selectedMaterial} onRefresh={fetchData} onNotify={notify} currentUser={currentUser} />}
          {activeTab === 'reports' && <PeriodicReport releases={filteredReleases} records={filteredRecords} t={t} />}
          {activeTab === 'ai' && <AIInsights records={filteredRecords} releases={filteredReleases} lang={lang} />}
          {activeTab === 'settings' && <MasterDataUpload currentData={masterData} lang={lang} setLang={setLang} onRefresh={fetchData} onNotify={notify} zoom={zoom} setZoom={setZoom} fontSizes={fontSizes} setFontSizes={setFontSizes} activeTab="settings" />}
        </main>
      </div>
    </div>
  );
};

export default App;
