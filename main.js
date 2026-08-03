import OBR from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

const SERVER_URL = "https://mengfanrui.jijihenda.cloud";
let lastData = null;
let isRendering = false;

async function fetchMap() {
    if (isRendering) return;
    try {
        const res = await fetch(SERVER_URL + '/get-map');
        if (!res.ok) return;
        const data = await res.json();
        if (JSON.stringify(data) !== JSON.stringify(lastData)) {
            lastData = data;
            if (data && data.background) {
                console.log('[MapRenderer] 收到地图更新:', data);
                await renderMap(data);
            }
        }
    } catch (e) {
        console.error('[MapRenderer] fetch 错误:', e);
    }
}

async function renderMap(mapData) {
    if (isRendering) return;
    isRendering = true;
    try {
        // 🔥 检查场景引擎是否就绪
        let sceneReady = false;
        let attempts = 0;
        while (!sceneReady && attempts < 15) {
            try {
                const scene = await OBR.scene.getScene();
                const viewport = await OBR.scene.getViewport();
                if (scene && viewport) {
                    sceneReady = true;
                    console.log('[MapRenderer] 场景引擎已就绪');
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
            console.warn('[MapRenderer] 场景引擎未就绪，放弃本次渲染');
            isRendering = false;
            return;
        }

        // 清除旧标记
        const items = await OBR.scene.items.getItems();
        const tokenItems = items.filter(item => 
            item.layer === "CHARACTER" || item.layer === "ATTACHMENT"
        );
        for (const item of tokenItems) {
            await OBR.scene.items.deleteItems([item.id]);
        }

        if (mapData.tokens && mapData.tokens.length > 0) {
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
                        type: token.type
                    }
                };
                await OBR.scene.items.addItems([tokenItem]);
            }
            console.log(`[MapRenderer] 已放置 ${mapData.tokens.length} 个标记`);
        }
    } catch (error) {
        console.error("[MapRenderer] 渲染失败:", error);
        console.error("[MapRenderer] 错误详情:", error.message);
    } finally {
        isRendering = false;
    }
}

OBR.onReady(async () => {
    console.log("[MapRenderer] Owlbear Rodeo 扩展已加载");
    
    // 等待场景加载完成
    let sceneReady = false;
    while (!sceneReady) {
        try {
            const scene = await OBR.scene.getScene();
            const viewport = await OBR.scene.getViewport();
            if (scene && viewport) {
                sceneReady = true;
                console.log("[MapRenderer] 场景已就绪，开始轮询");
                setInterval(fetchMap, 2000);
            } else {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
});
