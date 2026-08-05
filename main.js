import OBR from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

const SERVER_URL = "https://mengfanrui.jijihenda.cloud";
let lastData = null;
let isRendering = false;

// ========== 角色名 → 图片 URL 映射表（0.2.0） ==========
const TOKEN_IMAGES = {
    // ===== 职业类（玩家角色） =====
    "Barbarian": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Barbarian.png",
    "Bard": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Bard.png",
    "Cleric": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Cleric.png",
    "Druid": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Druid.png",
    "Fighter": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Fighter.png",
    "Monk": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Monk.png",
    "Paladin": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Paladin.png",
    "Ranger": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Ranger.png",
    "Rogue": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Rogue.png",
    "Sorcerer": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Sorcerer.png",
    "Warlock": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Warlock.png",
    "Wizard": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Wizard.png",
    "Artificer": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Artificer.png",
    "Blood Hunter": "https://images.owlbear.rodeo/shared/items/owlbear-characters/BloodHunter.png",

    // ===== 怪物类型（敌人/NPC） =====
    "Aberration": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Aberration.png",
    "Beast": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Beast.png",
    "Celestial": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Celestial.png",
    "Construct": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Construct.png",
    "Dragon": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Dragon.png",
    "Elemental": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Elemental.png",
    "Fey": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Fey.png",
    "Fiend": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Fiend.png",
    "Giant": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Giant.png",
    "Goblin": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Goblin.png",
    "Humanoid": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Humanoid.png",
    "Monstrosity": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Monstrosity.png",
    "Ooze": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Ooze.png",
    "Plant": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Plant.png",
    "Shapechanger": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Shapechanger.png",
    "Titan": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Titan.png",
    "Undead": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Undead.png",

    // ===== 中文别名（方便 AI 直接使用中文名） =====
    "野蛮人": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Barbarian.png",
    "吟游诗人": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Bard.png",
    "牧师": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Cleric.png",
    "德鲁伊": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Druid.png",
    "战士": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Fighter.png",
    "武僧": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Monk.png",
    "圣骑士": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Paladin.png",
    "游侠": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Ranger.png",
    "游荡者": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Rogue.png",
    "术士": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Sorcerer.png",
    "邪术师": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Warlock.png",
    "法师": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Wizard.png",
    "奇械师": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Artificer.png",

    "地精": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Goblin.png",
    "巨龙": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Dragon.png",
    "巨人": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Giant.png",
    "不死生物": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Undead.png",
    "元素生物": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Elemental.png",

    // ===== 默认兜底图片 =====
    "default": "https://images.owlbear.rodeo/shared/items/owlbear-characters/Humanoid.png"
};

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

// ============== renderMap（支持图片 + 彩色圆形回退） ==============
async function renderMap(mapData) {
    if (isRendering) return;
    isRendering = true;
    try {
        if (!OBR.scene.isReady) {
            console.warn('[MapRenderer] 场景未就绪，放弃本次渲染');
            isRendering = false;
            return;
        }
        console.log('[MapRenderer] 场景引擎已就绪');

        // 清除旧标记
        const items = await OBR.scene.items.getItems();
        const tokenItems = items.filter(item => item.metadata && item.metadata._fromExtension === true);
        for (const item of tokenItems) {
            await OBR.scene.items.deleteItems([item.id]);
        }

        if (mapData.tokens && mapData.tokens.length > 0) {
            for (const token of mapData.tokens) {
                let tokenItem;
                const imageUrl = TOKEN_IMAGES[token.name] || TOKEN_IMAGES["default"];

                // 如果有匹配的图片，使用 IMAGE 类型（完全复制成功格式）
                if (imageUrl) {
                    tokenItem = {
                        type: "IMAGE",
                        id: Math.random().toString(36).substr(2, 9),
                        name: token.name || "Token",
                        position: {
                            x: token.x * 50,
                            y: token.y * 50
                        },
                        rotation: 0,
                        scale: { x: 1, y: 1 },
                        visible: true,
                        locked: false,
                        createdUserId: "c1876eaa-3709-40e7-824f-4a6f6b28f37d",
                        zIndex: Date.now(),
                        lastModified: new Date().toISOString(),
                        lastModifiedUserId: "c1876eaa-3709-40e7-824f-4a6f6b28f37d",
                        metadata: {
                            name: token.name,
                            type: token.type,
                            _fromExtension: true
                        },
                        image: {
                            url: imageUrl,
                            mime: "image/png",
                            width: 300,
                            height: 300
                        },
                        grid: {
                            dpi: 300,
                            offset: { x: 150, y: 150 }
                        },
                        text: {
                            type: "PLAIN",
                            style: {
                                padding: 8,
                                fontSize: 24,
                                fillColor: "white",
                                textAlign: "CENTER",
                                fontFamily: "Roboto",
                                fontWeight: 400,
                                lineHeight: 1.5,
                                fillOpacity: 1,
                                strokeColor: "white",
                                strokeWidth: 0,
                                strokeOpacity: 1,
                                textAlignVertical: "BOTTOM"
                            },
                            width: "AUTO",
                            height: "AUTO",
                            richText: [
                                {
                                    type: "paragraph",
                                    children: [{ text: "" }]
                                }
                            ],
                            plainText: ""
                        },
                        textItemType: "LABEL",
                        layer: "CHARACTER"
                    };
                } else {
                    // 回退到彩色圆形（兼容旧数据）
                    let fillColor = "#4A90D9";
                    if (token.type === "player") fillColor = "#2ECC71";
                    else if (token.type === "enemy") fillColor = "#E74C3C";
                    else if (token.type === "npc") fillColor = "#F1C40F";

                    tokenItem = {
                        id: Math.random().toString(36).substr(2, 9),
                        type: "SHAPE",
                        layer: "CHARACTER",
                        visible: true,
                        shapeType: "CIRCLE",
                        width: 40,
                        height: 40,
                        position: {
                            x: token.x * 50,
                            y: token.y * 50
                        },
                        rotation: 0,
                        scale: { x: 1, y: 1 },
                        style: {
                            fillColor: fillColor,
                            fillOpacity: 1,
                            strokeColor: "#FFFFFF",
                            strokeOpacity: 1,
                            strokeWidth: 3,
                            strokeDash: []
                        },
                        createdUserId: "extension",
                        metadata: {
                            name: token.name,
                            type: token.type,
                            _fromExtension: true
                        }
                    };
                }

                await OBR.scene.items.addItems([tokenItem]);
            }
            console.log(`[MapRenderer] 已放置 ${mapData.tokens.length} 个标记`);
            console.log('[MapRenderer] ✅ 标记已全部放置完成！');
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

    window.__OBR = OBR;
    console.log('[MapRenderer] 🔧 已将 OBR 暴露到当前 window.__OBR');

    try {
        await waitForScene(30, 1000);
        console.log("[MapRenderer] ✅ 场景已就绪，开始轮询（间隔5秒）");
        await fetchMap();
        setInterval(fetchMap, 5000);
    } catch (error) {
        console.error("[MapRenderer] ❌", error.message);
        console.warn("[MapRenderer] 💡 请尝试：");
        console.warn("[MapRenderer]    1. 刷新浏览器页面（Ctrl+F5）");
        console.warn("[MapRenderer]    2. 在 Owlbear 中关闭并重新打开场景");
        console.warn("[MapRenderer]    3. 重新安装扩展");
    }
});
