// corner-calibration/calibration.js
// 四角标定核心逻辑 - 修复 height 负数问题 + 发送标定数据到 server.js

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

function getOBR() {
    if (typeof window.__OBR !== 'undefined') return window.__OBR;
    if (typeof OBR !== 'undefined') return OBR;
    return null;
}

async function waitForOBR() {
    const obr = getOBR();
    if (obr && obr.scene) return obr;
    return new Promise((resolve) => {
        const check = () => {
            const o = getOBR();
            if (o && o.scene) {
                console.log('[Calibration] OBR 就绪');
                resolve(o);
            } else {
                setTimeout(check, 300);
            }
        };
        check();
        setTimeout(() => {
            console.warn('[Calibration] OBR 就绪超时');
            resolve(null);
        }, 10000);
    });
}

export function setCallbacks(cb) {
    callbacks = { ...callbacks, ...cb };
}

export async function startCalibration() {
    if (state.isActive) {
        console.warn('[Calibration] 标定已在进行中');
        return;
    }

    const obr = await waitForOBR();
    if (!obr || !obr.scene) {
        const errMsg = 'OBR 未就绪，请刷新页面后重试';
        console.error('[Calibration]', errMsg);
        if (callbacks.onError) callbacks.onError(errMsg);
        return;
    }

    const existing = await getCalibrationData();
    if (existing) console.log('[Calibration] 已有标定数据，将覆盖');

    const allItems = await obr.scene.items.getItems();
    const initialChars = allItems.filter(item =>
        item.type === 'IMAGE' &&
        item.layer === 'CHARACTER'
    );
    state.initialCount = initialChars.length;
    console.log(`[Calibration] 初始 Character 数量: ${state.initialCount}`);

    state.corners = [];
    state.currentStep = 0;
    state.isActive = true;
    state.isComplete = false;

    console.log('[Calibration] 🎯 开始标定流程');
    if (callbacks.onStepChange) callbacks.onStepChange(0, CORNER_NAMES[0]);

    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => checkForNewCorner(obr), 800);

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
        const obr = await waitForOBR();
        if (!obr || !obr.scene) return null;
        const metadata = await obr.scene.getMetadata();
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

async function checkForNewCorner(obr) {
    if (!state.isActive || state.isComplete) return;
    if (!obr) {
        obr = getOBR();
        if (!obr) return;
    }

    try {
        const items = await obr.scene.items.getItems();
        const newItems = items.filter(item =>
            item.type === 'IMAGE' &&
            item.layer === 'CHARACTER' &&
            !item.metadata?._isCorner &&
            !item.metadata?._fromExtension
        );

        if (newItems.length > state.initialCount) {
            const latest = newItems[newItems.length - 1];
            console.log(`[Calibration] ✅ 检测到新 Character: (${latest.position.x}, ${latest.position.y})`);

            state.corners.push({
                id: latest.id,
                x: latest.position.x,
                y: latest.position.y,
            });

            try {
                await obr.scene.items.updateItems([latest.id], (draft) => {
                    draft.metadata = {
                        ...draft.metadata,
                        _isCorner: true,
                        _cornerStep: state.currentStep,
                    };
                });
            } catch (e) {
                console.warn('[Calibration] 标记角标失败:', e);
            }

            const currentChars = items.filter(item =>
                item.type === 'IMAGE' &&
                item.layer === 'CHARACTER'
            );
            state.initialCount = currentChars.length;
            state.currentStep++;

            if (state.corners.length >= 4) {
                await completeCalibration(obr);
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

// ===== 发送标定数据到 server.js（通过 WebSocket） =====
async function sendCalibrationToServer(calibrationData) {
    try {
        // 尝试使用全局 WebSocket 连接
        const ws = window.ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'calibration_update',
                payload: calibrationData
            }));
            console.log('[Calibration] 📤 标定数据已通过 WebSocket 发送到 server.js');
        } else {
            console.warn('[Calibration] ⚠️ WebSocket 未连接，标定数据未发送');
        }
    } catch (e) {
        console.warn('[Calibration] 发送标定数据失败:', e);
    }
}

// ===== 完整的标定完成函数 =====
async function completeCalibration(obr) {
    console.log('[Calibration] ✅ 四个角标已收集完毕');
    state.isActive = false;
    state.isComplete = true;

    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }

    // 按 y 升序排序（上→下）
    const sortedByY = [...state.corners].sort((a, b) => a.y - b.y);

    const topRow = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottomRow = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);

    const tl = topRow[0];
    const tr = topRow[1];
    const bl = bottomRow[0];
    const br = bottomRow[1];

    const originX = tl.x;
    const originY = tl.y;
    const width = tr.x - tl.x;
    const height = Math.abs(tl.y - bl.y);

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
        await obr.scene.setMetadata({ [CALIBRATION_KEY]: calibration });
        console.log('[Calibration] 💾 标定数据已保存到场景 metadata');
    } catch (e) {
        console.error('[Calibration] ❌ 保存失败:', e);
        if (callbacks.onError) callbacks.onError('保存标定数据失败: ' + e.message);
        return;
    }

    // 🔥 通过 WebSocket 发送到 server.js
    await sendCalibrationToServer(calibration);

    const cornerIds = state.corners.map(c => c.id);
    try {
        await obr.scene.items.deleteItems(cornerIds);
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
    state.initialCount = 0;
    console.log('[Calibration] 🔄 已重置');
}

if (typeof window !== 'undefined') {
    window.__calibration = {
        start: startCalibration,
        stop: stopCalibration,
        reset: resetCalibration,
        getStatus,
        getData: getCalibrationData,
        has: hasCalibration,
        setCallbacks,
        state: state,
    };
}
