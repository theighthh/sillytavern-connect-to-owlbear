import OBR from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

const SERVER_URL = "https://mengfanrui.jijihenda.cloud";
let lastData = null;
let isRendering = false;
let fetchCount = 0;

async function fetchMap() {
    fetchCount++;
    console.log(`[MapRenderer] 🔄 第 ${fetchCount} 次轮询开始`);
    
    if (isRendering) {
        console.log('[MapRenderer] ⏳ 正在渲染中，跳过本次轮询');
        return;
    }
    
    try {
        const url = SERVER_URL + '/get-map';
        console.log('[MapRenderer] 📡 请求地址:', url);
        
        const res = await fetch(url);
        console.log('[MapRenderer] 📥 响应状态:', res.status);
        
        if (!res.ok) {
            console.warn('[MapRenderer] ⚠️ 响应异常:', res.status);
            return;
        }
        
        const data = await res.json();
        console.log('[MapRenderer] 📦 原始数据:', JSON.stringify(data));
        
        // 检查数据是否为空
        if (Object.keys(data).length === 0) {
            console.log('[MapRenderer] 📭 数据为空，跳过渲染');
            return;
        }
        
        // 检查数据是否变化
        const dataStr = JSON.stringify(data);
        const lastStr = JSON.stringify(lastData);
        console.log('[MapRenderer] 🔍 数据是否变化:', dataStr !== lastStr);
        
        if (dataStr === lastStr) {
            console.log('[MapRenderer] 📌 数据无变化，跳过渲染');
            return;
        }
        
        lastData = data;
        console.log('[MapRenderer] ✅ 数据已更新，准备渲染...');
        
        if (data && data.background) {
            console.log('[MapRenderer] 🎨 开始渲染地图:', data.background.substring(0, 30) + '...');
            await renderMap(data);
            console.log('[MapRenderer] ✅ 地图渲染成功！');
        } else {
            console.warn('[MapRenderer] ⚠️ 数据缺少 background 字段');
        }
    } catch (e) {
        console.error('[MapRenderer] ❌ fetch 错误:', e);
        console.error('[MapRenderer] 错误详情:', e.message);
    }
}

async function renderMap(mapData) {
    if (isRendering) {
        console.log('[MapRenderer] ⏳ 渲染中，跳过');
        return;
    }
    isRendering = true;
    console.log('[MapRenderer] 🔒 开始渲染，锁定渲染状态');
    
    try {
        // 检查场景引擎是否就绪
        console.log('[MapRenderer] 🔍 检查场景引擎...');
        let sceneReady = false;
        let attempts = 0;
        while (!sceneReady && attempts < 15) {
            try {
                const scene = await OBR.scene.getScene();
                const viewport = await OBR.scene.getViewport();
                if (scene && viewport) {
                    sceneReady = true;
                    console.log('[MapRenderer] ✅ 场景引擎已就绪');
                } else {
                    await new Promise(r => setTimeout(r, 500));
                    attempts++;
                }
            } catch (e) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }
        }

        if (!sceneReady) {
            console.warn('[MapRenderer] ⚠️ 场景引擎未就绪，放弃本次渲染');
            isRendering = false;
            return;
        }

        // 清除旧标记
        console.log('[MapRenderer] 🗑️ 清除旧标记...');
        const items = await OBR.scene.items.getItems();
        const tokenItems = items.filter(item => 
            item.metadata && item.metadata._fromExtension === true
        );
        console.log(`[MapRenderer] 找到 ${tokenItems.length} 个旧标记`);
        for (const item of tokenItems) {
            await OBR.scene.items.deleteItems([item.id]);
        }

        // 放置新标记
        if (mapData.tokens && mapData.tokens.length > 0) {
            console.log(`[MapRenderer] 📍 准备放置 ${mapData.tokens.length} 个标记`);
            for (const token of mapData.tokens) {
                let color = "#4A90D9";
                if (token.type === "player") color = "#2ECC71";
                else if (token.type === "enemy") color = "#E74C3C";
                else if (token.type === "npc") color = "#F1C40F";

                const tokenItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: "SHAPE",
                    layer: "CHARACTER",
                    visible: true,
                    position: {
                        x: token.x * 50,
                        y: token.y * 50
                    },
                    width: 40,
                    height: 40,
                    rotation: 0,
                    shape: {
                        type: "CIRCLE",
                        fillColor: color,
                        strokeColor: "#000000",
                        strokeWidth: 2,
                        text: token.name || "",
                        fontSize: 12,
                        fontColor: "#FFFFFF"
                    },
                    metadata: {
                        name: token.name,
                        type: token.type,
                        _fromExtension: true
                    }
                };
                await OBR.scene.items.addItems([tokenItem]);
            }
            console.log(`[MapRenderer] ✅ 已放置 ${mapData.tokens.length} 个标记！`);
        } else {
            console.warn('[MapRenderer] ⚠️ 没有可放置的标记');
        }
    } catch (error) {
        console.error("[MapRenderer] ❌ 渲染失败:", error);
        console.error("[MapRenderer] 错误详情:", error.message);
    } finally {
        isRendering = false;
        console.log('[MapRenderer] 🔓 渲染状态已解锁');
    }
}

OBR.onReady(async () => {
    console.log("[MapRenderer] 🚀 Owlbear Rodeo 扩展已加载");
    console.log("[MapRenderer] 🌐 目标服务器:", SERVER_URL);
    
    // 等待场景加载完成
    console.log('[MapRenderer] 🔍 等待场景加载...');
    let sceneReady = false;
    let attempts = 0;
    while (!sceneReady && attempts < 20) {
        try {
            const scene = await OBR.scene.getScene();
            const viewport = await OBR.scene.getViewport();
            if (scene && viewport) {
                sceneReady = true;
                console.log("[MapRenderer] ✅ 场景已就绪");
            } else {
                attempts++;
                console.log(`[MapRenderer] ⏳ 等待场景... (${attempts}/20)`);
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {
            attempts++;
            console.log(`[MapRenderer] ⏳ 场景未就绪 (${attempts}/20)`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    if (sceneReady) {
        console.log("[MapRenderer] 🟢 开始轮询（间隔5秒）");
        // 立即执行一次 fetch
        console.log('[MapRenderer] 🔄 立即执行首次 fetch...');
        await fetchMap();
        // 然后启动定时轮询
        setInterval(fetchMap, 5000);
    } else {
        console.warn("[MapRenderer] ❌ 场景未就绪，停止启动");
    }
});
