import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/layout/Toast';
import { useConfirm } from '../components/layout/ConfirmModal';
import { 
  QrCode, Clock, Plus, Trash, Warning, CheckCircle, 
  Calendar, MapPin, Note, ArrowLeft, ClockAfternoon, Info
} from '@phosphor-icons/react';
import { Html5Qrcode } from 'html5-qrcode';
import './AttendancePage.css';

export default function AttendancePage() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  // State
  const [activeLog, setActiveLog] = useState(null);
  const [pendingDeclarations, setPendingDeclarations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [logs, setLogs] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance', 'history', 'claim'

  // Scanner State
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeInstance = useRef(null);

  // Declaration State
  const [declaringLog, setDeclaringLog] = useState(null);
  const [declaredSessions, setDeclaredSessions] = useState([
    { ta_capability: 'TA_SUPPORT', start_time: '08:00', end_time: '09:30' }
  ]);

  // Claim State
  const [claimBranchId, setClaimBranchId] = useState('');
  const [claimDate, setClaimDate] = useState('');
  const [claimCheckIn, setClaimCheckIn] = useState('');
  const [claimCheckOut, setClaimCheckOut] = useState('');
  const [claimReason, setClaimReason] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Pagination states
  const [logsPage, setLogsPage] = useState(1);
  const [totalPagesLogs, setTotalPagesLogs] = useState(1);
  const [claimsPage, setClaimsPage] = useState(1);
  const [totalPagesClaims, setTotalPagesClaims] = useState(1);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchLogsPage = async (page) => {
    try {
      const history = await api.getMyAttendanceLogs(page, claimsPage, 10);
      setLogs(history.logs || []);
      setLogsPage(history.logsPage);
      setTotalPagesLogs(history.totalPagesLogs);
    } catch (err) {
      addToast('Lỗi tải nhật ký: ' + err.message, 'error');
    }
  };

  const fetchClaimsPage = async (page) => {
    try {
      const history = await api.getMyAttendanceLogs(logsPage, page, 10);
      setClaims(history.claims || []);
      setClaimsPage(history.claimsPage);
      setTotalPagesClaims(history.totalPagesClaims);
    } catch (err) {
      addToast('Lỗi tải đơn bù công: ' + err.message, 'error');
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const status = await api.getAttendanceStatus();
      setActiveLog(status.activeLog);
      setPendingDeclarations(status.pendingDeclarations || []);

      const branchList = await api.getBranches();
      setBranches(branchList);
      if (branchList.length > 0) {
        setClaimBranchId(branchList[0].id);
      }

      const history = await api.getMyAttendanceLogs(1, 1, 10);
      setLogs(history.logs || []);
      setClaims(history.claims || []);
      setLogsPage(history.logsPage || 1);
      setTotalPagesLogs(history.totalPagesLogs || 1);
      setClaimsPage(history.claimsPage || 1);
      setTotalPagesClaims(history.totalPagesClaims || 1);
    } catch (err) {
      addToast('Lỗi tải dữ liệu chấm công: ' + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Start Camera QR Scanner
  const startScanner = async () => {
    setScanning(true);
    // Wait for DOM element
    setTimeout(async () => {
      try {
        html5QrcodeInstance.current = new Html5Qrcode('qr-reader');
        await html5QrcodeInstance.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (qrCodeMessage) => {
            handleScanSuccess(qrCodeMessage);
          },
          (errorMessage) => {
            // Silence noise scans
          }
        );
      } catch (err) {
        addToast('Không thể mở camera: ' + (err.message || err), 'error');
        setScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (html5QrcodeInstance.current && html5QrcodeInstance.current.isScanning) {
      await html5QrcodeInstance.current.stop();
      html5QrcodeInstance.current = null;
    }
    setScanning(false);
  };

  const handleScanSuccess = async (qrToken) => {
    await stopScanner();
    addToast('Đã nhận diện mã QR. Đang lấy vị trí GPS...', 'info');

    // Get GPS coords
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await submitScan(qrToken, latitude, longitude);
      },
      async (err) => {
        addToast('Không thể định vị GPS, tiếp tục chấm công với cảnh báo vị trí.', 'warning');
        await submitScan(qrToken, null, null);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const submitScan = async (token, lat, lng) => {
    try {
      const res = await api.scanQR(token, lat, lng);
      addToast(res.message, 'success');

      if (res.action === 'CHECK_OUT') {
        // Automatically open session declaration modal
        setDeclaringLog(res.log);
        // Estimate start and end from raw scan hours
        const rawIn = new Date(res.log.check_in_time);
        const rawOut = new Date(res.log.check_out_time);
        const startStr = `${String(rawIn.getHours()).padStart(2, '0')}:${String(rawIn.getMinutes()).padStart(2, '0')}`;
        const endStr = `${String(rawOut.getHours()).padStart(2, '0')}:${String(rawOut.getMinutes()).padStart(2, '0')}`;
        setDeclaredSessions([{ ta_capability: 'TA_SUPPORT', start_time: startStr, end_time: endStr }]);
      }

      fetchInitialData();
    } catch (err) {
      addToast(err.message || 'Lỗi quét chấm công.', 'error');
    }
  };

  // Declare Sessions
  const addDeclarationRow = () => {
    setDeclaredSessions([...declaredSessions, { ta_capability: 'TA_SUPPORT', start_time: '08:00', end_time: '09:30' }]);
  };

  const removeDeclarationRow = (index) => {
    setDeclaredSessions(declaredSessions.filter((_, i) => i !== index));
  };

  const updateDeclarationRow = (index, field, value) => {
    const updated = [...declaredSessions];
    updated[index][field] = value;
    setDeclaredSessions(updated);
  };

  const handleSubmitDeclaration = async (e) => {
    e.preventDefault();
    if (declaredSessions.length === 0) {
      addToast('Vui lòng thêm ít nhất một ca dạy.', 'warning');
      return;
    }

    try {
      await api.declareSessions(declaringLog.id, declaredSessions);
      addToast('Khai báo giờ dạy thành công, đang chờ Admin duyệt!', 'success');
      setDeclaringLog(null);
      fetchInitialData();
    } catch (err) {
      addToast(err.message || 'Lỗi khai báo ca dạy.', 'error');
    }
  };

  // Submit Claim
  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!claimBranchId || !claimDate || !claimCheckIn || !claimCheckOut || !claimReason) {
      addToast('Vui lòng điền đầy đủ thông tin khiếu nại.', 'warning');
      return;
    }

    setSubmittingClaim(true);
    try {
      const checkInDateTime = `${claimDate}T${claimCheckIn}:00`;
      const checkOutDateTime = `${claimDate}T${claimCheckOut}:00`;

      await api.submitClaim({
        branch_id: claimBranchId,
        claim_date: claimDate,
        claimed_check_in: checkInDateTime,
        claimed_check_out: checkOutDateTime,
        reason: claimReason
      });

      addToast('Đã gửi khiếu nại bù công thành công!', 'success');
      setClaimDate('');
      setClaimCheckIn('');
      setClaimCheckOut('');
      setClaimReason('');
      setActiveTab('history');
      fetchInitialData();
    } catch (err) {
      addToast(err.message || 'Lỗi gửi yêu cầu bù công.', 'error');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="attendance-container">
      <div className="attendance-header">
        <h1 className="attendance-title">Chấm Công Trợ Giảng</h1>
        <p className="attendance-subtitle">Check-in/out tại trung tâm và khai báo ca dạy hàng ngày</p>
      </div>

      {/* Tabs */}
      <div className="attendance-tabs">
        <button className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
          <QrCode size={18} />
          <span>Chấm công</span>
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <Calendar size={18} />
          <span>Lịch sử & Khiếu nại</span>
        </button>
        <button className={`tab-btn ${activeTab === 'claim' ? 'active' : ''}`} onClick={() => setActiveTab('claim')}>
          <Warning size={18} />
          <span>Quên chấm công (Bù công)</span>
        </button>
      </div>

      {loading ? (
        <div className="attendance-loading">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu chấm công...</p>
        </div>
      ) : (
        <div className="attendance-content">
          {/* TAB 1: ATTENDANCE SCAN & STATE */}
          {activeTab === 'attendance' && (
            <div className="tab-pane">
              {/* Alert: Historic Missing Declarations */}
              {pendingDeclarations.length > 0 && (
                <div className="alert-box warning-alert">
                  <Warning size={24} weight="fill" className="alert-icon" />
                  <div className="alert-body">
                    <h3>Bạn có ca làm việc chưa khai báo giờ dạy!</h3>
                    <p>Hãy chọn ca làm việc dưới đây để bổ sung chi tiết giờ dạy để tránh bị thiếu lương:</p>
                    <div className="pending-declaration-list">
                      {pendingDeclarations.map(log => (
                        <button key={log.id} className="pending-decl-item-btn" onClick={() => {
                          setDeclaringLog(log);
                          const rawIn = new Date(log.check_in_time);
                          const rawOut = log.check_out_time ? new Date(log.check_out_time) : new Date(rawIn.getTime() + 2 * 60 * 60 * 1000);
                          const startStr = `${String(rawIn.getHours()).padStart(2, '0')}:${String(rawIn.getMinutes()).padStart(2, '0')}`;
                          const endStr = `${String(rawOut.getHours()).padStart(2, '0')}:${String(rawOut.getMinutes()).padStart(2, '0')}`;
                          setDeclaredSessions([{ ta_capability: 'TA_SUPPORT', start_time: startStr, end_time: endStr }]);
                        }}>
                          <span>Cơ sở: {log.branch_name} | Ngày: {formatDateOnly(log.check_in_time)} ({formatDateTime(log.check_in_time).split(' ')[0]} - {log.check_out_time ? formatDateTime(log.check_out_time).split(' ')[0] : 'Chưa Checkout'})</span>
                          <strong>Khai báo ngay →</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* QR Scanner Screen */}
              {scanning ? (
                <div className="scanner-container">
                  <div className="scanner-header">
                    <h3>Quét mã QR từ màn hình Admin</h3>
                    <button className="btn btn-secondary btn-sm" onClick={stopScanner}>
                      <ArrowLeft size={16} /> Quay lại
                    </button>
                  </div>
                  <div className="qr-reader-wrapper">
                    <div id="qr-reader" style={{ width: '100%' }}></div>
                  </div>
                  <p className="scanner-tip">Vui lòng căn chỉnh mã QR vào khung ngắm để hệ thống tự động nhận dạng.</p>
                </div>
              ) : declaringLog ? (
                /* Declare Sessions Form */
                <div className="declaration-card">
                  <div className="card-header">
                    <h2>Khai Báo Ca Dạy Thực Tế</h2>
                    <p>Mã ca: <code>{declaringLog.id.slice(0, 8)}...</code> | Cơ sở: {declaringLog.branch_name || 'Lotus Time'}</p>
                    <p className="time-range">Khung giờ làm việc thực tế: <strong>{formatDateTime(declaringLog.check_in_time)}</strong> đến <strong>{declaringLog.check_out_time ? formatDateTime(declaringLog.check_out_time) : 'Bây giờ'}</strong></p>
                  </div>
                  <form onSubmit={handleSubmitDeclaration} className="declaration-form">
                    <div className="sessions-list">
                      {declaredSessions.map((sess, idx) => (
                        <div key={idx} className="session-row">
                          <div className="form-group">
                            <label>Phân khúc/Nhiệm vụ</label>
                            <select 
                              value={sess.ta_capability} 
                              onChange={(e) => updateDeclarationRow(idx, 'ta_capability', e.target.value)}
                            >
                              <option value="TA_IELTS">TA IELTS (Lương cao)</option>
                              <option value="TA_KIDS">TA Kids (Lớp trẻ em)</option>
                              <option value="TA_INDEPENDENT">TA Độc lập (Lớp tự quản)</option>
                              <option value="TA_SUPPORT">TA Hỗ trợ (Lớp trợ giảng)</option>
                            </select>
                          </div>
                          <div className="form-group time-group">
                            <label>Giờ bắt đầu</label>
                            <input 
                              type="time" 
                              value={sess.start_time} 
                              onChange={(e) => updateDeclarationRow(idx, 'start_time', e.target.value)} 
                              required 
                            />
                          </div>
                          <div className="form-group time-group">
                            <label>Giờ kết thúc</label>
                            <input 
                              type="time" 
                              value={sess.end_time} 
                              onChange={(e) => updateDeclarationRow(idx, 'end_time', e.target.value)} 
                              required 
                            />
                          </div>
                          {declaredSessions.length > 1 && (
                            <button type="button" className="btn-remove-session" onClick={() => removeDeclarationRow(idx)}>
                              <Trash size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={addDeclarationRow}>
                        <Plus size={16} /> Thêm ca dạy khác
                      </button>
                      <div className="submit-actions">
                        <button type="button" className="btn btn-text" onClick={() => setDeclaringLog(null)}>Hủy bỏ</button>
                        <button type="submit" className="btn btn-primary">Gửi phê duyệt</button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : (
                /* Normal Punch Screen */
                <div className="punch-card-wrapper">
                  <div className="punch-status-card">
                    {activeLog ? (
                      <div className="status-badge check-in-active">
                        <Clock size={20} weight="fill" />
                        <span>Đang trong ca làm việc</span>
                      </div>
                    ) : (
                      <div className="status-badge check-out-active">
                        <CheckCircle size={20} weight="fill" />
                        <span>Sẵn sàng Check-in</span>
                      </div>
                    )}

                    <div className="active-details">
                      {activeLog ? (
                        <>
                          <p className="label">Bạn đã Check-In tại:</p>
                          <h3 className="value">{activeLog.branch_name}</h3>
                          <p className="label">Thời điểm:</p>
                          <h3 className="value time">{formatDateTime(activeLog.check_in_time)}</h3>
                          {activeLog.check_in_gps_valid === false && (
                            <div className="gps-warning">
                              <Warning size={16} weight="fill" />
                              <span>Định vị ngoài chi nhánh (Warning ghi nhận)</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="ready-view">
                          <p>Vui lòng lại gần màn hình Admin của Trung tâm và bấm nút bên dưới để thực hiện chấm công.</p>
                        </div>
                      )}
                    </div>

                    <button className={`btn btn-large ${activeLog ? 'btn-danger' : 'btn-primary'}`} onClick={startScanner}>
                      <QrCode size={24} />
                      <span>{activeLog ? 'QUÉT MÃ CHECK-OUT (RA VỀ)' : 'QUÉT MÃ CHECK-IN (ĐẾN LỚP)'}</span>
                    </button>
                  </div>

                  {/* QR Scan Instructions */}
                  <div className="instructions-card">
                    <h4>
                      <Info size={18} /> Hướng dẫn chấm công QR
                    </h4>
                    <ol>
                      <li>Bật kết nối Wi-Fi của Trung tâm hoặc mạng dữ liệu di động (4G).</li>
                      <li>Cho phép trình duyệt truy cập định vị GPS của thiết bị khi quét.</li>
                      <li>Nhấn quét mã và camera sẽ tự động đọc mã QR vạn năng trên màn hình Admin.</li>
                      <li>Sau khi Check-out, khai báo các ca dạy của bạn để gửi duyệt lương.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ATTENDANCE LOGS HISTORY */}
          {activeTab === 'history' && (
            <div className="tab-pane">
              <div className="history-section">
                <h3>Nhật Ký Chấm Công Gần Đây</h3>
                {logs.length === 0 ? (
                  <p className="no-data">Chưa có nhật ký chấm công nào.</p>
                ) : (
                  <div className="logs-table-wrapper">
                    <table className="logs-table">
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Chi nhánh</th>
                          <th>Giờ Vào/Ra thực tế</th>
                          <th>Các ca học khai báo</th>
                          <th>GPS Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id}>
                            <td className="font-semibold">{formatDateOnly(log.check_in_time)}</td>
                            <td>{log.branch_name}</td>
                            <td>
                              <div className="in-out-times">
                                <span className="time-in">Vào: {formatDateTime(log.check_in_time).split(' ')[0]}</span>
                                <span className="time-out">Ra: {log.check_out_time ? formatDateTime(log.check_out_time).split(' ')[0] : 'N/A'}</span>
                              </div>
                              {log.status === 'auto_closed' && (
                                <span className="badge badge-auto-closed">Auto-Closed</span>
                              )}
                            </td>
                            <td>
                              {log.declared_sessions.length === 0 ? (
                                <span className="text-mute italic text-sm">Chưa khai báo ca dạy</span>
                              ) : (
                                <div className="declared-sessions-mini">
                                  {log.declared_sessions.map((s) => (
                                    <div key={s.id} className="declared-session-item">
                                      <span className="cap-label">{s.ta_capability.replace('TA_', '')}:</span>
                                      <span className="time-range">{s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}</span>
                                      <span className={`status-dot ${s.is_approved ? 'approved' : 'pending'}`} title={s.is_approved ? 'Đã duyệt' : 'Chờ duyệt'}></span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="gps-labels">
                                <span className={`gps-indicator ${log.check_in_gps_valid ? 'valid' : 'invalid'}`}>
                                  In: {log.check_in_gps_valid ? 'OK' : 'Lệch'}
                                </span>
                                {log.check_out_time && (
                                  <span className={`gps-indicator ${log.check_out_gps_valid ? 'valid' : 'invalid'}`}>
                                    Out: {log.check_out_gps_valid ? 'OK' : 'Lệch'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {totalPagesLogs > 1 && (
                  <div className="pagination-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
                    <button 
                      disabled={logsPage === 1} 
                      onClick={() => fetchLogsPage(logsPage - 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      Trước
                    </button>
                    <span>Trang {logsPage} / {totalPagesLogs}</span>
                    <button 
                      disabled={logsPage === totalPagesLogs} 
                      onClick={() => fetchLogsPage(logsPage + 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </div>

              {/* Claims Section */}
              <div className="claims-section">
                <h3>Yêu Cầu Bù Công (Quên Chấm Công)</h3>
                {claims.length === 0 ? (
                  <p className="no-data">Chưa gửi yêu cầu bù công nào.</p>
                ) : (
                  <div className="claims-list">
                    {claims.map((claim) => (
                      <div key={claim.id} className={`claim-card-item status-${claim.status}`}>
                        <div className="claim-item-header">
                          <span className="claim-date font-semibold">Ngày yêu cầu công: {formatDateOnly(claim.claim_date)}</span>
                          <span className={`claim-status-badge ${claim.status}`}>{claim.status === 'pending' ? 'Chờ duyệt' : claim.status === 'approved' ? 'Đã duyệt' : 'Bị từ chối'}</span>
                        </div>
                        <div className="claim-item-body">
                          <p><strong>Cơ sở:</strong> {claim.branch_name}</p>
                          <p><strong>Khung giờ khai báo:</strong> {formatDateTime(claim.claimed_check_in).split(' ')[0]} - {formatDateTime(claim.claimed_check_out).split(' ')[0]}</p>
                          <p><strong>Lý do:</strong> {claim.reason}</p>
                          {claim.admin_notes && (
                            <p className="admin-notes"><strong>Ghi chú của Admin:</strong> {claim.admin_notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {totalPagesClaims > 1 && (
                  <div className="pagination-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
                    <button 
                      disabled={claimsPage === 1} 
                      onClick={() => fetchClaimsPage(claimsPage - 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      Trước
                    </button>
                    <span>Trang {claimsPage} / {totalPagesClaims}</span>
                    <button 
                      disabled={claimsPage === totalPagesClaims} 
                      onClick={() => fetchClaimsPage(claimsPage + 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SUBMIT COMPENSATION CLAIM */}
          {activeTab === 'claim' && (
            <div className="tab-pane">
              <div className="claim-form-card">
                <h2>Báo Bù Công / Khiếu Nại Quên Quét QR</h2>
                <p className="claim-tip">Gửi đơn khai báo bù công nếu bạn quên mang điện thoại hoặc quên quét mã QR khi đến/về. Admin sẽ đối chiếu camera và phê duyệt sau.</p>
                
                <form onSubmit={handleClaimSubmit} className="claim-form">
                  <div className="form-group">
                    <label>Chi nhánh làm việc</label>
                    <select 
                      value={claimBranchId} 
                      onChange={(e) => setClaimBranchId(e.target.value)}
                      required
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Ngày làm việc</label>
                    <input 
                      type="date" 
                      value={claimDate} 
                      onChange={(e) => setClaimDate(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Giờ vào thực tế</label>
                      <input 
                        type="time" 
                        value={claimCheckIn} 
                        onChange={(e) => setClaimCheckIn(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Giờ ra thực tế</label>
                      <input 
                        type="time" 
                        value={claimCheckOut} 
                        onChange={(e) => setClaimCheckOut(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Lý do quên / Khiếu nại</label>
                    <textarea 
                      rows="3" 
                      placeholder="VD: Em vội vào lớp nên quên quét mã check-in, em dạy ca IELTS 8h-9h30 sáng..."
                      value={claimReason} 
                      onChange={(e) => setClaimReason(e.target.value)} 
                      required
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary btn-block" disabled={submittingClaim}>
                    {submittingClaim ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu bù công'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
