import OBR from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

const SERVER_URL = "http://localhost:8080";
let lastData = null;

async function fetchMap() {
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
        // 静默失败
    }
}

async function renderMap(mapData) {
    try {
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
                    id: crypto.randomUUID(),
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
    }
}

OBR.onReady(() => {
    console.log("[MapRenderer] Owlbear Rodeo 扩展已加载");
    setInterval(fetchMap, 2000); // 每2秒轮询一次
});
