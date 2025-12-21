/**
 * IndexedDB 图片存储服务
 * 用于持久化存储生成的图片，避免 CDN URL 过期问题
 */

const DB_NAME = 'dream-dress-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 获取数据库连接
 */
function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB 打开失败:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
}

/**
 * 从 URL 下载图片并转为 Blob
 */
async function fetchImageAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`);
  }
  return response.blob();
}

/**
 * 保存图片到 IndexedDB
 * @param id 图片唯一标识（使用 historyItem.id）
 * @param imageUrl CDN 图片 URL
 * @returns 成功返回 true
 */
export async function saveImage(id: string, imageUrl: string): Promise<boolean> {
  try {
    // 如果已经是 blob URL 或 data URL，先转换
    let blob: Blob;
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      const response = await fetch(imageUrl);
      blob = await response.blob();
    } else {
      blob = await fetchImageAsBlob(imageUrl);
    }

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('保存图片失败:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('保存图片到 IndexedDB 失败:', error);
    return false;
  }
}

/**
 * 从 IndexedDB 获取图片
 * @param id 图片唯一标识
 * @returns Blob URL 或 null
 */
export async function getImage(id: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const blob = request.result as Blob | undefined;
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error('获取图片失败:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('从 IndexedDB 获取图片失败:', error);
    return null;
  }
}

/**
 * 删除图片
 * @param id 图片唯一标识
 */
export async function deleteImage(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('删除图片失败:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('从 IndexedDB 删除图片失败:', error);
    return false;
  }
}

/**
 * 获取所有图片（用于导出）
 * @returns { id: base64 } 格式的对象
 */
export async function getAllImagesAsBase64(): Promise<Record<string, string>> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const result: Record<string, string> = {};

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const blob = cursor.value as Blob;
          const reader = new FileReader();
          reader.onloadend = () => {
            result[cursor.key as string] = reader.result as string;
            cursor.continue();
          };
          reader.readAsDataURL(blob);
        } else {
          // 等待所有 FileReader 完成
          setTimeout(() => resolve(result), 100);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('导出图片失败:', error);
    return {};
  }
}

/**
 * 从 base64 数据导入图片
 * @param images { id: base64 } 格式的对象
 */
export async function importImagesFromBase64(images: Record<string, string>): Promise<void> {
  const db = await getDB();

  for (const [id, base64] of Object.entries(images)) {
    try {
      // base64 转 Blob
      const response = await fetch(base64);
      const blob = await response.blob();

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(blob, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`导入图片 ${id} 失败:`, error);
    }
  }
}

/**
 * 清空所有图片
 */
export async function clearAllImages(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('清空图片失败:', error);
  }
}

/**
 * 获取存储使用情况
 */
export async function getStorageInfo(): Promise<{ count: number; estimatedSize: string }> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        // 估算大小（每张图片约 200KB）
        const estimatedBytes = count * 200 * 1024;
        const estimatedSize = estimatedBytes < 1024 * 1024
          ? `${(estimatedBytes / 1024).toFixed(1)} KB`
          : `${(estimatedBytes / 1024 / 1024).toFixed(1)} MB`;
        resolve({ count, estimatedSize });
      };
    });
  } catch (error) {
    return { count: 0, estimatedSize: '0 KB' };
  }
}
