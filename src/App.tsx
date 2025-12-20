import { useState, useEffect, useCallback, useRef } from 'react';
import { generateImage } from './services/image-api';
import { settingsManager } from './services/settings';
import { generateCustomPrompt, DEFAULT_PROMPT_TEMPLATE, BUILT_IN_TEMPLATES, TEMPLATES_STORAGE_KEY } from './constants/dreams';
import type { PromptTemplate } from './constants/dreams';
import { IMAGE_MODELS } from './types';
import './App.css';

// 胶片/照片类型（在画板上）
interface FilmPhoto {
  id: string;
  originalPhoto: string;
  name: string;
  dream: string;
  date: string;
  result?: string;
  isGenerating: boolean;
  isDeveloping: boolean;
  developProgress: number;
  position: { x: number; y: number };
  isDragging: boolean;
  isEjecting: boolean;
  ejectProgress: number; // 0-100 弹出进度
}

// 历史记录类型（带位置信息）
interface HistoryItem {
  id: string;
  name: string;
  dream: string;
  originalPhoto: string;
  resultPhoto: string;
  timestamp: number;
  position: { x: number; y: number };
}

// 本地存储 key
const HISTORY_KEY = 'dream-dress-history';

function App() {
  // 摄像头状态
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 待确认的照片（拍照后弹窗编辑）
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDream, setEditDream] = useState('');

  // 正在进入相机的照片（上传动画）
  const [enteringPhoto, setEnteringPhoto] = useState<string | null>(null);
  const [enteringProgress, setEnteringProgress] = useState(0);

  // 画板上的胶片/照片列表（生成中的）
  const [films, setFilms] = useState<FilmPhoto[]>([]);

  // 历史记录（已完成的照片，直接显示在画板上）
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  // 拖拽历史记录项
  const historyDragRef = useRef<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [draggingHistoryId, setDraggingHistoryId] = useState<string | null>(null);

  // API设置
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState('https://api.tu-zi.com/v1');
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempModel, setTempModel] = useState('gemini-3-pro-image-preview-vip');
  const [tempTemplateId, setTempTemplateId] = useState('realistic');
  const [tempPrompt, setTempPrompt] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [templates, setTemplates] = useState<PromptTemplate[]>(BUILT_IN_TEMPLATES);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  // 加载历史记录和设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const items = JSON.parse(saved) as HistoryItem[];
        // 为旧数据添加位置信息
        const itemsWithPosition = items.map((item, index) => ({
          ...item,
          position: item.position || {
            x: 500 + (index % 5) * 180,
            y: 80 + Math.floor(index / 5) * 220
          }
        }));
        setHistory(itemsWithPosition);
      }
    } catch (e) {
      console.error('加载历史记录失败', e);
    }

    // 加载自定义模板
    try {
      const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (savedTemplates) {
        const customTemplates = JSON.parse(savedTemplates) as PromptTemplate[];
        setTemplates([...BUILT_IN_TEMPLATES, ...customTemplates]);
      }
    } catch (e) {
      console.error('加载模板失败', e);
    }

    // 加载设置
    const config = settingsManager.getConfig();
    setTempApiUrl(config.baseUrl);
    setTempApiKey(config.apiKey);
    setTempModel(config.modelName || 'gemini-3-pro-image-preview-vip');
    // 加载模板设置
    const savedTemplateId = (config as any).templateId || 'realistic';
    setTempTemplateId(savedTemplateId);

    // 加载模板内容
    const allTemplates = [...BUILT_IN_TEMPLATES];
    try {
      const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (savedTemplates) {
        allTemplates.push(...JSON.parse(savedTemplates));
      }
    } catch (e) {}

    const template = allTemplates.find(t => t.id === savedTemplateId);
    setTempPrompt(template?.template || config.customPrompt || DEFAULT_PROMPT_TEMPLATE);
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

  // 拍照 - 只捕获照片，弹窗确认
  const takePhoto = useCallback(() => {
    if (!videoRef.current || capturedPhoto) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(dataUrl);
    setEditName('');
    setEditDream('');
  }, [capturedPhoto]);

  // 上传照片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || capturedPhoto || enteringPhoto) return;

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

        // 开始进入动画
        setEnteringPhoto(dataUrl);
        setEnteringProgress(0);

        // 照片进入相机的动画
        let progress = 0;
        const enterInterval = setInterval(() => {
          progress += 2;
          setEnteringProgress(progress);

          if (progress >= 100) {
            clearInterval(enterInterval);
            // 动画完成，打开编辑弹窗
            setEnteringPhoto(null);
            setEnteringProgress(0);
            setCapturedPhoto(dataUrl);
            setEditName('');
            setEditDream('');
          }
        }, 20);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [capturedPhoto, enteringPhoto]);

  // 确认并开始生成 - 弹出黑色胶片
  const handleConfirmAndGenerate = async () => {
    if (!capturedPhoto || !editDream.trim()) {
      setError('请输入梦想');
      return;
    }

    if (!settingsManager.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // 创建新胶片（黑色状态，出现在相机上方）
    const filmId = Date.now().toString();
    // 胶片出现在相机上方
    const filmX = 130;
    const filmY = 30;

    const newFilm: FilmPhoto = {
      id: filmId,
      originalPhoto: capturedPhoto,
      name: editName.trim(),
      dream: editDream.trim(),
      date: dateStr,
      isGenerating: true,
      isDeveloping: false,
      developProgress: 0,
      position: { x: filmX, y: filmY },
      isDragging: false,
      isEjecting: true,
      ejectProgress: 0,
    };

    setFilms(prev => [...prev, newFilm]);
    setCapturedPhoto(null);
    setEditName('');
    setEditDream('');
    setError(null);

    // 胶片缓慢出现动画（渐入效果）- 更慢的速度
    let ejectProgress = 0;
    const ejectInterval = setInterval(() => {
      ejectProgress += 1; // 更慢的增量
      setFilms(prev => prev.map(f =>
        f.id === filmId
          ? { ...f, ejectProgress: Math.min(ejectProgress, 100) }
          : f
      ));

      if (ejectProgress >= 100) {
        clearInterval(ejectInterval);
        setFilms(prev => prev.map(f =>
          f.id === filmId
            ? { ...f, isEjecting: false }
            : f
        ));
      }
    }, 50); // 更长的间隔

    // 开始AI生成
    try {
      const config = settingsManager.getConfig();
      const promptText = generateCustomPrompt(newFilm.dream, config.customPrompt);
      const response = await generateImage(promptText, { image: newFilm.originalPhoto });

      if (response.data?.[0]?.url) {
        const imageUrl = response.data[0].url;

        // 开始显影动画
        setFilms(prev => prev.map(f =>
          f.id === filmId
            ? { ...f, result: imageUrl, isGenerating: false, isDeveloping: true }
            : f
        ));

        // 显影动画（逐渐显示）- 更慢的速度
        let progress = 0;
        let hasAddedToHistory = false; // 防止重复添加
        const developInterval = setInterval(() => {
          progress += 1; // 更慢的增量

          if (progress >= 100) {
            clearInterval(developInterval);

            // 防止重复添加到历史
            if (hasAddedToHistory) return;
            hasAddedToHistory = true;

            // 显影完成后，保存到历史并移除胶片
            setFilms(prev => {
              const completedFilm = prev.find(f => f.id === filmId);
              if (completedFilm) {
                // 添加到历史记录
                const newItem: HistoryItem = {
                  id: Date.now().toString(),
                  name: completedFilm.name || '未命名',
                  dream: completedFilm.dream,
                  originalPhoto: completedFilm.originalPhoto,
                  resultPhoto: imageUrl,
                  timestamp: Date.now(),
                  position: completedFilm.position,
                };
                // 延迟添加到 history，避免状态冲突
                setTimeout(() => {
                  setHistory(prevHistory => {
                    // 检查是否已存在
                    if (prevHistory.some(h => h.originalPhoto === newItem.originalPhoto && h.dream === newItem.dream)) {
                      return prevHistory;
                    }
                    const newHistory = [newItem, ...prevHistory].slice(0, 50);
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
                    return newHistory;
                  });
                }, 50);
              }
              // 移除已完成的胶片
              return prev.filter(f => f.id !== filmId);
            });
          } else {
            // 更新显影进度
            setFilms(prev => prev.map(f =>
              f.id === filmId
                ? { ...f, developProgress: progress }
                : f
            ));
          }
        }, 80); // 更长的间隔

      } else {
        throw new Error('生成失败，请重试');
      }
    } catch (e: any) {
      setError(e.message || '生成失败，请重试');
      // 移除失败的胶片
      setFilms(prev => prev.filter(f => f.id !== filmId));
    }
  };

  // 取消拍照
  const cancelCapture = () => {
    setCapturedPhoto(null);
    setEditName('');
    setEditDream('');
  };

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, filmId: string) => {
    const film = films.find(f => f.id === filmId);
    if (!film) return;

    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // 如果胶片还在相机内（弹出/生成/显影中），需要计算它相对于画板的实际位置
    let initialX = film.position.x;
    let initialY = film.position.y;

    if (film.isEjecting || film.isGenerating || film.isDeveloping) {
      // 获取胶片元素当前的屏幕位置
      const filmElement = (e.target as HTMLElement).closest('.ejecting-film');
      if (filmElement && canvasRef.current) {
        const filmRect = filmElement.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        initialX = filmRect.left - canvasRect.left;
        initialY = filmRect.top - canvasRect.top;
      }
    }

    dragRef.current = {
      id: filmId,
      startX: clientX,
      startY: clientY,
      offsetX: initialX,
      offsetY: initialY,
    };

    setFilms(prev => prev.map(f =>
      f.id === filmId ? { ...f, isDragging: true, position: { x: initialX, y: initialY } } : f
    ));
  };

  // 拖拽移动
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = dragRef.current.offsetX + (clientX - dragRef.current.startX);
    const newY = dragRef.current.offsetY + (clientY - dragRef.current.startY);

    setFilms(prev => prev.map(f =>
      f.id === dragRef.current?.id
        ? { ...f, position: { x: newX, y: newY } }
        : f
    ));
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return;

    setFilms(prev => prev.map(f =>
      f.id === dragRef.current?.id ? { ...f, isDragging: false } : f
    ));

    dragRef.current = null;
  }, []);

  // 监听全局拖拽事件
  useEffect(() => {
    const hasDragging = films.some(f => f.isDragging);
    if (hasDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [films, handleDragMove, handleDragEnd]);

  // 删除胶片
  const deleteFilm = (id: string) => {
    setFilms(prev => prev.filter(f => f.id !== id));
  };

  // 保存历史记录
  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }, []);

  // 删除历史记录
  const deleteHistoryItem = (id: string) => {
    saveHistory(history.filter(item => item.id !== id));
    if (selectedHistoryItem?.id === id) {
      setSelectedHistoryItem(null);
    }
  };

  // 记录是否真正拖动过（用于区分点击和拖动）
  const hasDraggedRef = useRef(false);

  // 历史记录拖拽开始
  const handleHistoryDragStart = (e: React.MouseEvent | React.TouchEvent, itemId: string) => {
    const item = history.find(h => h.id === itemId);
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    historyDragRef.current = {
      id: itemId,
      startX: clientX,
      startY: clientY,
      offsetX: item.position.x,
      offsetY: item.position.y,
    };

    hasDraggedRef.current = false;
    setDraggingHistoryId(itemId);
  };

  // 历史记录拖拽移动
  const handleHistoryDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!historyDragRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // 检测是否真正移动了（超过5px认为是拖动）
    const dx = clientX - historyDragRef.current.startX;
    const dy = clientY - historyDragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasDraggedRef.current = true;
    }

    const newX = historyDragRef.current.offsetX + dx;
    const newY = historyDragRef.current.offsetY + dy;

    setHistory(prev => prev.map(h =>
      h.id === historyDragRef.current?.id
        ? { ...h, position: { x: newX, y: newY } }
        : h
    ));
  }, []);

  // 历史记录拖拽结束
  const handleHistoryDragEnd = useCallback(() => {
    if (!historyDragRef.current) return;

    // 保存位置到 localStorage
    setHistory(prev => {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(prev));
      return prev;
    });

    setDraggingHistoryId(null);
    historyDragRef.current = null;
  }, []);

  // 监听历史记录拖拽事件
  useEffect(() => {
    if (draggingHistoryId) {
      window.addEventListener('mousemove', handleHistoryDragMove);
      window.addEventListener('mouseup', handleHistoryDragEnd);
      window.addEventListener('touchmove', handleHistoryDragMove);
      window.addEventListener('touchend', handleHistoryDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleHistoryDragMove);
        window.removeEventListener('mouseup', handleHistoryDragEnd);
        window.removeEventListener('touchmove', handleHistoryDragMove);
        window.removeEventListener('touchend', handleHistoryDragEnd);
      };
    }
  }, [draggingHistoryId, handleHistoryDragMove, handleHistoryDragEnd]);

  // 保存设置
  const handleSaveSettings = () => {
    settingsManager.updateConfig({
      baseUrl: tempApiUrl.trim() || 'https://api.tu-zi.com/v1',
      apiKey: tempApiKey.trim(),
      modelName: tempModel,
      customPrompt: tempPrompt,
      templateId: tempTemplateId,
    } as any);
    setShowSettings(false);
  };

  // 切换模板
  const handleTemplateChange = (templateId: string) => {
    setTempTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTempPrompt(template.template);
    }
  };

  // 添加新模板
  const handleAddTemplate = () => {
    if (!newTemplateName.trim() || !tempPrompt.trim()) return;

    const newTemplate: PromptTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      template: tempPrompt,
      isBuiltIn: false,
    };

    const customTemplates = templates.filter(t => !t.isBuiltIn);
    const updatedCustomTemplates = [...customTemplates, newTemplate];

    // 保存到 localStorage
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedCustomTemplates));

    // 更新状态
    setTemplates([...BUILT_IN_TEMPLATES, ...updatedCustomTemplates]);
    setTempTemplateId(newTemplate.id);
    setNewTemplateName('');
    setShowAddTemplate(false);
  };

  // 删除模板
  const handleDeleteTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template || template.isBuiltIn) return;

    const customTemplates = templates.filter(t => !t.isBuiltIn && t.id !== templateId);

    // 保存到 localStorage
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));

    // 更新状态
    setTemplates([...BUILT_IN_TEMPLATES, ...customTemplates]);

    // 如果删除的是当前选中的模板，切换到默认模板
    if (tempTemplateId === templateId) {
      setTempTemplateId('realistic');
      setTempPrompt(DEFAULT_PROMPT_TEMPLATE);
    }
  };

  // 重置提示词
  const handleResetPrompt = () => {
    setTempTemplateId('realistic');
    setTempPrompt(DEFAULT_PROMPT_TEMPLATE);
  };

  return (
    <div className="app">
      {/* 顶部按钮 */}
      <div className="top-buttons">
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          SETTINGS
        </button>
        <button className="history-btn" onClick={() => setShowHistory(true)}>
          GALLERY
        </button>
      </div>

      {/* 主区域 - 画板背景 */}
      <main className="canvas-area" ref={canvasRef}>
        {/* 相机 */}
        <div className="camera-section">
          <div className="camera-wrapper">
            {/* 正在弹出的胶片（在相机图片下方，从顶部升起）- 只显示未拖拽的 */}
            {films.filter(f => (f.isEjecting || f.isGenerating || f.isDeveloping) && !f.isDragging).map((film) => (
              <div
                key={film.id}
                className="ejecting-film"
                style={{
                  transform: `translateY(${100 - film.ejectProgress}%)`,
                }}
                onMouseDown={(e) => handleDragStart(e, film.id)}
                onTouchStart={(e) => handleDragStart(e, film.id)}
              >
                <div className="film-image">
                  {/* 结果照片在底层 */}
                  {film.result && (
                    <div className="film-photo">
                      <img src={film.result} alt="照片" />
                    </div>
                  )}
                  {/* 黑色胶片在上层：没有结果时全黑，有结果后逐渐透明 */}
                  <div
                    className="film-black"
                    style={{ opacity: !film.result ? 1 : 1 - (film.developProgress / 100) }}
                  ></div>
                </div>
                <div className="film-info">
                  <span className="film-dream">{film.dream}</span>
                  <span className="film-date">{film.date}</span>
                </div>
              </div>
            ))}

            {/* 摄像头视频（在相机图片下方，透过镜头显示） */}
            <div className="camera-video-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />
              {!cameraReady && (
                <div className="camera-placeholder">📷</div>
              )}
            </div>

            {/* 相机图片 */}
            <img src="/camera.png" alt="相机" className="camera-image" />

            {/* 拍照按钮 - 右上角，模拟快门 */}
            <button
              className="camera-shutter"
              onClick={takePhoto}
              disabled={!!capturedPhoto}
              title="拍照"
            />

            {/* 上传按钮 - 底部出口位置，带箭头图标 */}
            <button
              className="camera-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!capturedPhoto || !!enteringPhoto}
              title="上传照片"
            >
              <span className="upload-arrow">↑</span>
            </button>

            {/* 正在进入相机的照片 */}
            {enteringPhoto && (
              <div className="entering-photo-container">
                <div
                  className="entering-photo"
                  style={{
                    transform: `translateY(${-enteringProgress}%)`,
                  }}
                >
                  <img src={enteringPhoto} alt="上传的照片" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 画板上拖拽中的胶片 */}
        {films.filter(f => f.isDragging).map((film) => {
          // 计算黑胶透明度：没有结果时全黑，有结果后逐渐透明
          const blackOpacity = !film.result ? 1 : 1 - (film.developProgress / 100);

          return (
            <div
              key={film.id}
              className="film-card dragging"
              style={{
                left: film.position.x,
                top: film.position.y,
              }}
              onMouseDown={(e) => handleDragStart(e, film.id)}
              onTouchStart={(e) => handleDragStart(e, film.id)}
            >
              <div className="film-image">
                {/* 结果照片在底层 */}
                {film.result && (
                  <div className="film-photo">
                    <img src={film.result} alt="照片" />
                  </div>
                )}
                {/* 黑色胶片在上层，逐渐变透明 */}
                {blackOpacity > 0 && (
                  <div
                    className="film-black"
                    style={{ opacity: blackOpacity }}
                  ></div>
                )}
              </div>
              <div className="film-info">
                <span className="film-dream">{film.dream}</span>
                <span className="film-date">{film.date}</span>
              </div>
            </div>
          );
        })}

        {/* 画板上的历史照片 */}
        {history.map((item) => (
          <div
            key={item.id}
            className={`film-card completed ${draggingHistoryId === item.id ? 'dragging' : ''}`}
            style={{
              left: item.position.x,
              top: item.position.y,
            }}
            onMouseDown={(e) => handleHistoryDragStart(e, item.id)}
            onTouchStart={(e) => handleHistoryDragStart(e, item.id)}
            onClick={() => {
              // 只有在没有拖动的情况下才打开详情
              if (!hasDraggedRef.current) {
                setSelectedHistoryItem(item);
              }
            }}
          >
            <div className="film-image">
              <img src={item.resultPhoto} alt={item.name} />
            </div>
            <div className="film-info">
              <span className="film-name">{item.name}</span>
              <span className="film-dream">{item.dream}</span>
            </div>
            <button
              className="film-delete"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                deleteHistoryItem(item.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
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

      {/* 拍照确认弹窗 */}
      {capturedPhoto && (
        <div className="polaroid-modal" onClick={cancelCapture}>
          <div className="polaroid-modal-content" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={cancelCapture}>✕</button>

            <div className="polaroid-preview">
              <img src={capturedPhoto} alt="照片" />
            </div>

            <div className="polaroid-form">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="输入姓名（可选）"
                className="input-name"
              />
              <textarea
                value={editDream}
                onChange={(e) => setEditDream(e.target.value)}
                placeholder="输入你的梦想..."
                className="input-dream"
                rows={2}
              />
              <div className="polaroid-actions">
                <button
                  className="btn-primary"
                  onClick={handleConfirmAndGenerate}
                  disabled={!editDream.trim()}
                >
                  确认并生成 ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录画廊 - 软木板风格 */}
      {showHistory && (
        <div className="gallery-overlay">
          <div className="gallery-container">
            {/* 返回按钮 */}
            <button className="gallery-back" onClick={() => setShowHistory(false)}>
              ← Back to Camera
            </button>

            {/* 标题区域 */}
            <div className="gallery-header">
              <div className="gallery-pin">📌</div>
              <h2>Public Pinboard Gallery</h2>
              <p className="gallery-subtitle">Shared memories from the Retro Camera community</p>
            </div>

            <div className="gallery-divider"></div>

            {history.length === 0 ? (
              <div className="gallery-empty">
                <span>🖼️</span>
                <p>还没有记录哦，快去拍照吧！</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {history.map((item, index) => {
                  // 随机旋转角度
                  const rotation = (index % 5 - 2) * 3;
                  return (
                    <div
                      key={item.id}
                      className="gallery-polaroid"
                      style={{ '--rotation': `${rotation}deg` } as React.CSSProperties}
                      onClick={() => setSelectedHistoryItem(item)}
                    >
                      <div className="gallery-polaroid-image">
                        <img src={item.resultPhoto} alt={item.name} />
                      </div>
                      <div className="gallery-polaroid-info">
                        <span className="gallery-polaroid-dream">{item.dream}</span>
                        <span className="gallery-polaroid-date">{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                      <button
                        className="gallery-polaroid-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-container" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>⚙️ 设置</h2>
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
              <div className="settings-field">
                <label>模型</label>
                <select
                  value={tempModel}
                  onChange={(e) => setTempModel(e.target.value)}
                  className="input-select"
                >
                  {IMAGE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-field">
                <label>风格模板</label>
                <div className="template-list">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`template-item ${tempTemplateId === template.id ? 'active' : ''}`}
                      onClick={() => handleTemplateChange(template.id)}
                    >
                      <span className="template-name">{template.name}</span>
                      {!template.isBuiltIn && (
                        <button
                          className="template-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(template.id);
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="template-add"
                    onClick={() => setShowAddTemplate(true)}
                  >
                    + 添加模板
                  </button>
                </div>
              </div>

              {showAddTemplate && (
                <div className="settings-field add-template-field">
                  <label>新模板名称</label>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="输入模板名称"
                    className="input-name"
                  />
                  <div className="add-template-actions">
                    <button className="btn-secondary" onClick={() => setShowAddTemplate(false)}>
                      取消
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleAddTemplate}
                      disabled={!newTemplateName.trim()}
                    >
                      保存为新模板
                    </button>
                  </div>
                </div>
              )}

              <div className="settings-field">
                <label>
                  提示词内容
                  <button className="btn-reset" onClick={handleResetPrompt}>重置</button>
                </label>
                <textarea
                  value={tempPrompt}
                  onChange={(e) => setTempPrompt(e.target.value)}
                  placeholder="输入提示词模板，使用 {dream} 作为梦想占位符"
                  className="input-prompt"
                  rows={6}
                />
                <p className="settings-hint">
                  使用 <code>{'{dream}'}</code> 作为用户输入梦想的占位符。编辑后点击"添加模板"可保存为新模板。
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={handleSaveSettings}
              >
                保存设置
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
