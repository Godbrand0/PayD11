
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Filter, Calendar, X, Activity, User, Tag, Loader2, Cpu, CheckCircle } from 'lucide-react';
import { fetchAuditLogs, AuditRecord, AuditListFilters, fetchEmployees, Employee } from '../services/auditApi';

const ASSETS = ['USDC', 'XLM', 'NGN'];
const STATUSES = ['Completed', 'Pending', 'Failed'];

// Hook for debouncing fast state updates
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
function SkeletonRow() {
  return (
    <tr className="border-b border-zinc-800/30">
      <td className="p-4"><div className="w-24 h-4 bg-zinc-800/50 rounded animate-pulse" /></td>
      <td className="p-4"><div className="w-20 h-4 bg-zinc-800/50 rounded animate-pulse" /></td>
      <td className="p-4"><div className="w-32 h-4 bg-zinc-800/50 rounded animate-pulse" /></td>
      <td className="p-4"><div className="w-16 h-5 bg-zinc-800/50 rounded-md animate-pulse" /></td>
      <td className="p-4 flex justify-end"><div className="w-20 h-4 bg-zinc-800/50 rounded animate-pulse" /></td>
      <td className="p-4"><div className="w-16 h-5 bg-zinc-800/50 rounded-md animate-pulse" /></td>
    </tr>
  );
}

export default function TransactionHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);

  useEffect(() => {
  const loadEmployees = async () => {
    const res = await fetchEmployees();
    setEmployeesList(res.data || []);
  };
  void loadEmployees();
}, []);

  // API State
  const [transactions, setTransactions] = useState<AuditRecord[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Debounced filters
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedDateRange = useDebounce(dateRange, 500);
  const LIMIT = 20;

  // Load Data Effect
  const loadData = useCallback(async (isLoadMore: boolean = false) => {
    setIsLoading(true);
    try {
      const filters: AuditListFilters = {
        page: isLoadMore ? page + 1 : 1,
        limit: LIMIT,
        sourceAccount: debouncedSearchTerm.length === 56 ? debouncedSearchTerm : undefined,
        dateStart: debouncedDateRange.start || undefined,
        dateEnd: debouncedDateRange.end || undefined,
        employeeId: selectedEmployees.length === 1 ? selectedEmployees[0] : undefined,
        asset: selectedAssets.length === 1 ? selectedAssets[0] : undefined,
        status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
      };

      const res = await fetchAuditLogs(filters);

      if (isLoadMore) {
        setTransactions((prev: AuditRecord[]) => [...prev, ...res.data]);
        setPage(res.page);
      } else {
        setTransactions(res.data);
        setPage(1);
      }
      
      setTotalCount(res.total);
      setHasMore(res.page < res.totalPages);
    } catch (e) {
      console.error('Failed to load transactions', e);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearchTerm, debouncedDateRange, selectedEmployees, selectedAssets, selectedStatuses]);

  useEffect(() => {
  void loadData(false);
}, [debouncedSearchTerm, debouncedDateRange, selectedEmployees, selectedAssets, selectedStatuses, loadData]);

  const handleLoadMore = () => {
  if (!isLoading && hasMore) {
    void loadData(true);
  }
};

  // Active filters array for tags
  const activeFilters = useMemo(() => {
    const filters: { type: string; value: string; label: string }[] = [];
    if (searchTerm)
      filters.push({ type: 'search', value: searchTerm, label: `Search: ${searchTerm}` });
    selectedAssets.forEach((a: string) =>
      filters.push({ type: 'asset', value: a, label: `Asset: ${a}` })
    );
    selectedStatuses.forEach((s: string) =>
      filters.push({ type: 'status', value: s, label: `Status: ${s}` })
    );
    selectedEmployees.forEach((eId: string) => {
      const emp = employeesList.find((emp: Employee) => emp.id.toString() === eId);
      const name = emp ? `${emp.first_name} ${emp.last_name}` : `Emp #${eId}`;
      filters.push({ type: 'employee', value: eId, label: `Employee: ${name}` });
    });
    if (dateRange.start)
      filters.push({
        type: 'dateStart',
        value: dateRange.start,
        label: `From: ${dateRange.start}`,
      });
    if (dateRange.end)
      filters.push({ type: 'dateEnd', value: dateRange.end, label: `To: ${dateRange.end}` });
    return filters;
  }, [searchTerm, selectedAssets, selectedStatuses, selectedEmployees, dateRange, employeesList]);

  const removeFilter = (filter: { type: string; value: string }) => {
    switch (filter.type) {
      case 'search':
        setSearchTerm('');
        break;
      case 'asset':
        setSelectedAssets((prev: string[]) => prev.filter((a: string) => a !== filter.value));
        break;
      case 'status':
        setSelectedStatuses((prev: string[]) => prev.filter((s: string) => s !== filter.value));
        break;
      case 'employee':
        setSelectedEmployees((prev: string[]) => prev.filter((e: string) => e !== filter.value));
        break;
      case 'dateStart':
        setDateRange((prev: {start: string, end: string}) => ({ ...prev, start: '' }));
        break;
      case 'dateEnd':
        setDateRange((prev: {start: string, end: string}) => ({ ...prev, end: '' }));
        break;
    }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedAssets([]);
    setSelectedStatuses([]);
    setSelectedEmployees([]);
    setDateRange({ start: '', end: '' });
    setPage(1);
  };

  const toggleAsset = (asset: string) => {
    setSelectedAssets((prev: string[]) =>
      prev.includes(asset) ? prev.filter((a: string) => a !== asset) : [...prev, asset]
    );
    setPage(1);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev: string[]) =>
      prev.includes(status) ? prev.filter((s: string) => s !== status) : [...prev, status]
    );
    setPage(1);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev: string[]) =>
      prev.includes(empId) ? prev.filter((e: string) => e !== empId) : [...prev, empId]
    );
    setPage(1);
  };



  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Transaction <span className="text-accent">History</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm tracking-wider uppercase">
            Track and filter all organizational transfers
          </p>
        </div>
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isFilterExpanded ? 'bg-accent text-bg' : 'bg-zinc-800/50 text-white hover:bg-zinc-800'}`}
        >
          <Filter size={18} />
          {isFilterExpanded ? 'Hide Filters' : 'Advanced Filters'}
        </button>
      </div>

      {/* Expanded Filter Header */}
      {isFilterExpanded && (
        <div className="bg-[#16161a] border border-zinc-800 rounded-xl p-6 mb-8 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Search */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="ID or Employee Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-accent outline-none transition-all"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange((prev: {start: string, end: string}) => ({ ...prev, start: e.target.value }))}
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2 pl-8 pr-2 text-xs focus:ring-1 focus:ring-accent outline-none text-zinc-300 custom-date-input"
                  />
                </div>
                <span className="text-zinc-600">-</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange((prev: {start: string, end: string}) => ({ ...prev, end: e.target.value }))}
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2 pl-8 pr-2 text-xs focus:ring-1 focus:ring-accent outline-none text-zinc-300 custom-date-input"
                  />
                </div>
              </div>
            </div>

            {/* Assets Multi-select */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Assets
              </label>
              <div className="flex flex-wrap gap-2">
                {ASSETS.map((asset) => (
                  <button
                    key={asset}
                    onClick={() => toggleAsset(asset)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-all ${selectedAssets.includes(asset) ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <Tag size={12} />
                    {asset}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Statuses Multi-select */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-all ${selectedStatuses.includes(status) ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <CheckCircle size={12} />
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Employees Multi-select (Dynamic from DB) */}
            <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-4">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Employees
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                {employeesList.map((emp: Employee) => (
                  <button
                    key={emp.id}
                    onClick={() => toggleEmployee(emp.id.toString())}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-all ${selectedEmployees.includes(emp.id.toString()) ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                  >
                    <User size={12} />
                    {emp.first_name} {emp.last_name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Bar */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
          <span className="text-xs font-bold uppercase text-zinc-500 mr-2 flex items-center gap-1">
            <Filter size={12} /> Active Filters:
          </span>
          {activeFilters.map((filter: { type: string; value: string; label: string }) => (
            <span
              key={`${filter.type}-${filter.value}`}
              className="flex items-center gap-1.5 bg-zinc-800 text-xs px-2.5 py-1 rounded-md text-zinc-300 border border-zinc-700"
            >
              {filter.label}
              <button
                onClick={() => removeFilter(filter)}
                className="text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-blue-400 hover:text-blue-300 underline ml-auto font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-[#16161a] border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex-1 flex flex-col max-h-150 overflow-y-auto custom-scrollbar">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-175">
            <thead className="bg-[#111115] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Txn ID
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Date
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Employee
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Asset
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70 text-right">
                  Amount
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800/70">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && transactions.length === 0 ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : transactions.length > 0 ? (
                transactions.map((txn: AuditRecord, idx: number) => (
                  <tr
                    key={txn.id}
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/10'}`}
                  >
                    <td className="p-4 font-mono text-sm text-blue-400">
                      {txn.tx_hash.substring(0, 12)}...
                      {txn.is_contract_event && (
                        <span className="ml-2 bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-purple-500/20 flex items-center inline-flex gap-1" title="Soroban Smart Contract Event">
                          <Cpu size={10} /> Event
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-zinc-400">{new Date(txn.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-sm font-medium">{txn.employee_name || 'System / N/A'}</td>
                    <td className="p-4">
                      <span className="bg-zinc-800/80 text-zinc-300 px-2.5 py-1 rounded-md text-xs border border-zinc-700/50">
                        {txn.asset || 'NATIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold">
                      {txn.amount || '0'} <span className="text-zinc-500 text-xs">{txn.asset || 'XLM'}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          txn.status === 'Completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : txn.status === 'Pending'
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {txn.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <Activity className="w-8 h-8 opacity-20" />
                      <p>No transactions match the selected filters.</p>
                      <button
                        onClick={clearAllFilters}
                        className="text-blue-400 hover:text-blue-300 text-sm mt-2 transition-colors"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Load More Button */}
        {hasMore && (
          <div className="p-4 flex justify-center border-t border-zinc-800/50">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 transition-colors rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Fetching...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 text-xs text-zinc-500 flex justify-between items-center px-2">
        <span>
          Showing {transactions.length} of {totalCount} transactions
        </span>
        <span>Filter engine active</span>
      </div>

      {/* Custom Scrollbar & Utility Styles for this page */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
        
        /* Ensures the date chevron and icon blend in dark mode */
        .custom-date-input::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
