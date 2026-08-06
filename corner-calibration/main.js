// 0.2.0/main.js
import {
    startCalibration,
    stopCalibration,
    getStatus,
    getCalibrationData,
    setCallbacks,
    hasCalibration
} from './calibration.js';

// ======================= DOM 引用 =======================

const $ = (id) => document.getElementById(id);
const dot = $('statusDot');
const statusText = $('statusText');
const statusDetail = $('statusDetail');
const btnStart = $('btnStart');
const btnCancel = $('btnCancel');
const btnReset = $('btnReset');
const stepTitle = $('stepTitle');
const stepMessage = $('stepMessage');
const stepSub = $('stepSub');
const progressDots = document.querySelectorAll('.progress-dot');
const resultBox = $('resultBox');
const resultDetail = $('resultDetail');
const errorBox = $('errorBox');
const errorDetail = $('errorDetail');

// ======================= UI 更新函数 =======================

function updateUI(state) {
    // 状态点
    dot.className = 'status-dot';
    if (state.status === 'idle') {
        dot.classList.add('ready');
        statusText.textContent = '就绪';
    } else if (state.status === 'active') {
        dot.classList.add('active');
        statusText.textContent = '标定中...';
    } else if (state.status === 'done') {
        dot.classList.add('done');
        statusText.textContent = '已标定 ✅';
    } else if (state.status === 'error') {
        dot.classList.add('error');
        statusText.textContent = '错误 ❌';
    }

    // 状态详情
    statusDetail.textContent = state.detail || '';

    // 按钮
    if (state.status === 'active') {
        btnStart.disabled = true;
        btnStart.textContent = '⏳ 标定中...';
        btnCancel.classList.remove('hidden');
    } else {
        btnStart.disabled = false;
        btnStart.textContent = state.status === 'done' ? '🔄 重新标定' : '📍 开始标定地图';
        btnCancel.classList.add('hidden');
    }

    // 步骤提示
    if (state.status === 'active' && state.step !== undefined) {
        stepTitle.textContent = `第 ${state.step + 1}/4 步`;
        stepMessage.textContent = `请将 Character 放置在地图的 ${state.cornerName}`;
        stepSub.textContent = `当前进度: ${state.step + 1}/4`;
    } else if (state.status === 'done') {
        stepTitle.textContent = '✅ 标定完成';
        stepMessage.textContent = '地图已成功校准！';
        stepSub.textContent = `网格: ${state.cols || '?'} 列 × ${state.rows || '?'} 行`;
    } else if (state.status === 'error') {
        stepTitle.textContent = '❌ 标定失败';
        stepMessage.textContent = state.errorMessage || '发生错误，请重试';
        stepSub.textContent = '';
    } else {
        stepTitle.textContent = '等待操作';
        stepMessage.textContent = '点击按钮开始标定';
        stepSub.textContent = '';
    }

    // 进度点
    const current = state.step ?? -1;
    progressDots.forEach((dotEl, idx) => {
        dotEl.className = 'progress-dot';
        if (idx < current) dotEl.classList.add('done');
        else if (idx === current && state.status === 'active') dotEl.classList.add('active');
    });

    // 结果框
    if (state.status === 'done') {
        resultBox.classList.add('show');
        resultDetail.textContent = `网格: ${state.cols || '?'} 列 × ${state.rows || '?'} 行，网格大小: ${state.gridSize || '?'}px`;
    } else {
        resultBox.classList.remove('show');
    }

    // 错误框
    if (state.status === 'error') {
        errorBox.classList.add('show');
        errorDetail.textContent = state.errorMessage || '未知错误';
    } else {
        errorBox.classList.remove('show');
    }
}

// ======================= 初始化状态 =======================

let currentState = { status: 'idle', step: -1, cornerName: '' };

// ======================= 设置回调 =======================

setCallbacks({
    onStepChange: (step, cornerName) => {
        currentState = {
            status: 'active',
            step: step,
            cornerName: cornerName,
            detail: `第 ${step + 1}/4 步`
        };
        updateUI(currentState);
    },
    onComplete: (calibration) => {
        currentState = {
            status: 'done',
            step: 4,
            detail: '标定完成',
            cols: calibration.cols,
            rows: calibration.rows,
            gridSize: calibration.gridSize
        };
        updateUI(currentState);
        // 重新检查状态
        checkInitialStatus();
    },
    onError: (message) => {
        currentState = {
            status: 'error',
            errorMessage: message,
            detail: '错误'
        };
        updateUI(currentState);
        // 5 秒后自动重置
        setTimeout(() => {
            if (currentState.status === 'error') {
                resetToIdle();
            }
        }, 5000);
    },
    onCancel: () => {
        resetToIdle();
    }
});

// ======================= 重置函数 =======================

function resetToIdle() {
    currentState = { status: 'idle', step: -1, cornerName: '', detail: '' };
    updateUI(currentState);
    // 检查是否已有标定
    checkInitialStatus();
}

// ======================= 检查初始状态 =======================

async function checkInitialStatus() {
    try {
        const has = await hasCalibration();
        if (has && currentState.status !== 'done') {
            const data = await getCalibrationData();
            if (data) {
                currentState = {
                    status: 'done',
                    step: 4,
                    detail: '已标定',
                    cols: data.cols,
                    rows: data.rows,
                    gridSize: data.gridSize
                };
                updateUI(currentState);
                console.log('[Terrain] 已检测到标定数据:', data);
            }
        }
    } catch (e) {
        console.warn('[Terrain] 检查标定状态失败:', e);
    }
}

// ======================= 事件绑定 =======================

btnStart.addEventListener('click', async () => {
    // 如果已有标定，先清除（重新标定）
    if (currentState.status === 'done') {
        // 允许重新标定，直接启动
    }
    try {
        await startCalibration();
        // 状态会通过回调更新
    } catch (e) {
        console.error('[Terrain] 启动标定失败:', e);
        currentState = {
            status: 'error',
            errorMessage: e.message || '启动失败',
            detail: '错误'
        };
        updateUI(currentState);
    }
});

btnCancel.addEventListener('click', () => {
    stopCalibration();
    resetToIdle();
});

btnReset.addEventListener('click', () => {
    if (currentState.status === 'active') {
        stopCalibration();
    }
    resetToIdle();
});

// ======================= 初始化 =======================

// 等待 OBR 就绪（如果全局可用）
if (typeof OBR !== 'undefined' && OBR.onReady) {
    OBR.onReady(() => {
        console.log('[Terrain] OBR 已就绪');
        checkInitialStatus();
    });
} else {
    // 如果是独立测试，延迟检查
    setTimeout(checkInitialStatus, 1000);
}

console.log('[Terrain] 地形分析器 UI 已加载');