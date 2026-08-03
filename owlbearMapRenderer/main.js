import OBR from "@owlbear-rodeo/sdk";

// WebSocket 服务器地址（根据实际修改）
const WS_URL = "ws://localhost:8080";

let ws = null;
let isConnected = false;

// 初始化：连接到 WebSocket 服务器
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("[MapRenderer] 已连接到地图桥接服务器");
        isConnected = true;
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === "map_update") {
                console.log("[MapRenderer] 收到地图更新:", message.data);
                renderMap(message.data);
            }
        } catch (error) {
            console.error("[MapRenderer] 解析消息失败:", error);
        }
    };

    ws.onclose = () => {
        console.log("[MapRenderer] 与服务器断开连接，尝试 5 秒后重连");
        isConnected = false;
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error("[MapRenderer] WebSocket 错误:", error);
    };
}

// 渲染地图
async function renderMap(mapData) {
    try {
        // 1. 清理当前场景中的旧标记（可选：保留背景）
        const items = await OBR.scene.items.getItems();
        const tokenItems = items.filter(item => 
            item.layer === "CHARACTER" || item.layer === "ATTACHMENT"
        );
        for (const item of tokenItems) {
            await OBR.scene.items.deleteItems([item.id]);
        }

        // 2. 放置新标记（Tokens）
        if (mapData.tokens && mapData.tokens.length > 0) {
            for (const token of mapData.tokens) {
                // 根据类型选择颜色
                let color = "#4A90D9"; // 默认蓝色
                if (token.type === "player") color = "#2ECC71"; // 绿色
                else if (token.type === "enemy") color = "#E74C3C"; // 红色
                else if (token.type === "npc") color = "#F1C40F"; // 黄色

                const tokenItem = {
                    id: crypto.randomUUID(),
                    type: "SHAPE",
                    layer: "CHARACTER",
                    visible: true,
                    position: {
                        x: token.x * 50, // 假设每个格子 50px
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

        // 3. 如果有背景描述，可以在这里调用 AI 绘图 API 生成背景图
        if (mapData.background) {
            console.log("[MapRenderer] 背景描述:", mapData.background);
            // TODO: 调用 AI 绘图 API（如 Stability AI / DALL-E）生成背景图
            // 然后通过 OBR.assets.uploadImages() 上传并设置为地图背景
        }

    } catch (error) {
        console.error("[MapRenderer] 渲染地图失败:", error);
    }
}

// 等待 Owlbear Rodeo 准备就绪
OBR.onReady(() => {
    console.log("[MapRenderer] Owlbear Rodeo 扩展已加载");
    connectWebSocket();
});