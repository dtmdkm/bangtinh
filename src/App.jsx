import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, DollarSign, Activity, TrendingUp, TrendingDown, Save } from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, getDoc, doc, setDoc, writeBatch } from 'firebase/firestore';

function App() {
  const [records, setRecords] = useState([]);
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Stats
  const [stats, setStats] = useState({
    totalExpense: 0,
    totalRevenue: 0,
    balance: 0
  });

  const isFirebaseConfigured = db.app.options.apiKey !== "YOUR_API_KEY";

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Calculate stats whenever records or investment changes
  useEffect(() => {
    let expense = 0;
    let revenue = 0;

    records.forEach(r => {
      expense += (Number(r.amount) || 0) + (Number(r.salary) || 0);
      revenue += (Number(r.revenue) || 0);
    });

    setStats({
      totalExpense: expense,
      totalRevenue: revenue,
      balance: Number(initialInvestment) + revenue - expense
    });
  }, [records, initialInvestment]);

  const loadData = async () => {
    if (isFirebaseConfigured) {
      try {
        // Load investment
        const invDoc = await getDoc(doc(db, "settings", "investment"));
        if (invDoc.exists()) {
          setInitialInvestment(invDoc.data().amount || 0);
        }

        // Load records
        const querySnapshot = await getDocs(collection(db, "transactions"));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by date or id to keep order stable
        data.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        
        if (data.length === 0) {
          // Add one empty row if no data
          setRecords([createNewEmptyRecord()]);
        } else {
          setRecords(data);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // LocalStorage fallback
      const localRecords = JSON.parse(localStorage.getItem('officeRecords') || '[]');
      const localInvestment = Number(localStorage.getItem('officeInvestment') || 0);
      setInitialInvestment(localInvestment);
      
      if (localRecords.length === 0) {
        setRecords([createNewEmptyRecord()]);
      } else {
        setRecords(localRecords);
      }
      setIsLoading(false);
    }
  };

  const createNewEmptyRecord = () => {
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      content: '',
      amount: '',
      salary: '',
      revenue: '',
      notes: '',
      createdAt: Date.now()
    };
  };

  const handleInvestmentChange = (e) => {
    const val = Number(e.target.value);
    setInitialInvestment(val);
  };

  const handleRecordChange = (id, field, value) => {
    setRecords(prevRecords => 
      prevRecords.map(record => 
        record.id === id ? { ...record, [field]: value } : record
      )
    );
  };

  const addNewRow = () => {
    setRecords(prev => [...prev, createNewEmptyRecord()]);
  };

  const deleteRow = (id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const saveData = async () => {
    setIsSaving(true);
    
    // Clean up empty records (if all fields are empty)
    const validRecords = records.filter(r => 
      r.content.trim() !== '' || 
      Number(r.amount) > 0 || 
      Number(r.salary) > 0 || 
      Number(r.revenue) > 0 ||
      r.notes.trim() !== ''
    );

    if (isFirebaseConfigured) {
      try {
        // Save investment
        await setDoc(doc(db, "settings", "investment"), { amount: Number(initialInvestment) });

        // Save records via Batch to replace all (for simplicity in this spreadsheet model)
        // Note: A more robust way is syncing diffs, but for < 1000 rows batch overwrite is fine
        const batch = writeBatch(db);
        
        // Delete old records first to avoid orphans (requires fetching first)
        const querySnapshot = await getDocs(collection(db, "transactions"));
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Add new records
        validRecords.forEach(record => {
          const docRef = doc(collection(db, "transactions"), record.id);
          batch.set(docRef, { ...record });
        });

        await batch.commit();
        
        // Update local state with valid records + 1 empty row to continue typing
        setRecords([...validRecords, createNewEmptyRecord()]);
        
        alert("Đã lưu dữ liệu thành công!");
      } catch (error) {
        console.error("Error saving data:", error);
        alert("Lỗi khi lưu dữ liệu!");
      }
    } else {
      // LocalStorage save
      localStorage.setItem('officeInvestment', initialInvestment);
      localStorage.setItem('officeRecords', JSON.stringify(validRecords));
      
      // Keep one empty row at the bottom
      setRecords([...validRecords, createNewEmptyRecord()]);
    }
    
    setIsSaving(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  return (
    <div className="container">
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient">Office Accounting</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Bảng tính nhập liệu trực tiếp</p>
        </div>
        {!isFirebaseConfigured && (
          <div className="badge badge-expense">
            Chưa cấu hình Firebase (Đang dùng LocalStorage)
          </div>
        )}
      </header>

      <div className="dashboard-grid">
        <div className="stat-card glass-panel">
          <div className="stat-title">
            <DollarSign size={18} /> Tiền Đầu Tư
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="stat-value primary" style={{ fontSize: '1.5rem', wordBreak: 'break-all' }}>
              {formatCurrency(initialInvestment)}
            </div>
            <input 
              type="number" 
              className="form-control" 
              style={{ width: '100%', padding: '0.5rem' }} 
              value={initialInvestment || ''}
              onChange={handleInvestmentChange}
              placeholder="Nhập số tiền đầu tư..."
            />
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-title">
            <TrendingUp size={18} /> Tổng Thu (Doanh Thu)
          </div>
          <div className="stat-value success">
            {formatCurrency(stats.totalRevenue)}
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-title">
            <TrendingDown size={18} /> Tổng Chi (Chi + Lương)
          </div>
          <div className="stat-value danger">
            {formatCurrency(stats.totalExpense)}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ border: '1px solid var(--accent-primary)' }}>
          <div className="stat-title" style={{ color: 'var(--text-primary)' }}>
            <Activity size={18} /> Tồn Quỹ Hiện Tại
          </div>
          <div className={`stat-value ${stats.balance >= 0 ? 'success' : 'danger'}`}>
            {formatCurrency(stats.balance)}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Bảng Tính Phân Bổ</h2>
          <button 
            className="btn btn-primary" 
            onClick={saveData} 
            disabled={isSaving}
          >
            <Save size={18} /> {isSaving ? 'Đang Lưu...' : 'Lưu Dữ Liệu'}
          </button>
        </div>

        <div className="table-wrapper" style={{ margin: 0, borderRadius: 0 }}>
          <table className="editable-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>STT</th>
                <th style={{ width: '150px' }}>Ngày Tháng</th>
                <th>Nội Dung</th>
                <th style={{ width: '150px' }}>Số Tiền (Chi)</th>
                <th style={{ width: '150px' }}>Tiền Lương (Chi)</th>
                <th style={{ width: '150px' }}>Doanh Thu (Thu)</th>
                <th>Ghi Chú</th>
                <th style={{ width: '50px', textAlign: 'center' }}>Xoá</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <Activity size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
                    <div>Đang tải dữ liệu từ mây...</div>
                  </td>
                </tr>
              ) : records.map((record, index) => (
                <tr key={record.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{index + 1}</td>
                  <td>
                    <input 
                      type="date" 
                      className="inline-input"
                      value={record.date}
                      onChange={(e) => handleRecordChange(record.id, 'date', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input"
                      placeholder="Nhập nội dung..."
                      value={record.content}
                      onChange={(e) => handleRecordChange(record.id, 'content', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="inline-input text-right amount-expense"
                      placeholder="0"
                      value={record.amount}
                      onChange={(e) => handleRecordChange(record.id, 'amount', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="inline-input text-right amount-salary"
                      placeholder="0"
                      value={record.salary}
                      onChange={(e) => handleRecordChange(record.id, 'salary', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="inline-input text-right amount-revenue"
                      placeholder="0"
                      value={record.revenue}
                      onChange={(e) => handleRecordChange(record.id, 'revenue', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input"
                      placeholder="Ghi chú thêm..."
                      value={record.notes}
                      onChange={(e) => handleRecordChange(record.id, 'notes', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-outline" 
                      style={{ padding: '0.4rem', border: 'none', color: 'var(--danger)' }} 
                      onClick={() => deleteRow(record.id)}
                      title="Xoá dòng"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
          <button className="btn btn-outline" onClick={addNewRow} style={{ width: '100%', borderStyle: 'dashed' }}>
            <Plus size={18} /> Thêm Dòng Mới
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
