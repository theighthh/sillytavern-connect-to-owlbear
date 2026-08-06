// corner-calibration/calibration.js
// 四角标定核心逻辑（已修复 OBR 就绪问题）

const CALIBRATION_KEY = 'mapCalibration';
const CORNER_NAMES = ['左上角', '右上角', '右下角', '左下角'];
const GRID_SIZE = 150; // 固定网格大小

// ======================= 状态 =======================

let state = {
    isActive: false,
    currentStep: 0, // 0-3
    corners: [], // [{id, x, y}]
    intervalId: null,
    initialCount: 0,
    isComplete: false,
};

let callbacks = {
    onStepChange: null,
    onComplete: null,
    onError: null,
    onCancel: null,
};

let obrReady = false;

// ======================= 辅助函数：等待 OBR 就绪 =======================

async function waitForOBR() {
    if (obrReady && typeof OBR !== 'undefined' && OBR.scene) {
        return;
    }

    return new Promise((resolve) => {
        // 如果 OBR 已经存在且场景可用
        if (typeof OBR !== 'undefined' && OBR.scene) {
            obrReady = true;
            resolve();
            return;
        }

        // 使用 OBR.onReady（官方推荐）
        if (typeof OBR !== 'undefined' && OBR.onReady) {
            OBR.onReady(() => {
                obrReady = true;
                resolve();
            });
        } else {
            // 兜底：轮询检查
            const interval = setInterval(() => {
                if (typeof OBR !== 'undefined' && OBR.scene) {
                    clearInterval(interval);
                    obrReady = true;
                    resolve();
                }
            }, 300);
            // 超时保护（10 秒）
            setTimeout(() => {
                clearInterval(interval);
                if (!obrReady) {
                    console.warn('[Calibration] OBR 就绪超时，请刷新页面');
                    resolve(); // 即使超时也继续，让后续错误处理
                }
            }, 10000);
        }
    });
}

// ======================= 公共 API =======================

export function setCallbacks(cb) {
    callbacks = { ...callbacks, ...cb };
}

export async function startCalibration() {
    if (state.isActive) {
        console.warn('[Calibration] 标定已在进行中');
        return;
    }

    // 🔥 关键修复：等待 OBR 就绪
    await waitForOBR();

    // 再次检查 OBR 是否可用
    if (typeof OBR === 'undefined' || !OBR.scene) {
        const errMsg = 'OBR 未就绪，请刷新页面后重试';
        console.error('[Calibration]', errMsg);
        if (callbacks.onError) {
            callbacks.onError(errMsg);
        }
        return;
    }

    // 检查是否已有旧标定
    const existing = await getCalibrationData();
    if (existing) {
        console.log('[Calibration] 已有标定数据，将覆盖');
    }

    // 获取当前场景物品
    const items = await OBR.scene.items.getItems();
    state.initialCount = items.length;
    state.corners = [];
    state.currentStep = 0;
    state.isActive = true;
    state.isComplete = false;

    console.log('[Calibration] 🎯 开始标定流程');

    // 触发第一步回调
    if (callbacks.onStepChange) {
        callbacks.onStepChange(0, CORNER_NAMES[0]);
    }

    // 启动检测循环（每 800ms 检测一次）
    if (state.intervalId) {
        clearInterval(state.intervalId);
    }
    state.intervalId = setInterval(checkForNewCorner, 800);

    // 超时保护：60 秒后自动取消
    setTimeout(() => {
        if (state.isActive && !state.isComplete) {
            console.warn('[Calibration] ⏰ 标定超时，自动取消');
            stopCalibration();
            if (callbacks.onError) {
                callbacks.onError('标定超时（60秒），请重试');
            }
        }
    }, 60000);
}

export function stopCalibration() {
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
    state.isActive = false;
    console.log('[Calibration] ⏹️ 标定已取消');
    if (callbacks.onCancel) {
        callbacks.onCancel();
    }
}

export function getStatus() {
    return {
        isActive: state.isActive,
        currentStep: state.currentStep,
        corners: state.corners.length,
        isComplete: state.isComplete,
    };
}

export async function getCalibrationData() {
    try {
        // 先等待 OBR 就绪
        await waitForOBR();
        if (typeof OBR === 'undefined' || !OBR.scene) {
            return null;
        }
        const metadata = await OBR.scene.getMetadata();
        return metadata[CALIBRATION_KEY] || null;
    } catch (e) {
        console.warn('[Calibration] 读取标定数据失败:', e);
        return null;
    }
}

export async function hasCalibration() {
    const data = await getCalibrationData();
    return data !== null;
}

// ======================= 内部函数 =======================

async function checkForNewCorner() {
    if (!state.isActive || state.isComplete) return;

    try {
        const items = await OBR.scene.items.getItems();

        // 查找新增的 Character（排除已有 _isCorner 标记的）
        const newItems = items.filter(item =>
            item.type === 'IMAGE' &&
            item.layer === 'CHARACTER' &&
            !item.metadata?._isCorner &&
            !item.metadata?._fromExtension // 排除扩展生成的
        );

        // 如果新增数量大于初始数量，说明用户放置了新的 Character
        if (newItems.length > state.initialCount) {
            // 取最新的那个（用户刚放置的）
            const latest = newItems[newItems.length - 1];

            console.log(`[Calibration] 检测到新 Character: (${latest.position.x}, ${latest.position.y})`);

            // 记录坐标
            state.corners.push({
                id: latest.id,
                x: latest.position.x,
                y: latest.position.y,
            });

            // 标记为角标，防止后续干扰
            try {
                await OBR.scene.items.updateItems([latest.id], (draft) => {
                    draft.metadata = {
                        ...draft.metadata,
                        _isCorner: true,
                        _cornerStep: state.currentStep,
                    };
                });
            } catch (e) {
                console.warn('[Calibration] 标记角标失败:', e);
                // 继续执行，不阻塞
            }

            // 更新初始数量，防止重复检测
            state.initialCount = items.length;
            state.currentStep++;

            // 检查是否四个角都已收集
            if (state.corners.length >= 4) {
                await completeCalibration();
            } else {
                // 通知下一步
                if (callbacks.onStepChange) {
                    callbacks.onStepChange(state.currentStep, CORNER_NAMES[state.currentStep]);
                }
            }
        }
    } catch (e) {
        console.error('[Calibration] 检测异常:', e);
        // 如果出现异常，可以尝试继续，但记录错误
        if (callbacks.onError) {
            callbacks.onError('检测过程发生错误: ' + e.message);
        }
    }
}

async function completeCalibration() {
    console.log('[Calibration] ✅ 四个角标已收集完毕');
    state.isActive = false;
    state.isComplete = true;

    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }

    // 排序：按 y 升序（上→下），再按 x 升序（左→右）
    const sorted = [...state.corners].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 10) {
            return a.y - b.y;
        }
        return a.x - b.x;
    });

    // 提取四个角
    // 左上：y 最小，x 最小
    const topRow = sorted.filter(c => Math.abs(c.y - sorted[0].y) < 10);
    const bottomRow = sorted.filter(c => Math.abs(c.y - sorted[sorted.length - 1].y) < 10);

    const tl = topRow.reduce((a, b) => a.x < b.x ? a : b);
    const tr = topRow.reduce((a, b) => a.x > b.x ? a : b);
    const bl = bottomRow.reduce((a, b) => a.x < b.x ? a : b);
    const br = bottomRow.reduce((a, b) => a.x > b.x ? a : b);

    const corners = [tl, tr, br, bl];

    // 提取坐标
    const originX = tl.x;
    const originY = tl.y;
    const width = tr.x - tl.x;
    const height = tl.y - bl.y;

    const cols = Math.round(width / GRID_SIZE) + 1;
    const rows = Math.round(height / GRID_SIZE) + 1;

    const calibration = {
        originX,
        originY,
        width,
        height,
        gridSize: GRID_SIZE,
        cols,
        rows,
        topLeft: { x: tl.x, y: tl.y },
        topRight: { x: tr.x, y: tr.y },
        bottomRight: { x: br.x, y: br.y },
        bottomLeft: { x: bl.x, y: bl.y },
        timestamp: Date.now(),
    };

    console.log('[Calibration] 📐 标定数据:', calibration);

    // 保存到场景 metadata
    try {
        await OBR.scene.setMetadata({
            [CALIBRATION_KEY]: calibration,
        });
        console.log('[Calibration] 💾 标定数据已保存');
    } catch (e) {
        console.error('[Calibration] ❌ 保存失败:', e);
        if (callbacks.onError) {
            callbacks.onError('保存标定数据失败: ' + e.message);
        }
        return;
    }

    // 删除四个角标
    const cornerIds = state.corners.map(c => c.id);
    try {
        await OBR.scene.items.deleteItems(cornerIds);
        console.log('[Calibration] 🗑️ 已删除四个角标');
    } catch (e) {
        console.warn('[Calibration] ⚠️ 删除角标失败:', e);
        // 不阻塞主流程
    }

    // 通知完成
    if (callbacks.onComplete) {
        callbacks.onComplete(calibration);
    }

    // 清空状态
    state.corners = [];
    console.log('[Calibration] ✅ 标定完成！');
}

// ======================= 清理 =======================

export function resetCalibration() {
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
    state.isActive = false;
    state.isComplete = false;
    state.corners = [];
    state.currentStep = 0;
    console.log('[Calibration] 🔄 已重置');
}

// ======================= 调试工具 =======================

// 暴露到全局方便调试（只在开发环境）
if (typeof window !== 'undefined') {
    window.__calibration = {
        start: startCalibration,
        stop: stopCalibration,
        reset: resetCalibration,
        getStatus,
        getData: getCalibrationData,
        has: hasCalibration,
        setCallbacks,
    };
}
