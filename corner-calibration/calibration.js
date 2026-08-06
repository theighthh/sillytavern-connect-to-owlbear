// corner-calibration/calibration.js
// 四角标定核心逻辑

import OBR from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

const CALIBRATION_KEY = 'mapCalibration';
const CORNER_NAMES = ['左上角', '右上角', '右下角', '左下角'];
const GRID_SIZE = 150;

let state = {
    isActive: false,
    currentStep: 0,
    corners: [],
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

// ======================= 等待 OBR 就绪 =======================

async function waitForOBR() {
    if (OBR && OBR.scene) {
        console.log('[Calibration] OBR 已就绪');
        return;
    }

    return new Promise((resolve) => {
        if (OBR && OBR.onReady) {
            OBR.onReady(() => {
                console.log('[Calibration] OBR.onReady 触发');
                resolve();
            });
        } else {
            const interval = setInterval(() => {
                if (OBR && OBR.scene) {
                    clearInterval(interval);
                    resolve();
                }
            }, 300);
            setTimeout(() => {
                clearInterval(interval);
                resolve();
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

    await waitForOBR();

    if (!OBR || !OBR.scene) {
        const errMsg = 'OBR 未就绪，请刷新页面后重试';
        console.error('[Calibration]', errMsg);
        if (callbacks.onError) callbacks.onError(errMsg);
        return;
    }

    const existing = await getCalibrationData();
    if (existing) console.log('[Calibration] 已有标定数据，将覆盖');

    const items = await OBR.scene.items.getItems();
    state.initialCount = items.length;
    state.corners = [];
    state.currentStep = 0;
    state.isActive = true;
    state.isComplete = false;

    console.log('[Calibration] 🎯 开始标定流程');
    if (callbacks.onStepChange) callbacks.onStepChange(0, CORNER_NAMES[0]);

    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(checkForNewCorner, 800);

    setTimeout(() => {
        if (state.isActive && !state.isComplete) {
            console.warn('[Calibration] ⏰ 标定超时，自动取消');
            stopCalibration();
            if (callbacks.onError) callbacks.onError('标定超时（60秒），请重试');
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
    if (callbacks.onCancel) callbacks.onCancel();
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
        await waitForOBR();
        if (!OBR || !OBR.scene) return null;
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
        const newItems = items.filter(item =>
            item.type === 'IMAGE' &&
            item.layer === 'CHARACTER' &&
            !item.metadata?._isCorner &&
            !item.metadata?._fromExtension
        );

        if (newItems.length > state.initialCount) {
            const latest = newItems[newItems.length - 1];
            console.log(`[Calibration] 检测到新 Character: (${latest.position.x}, ${latest.position.y})`);

            state.corners.push({
                id: latest.id,
                x: latest.position.x,
                y: latest.position.y,
            });

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
            }

            state.initialCount = items.length;
            state.currentStep++;

            if (state.corners.length >= 4) {
                await completeCalibration();
            } else {
                if (callbacks.onStepChange) {
                    callbacks.onStepChange(state.currentStep, CORNER_NAMES[state.currentStep]);
                }
            }
        }
    } catch (e) {
        console.error('[Calibration] 检测异常:', e);
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

    const sorted = [...state.corners].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
        return a.x - b.x;
    });

    const topRow = sorted.filter(c => Math.abs(c.y - sorted[0].y) < 10);
    const bottomRow = sorted.filter(c => Math.abs(c.y - sorted[sorted.length - 1].y) < 10);

    const tl = topRow.reduce((a, b) => a.x < b.x ? a : b);
    const tr = topRow.reduce((a, b) => a.x > b.x ? a : b);
    const bl = bottomRow.reduce((a, b) => a.x < b.x ? a : b);
    const br = bottomRow.reduce((a, b) => a.x > b.x ? a : b);

    const corners = [tl, tr, br, bl];

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

    try {
        await OBR.scene.setMetadata({ [CALIBRATION_KEY]: calibration });
        console.log('[Calibration] 💾 标定数据已保存');
    } catch (e) {
        console.error('[Calibration] ❌ 保存失败:', e);
        if (callbacks.onError) callbacks.onError('保存标定数据失败: ' + e.message);
        return;
    }

    const cornerIds = state.corners.map(c => c.id);
    try {
        await OBR.scene.items.deleteItems(cornerIds);
        console.log('[Calibration] 🗑️ 已删除四个角标');
    } catch (e) {
        console.warn('[Calibration] ⚠️ 删除角标失败:', e);
    }

    if (callbacks.onComplete) callbacks.onComplete(calibration);
    state.corners = [];
    console.log('[Calibration] ✅ 标定完成！');
}

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
