import { useState, useEffect, useCallback, useRef } from 'react';
import { generateImage } from './services/image-api';
import { settingsManager } from './services/settings';
import { generateCustomPrompt } from './constants/dreams';
import './App.css';

// 拍立得照片类型
interface PolaroidPhoto {
  id: string;
  photo: string;
  name: string;
  dream: string;
  date: string;
  result?: string;
  isGenerating?: boolean;
}

// 历史记录类型
interface HistoryItem {
  id: string;
  name: string;
  dream: string;
  originalPhoto: string;
  resultPhoto: string;
  timestamp: number;
}

// 本地存储 key
const HISTORY_KEY = 'dream-dress-history';

function App() {
  // 摄像头状态
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 拍立得照片列表
  const [polaroids, setPolaroids] = useState<PolaroidPhoto[]>([]);
  const [selectedPolaroid, setSelectedPolaroid] = useState<PolaroidPhoto | null>(null);

  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  // API设置
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState('https://api.tu-zi.com/v1');
  const [tempApiKey, setTempApiKey] = useState('');

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载历史记录
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载历史记录失败', e);
    }
  }, []);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
      setError('无法访问摄像头，请使用上传功能');
    }
  }, []);

  // 初始化摄像头
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // 拍照
  const takePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 裁剪为正方形并镜像
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    const newPolaroid: PolaroidPhoto = {
      id: Date.now().toString(),
      photo: dataUrl,
      name: '',
      dream: '',
      date: dateStr,
    };

    setPolaroids(prev => [newPolaroid, ...prev].slice(0, 6));
    setSelectedPolaroid(newPolaroid);
  }, []);

  // 上传照片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 640;
        canvas.height = 640;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 640, 640);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

        const newPolaroid: PolaroidPhoto = {
          id: Date.now().toString(),
          photo: dataUrl,
          name: '',
          dream: '',
          date: dateStr,
        };

        setPolaroids(prev => [newPolaroid, ...prev].slice(0, 6));
        setSelectedPolaroid(newPolaroid);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // 更新拍立得信息
  const updatePolaroid = (id: string, updates: Partial<PolaroidPhoto>) => {
    setPolaroids(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (selectedPolaroid?.id === id) {
      setSelectedPolaroid(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  // 删除拍立得
  const deletePolaroid = (id: string) => {
    setPolaroids(prev => prev.filter(p => p.id !== id));
    if (selectedPolaroid?.id === id) {
      setSelectedPolaroid(null);
    }
  };

  // 保存历史记录
  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }, []);

  // 生成图片
  const handleGenerate = async (polaroid: PolaroidPhoto) => {
    if (!polaroid.dream.trim()) {
      setError('请输入梦想');
      return;
    }

    if (!settingsManager.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    updatePolaroid(polaroid.id, { isGenerating: true });
    setError(null);

    try {
      const promptText = generateCustomPrompt(polaroid.dream.trim());
      const response = await generateImage(promptText, { image: polaroid.photo });

      if (response.data?.[0]?.url) {
        const imageUrl = response.data[0].url;
        updatePolaroid(polaroid.id, { result: imageUrl, isGenerating: false });

        // 保存到历史记录
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          name: polaroid.name.trim() || '未命名',
          dream: polaroid.dream.trim(),
          originalPhoto: polaroid.photo,
          resultPhoto: imageUrl,
          timestamp: Date.now(),
        };
        saveHistory([newItem, ...history].slice(0, 50));
      } else {
        throw new Error('生成失败，请重试');
      }
    } catch (e: any) {
      setError(e.message || '生成失败，请重试');
      updatePolaroid(polaroid.id, { isGenerating: false });
    }
  };

  // 删除历史记录
  const deleteHistoryItem = (id: string) => {
    saveHistory(history.filter(item => item.id !== id));
    if (selectedHistoryItem?.id === id) {
      setSelectedHistoryItem(null);
    }
  };

  return (
    <div className="app">
      {/* 顶部按钮 */}
      <div className="top-buttons">
        <button className="history-btn" onClick={() => setShowHistory(true)}>
          DOWNLOAD
        </button>
      </div>

      {/* 主区域 */}
      <main className="main-area">
        {/* 相机区域 */}
        <div className="camera-body">
          {/* 闪光灯 */}
          <div className="camera-flash"></div>

          {/* 取景器 */}
          <div className="camera-viewfinder"></div>

          {/* 小镜头 */}
          <div className="camera-small-lens"></div>

          {/* 主镜头 - 包含视频 */}
          <div className="camera-lens-outer">
            <div className="camera-lens-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />
              {!cameraReady && (
                <div className="camera-placeholder">
                  <span>📷</span>
                </div>
              )}
            </div>
          </div>

          {/* 拍照按钮 */}
          <button className="camera-shutter" onClick={takePhoto}>
            <div className="shutter-inner"></div>
          </button>

          {/* 上传按钮 */}
          <button className="camera-upload" onClick={() => fileInputRef.current?.click()}>
            📁
          </button>

          {/* 照片出口 */}
          <div className="camera-output">
            {polaroids[0] && !polaroids[0].result && (
              <div className="output-photo"></div>
            )}
          </div>
        </div>

        {/* 拍立得照片区域 */}
        <div className="polaroids-area">
          {polaroids.map((polaroid, index) => (
            <div
              key={polaroid.id}
              className={`polaroid ${selectedPolaroid?.id === polaroid.id ? 'selected' : ''}`}
              style={{
                transform: `rotate(${(index % 2 === 0 ? 1 : -1) * (3 + index * 2)}deg)`,
                zIndex: polaroids.length - index,
              }}
              onClick={() => setSelectedPolaroid(polaroid)}
            >
              <div className="polaroid-image">
                {polaroid.isGenerating ? (
                  <div className="polaroid-loading">
                    <div className="spinner-small"></div>
                  </div>
                ) : polaroid.result ? (
                  <img src={polaroid.result} alt="结果" />
                ) : (
                  <img src={polaroid.photo} alt="照片" />
                )}
              </div>
              <div className="polaroid-info">
                <span className="polaroid-dream">{polaroid.dream || 'MAY I MEET YOU'}</span>
                <span className="polaroid-date">{polaroid.date}</span>
              </div>
              <button
                className="polaroid-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePolaroid(polaroid.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* 错误提示 */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* 拍立得编辑弹窗 */}
      {selectedPolaroid && (
        <div className="polaroid-modal" onClick={() => setSelectedPolaroid(null)}>
          <div className="polaroid-modal-content" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedPolaroid(null)}>✕</button>

            <div className="polaroid-preview">
              {selectedPolaroid.isGenerating ? (
                <div className="polaroid-generating">
                  <div className="spinner"></div>
                  <p>正在实现梦想...</p>
                </div>
              ) : selectedPolaroid.result ? (
                <img src={selectedPolaroid.result} alt="结果" />
              ) : (
                <img src={selectedPolaroid.photo} alt="照片" />
              )}
            </div>

            <div className="polaroid-form">
              <input
                type="text"
                value={selectedPolaroid.name}
                onChange={(e) => updatePolaroid(selectedPolaroid.id, { name: e.target.value })}
                placeholder="输入姓名（可选）"
                className="input-name"
              />
              <textarea
                value={selectedPolaroid.dream}
                onChange={(e) => updatePolaroid(selectedPolaroid.id, { dream: e.target.value })}
                placeholder="输入你的梦想..."
                className="input-dream"
                rows={2}
              />
              <div className="polaroid-actions">
                {selectedPolaroid.result ? (
                  <>
                    <a
                      href={selectedPolaroid.result}
                      download={`${selectedPolaroid.name || '梦想变装'}.png`}
                      className="btn-download"
                    >
                      📥 保存
                    </a>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        updatePolaroid(selectedPolaroid.id, { result: undefined });
                      }}
                    >
                      重新生成
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => handleGenerate(selectedPolaroid)}
                    disabled={!selectedPolaroid.dream.trim() || selectedPolaroid.isGenerating}
                  >
                    {selectedPolaroid.isGenerating ? '生成中...' : '开始变装 ✨'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录画廊 */}
      {showHistory && (
        <div className="gallery-overlay" onClick={() => setShowHistory(false)}>
          <div className="gallery-container" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-header">
              <h2>📚 梦想画廊</h2>
              <button className="btn-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            {history.length === 0 ? (
              <div className="gallery-empty">
                <span>🖼️</span>
                <p>还没有记录哦，快去拍照吧！</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="gallery-item"
                    onClick={() => setSelectedHistoryItem(item)}
                  >
                    <img src={item.resultPhoto} alt={item.name} />
                    <div className="gallery-item-info">
                      <span className="gallery-item-name">{item.name}</span>
                    </div>
                    <button
                      className="gallery-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistoryItem(item.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* API 设置弹窗 */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-container" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>API 配置</h2>
              <button className="btn-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-form">
              <div className="settings-field">
                <label>API 地址</label>
                <input
                  type="text"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="https://api.tu-zi.com/v1"
                  className="input-name"
                />
              </div>
              <div className="settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="输入你的 API Key"
                  className="input-name"
                />
                <p className="settings-hint">
                  获取地址: <a href="https://api.tu-zi.com/token" target="_blank" rel="noopener noreferrer">https://api.tu-zi.com/token</a>
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  if (tempApiKey.trim()) {
                    settingsManager.updateConfig({
                      baseUrl: tempApiUrl.trim() || 'https://api.tu-zi.com/v1',
                      apiKey: tempApiKey.trim(),
                    });
                    setShowSettings(false);
                    if (selectedPolaroid) {
                      handleGenerate(selectedPolaroid);
                    }
                  }
                }}
                disabled={!tempApiKey.trim()}
              >
                保存并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片详情弹窗 */}
      {selectedHistoryItem && (
        <div className="detail-overlay" onClick={() => setSelectedHistoryItem(null)}>
          <div className="detail-container" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedHistoryItem(null)}>✕</button>
            <div className="detail-images">
              <div className="detail-image-box">
                <span className="detail-label">原始照片</span>
                <img src={selectedHistoryItem.originalPhoto} alt="原始" />
              </div>
              <div className="detail-image-box">
                <span className="detail-label">变装后</span>
                <img src={selectedHistoryItem.resultPhoto} alt="变装后" />
              </div>
            </div>
            <div className="detail-info">
              <p className="detail-name">{selectedHistoryItem.name}</p>
              <p className="detail-dream">"{selectedHistoryItem.dream}"</p>
              <p className="detail-time">{new Date(selectedHistoryItem.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
