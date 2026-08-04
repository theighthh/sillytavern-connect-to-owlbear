import OBR, { buildShape } from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

const SERVER_URL = "https://mengfanrui.jijihenda.cloud";
let lastData = null;
let isRendering = false;

// ============== 直接返回 OBR.scene ==============
async function getScene() {
    return OBR.scene;
}

// ============== 等待场景就绪（双重校验） ==============
async function waitForScene(maxAttempts = 30, interval = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        if (!OBR.scene.isReady) {
            console.log(`[MapRenderer] ⏳ 场景未就绪 (${i+1}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, interval));
            continue;
        }
        console.log('[MapRenderer] ✅ 场景已就绪');
        return OBR.scene;
    }
    throw new Error('场景加载超时，请刷新页面或重新打开场景');
}

// ============== fetchMap ==============
async function fetchMap() {
    if (isRendering) return;
    try {
        const res = await fetch(SERVER_URL + '/get-map');
        if (!res.ok) return;
        const data = await res.json();
        if (Object.keys(data).length === 0) return;
        if (JSON.stringify(data) === JSON.stringify(lastData)) return;
        lastData = data;
        if (data && data.background) {
            console.log('[MapRenderer] 收到地图更新:', data);
            await renderMap(data);
            console.log('[MapRenderer] ✅ 地图渲染成功！');
        }
    } catch (e) {
        console.error('[MapRenderer] fetch 错误:', e);
    }
}

// ============== renderMap（使用 buildShape） ==============
async function renderMap(mapData) {
    if (isRendering) return;
    isRendering = true;
    try {
        // 检查场景就绪
        if (!OBR.scene.isReady) {
            console.warn('[MapRenderer] 场景未就绪，放弃本次渲染');
            isRendering = false;
            return;
        }
        console.log('[MapRenderer] 场景引擎已就绪');

        // 清除旧标记（只清除扩展创建的）
        const items = await OBR.scene.items.getItems();
        const tokenItems = items.filter(item => item.metadata && item.metadata._fromExtension === true);
        for (const item of tokenItems) {
            await OBR.scene.items.deleteItems([item.id]);
        }

        if (mapData.tokens && mapData.tokens.length > 0) {
            for (const token of mapData.tokens) {
                // 根据类型选择颜色
                let fillColor = "#4A90D9"; // 默认蓝色
                if (token.type === "player") fillColor = "#2ECC71";
                else if (token.type === "enemy") fillColor = "#E74C3C";
                else if (token.type === "npc") fillColor = "#F1C40F";

                // 🔥 使用官方 Builder 构造标记对象（格式完全合规）
                const tokenItem = buildShape()
                    .shapeType("CIRCLE")
                    .width(40)
                    .height(40)
                    .position({ x: token.x * 50, y: token.y * 50 })
                    .style({
                        fillColor: fillColor,
                        strokeColor: "#000000",
                        strokeWidth: 2,
                    })
                    .metadata({
                        name: token.name,
                        type: token.type,
                        _fromExtension: true
                    })
                    .build();

                // 添加到场景
                await OBR.scene.items.addItems([tokenItem]);
            }
            console.log(`[MapRenderer] 已放置 ${mapData.tokens.length} 个标记`);
            console.log('[MapRenderer] ✅ 标记已全部放置完成！');
        } else {
            console.warn('[MapRenderer] 没有 tokens 数据');
        }
    } catch (error) {
        console.error("[MapRenderer] 渲染失败:", error);
        console.error("[MapRenderer] 错误名称:", error.name);
        console.error("[MapRenderer] 错误消息:", error.message);
        if (error.details) {
            console.error("[MapRenderer] 错误详情:", JSON.stringify(error.details, null, 2));
        }
    } finally {
        isRendering = false;
    }
}

// ============== 主入口 ==============
OBR.onReady(async () => {
    console.log("[MapRenderer] 🚀 Owlbear Rodeo 扩展已加载");
    console.log("[MapRenderer] 🌐 目标服务器:", SERVER_URL);

    try {
        await waitForScene(30, 1000);
        console.log("[MapRenderer] ✅ 场景已就绪，开始轮询（间隔5秒）");
        await fetchMap(); // 立即执行一次
        setInterval(fetchMap, 5000);
    } catch (error) {
        console.error("[MapRenderer] ❌", error.message);
        console.warn("[MapRenderer] 💡 请尝试：");
        console.warn("[MapRenderer]    1. 刷新浏览器页面（Ctrl+F5）");
        console.warn("[MapRenderer]    2. 在 Owlbear 中关闭并重新打开场景");
        console.warn("[MapRenderer]    3. 重新安装扩展");
    }
});
