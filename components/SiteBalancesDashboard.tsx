
import React, { useMemo } from 'react';
import { Release, TransportRecord, OperationStatus } from '../types';

interface Props {
  releases: Release[];
  records: TransportRecord[];
  t: any;
  lang: string;
}

interface BalanceItem {
  total: number;
  consumed: number; 
  arrived: number;  
  inTransit: number; 
  site: string;
  order: string;
  goods: string;
  date: string;
}

const SiteBalancesDashboard: React.FC<Props> = ({ releases, records, t }) => {
  const balances = useMemo(() => {
    const consumption: Record<string, { total: number, arrived: number, inTransit: number }> = {};
    
    records.forEach(r => {
      const site = String(r.unloadingSite || '').trim();
      const order = String(r.orderNo || '').trim();
      const key = `${site}||${order}`;
      
      if (!consumption[key]) consumption[key] = { total: 0, arrived: 0, inTransit: 0 };

      const weight = Number(r.weight || 0);
      if (r.status === OperationStatus.DONE) {
        consumption[key].arrived += weight;
        consumption[key].total += weight;
      } else if (r.status === OperationStatus.IN_PROGRESS) {
        consumption[key].inTransit += weight;
        consumption[key].total += weight;
      }
    });

    const bal: Record<string, BalanceItem> = {};
    releases.forEach(rel => {
      const site = String(rel.siteName || '').trim();
      const order = String(rel.orderNo || '').trim();
      const key = `${site}||${order}`;
      
      if (!bal[key]) {
        const stats = consumption[key] || { total: 0, arrived: 0, inTransit: 0 };
        bal[key] = { 
          total: 0, 
          consumed: stats.total, 
          arrived: stats.arrived,
          inTransit: stats.inTransit,
          site: site, 
          order: order,
          goods: String(rel.goodsType || ''),
          date: String(rel.date || '').split('T')[0]
        };
      }
      bal[key].total += Number(rel.totalQuantity || 0);
    });

    return (Object.values(bal) as BalanceItem[]).filter(item => (item.total - item.consumed) > 0);
  }, [releases, records]);

  return (
    <div className="space-y-10">
      <div className="bg-[#0f172a] text-white p-6 md:p-10 rounded-[40px] shadow-2xl min-h-[500px] border border-white/5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between mb-16 relative z-10 gap-6 text-right">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
              <i className="fas fa-layer-group text-3xl text-emerald-400"></i>
            </div>
            <div>
              <h3 className="text-4xl md:text-5xl font-black tracking-tight mb-2">موقف أرصدة التوريدات</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.4em]">المتبقي = الإجمالي - (المنفذ + الجاري)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 relative z-10">
          {balances.map((b, i) => {
            const remaining = Math.max(0, b.total - b.consumed);
            const progress = b.total > 0 ? ((b.consumed) / b.total) * 100 : 0;
            
            return (
              <div key={i} className="group bg-[#1e293b]/40 backdrop-blur-2xl border border-white/5 p-8 md:p-10 rounded-[45px] hover:border-emerald-500/30 transition-all duration-500 shadow-2xl flex flex-col justify-between min-h-[420px] text-right">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-3">
                    <h4 className="text-4xl font-black text-amber-400 group-hover:text-amber-300 transition-colors">{b.site}</h4>
                    <div className="flex flex-col gap-1">
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">أمر توريد: {b.order}</div>
                      <div className="text-[11px] font-black text-emerald-400 tracking-widest">{b.goods}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1"><i className="far fa-calendar-alt text-[9px] ml-1"></i> {b.date}</div>
                    </div>
                  </div>
                  <div className="text-left bg-black/40 p-5 rounded-[28px] border border-white/5 min-w-[130px]">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">المتبقي</p>
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className="text-4xl font-black text-white">{remaining.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">طن</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[9px] font-black text-slate-500 uppercase mb-1">المنفذ (تم)</p>
                     <p className="text-lg font-black text-emerald-400">{b.arrived.toLocaleString()} <span className="text-[8px] text-slate-500">طن</span></p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[9px] font-black text-slate-500 uppercase mb-1">في الطريق</p>
                     <p className="text-lg font-black text-blue-400">{b.inTransit.toLocaleString()} <span className="text-[8px] text-slate-500">طن</span></p>
                  </div>
                </div>
                
                <div className="relative w-full bg-slate-900/80 h-3 rounded-full overflow-hidden border border-white/5">
                  <div 
                      className="absolute top-0 right-0 h-full bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, progress)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SiteBalancesDashboard;
