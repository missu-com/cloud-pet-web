/* double · 我们的小窝（网页版）
 * 双人互动小屋：本地 localStorage + textdb.online 云同步
 * 悄悄话 / 走心互答 端到端加密（AES-GCM，密钥由两人暗号派生，暗号永不上传）
 */
'use strict';

/* ===== 启动自检 / 防白屏兜底（必须最先执行） ===== */
window.__APP_VER = '20260908e';
(function () {
  function ensureSplash() {
    var s = document.getElementById('bootSplash');
    if (!s) {
      s = document.createElement('div');
      s.id = 'bootSplash';
      s.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;background:#FFF8F0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#9a7a66;text-align:center;padding:28px;box-sizing:border-box';
      var ic = document.createElement('div'); ic.style.cssText = 'font-size:52px;line-height:1'; ic.textContent = '🐰🐶';
      var t = document.createElement('div'); t.id = 'bootMsg'; t.textContent = '正在准备我们的小窝…'; t.style.cssText = 'font-size:15px;line-height:1.6;white-space:pre-line';
      var b = document.createElement('button'); b.id = 'bootReload'; b.style.cssText = 'display:none;margin-top:10px;padding:11px 22px;border:none;border-radius:999px;background:#ff8fab;color:#fff;font-size:15px;font-weight:600'; b.textContent = '🔄 强制刷新';
      b.onclick = function () { try { location.replace(location.pathname + location.search + (location.search ? '&' : '?') + 'hb=' + Date.now()); } catch (e2) { location.reload(); } };
      s.appendChild(ic); s.appendChild(t); s.appendChild(b);
      (document.body || document.documentElement).appendChild(s);
    }
    return s;
  }
  ensureSplash();
  window.__bootMsg = function (msg) { var t = document.getElementById('bootMsg'); if (t) t.textContent = msg; };
  window.__bootErr = function (msg) {
    ensureSplash();
    var t = document.getElementById('bootMsg'); if (t) t.textContent = msg || '页面加载遇到问题，点下方按钮强制刷新一次';
    var b = document.getElementById('bootReload'); if (b) b.style.display = 'inline-block';
    var s = document.getElementById('bootSplash'); if (s) s.style.zIndex = 9999999;
  };
  window.__bootDone = function () { var s = document.getElementById('bootSplash'); if (s && s.parentNode) s.parentNode.removeChild(s); };
  /* 脚本运行错误 → 显示可恢复提示，而不是白屏 */
  window.addEventListener('error', function (e) {
    var src = (e && (e.filename || '')) || '';
    if (!src || /\.(png|jpe?g|webp|gif|svg|ico|woff2?|mp3|mp4)/i.test(src)) return; // 忽略图片/字体/媒体 404
    window.__bootErr('页面出了点小问题\n（' + ((e && e.message) || '脚本错误').slice(0, 60) + '）\n点下方按钮刷新一次');
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = (e && e.reason) || {};
    var m = (r && r.message) || '';
    if (/AbortError|NetworkError|Failed to fetch|timeout/i.test(m)) return; // 云同步失败走 toast 提示即可
    window.__bootErr('页面出了点小问题\n点下方按钮刷新一次');
  });
})();

/* ================= 配置 ================= */
const APP_NAME = 'double';
const MEALS = [
  { key: 'breakfast', label: '早餐', emoji: '🥣', start: 5, end: 10, exp: 10, tip: '05:00 - 10:00' },
  { key: 'lunch', label: '午餐', emoji: '🍱', start: 10, end: 15, exp: 10, tip: '10:00 - 15:00' },
  { key: 'dinner', label: '晚餐', emoji: '🍲', start: 15, end: 21, exp: 10, tip: '15:00 - 21:00' }
];
/* 配饰：同画风贴纸，锚点贴合宠物 */
const OUTFITS = {
  none: { name: '素颜', emoji: '🐰' },
  bow: { name: '蝴蝶结', emoji: '🎀', img: 'assets/acc_bow.png', a: { x: 44, y: 5, w: 38, z: 2 } },
  beret: { name: '贝雷帽', emoji: '🎩', img: 'assets/acc_beret.png', a: { x: 30, y: 0, w: 42, z: 2 } },
  scarf: { name: '围巾', emoji: '🧣', img: 'assets/acc_scarf.png', a: { x: 30, y: 46, w: 40, z: 2 } },
  glasses: { name: '圆眼镜', emoji: '👓', img: 'assets/acc_glasses.png', a: { x: 26, y: 31, w: 46, z: 2 } },
  crown: { name: '皇冠', emoji: '👑', img: 'assets/acc_crown.png', a: { x: 40, y: 1, w: 26, z: 2 } },
  starclip: { name: '星星发卡', emoji: '⭐', img: 'assets/acc_starclip.png', a: { x: 70, y: 13, w: 18, z: 2 } },
  backpack: { name: '小背包', emoji: '🎒', img: 'assets/acc_backpack.png', a: { x: 62, y: 46, w: 32, z: 1 } },
  bell: { name: '铃铛项圈', emoji: '🔔', img: 'assets/acc_bell.png', a: { x: 36, y: 52, w: 30, z: 2 } }
};
const OUTFIT_IMG = {}; Object.keys(OUTFITS).forEach((k) => OUTFIT_IMG[k] = OUTFITS[k].img || '');
const PET_IMG = { rabbit: 'assets/pet_rabbit.png', dog: 'assets/pet_dog.png' };
/* 小屋壁纸（主页小家背景同步用） */
const WALLPAPERS = [
  { id: 'cream', name: '奶油', img: 'assets/wall_cream.png' },
  { id: 'forest', name: '森林', img: 'assets/wall_forest.png' },
  { id: 'star', name: '星空', img: 'assets/wall_star.png' },
  { id: 'ocean', name: '海盐', img: 'assets/wall_ocean.png' }
];
function wallImg(v) { return (WALLPAPERS.find((w) => w.id === v) || WALLPAPERS[0]).img; }
const SCENE_IMG = { work: 'assets/office.png' };
const REWARDS = [
  { target: 'bow', need: '等级 3', emoji: '🎀' }, { target: 'beret', need: '等级 6', emoji: '🎩' },
  { target: 'scarf', need: '等级 9', emoji: '🧣' }, { target: 'glasses', need: '等级 12', emoji: '👓' },
  { target: 'crown', need: '默契 21', emoji: '👑' }, { target: 'starclip', need: '等级 15', emoji: '⭐' },
  { target: 'bell', need: '默契 10', emoji: '🔔' }, { target: 'backpack', need: '默契 28', emoji: '🎒' }
];
const BLINDBOX = [
  { id: 'box_outfit_bow', type: 'outfit', target: 'bow', name: '蝴蝶结', emoji: '🎀', exp: 5 },
  { id: 'box_outfit_beret', type: 'outfit', target: 'beret', name: '贝雷帽', emoji: '🎩', exp: 5 },
  { id: 'box_outfit_scarf', type: 'outfit', target: 'scarf', name: '围巾', emoji: '🧣', exp: 5 },
  { id: 'box_outfit_starclip', type: 'outfit', target: 'starclip', name: '星星发卡', emoji: '⭐', exp: 5 },
  { id: 'box_fur_plant', type: 'furniture', target: 'plant', name: '小盆栽', emoji: '🪴', exp: 3 },
  { id: 'box_fur_lamp', type: 'furniture', target: 'lamp', name: '夜灯', emoji: '💡', exp: 3 },
  { id: 'box_fur_rug', type: 'furniture', target: 'rug', name: '地毯', emoji: '🟫', exp: 3 },
  { id: 'box_fur_yarn', type: 'furniture', target: 'yarn', name: '毛线球', emoji: '🧶', exp: 3 },
  { id: 'box_exp_20', type: 'exp', target: '', name: '经验糖果', emoji: '🍬', exp: 20 },
  { id: 'box_exp_10', type: 'exp', target: '', name: '小鱼干', emoji: '🐟', exp: 10 }
];
/* 同画风家具贴纸：s=[宽%, 高%] 摆放时按此缩放 */
const FURNITURES = [
  { id: 'bed', name: '小床', emoji: '🛏️', img: 'assets/fur_bed.png', s: [36, 58] },
  { id: 'sofa', name: '云朵沙发', emoji: '🛋️', img: 'assets/fur_sofa.png', s: [36, 54] },
  { id: 'plant', name: '小盆栽', emoji: '🪴', img: 'assets/fur_plant.png', s: [22, 60] },
  { id: 'lamp', name: '台灯', emoji: '💡', img: 'assets/fur_lamp.png', s: [20, 62] },
  { id: 'frame', name: '相框', emoji: '🖼️', img: 'assets/fur_frame.png', s: [26, 52] },
  { id: 'rug', name: '地毯', emoji: '🟫', img: 'assets/fur_rug.png', s: [44, 46] },
  { id: 'yarn', name: '毛线球', emoji: '🧶', img: 'assets/fur_yarn.png', s: [18, 46] },
  { id: 'books', name: '书架', emoji: '📚', img: 'assets/fur_books.png', s: [26, 60] },
  { id: 'clock', name: '挂钟', emoji: '⏰', img: 'assets/fur_clock.png', s: [24, 50] },
  { id: 'cushion', name: '抱枕', emoji: '🧸', img: 'assets/fur_cushion.png', s: [26, 44] },
  { id: 'coffee', name: '咖啡杯', emoji: '☕', img: 'assets/fur_coffee.png', s: [18, 48] },
  { id: 'desk', name: '小书桌', emoji: '🪑', img: 'assets/fur_desk.png', s: [42, 54] }
];
function furnitureFor(id) { return FURNITURES.find((f) => f.id === id) || { emoji: '🧸', name: '杂物', img: '', s: [24, 60] }; }
const WHISPER_MOODS = [
  { key: '吐槽', emoji: '😤', color: '#FFE3E3' }, { key: '烦心事', emoji: '😔', color: '#FFEEDC' },
  { key: '心里话', emoji: '💭', color: '#E3ECFF' }, { key: '悄悄夸', emoji: '🥰', color: '#E1F5EE' }
];
const COMPLIMENTS = [
  '你今天也超认真地生活，我看得见。', '和你一起打卡吃饭，是我每天的小确幸。',
  '你笑起来的时候，我的宠物都会跟着摇尾巴。', '别忘了，你已经做得很好了。',
  '你认真的样子，真的很迷人。', '今天也要好好吃饭，我监督你哦。',
  '你是我最想一起变好的人。', '累的时候记得，我一直在。'
];
const PET_LINES = [
  '今天也要好好吃饭哦~', '你累不累呀，过来抱抱🤗', '猜猜我在想什么~',
  '我们一起加油鸭！', '等我放学回来一起玩~', '有你陪着我真好',
  '今天也要开开心心的！', '我偷偷给你留了颗糖🍬', '你看，我俩都在呢',
  '要不要一起看星星🌟', '今天过得怎么样呀？'
];
const STORIES = [
  '{meE}今天把{friendE}最爱的小零食藏了起来，说要拿来做奖励~',
  '{friendE}给{meE}画了一幅画，虽然有点歪，但{meE}超喜欢！',
  '{meE}和{friendE}约好今晚一起看星星，已经搬好小板凳啦🌟',
  '{friendE}偷偷给{meE}的饭盒里多放了一颗糖🍬',
  '{meE}今天学了个新舞步，非要跳给{friendE}看💃',
  '{friendE}说想{meE}了，发了个超大的抱抱过来🤗',
  '{meE}和{friendE}在公园迷路了，但俩人都说一点都不慌~',
  '{friendE}给{meE}写了一句悄悄话，藏在「今日一句」里✍️'
];
const STUDY_TASKS = [
  { id: 'focus', emoji: '🍅', name: '专注番茄钟', desc: '两人一起专注一段时间', exp: 20 },
  { id: 'code', emoji: '💻', name: '敲代码', desc: '写一小段今天的进度', exp: 18 },
  { id: 'meeting', emoji: '🗓️', name: '开个短会', desc: '梳理今天要做的事', exp: 12 },
  { id: 'mail', emoji: '📮', name: '处理邮件', desc: '清空未读消息', exp: 12 },
  { id: 'learn', emoji: '📚', name: '学点新东西', desc: '读一篇干货', exp: 15 }
];
const FOCUS_LENGTHS = [15, 25, 50]; // 番茄钟可选分钟数
const COMMUTE_LINES = ['上班打卡 📍', '下班打卡 🌆'];
const PET_BIRTHDAYS = { rabbit: '05-03', dog: '03-21' };
const ROLES = ['rabbit', 'dog'];
const DAY_MOODS = [
  { emoji: '😊', name: '开心', color: '#FFD86B' }, { emoji: '🥰', name: '甜蜜', color: '#FF9DBB' },
  { emoji: '😌', name: '平静', color: '#A8E6CF' }, { emoji: '😤', name: '小脾气', color: '#FFB4A2' },
  { emoji: '😢', name: '难过', color: '#9CC6FF' }, { emoji: '😴', name: '困倦', color: '#C9B6E4' },
  { emoji: '🤩', name: '激动', color: '#FFE89A' }
];
const DAY_MOOD_MAP = {}; DAY_MOODS.forEach((m, i) => DAY_MOOD_MAP[m.emoji] = m);
const HARMONY_QUESTIONS = [
  { q: '周末我们更适合哪种安排？', opts: ['宅家 + 火锅', '出门逛逛', '各自忙完视频', '睡到自然醒'] },
  { q: '遇到烦心事，我更倾向？', opts: ['找 TA 吐槽', '自己静静', '吃顿好的', '运动发泄'] },
  { q: '我的理想宠物名字风格？', opts: ['软萌叠字', '帅气单字', '食物名', '搞怪'] },
  { q: '我最怕哪种情况？', opts: ['被放鸽子', '吃不到好吃的', '大半夜饿肚子', '计划被打乱'] },
  { q: '心情不好时最想要？', opts: ['安静陪着', '被逗笑', '一顿美食', '一起去散步'] },
  { q: '我更喜欢哪种夸奖？', opts: ['夸我认真', '夸我可爱', '夸我靠谱', '夸我有品味'] },
  { q: '如果突然多了一天空闲，我会？', opts: ['补觉', '研究新东西', '找人玩', '打扫收拾'] },
  { q: '我觉得最舒服的相处方式是？', opts: ['各自做各自的事', '一直聊天', '一起打游戏', '一起做饭'] },
  { q: '我更喜欢哪种天气？', opts: ['晴天', '雨天', '雪天', '多云'] },
  { q: '更想收到什么小惊喜？', opts: ['一杯奶茶', '一句夸夸', '一张手写信', '一起看个电影'] }
];
const SOUL_QUESTIONS = [
  '如果今天只能做一件事，你最想和 TA 一起做什么？',
  '你第一次见 TA 是什么感觉？',
  '你觉得 TA 身上最闪光的地方是什么？',
  '最近有什么小事让你偷偷开心？',
  '你最想和 TA 一起完成的小目标是什么？',
  '你压力大的时候，最希望 TA 怎么陪你？',
  '说出三件你感谢 TA 的事',
  '你最喜欢 TA 的哪个小习惯？',
  '如果可以去任何地方旅行一天，你想和 TA 去哪里？',
  '你最近有没有一句话很想对 TA 说？',
  '你觉得自己和 TA 最像的地方是什么？',
  '你希望 5 年后你们还是好朋友吗？为什么？',
  '你最近一次被 TA 逗笑是因为什么？',
  '有什么你一直想做但还没做的事？',
  '你觉得 TA 最近最需要什么？',
  '你最喜欢两人一起做的哪件小事？',
  '如果 TA 心情不好，你会怎么哄？',
  '今天你过得怎么样？老实说',
  '你想在「小屋」里添什么？为什么？',
  '你最近学到的新东西是什么？'
];
/* ===== 流动爱意文案池（每次打开不同） ===== */
const QUOTES = [
  // 🌙 发呆系
  { t: '发呆', q: '我想和你发呆很久很久，发很久很久的呆，然后说，人类好渺小呀，你说，但是爱很伟大呀。' },
  { t: '发呆', q: '我们就这样坐着，不说话，也很好。' },
  { t: '发呆', q: '和你在一起的每一秒，我都舍不得快进。' },
  { t: '发呆', q: '世界很吵，但我只想听你轻轻呼吸。' },
  { t: '发呆', q: '就这样并肩坐着，时间都变慢了。' },
  { t: '发呆', q: '发呆的时候，偷偷想你，算是双倍幸福。' },
  // 🌿 远方系
  { t: '远方', q: '我想跟你聊文学、生命、童年、远方的康乃馨，但你摸了摸我的手臂，告诉我不要生病。' },
  { t: '远方', q: '想和你一起去看 70 岁的夕阳。' },
  { t: '远方', q: '把每一个今天，都写成我们未来的备忘录。' },
  { t: '远方', q: '你在的地方，就是我想去的远方。' },
  { t: '远方', q: '我们一起去看海吧，把心事都冲走。' },
  { t: '远方', q: '世界那么大，好想和你把这个地球走一遍。' },
  // ☀️ 日常系
  { t: '日常', q: '早餐吃了吗？要好好吃饭哦。' },
  { t: '日常', q: '今天也想被你温柔对待。' },
  { t: '日常', q: '在吗？在的话我们就一起去公园走走吧。' },
  { t: '日常', q: '也没什么特别的事，就是想你了。' },
  { t: '日常', q: '今天的风很温柔，像你。' },
  { t: '日常', q: '我这边下雨了，你那边呢？' },
  // 🌸 治愈系
  { t: '治愈', q: '你值得被爱，别忘了。' },
  { t: '治愈', q: '累了就歇一歇，不用一直那么拼。' },
  { t: '治愈', q: '今天辛苦了，摸摸头。' },
  { t: '治愈', q: '记得喝水，记得微笑。' },
  { t: '治愈', q: '你已经做得很好了，真的。' },
  { t: '治愈', q: '一切都会慢慢好起来的，我陪着你。' },
  // 🍯 回忆系
  { t: '回忆', q: '还记得我们第一次见面那天吗？天气真好。' },
  { t: '回忆', q: '那天的黄昏，我们现在还记得吗？' },
  { t: '回忆', q: '我们一起去过的那个地方，路边的花还开着。' },
  { t: '回忆', q: '有些瞬间，想起来就会忍不住笑。' },
  { t: '回忆', q: '我们的日子像一本慢慢写的小书。' },
  // 🎁 专属系（带参数，动态）
  { t: '专属', q: '{me}让我跟你说：能遇见{other}，真好。' },
  { t: '专属', q: '{me}和{other}的小窝，今天也在发光。' },
  { t: '专属', q: '{me}在想，{other}现在在干嘛呢。' }
];

/* ===== 模式（同地 / 异地） ===== */
const MODE_TOGETHER = 'together';   // 同地 · 在一起
const MODE_APART = 'apart';          // 异地 · 分隔两地
const MODE_INFO = {
  together: { key: 'together', name: '同地', label: '在一起', emoji: '🏠', color: '#E8934A', chip: '🌇 当时当下 · 我们在同一个城市', tagline: '实时互动 · 一起做的事' },
  apart: { key: 'apart', name: '异地', label: '分隔两地', emoji: '🌙', color: '#7F77DD', chip: '🌃 隔着山川与时差 · 心还在一起', tagline: '异步陪伴 · 等 TA 回应' }
};

/* ===== 季节主题皮肤 ===== */
const SEASONS = [
  { id: 'spring', name: '春 · 樱花', emoji: '🌸', accent: '#F5A9C0', bg: '#FFF2F7' },
  { id: 'summer', name: '夏 · 薄荷', emoji: '🌿', accent: '#7CCFA0', bg: '#EEF9F2' },
  { id: 'autumn', name: '秋 · 枫叶', emoji: '🍁', accent: '#E8963A', bg: '#FBF3E6' },
  { id: 'winter', name: '冬 · 初雪', emoji: '❄️', accent: '#8CB6E8', bg: '#EFF4FB' }
];

/* ===== 同地模式玩法 ===== */
const TOGETHER_GAMES = [
  { id: 'movie', emoji: '🎡', name: '电影大转盘', desc: '转一转 · 今晚就看它' },
  { id: 'music', emoji: '🎧', name: '云共听', desc: '同一首歌 · 各自播放一起听' },
  { id: 'dice', emoji: '🎲', name: '摇骰子决定晚饭', desc: '双人都摇 · 数字越近越默契' },
  { id: 'syncmood', emoji: '🎯', name: '同步表情', desc: '同一秒选同一个 · 命中加分' },
  { id: 'quiz', emoji: '🧩', name: '默契问答', desc: '两人同答 · 看是不是心有灵犀' },
  { id: 'guess', emoji: '💬', name: '我来描述你来猜', desc: '一个说一个猜' }
];
/* ===== 异地模式玩法 ===== */
const APART_GAMES = [
  { id: 'soul', emoji: '💭', name: '每日灵魂一问', desc: '各答一题 · 答完解锁互看' },
  { id: 'wish', emoji: '📌', name: '心愿清单', desc: '一起写 · 完成一项勾一项' },
  { id: 'draw', emoji: '🎨', name: '你画我猜', desc: '画下来 · 等 TA 猜' },
  { id: 'moon', emoji: '🌙', name: '晚安仪式', desc: '互道晚安才解锁今晚月色' },
  { id: 'quiz', emoji: '🧩', name: '默契问答', desc: '两人同答 · 看是不是心有灵犀' },
  { id: 'guess', emoji: '💬', name: '我来描述你来猜', desc: '一个说一个猜' }
];

/* ===== 心愿清单数据 ===== */
const WISH_PRESETS = ['一起去看海', '吃一次火锅', '逛一次街', '一起旅行', '看一场电影', '去游乐园', '一起做饭', '看一次日出'];
const GUESS_PAINT_WORDS = ['太阳', '苹果', '小猫', '爱心', '雨伞', '房子', '月亮', '花朵', '冰淇淋', '小兔'];

/* ===== 电影大转盘：类型 + 每类片单 ===== */
const MOVIE_TYPES = [
  { id: 'comedy', name: '喜剧', emoji: '😂', color: '#FFD86B', movies: ['让子弹飞', '唐伯虎点秋香', '夏洛特烦恼', '三傻大闹宝莱坞', '布达佩斯大饭店'] },
  { id: 'romance', name: '爱情', emoji: '💘', color: '#FF9DBB', movies: ['爱乐之城', '时空恋旅人', '你的名字。', '甜蜜蜜', '怦然心动'] },
  { id: 'horror', name: '恐怖', emoji: '👻', color: '#B7A6D8', movies: ['咒怨', '闪灵', '午夜凶铃', '遗传厄运', '第六感'] },
  { id: 'mystery', name: '悬疑', emoji: '🔍', color: '#8AB6FF', movies: ['看不见的客人', '控方证人', '禁闭岛', '致命魔术', '利刃出鞘'] },
  { id: 'anime', name: '动画', emoji: '🎈', color: '#8FD9C4', movies: ['千与千寻', '哪吒之魔童降世', '头脑特工队', '龙猫', '寻梦环游记'] },
  { id: 'scifi', name: '科幻', emoji: '🚀', color: '#7FC8E8', movies: ['星际穿越', '流浪地球', '盗梦空间', '头号玩家', '银翼杀手2049'] },
  { id: 'action', name: '动作', emoji: '💥', color: '#FFB48A', movies: ['红海行动', '疾速追杀', '谍影重重', '黑暗骑士', '英雄本色'] },
  { id: 'heal', name: '治愈', emoji: '🌿', color: '#C6E5A0', movies: ['小森林', '海街日记', '菊次郎的夏天', '人生果实', '我在故宫修文物'] }
];
const petEmoji = (t) => (t === 'dog' ? '🐶' : '🐰');
const petLabel = (t) => (t === 'dog' ? '小狗' : '小兔');
function expToLevel(exp) { return Math.floor((exp || 0) / 100) + 1; }
function levelProgress(exp) {
  const lvl = expToLevel(exp), cur = (exp || 0) - (lvl - 1) * 100;
  return { lvl, cur, need: 100, pct: Math.max(0, Math.min(100, Math.round(cur))) };
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function dailyIndex(seed, n) {
  const d = new Date(), key = `${seed}-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return hashStr(key) % n;
}
function sceneInfo() {
  const h = new Date().getHours();
  let emoji, label;
  if (h >= 5 && h < 11) { emoji = '🌅'; label = '早晨'; }
  else if (h >= 11 && h < 14) { emoji = '☀️'; label = '中午'; }
  else if (h >= 14 && h < 18) { emoji = '🌤️'; label = '下午'; }
  else if (h >= 18 && h < 22) { emoji = '🌇'; label = '傍晚'; }
  else { emoji = '🌙'; label = '夜晚'; }
  const weathers = ['晴 ☀️', '多云 ⛅', '小雨 🌧️'];
  return { emoji, label, weather: weathers[dailyIndex('weather', 3)] };
}
function todayStr() { const d = new Date(), p = (n) => ('' + n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
/* 宠物状态气泡：在家摸鱼 / 上班干活（每天按人+场景固定） */
const HOME_ACTS = ['🧶 玩毛线球', '💤 补觉中', '📺 看剧里', '🥕 干饭中', '📖 看书中'];
const WORK_ACTS = ['💻 敲键盘', '📋 整理需求', '☕ 咖啡续命', '✏️ 写写画画', '📈 盯数据'];
function todayMD() { const d = new Date(), p = (n) => ('' + n).padStart(2, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function fmtTime(ts) { const d = new Date(ts), p = (n) => ('' + n).padStart(2, '0'); return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function dateToStr(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); }

/* ================= 小工具 ================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function randCode(n) { const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const buf = new Uint8Array(n); crypto.getRandomValues(buf); return Array.from(buf, (b) => chars[b % chars.length]).join(''); }
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms || 2400); }
function hearts(n) {
  const emos = ['💗', '💕', '💖', '🩷', '💞'];
  for (let i = 0; i < (n || 10); i++) setTimeout(() => {
    const el = document.createElement('div'); el.className = 'heart-fly'; el.textContent = emos[Math.floor(Math.random() * emos.length)];
    el.style.left = (30 + Math.random() * 40) + '%'; el.style.bottom = (15 + Math.random() * 25) + '%';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1700);
  }, i * 90);
}
function confetti(n) {
  const emos = ['🎉', '✨', '🎊', '⭐', '🎈'];
  for (let i = 0; i < (n || 24); i++) setTimeout(() => {
    const el = document.createElement('div'); el.className = 'confetti-bit'; el.textContent = emos[Math.floor(Math.random() * emos.length)];
    el.style.left = Math.random() * 100 + '%'; el.style.top = '-24px'; document.body.appendChild(el); setTimeout(() => el.remove(), 2000);
  }, i * 60);
}
function showModal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBox').innerHTML = ''; }
$('#modal') && $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });

/* ================= 加密（AES-GCM，降级 XOR） ================= */
const HAS_SUBTLE = !!(window.crypto && crypto.subtle);
let derivedKey = null;
const b64 = { enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) };
async function getKey(secret, salt) {
  if (!HAS_SUBTLE) return null;
  if (derivedKey) return derivedKey;
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  derivedKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return derivedKey;
}
function xorCipher(text, pass) { let out = ''; for (let i = 0; i < text.length; i++) out += String.fromCharCode(text.charCodeAt(i) ^ pass.charCodeAt(i % pass.length) ^ 42); return btoa(unescape(encodeURIComponent(out))); }
function xorDecipher(b64s, pass) { const raw = decodeURIComponent(escape(atob(b64s))); let out = ''; for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ pass.charCodeAt(i % pass.length) ^ 42); return out; }
async function encryptText(text) {
  const pass = auth.secret + '|' + auth.roomKey;
  if (HAS_SUBTLE) { const key = await getKey(auth.secret, auth.roomKey); const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)); return { iv: b64.enc(iv), ct: b64.enc(ct) }; }
  return { iv: 'xor', ct: xorCipher(text, pass) };
}
async function decryptText(box) {
  try { if (!box) return null; if (box.iv === 'xor' || !HAS_SUBTLE) return xorDecipher(box.ct, auth.secret + '|' + auth.roomKey); const key = await getKey(auth.secret, auth.roomKey); const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(box.iv) }, key, b64.dec(box.ct)); return new TextDecoder().decode(pt); } catch (e) { return null; }
}

/* ================= 状态与同步 ================= */
const DB_BASE = 'https://textdb.online/';
const LS_AUTH = 'cloudpet-web-auth';
const LS_STATE = 'cloudpet-web-state';
let auth = null, state = null;
function loadAuth() { try { return JSON.parse(localStorage.getItem(LS_AUTH)); } catch (e) { return null; } }
function saveAuth() { localStorage.setItem(LS_AUTH, JSON.stringify(auth)); }
function saveLocalState() { if (state) { try { localStorage.setItem(LS_STATE, JSON.stringify(state)); } catch (e) {} } }
function loadLocalState() { try { const s = JSON.parse(localStorage.getItem(LS_STATE)); return s ? ensureStateShape(s) : null; } catch (e) { return null; } }
/* 旧版本数据兜底：补全后期新增字段，避免旧缓存读崩 */
function ensureStateShape(s) {
  if (!s || typeof s !== 'object') return s;
  s.pets = s.pets || {};
  // 给每个宠物补上照料状态（饱食/干净/开心/精力），旧缓存也安全
  for (const r of ROLES) if (s.pets[r] && !s.pets[r].stats) s.pets[r].stats = defaultStats();
  s.roomDecor = Array.isArray(s.roomDecor) ? s.roomDecor : [];
  // 清洗小屋摆件：过滤掉 FURNITURES 里不存在的 itemId（旧/脏数据），并保证坐标可用，杜绝渲染崩溃
  const validFur = new Set(FURNITURES.map((f) => f.id));
  s.roomDecor = s.roomDecor.filter((d) => d && validFur.has(d.itemId)).map((d) => ({
    id: d.id, itemId: d.itemId,
    x: (typeof d.x === 'number' && isFinite(d.x)) ? d.x : 50,
    y: (typeof d.y === 'number' && isFinite(d.y)) ? d.y : 50,
    by: d.by || ''
  }));
  s.todos = Array.isArray(s.todos) ? s.todos : [];
  s.commute = s.commute || {};
  s.focus = s.focus || {};
  s.studyDone = s.studyDone || {};
  if (!s.wallpaper || !s.wallpaper.v) s.wallpaper = { v: 'cream', ts: Date.now() };
  return s;
}
function defaultPet(name) { return { name: name, exp: 0, outfit: 'none', ownedOutfits: ['none'], ownedFurniture: [], boxItems: [], joined: Date.now(), stats: defaultStats() }; }
function defaultState(role, name) {
  return {
    v: 1, createdAt: Date.now(),
    pets: { rabbit: role === 'rabbit' ? defaultPet(name) : null, dog: role === 'dog' ? defaultPet(name) : null },
    checkins: {}, hugs: [], whispers: [], wishes: [], candle: {}, boxLast: {}, boxToday: {}, hugSeen: {},
    moods: {}, qa: null, game: null, roomDecor: [], studyDone: {},
    wallpaper: { v: 'cream', ts: Date.now() },     // 小屋壁纸（共享）
    commute: {},                                    // {date:{rabbit:inTs, dog:inTs}} 上班时间
    focus: {},                                      // {date:{rabbit:sec, dog:sec}} 今日专注秒数
    todos: [],                                      // 共享工作待办 [{id, text, done, by, ts}]
    mode: { v: 'together', ts: Date.now() },          // 同地/异地（共享）
    since: Date.now(),                                  // 在一起的天数起点（纪念日）
    season: { v: 'spring', ts: Date.now() },            // 季节主题（共享）
    wishlist: []                                        // 心愿清单
  };
}
async function makeProbe() { return await encryptText('cloudpet-ok'); }
async function pullRemote() {
  const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
  try {
    const r = await fetch(DB_BASE + auth.roomKey + '?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    if (!r.ok) throw new Error('网络不好');
    const text = (await r.text()).trim(); if (!text) return null;
    try { const j = JSON.parse(text); return (j && j.v != null) ? j : null; } catch (e) { return null; }
  } finally { if (to) clearTimeout(to); }
}
async function writeRemote(obj) {
  const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const to = ctl ? setTimeout(() => ctl.abort(), 12000) : null;
  try {
    const body = new URLSearchParams({ key: auth.roomKey, value: JSON.stringify(obj) });
    const r = await fetch(DB_BASE + 'update', { method: 'POST', body, signal: ctl ? ctl.signal : undefined });
    if (!r.ok) throw new Error('写入失败');
    const j = await r.json().catch(() => null);
    if (!j || j.status !== 1) throw new Error('写入被拒绝');
  } finally { if (to) clearTimeout(to); }
}
function mergeList(a, b, keyFn, extraMerge) { const map = new Map(); for (const item of b) map.set(keyFn(item), item); for (const item of a) { const k = keyFn(item); map.set(k, map.has(k) && extraMerge ? extraMerge(map.get(k), item) : item); } return Array.from(map.values()); }
function mergeStates(local, remote) {
  if (!remote) { local.v = (local.v || 0) + 1; return local; }
  const me = auth.role, other = ROLES.find((r) => r !== me);
  const out = JSON.parse(JSON.stringify(remote));
  out.v = Math.max(local.v || 0, remote.v || 0) + 1;
  out.pets = out.pets || {};
  out.pets[me] = (local.pets && local.pets[me]) || remote.pets[me] || null;
  out.pets[other] = remote.pets[other] || (local.pets && local.pets[other]) || null;
  out.checkins = {};
  const dates = new Set([...Object.keys(local.checkins || {}), ...Object.keys(remote.checkins || {})]);
  for (const d of dates) { out.checkins[d] = {}; for (const role of ROLES) { const a = ((local.checkins || {})[d] || {})[role] || []; const b = ((remote.checkins || {})[d] || {})[role] || []; out.checkins[d][role] = [...new Set([...a, ...b])]; } }
  out.hugs = mergeList(local.hugs || [], remote.hugs || [], (h) => h.ts + '-' + h.from);
  out.whispers = mergeList(local.whispers || [], remote.whispers || [], (w) => w.id, (oldV, newV) => ({ ...newV, read: oldV.read || newV.read }));
  out.wishes = mergeList(local.wishes || [], remote.wishes || [], (w) => w.id);
  out.boxLast = Object.assign({}, remote.boxLast, local.boxLast && { [me]: local.boxLast[me] });
  out.boxToday = Object.assign({}, remote.boxToday, local.boxToday && { [me]: local.boxToday[me] });
  out.hugSeen = Object.assign({}, remote.hugSeen, local.hugSeen && { [me]: local.hugSeen[me] });
  const candle = Object.assign({}, remote.candle); for (const d of Object.keys(local.candle || {})) candle[d] = Object.assign({}, candle[d], local.candle[d]); out.candle = candle;
  // moods：按日期并集，各 role 优选非空
  out.moods = out.moods || {};
  const mdates = new Set([...Object.keys(local.moods || {}), ...Object.keys(remote.moods || {})]);
  for (const d of mdates) { out.moods[d] = Object.assign({}, (remote.moods || {})[d], (local.moods || {})[d]); }
  // studyDone：双方按日期并集
  out.studyDone = Object.assign({}, remote.studyDone || {}, local.studyDone || {});
  // QA：合并双方答案（同一日期话题）
  if (remote.qa || local.qa) {
    const lq = local.qa, rq = remote.qa || null;
    const base = rq && rq.date === (lq && lq.date) ? rq : (lq || rq);
    const merged = { date: base.date, qid: base.qid, answers: Object.assign({}, base.answers) };
    if (lq) { for (const role of ROLES) if (lq.answers && lq.answers[role] && !merged.answers[role]) merged.answers[role] = lq.answers[role]; }
    if (rq) { for (const role of ROLES) if (rq.answers && rq.answers[role] && !merged.answers[role]) merged.answers[role] = rq.answers[role]; }
    out.qa = merged.answers && (merged.answers.rabbit || merged.answers.dog) ? merged : null;
  }
  // game：取 seq 较大者（后写者胜）
  const lgame = local.game, rgame = remote.game;
  out.game = (rgame && (!lgame || rgame.seq >= lgame.seq)) ? rgame : (lgame || null);
  // roomDecor：按 id 并集
  out.roomDecor = mergeList(local.roomDecor || [], remote.roomDecor || [], (d) => d.id);
  // mode：取 ts 较新（共享，双方都能改）
  const lm = local.mode, rm = remote.mode;
  out.mode = (lm && (!rm || (lm.ts || 0) > (rm.ts || 0))) ? lm : (rm || out.mode || { v: 'together', ts: 0 });
  // season：取 ts 较新
  const ls = local.season, rs = remote.season;
  out.season = (ls && (!rs || (ls.ts || 0) > (rs.ts || 0))) ? ls : (rs || out.season || { v: 'spring', ts: 0 });
  // wallpaper：取 ts 较新
  const lw = local.wallpaper, rw = remote.wallpaper;
  out.wallpaper = (lw && (!rw || (lw.ts || 0) > (rw.ts || 0))) ? lw : (rw || out.wallpaper || { v: 'cream', ts: 0 });
  // commute / focus：按日期并集，各 role 优选非空
  out.commute = out.commute || {}; const cdates = new Set([...Object.keys(local.commute || {}), ...Object.keys(remote.commute || {})]);
  for (const d of cdates) out.commute[d] = Object.assign({}, (remote.commute || {})[d], (local.commute || {})[d]);
  out.focus = out.focus || {}; const fdates = new Set([...Object.keys(local.focus || {}), ...Object.keys(remote.focus || {})]);
  for (const d of fdates) out.focus[d] = Object.assign({}, (remote.focus || {})[d], (local.focus || {})[d]);
  // todos：按 id 并集，merge 时保留 done 状态
  out.todos = mergeList(local.todos || [], remote.todos || [], (t) => t.id, (oldV, newV) => ({ ...newV, done: oldV.done || newV.done, keep: true }));
  // since：取较早的创建时间（一起的天数不因谁先改而变少）
  out.since = Math.min(local.since || Infinity, remote.since || out.since || Date.now());
  // wishlist：按 id 并集
  out.wishlist = mergeList(local.wishlist || [], remote.wishlist || [], (w) => w.id);
  out.probe = remote.probe || local.probe;
  out.createdAt = remote.createdAt || local.createdAt;
  return out;
}
function pruneState(s) {
  const day = 86400000;
  s.whispers = (s.whispers || []).filter((w) => !(w.read && w.readAt && Date.now() - w.readAt > day));
  if (s.whispers.length > 60) s.whispers = s.whispers.slice(-60);
  if (s.hugs && s.hugs.length > 200) s.hugs = s.hugs.slice(-200);
  return s;
}
let syncing = false;
function setSync(cls) { const dot = $('#syncDot'); if (dot) dot.className = 'sync-dot ' + (cls || ''); const btn = $('#btnSync'); if (btn) btn.classList.toggle('spin', cls === 'busy'); }
async function push(showErr) {
  if (!auth || !state || syncing) return;
  syncing = true; setSync('busy');
  try { const remote = await pullRemote(); state = mergeStates(state, remote); pruneState(state); await writeRemote(state); saveLocalState(); setSync('ok'); renderAll(); }
  catch (e) { saveLocalState(); setSync('err'); if (showErr) toast('同步失败，已先存本地，稍后会自动重试'); }
  finally { syncing = false; }
}
async function pull(quiet) {
  if (!auth || syncing) return;
  syncing = true; setSync('busy');
  try { const remote = await pullRemote(); if (remote) { const local = state || loadLocalState() || defaultState(auth.role, ''); state = ensureStateShape(mergeStates(local, remote)); saveLocalState(); setSync('ok'); renderAll(); } else setSync('ok'); }
  catch (e) { setSync('err'); if (!quiet) toast('拉取失败，网络不太好'); }
  finally { syncing = false; }
}

/* ================= 派生数据 ================= */
function myPet() { return (state && state.pets && state.pets[auth.role]) || null; }
function otherPet() { const o = otherRole(); return (state && state.pets && state.pets[o]) || null; }
function otherRole() { return ROLES.find((r) => r !== auth.role); }
function myName() { return myPet() ? myPet().name : '我'; }
function otherName() { const p = otherPet(); return p ? p.name : 'TA'; }
function mealDone(dateStr, role, mealKey) { return !!(((state.checkins || {})[dateStr] || {})[role] || []).includes(mealKey); }
function harmony() { let h = 0; for (const d of Object.keys(state.checkins || {})) { const r = (state.checkins[d] || {}).rabbit || [], g = (state.checkins[d] || {}).dog || []; for (const m of r) if (g.includes(m)) h++; } return h; }
function checkinStreak(role) { let streak = 0; const d = new Date(); for (;;) { const p = (x) => ('' + x).padStart(2, '0'); const ds = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; const arr = ((state.checkins || {})[ds] || {})[role] || []; if (arr.length > 0) { streak++; d.setDate(d.getDate() - 1); } else if (streak === 0 && ds === todayStr()) { d.setDate(d.getDate() - 1); } else break; } return streak; }
function checkinTotal(role) { let n = 0; for (const d of Object.keys(state.checkins || {})) n += (((state.checkins[d] || {})[role] || []).length); return n; }
function personality(pet, role) {
  pet = pet || {}; const eat = checkinTotal(role), hug = (state.hugs || []).filter((h) => h.from === role).length, box = (pet.boxItems || []).length;
  const max = Math.max(eat, hug, box);
  if (max === 0) return { name: '小透明', emoji: '🌱', desc: '刚来到这个世界，等你来陪~' };
  if (max === eat) return { name: '小吃货', emoji: '🍰', desc: '按时吃饭第一名，干饭魂！' };
  if (max === hug) return { name: '黏人精', emoji: '🤗', desc: '最喜欢和 TA 贴贴' };
  return { name: '欧皇', emoji: '🍀', desc: '运气爆棚，盲盒常出金' };
}
function unreadWhispers() { return (state.whispers || []).filter((w) => w.to === auth.role && !w.read); }
function unreadHugs() { const seen = ((state.hugSeen || {})[auth.role]) || 0; return (state.hugs || []).filter((h) => h.from !== auth.role && h.ts > seen); }
function birthdayPetToday() { const t = todayMD(); return ROLES.filter((r) => PET_BIRTHDAYS[r] === t); }
function daysToBirthday(role) { const [m, dd] = PET_BIRTHDAYS[role].split('-').map(Number); const now = new Date(); let next = new Date(now.getFullYear(), m - 1, dd); if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, m - 1, dd); return Math.round((next - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000); }
function outfitUnlocked(key) { const lvl = expToLevel((myPet() || {}).exp), h = harmony(); const cond = { bow: [3, 0], beret: [6, 0], scarf: [9, 0], glasses: [12, 0], starclip: [15, 0], crown: [1, 21], bell: [1, 10], backpack: [1, 28] }[key]; const owned = ((myPet() || {}).ownedOutfits || []).includes(key); if (owned) return true; if (!cond) return false; return lvl >= cond[0] && h >= cond[1]; }
function outfitCondText(key) { return { bow: '等级 3', beret: '等级 6', scarf: '等级 9', glasses: '等级 12', starclip: '等级 15', crown: '默契 21', bell: '默契 10', backpack: '默契 28' }[key] || ''; }
/* 生成带锚点的配饰贴纸（z=1 在宠物后层，z=2 在身前） */
function outfitAnchorImg(key, cls) { const o = OUTFITS[key]; if (!o || !o.img) return ''; const a = o.a; return `<img class="${cls} ${a.z === 1 ? 'oa-back' : 'oa-front'}" src="${o.img}" style="left:${a.x}%;top:${a.y}%;width:${a.w}%" alt="">`; }

/* ================= 场景（本地 UI 偏好） ================= */
let sceneMode = 'home'; // home | work
function toggleScene() {
  sceneMode = sceneMode === 'home' ? 'work' : 'home';
  const btn = $('#btnSceneToggle');
  btn.textContent = sceneMode === 'home' ? '💼 去上班' : '🏠 下班回家';
  renderHome();
}

/* ================= 今日一句（每次进入换一句） ================= */
let storyIdx = -1;
function setStory() { storyIdx = Math.floor(Math.random() * STORIES.length); }
function refreshStory() { setStory(); renderStory(); }
function renderStory() {
  const el = $('#storyText'); if (!el) return;
  const s = STORIES[storyIdx < 0 ? dailyIndex('story', STORIES.length) : storyIdx];
  el.innerHTML = esc(s.replace(/\{meE\}/g, petEmoji(auth.role)).replace(/\{friendE\}/g, petEmoji(otherRole()))) + ` <button class="story-refresh" id="btnStoryRefresh" title="换一句">🔄</button>`;
  const b = $('#btnStoryRefresh'); if (b) b.addEventListener('click', refreshStory);
}

/* ================= 汤姆猫式互动宠物（数据 + 音效 + 动作） ================= */
const CARE_DECAY = { hunger: 1.4, clean: 0.7, happy: 0.9, energy: 1.1 };   // 每小时衰减
const PET_FOODS = {
  rabbit: [
    { id: 'carrot', name: '胡萝卜', emoji: '🥕', boost: 'hunger', note: '最爱！咔咔啃', like: 2 },
    { id: 'grass',  name: '青草',   emoji: '🌿', boost: 'hunger', note: '清新一口',   like: 1 },
    { id: 'fish',   name: '小鱼干', emoji: '🐟', boost: 'happy',  note: '挺香的',     like: 1 },
    { id: 'chili',  name: '辣椒',   emoji: '🌶️', boost: 'none',   note: '好辣！！',   like: 0 }
  ],
  dog: [
    { id: 'bone',   name: '肉骨头', emoji: '🦴', boost: 'hunger', note: '最爱的骨头！', like: 2 },
    { id: 'meat',   name: '肉肉',   emoji: '🥩', boost: 'hunger', note: '大口吃肉',   like: 2 },
    { id: 'fish',   name: '小鱼干', emoji: '🐟', boost: 'happy',  note: '香香哒',     like: 1 },
    { id: 'bitter', name: '苦瓜',   emoji: '🥒', boost: 'none',   note: '好苦…',      like: 0 }
  ]
};
/* 抚摸分区（相对宠物图片区域的百分比坐标） */
const PET_ZONES = {
  rabbit: [
    { part: 'head',  x: 22, y: 14, w: 54, h: 32, icon: '😊' },
    { part: 'ear',   x: 6,  y: 1,  w: 28, h: 22, icon: '🪶' },
    { part: 'earR',  x: 66, y: 1,  w: 28, h: 22, icon: '🪶' },
    { part: 'nose',  x: 36, y: 28, w: 28, h: 14, icon: '👃' },
    { part: 'belly', x: 24, y: 50, w: 52, h: 42, icon: '🤍' }
  ],
  dog: [
    { part: 'head',  x: 24, y: 14, w: 52, h: 34, icon: '😊' },
    { part: 'ear',   x: 6,  y: 8,  w: 30, h: 26, icon: '🐶' },
    { part: 'earR',  x: 64, y: 8,  w: 30, h: 26, icon: '🐶' },
    { part: 'nose',  x: 40, y: 32, w: 20, h: 16, icon: '👃' },
    { part: 'belly', x: 30, y: 55, w: 42, h: 32, icon: '🤍' },
    { part: 'paw',   x: 12, y: 70, w: 26, h: 24, icon: '🐾' }
  ]
};
const PET_REACT = {
  head:  { emoji: '😊', anim: 'anim-happy',  sound: 'purr',   lines: ['最喜欢摸头啦~', '蹭蹭~', '好舒服…'] },
  ear:   { emoji: '🪶', anim: 'anim-wiggle', sound: 'pop',    lines: ['耳朵痒痒的…', '嘿嘿别碰耳朵啦~'] },
  earR:  { emoji: '🪶', anim: 'anim-wiggle', sound: 'pop',    lines: ['耳朵痒痒的…', '另一边也要挠挠~'] },
  nose:  { emoji: '🌸', anim: 'anim-purr',   sound: 'boop',   lines: ['哼哼~ 闻到了好吃的', '鼻子酸酸哒'] },
  belly: { emoji: '🤣', anim: 'anim-laugh',  sound: 'giggle', lines: ['哈哈哈好痒~~~', '噗，别戳肚子！'] },
  paw:   { emoji: '✋', anim: 'anim-wave',   sound: 'pop',    lines: ['击掌！', '咯咯咯拍到啦~'] },
  body:  { emoji: '💛', anim: 'anim-happy',  sound: 'purr',   lines: ['再摸摸~', '好呀好呀~', '最喜欢你啦'] }
};

function defaultStats() { return { hunger: 88, clean: 96, happy: 86, energy: 92, ts: Date.now(), fed: '', bathe: '', slept: '' }; }
function care(role) { const p = state.pets[role]; if (!p) return defaultStats(); if (!p.stats) p.stats = defaultStats(); return p.stats; }

/* ================= 真 3D 舞台（Three.js）桥接 ================= */
const P3D_VER = '20260909b';
let P3Dmod = null;      // 当前恒为 null：主舞台固定使用 watercolor PNG 平面模式（参考图造型）
let P3Dmode = 'loading'; // '2d' | '3d' | 'loading'（现恒为 '2d'：水彩 PNG 立绘 + DOM 分区互动）
let sleepState = {};    // role -> true/false（内存态：睡觉/醒来）
/* 挑食表：rabbit / dog 对所有食物 id 的口味（2 爱吃 / 1 一般 / 0 嫌弃） */
const TASTE = {
  rabbit: { carrot: 2, grass: 1, fish: 1, chili: 0, bone: 0, meat: 0, bitter: 0 },
  dog: { bone: 2, meat: 2, fish: 1, bitter: 0, carrot: 0, grass: 0, chili: 0 }
};
const P3D_FX_MAP = { head: 'poke-head', belly: 'poke-belly', ear: 'poke-ear', earR: 'poke-ear', nose: 'poke-nose', paw: 'poke-paw', tail: 'poke-tail', body: 'poke-body', mouth: 'poke-nose' };
const REACT_FALLBACK = { tail: 'body', mouth: 'nose' };

function ensurePet3D() {
  // 水彩 PNG 平面模式为默认与唯一模式（参考图造型，即「你之前做过的」版本）。
  // 直接渲染 assets/pet_rabbit.png / pet_dog.png（透明背景水彩立绘），不再拉起卡通 SVG。
  P3Dmode = '2d'; P3Dmod = null;
  document.body.classList.remove('p3d-mode');
  try { const cv = document.getElementById('p3dCv'); if (cv && cv.parentNode) cv.parentNode.removeChild(cv); } catch (e) {}
  return null;
}
/* 真机 WebGL 崩溃/上下文丢失 → 切回 2D 平面舞台，绝不让页面白屏 */
function p3dOnFail(reason) {
  console && console.warn && console.warn('pet3d fail → 2d', reason);
  if (P3Dmode === '3d') {
    P3Dmode = '2d';
    if (P3Dmod && P3Dmod.destroy) { try { P3Dmod.destroy(); } catch (e) {} }
    P3Dmod = null;
  }
  document.body.classList.remove('p3d-mode');
  try { const cv = document.getElementById('p3dCv'); if (cv && cv.parentNode) cv.parentNode.removeChild(cv); } catch (e) {}
  ['p3dBub', 'p3dNames', 'p3dUI'].forEach((id) => { const x = document.getElementById(id); if (x && x.parentNode) x.parentNode.removeChild(x); });
  const st = $('#petStage'); if (st) { st.classList.remove('bathing'); st.classList.remove('sleeping'); }
  try { const tray = $('#feedTray'); if (tray && tray.parentNode) tray.parentNode.removeChild(tray); } catch (e) {}
  window.__bootMsg && window.__bootMsg('正在切换画质模式…');
  if (typeof toast === 'function') toast('3D 模式不可用，已切到平面模式 🐰');
  renderStagePets(sceneMode === 'work');
  window.__bootMsg && window.__bootMsg('正在准备我们的小窝…');
}
function p3dOnTap(role, part) {
  if (!role) return;
  if (sleepState[role] && P3Dmode === '3d') { wakePet(role); return; }
  petReact(role, part);
}
/* 统一抚摸分发（3D 模式走 pet3d 动画 + 覆盖层气泡；2D 走原 DOM 分区动画） */
function petReact(role, part) {
  if (P3Dmode === '3d' && P3Dmod) {
    const fall = REACT_FALLBACK[part] || part;
    const r = PET_REACT[fall] || PET_REACT.body;
    const fxKind = P3D_FX_MAP[fall] || 'poke-body';
    P3Dmod.act(role, fxKind, { part: fall === 'ear' ? 'earL' : fall });
    say3D(role, r.lines[Math.floor(Math.random() * r.lines.length)]);
    emoji3D(role, r.emoji);
    sfx(r.sound || 'pop');
    if (role === auth.role) bumpCare(role, 'happy', +3);
    renderPetStats();
  } else reactPart(role, part);
}
/* 3D 覆盖层（气泡 / 名字 / 浮动 emoji）——跟随宠物头位置 */
function p3dUI() {
  let l = document.getElementById('p3dUI');
  if (!l) {
    l = document.createElement('div'); l.id = 'p3dUI'; l.className = 'p3d-ui';
    const stage = $('#petStage'); if (stage) stage.appendChild(l);
    l.innerHTML = '<div id="p3dBub" class="p3d-bub"></div><div id="p3dNames" class="p3d-names"></div>';
  }
  return l;
}
function say3D(role, text, dur) {
  if (P3Dmode !== '3d' || !P3Dmod) return;
  p3dUI(); const el = $('#p3dBub'); if (!el) return;
  el.textContent = text; el.classList.add('show');
  const host = $('#petStagePets'); const a = P3Dmod.headPx(role);
  if (a && host) {
    el.style.left = clamp((a.x / (host.clientWidth || 1)) * 100, 8, 92) + '%';
    el.style.top = clamp((a.y / (host.clientHeight || 1)) * 100 - 14, 2, 60) + '%';
  } else { el.style.left = '50%'; el.style.top = '16%'; }
  clearTimeout(say3D._t); say3D._t = setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, dur || 2600);
}
function emoji3D(role, emoji) {
  if (P3Dmode !== '3d' || !P3Dmod) return;
  p3dUI(); const layer = document.getElementById('p3dUI'); if (!layer) return;
  const el = document.createElement('span'); el.className = 'float-emoji'; el.textContent = emoji;
  const host = $('#petStagePets'); const a = P3Dmod.headPx(role);
  const hw = (host && host.clientWidth) || 1, hh = (host && host.clientHeight) || 1;
  const bx = a ? (a.x / hw) * 100 : 40 + Math.random() * 20;
  const by = a ? (a.y / hh) * 100 : 30;
  el.style.left = clamp(bx - 3, 4, 92) + '%';
  el.style.top = clamp(by + (a ? -2 : 6), 8, 80) + '%';
  layer.appendChild(el); setTimeout(() => el.remove(), 1400);
}
function updateNames3D() {
  if (P3Dmode !== '3d') return;
  p3dUI(); const el = $('#p3dNames'); if (!el) return;
  const mk = (role) => `${petEmoji(role)} ${esc(((state.pets || {})[role] || {}).name || '')} <i>Lv.${expToLevel(((state.pets || {})[role] || {}).exp || 0)}</i>`;
  el.innerHTML = mk(auth.role) + (otherPet() ? ' <span class="sep">·</span> ' + mk(otherRole()) : ' <span class="sep">·</span> 等 TA 来');
}
/* 睡觉 / 被吵醒（3D：dock 😴 睡 / 点它吵醒） */
function p3dSetSleep(role, on) {
  sleepState[role] = !!on;
  if (P3Dmode === '3d' && P3Dmod) {
    P3Dmod.setSleeping(role, on);
    if (on) { P3Dmod.act(role, 'sleep'); sfx('sleepy'); say3D(role, 'Zzz… 呼噜噜~ 💤'); }
  }
}
function wakePet(role) {
  p3dSetSleep(role, false);
  const stage = $('#petStage'); if (stage) stage.classList.remove('sleeping');
  if (P3Dmode === '3d' && P3Dmod) {
    P3Dmod.act(role, 'startle');
    const me = role === auth.role;
    setTimeout(() => { if (P3Dmode === '3d' && P3Dmod) { P3Dmod.act(role, 'grumpy'); sfx('boop'); say3D(role, me ? randomOf(['呜…吵醒我啦 😠', '刚梦到好吃的…赔我！']) : '唔…再睡五分钟…'); } }, 900);
    if (me) { bumpCare(role, 'happy', -4); }
    renderPetStats();
  }
}
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function petSleepVisual() {
  // 回填：energy 低（<15）的宠物进入犯困视觉（纯表演，不改数据）
  if (P3Dmode !== '3d' || !P3Dmod) return;
  ROLES.forEach((r) => {
    const want = sleepState[r] === true ? true : effCare(r).energy < 15;
    if (P3Dmod.isSleeping(r) !== want) P3Dmod.setSleeping(r, want);
  });
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function effCare(role) {
  const st = care(role); const hrs = Math.max(0, (Date.now() - (st.ts || Date.now())) / 3600000);
  const mk = (v, r) => Math.round(clamp(v - hrs * r, 0, 100));
  return { hunger: mk(st.hunger, CARE_DECAY.hunger), clean: mk(st.clean, CARE_DECAY.clean), happy: mk(st.happy, CARE_DECAY.happy), energy: mk(st.energy, CARE_DECAY.energy) };
}
function bumpCare(role, key, delta) { const st = care(role); const e = effCare(role); st[key] = clamp(e[key] + delta, 0, 100); st.ts = Date.now(); saveLocalState(); }

/* ---------- 互动渲染 ---------- */
function renderPetStats() {
  const el = $('#petStats'); if (!el) return;
  const e = effCare(auth.role);
  const pill = (em, val) => `<span class="stat-pill ${val < 35 ? 'low' : ''}">${em}<b>${val}</b></span>`;
  el.innerHTML = pill('🍖', e.hunger) + pill('🫧', e.clean) + pill('😊', e.happy) + pill('🔋', e.energy);
}
function stagePetHtml(role, big, pos) {
  const pet = state.pets[role]; if (!pet) return '';
  const out = outfitAnchorImg(pet.outfit, 'scene-outfit') || '';
  const zones = (PET_ZONES[role] || []).map((z) => `<span class="pet-zone" data-role="${role}" data-part="${z.part}" data-icon="${z.icon}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%"></span>`).join('');
  return `<div class="stage-pet scene-pet ${big ? 'big' : 'mini'} pos-${pos}" data-role="${role}">
    <div class="sp-name">${petEmoji(role)} ${esc(pet.name)} <i>Lv.${expToLevel(pet.exp)}</i></div>
    <div class="sp-fig">${out}<img class="sp-img" src="${PET_IMG[role]}" alt="">${zones}<span class="pet-aura"></span></div>
    <div class="sp-shadow"></div>
    <div class="sp-bubble"></div>
    <div class="pet-zzz"><i>Z</i><i>z</i><i>z</i></div>
  </div>`;
}
function renderStagePets(atWork) {
  const host = $('#petStagePets'); if (!host) return;
  const legacyHtml = () => {
    let html = stagePetHtml(auth.role, !atWork, atWork ? 'workA' : 'center');
    if (otherPet()) html += stagePetHtml(otherRole(), false, atWork ? 'workB' : 'side');
    else html += `<div class="stage-empty">🏠 还有点空<br>等 TA 来~</div>`;
    return html;
  };
  if (P3Dmode === '3d' && P3Dmod) {
    // 绝不能 innerHTML 清空：canvas 是 host 的子节点，会被一起毁掉。只移除「非画布」的子节点。
    const cv = document.getElementById('p3dCv');
    Array.from(host.children).forEach((ch) => { if (ch !== cv) host.removeChild(ch); });
    if (cv && cv.parentNode !== host) host.appendChild(cv);
    const roles = [{ role: auth.role, my: true }];
    if (otherPet()) roles.push({ role: otherRole(), my: false });
    else { const e = document.createElement('div'); e.className = 'stage-empty p3d-empty'; e.innerHTML = '🏠 还有点空<br>等 TA 来~'; host.appendChild(e); }
    P3Dmod.setMode({ my: auth.role, atWork, roles });
    updateNames3D();
    return;
  }
  host.innerHTML = legacyHtml();
  if (P3Dmode === '2d') return;
  // loading / 首次进入：后台把 3D 引擎拉起来，就绪后自动切 3D
  P3Dmode = 'loading';
  ensurePet3D();
}
function renderDock() {
  const el = $('#petDock'); if (!el) return;
  el.innerHTML = `
    <button class="dock-btn main" data-act="feed"><span class="db-ico">🍖</span><span class="db-t">喂食</span></button>
    <button class="dock-btn main" data-act="bathe"><span class="db-ico">🫧</span><span class="db-t">洗澡</span></button>
    <button class="dock-btn main" data-act="sleep"><span class="db-ico">😴</span><span class="db-t">睡觉</span></button>
    <button class="dock-btn" data-act="talk"><span class="db-ico">🎤</span><span class="db-t">说话</span></button>
    <button class="dock-btn" data-act="help"><span class="db-ico">💡</span><span class="db-t">提示</span></button>`;
}

/* ---------- 互动动作 ---------- */
function bub(pet, text) { if (!pet) return; const el = pet.querySelector('.sp-bubble'); if (el) { el.textContent = text; el.classList.add('show'); clearTimeout(bub._t); bub._t = setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, 2600); } }
function floatEmoji(emoji, pet, mode) {
  const layer = $('#stageFloat'); if (!layer) return;
  const el = document.createElement('span'); el.className = 'float-emoji'; el.textContent = emoji;
  let x = 30 + Math.random() * 40, y = 40;
  if (pet) { const r = pet.getBoundingClientRect(); const lr = layer.getBoundingClientRect(); if (lr.width) x = ((r.left + r.width * (0.28 + Math.random() * 0.44)) - lr.left) / lr.width * 100; if (lr.height) y = ((r.top + r.height * (0.15 + Math.random() * 0.4)) - lr.top) / lr.height * 100; }
  el.style.left = clamp(x, 6, 94) + '%'; el.style.top = clamp(y, 16, 82) + '%';
  layer.appendChild(el); setTimeout(() => el.remove(), 1400);
}
function reactPart(role, part) {
  const pet = document.querySelector(`.stage-pet[data-role="${role}"]`); if (!pet) return;
  const r = PET_REACT[part] || PET_REACT.body; const fig = pet.querySelector('.sp-fig');
  if (fig) { fig.classList.remove('anim-happy', 'anim-wiggle', 'anim-laugh', 'anim-wave', 'anim-purr', 'anim-eat'); void fig.offsetWidth; fig.classList.add(r.anim); setTimeout(() => fig.classList.remove(r.anim), 1400); }
  floatEmoji(r.emoji, pet);
  bub(pet, r.lines[Math.floor(Math.random() * r.lines.length)]);
  sfx(r.sound || 'pop');
  pet.classList.add('aura'); setTimeout(() => pet.classList.remove('aura'), 750);
  if (role === auth.role) bumpCare(role, 'happy', +3);
  renderPetStats();
}
function spawnBubbles(pet) { const fig = pet && pet.querySelector('.sp-fig'); if (!fig) return; const l = document.createElement('div'); l.className = 'bub-layer'; for (let i = 0; i < 14; i++) { const b = document.createElement('span'); b.className = 'bub'; b.style.left = (8 + Math.random() * 84) + '%'; b.style.setProperty('--d', Math.round(Math.random() * 4)); l.appendChild(b); } fig.appendChild(l); }
function clearBubbles(pet) { const fig = pet && pet.querySelector('.sp-fig'); if (fig) { const l = fig.querySelector('.bub-layer'); if (l) l.remove(); } }
function sfx(type) {
  try {
    const ctx = sfx.ctx || (sfx.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const now = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    let f = 420, dur = 0.12, vol = 0.12; o.type = 'sine';
    if (type === 'pop') { f = 620; dur = 0.1; vol = 0.14; }
    else if (type === 'boop') { f = 300; dur = 0.16; vol = 0.15; }
    else if (type === 'giggle') { f = 540; dur = 0.22; vol = 0.14; }
    else if (type === 'purr') { o.type = 'sawtooth'; f = 120; dur = 0.5; vol = 0.05; }
    else if (type === 'munch') { o.type = 'square'; f = 170; dur = 0.55; vol = 0.09; }
    else if (type === 'splash') { o.type = 'sine'; f = 220; dur = 0.6; vol = 0.12; }
    else if (type === 'sleepy') { o.type = 'sine'; f = 300; dur = 0.9; vol = 0.1; }
    o.frequency.setValueAtTime(f, now);
    if (type === 'pop' || type === 'boop') o.frequency.exponentialRampToValueAtTime(f * 2.2, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.start(now); o.stop(now + dur + 0.03);
  } catch (e) {}
}
const FOOD_FALLBACK_EMOJI = { carrot: '🥕', grass: '🌿', fish: '🐟', chili: '🌶️', bone: '🦴', meat: '🥩', bitter: '🥒' };
function foodOf(id) {
  for (const r of ROLES) { const f = (PET_FOODS[r] || []).find((x) => x.id === id); if (f) return f; }
  return { id, name: id, emoji: FOOD_FALLBACK_EMOJI[id] || '🍽️', note: '', like: 1 };
}
function stagePetDom(role) { return document.querySelector(`.stage-pet[data-role="${role}"]`); }
function tasteOf(role, food) { const t = TASTE[role] && TASTE[role][food.id]; return (typeof t === 'number') ? t : (food.like === 0 || food.like === 2 ? food.like : 1); }

/* ---------- 喂食托盘：点一下喂自己；按住拖到宠物嘴边喂它（2D/3D 通吃） ---------- */
let feedTrayEl = null, feedTrayTimer = null;
function openFeed() {
  const stage = $('#petStage'); if (!stage) return;
  closeFeedTray();
  const items = (PET_FOODS[auth.role] || PET_FOODS.rabbit).map((f) => {
    const tag = f.like === 2 ? '<u class="ft-heart">❤</u>' : (f.like === 0 ? '<u class="ft-no">✗</u>' : '<u class="ft-ok">○</u>');
    return `<span class="ft-item ${f.like === 2 ? 'love' : (f.like === 0 ? 'no' : '')}" data-food="${f.id}" data-emoji="${f.emoji}" data-name="${f.name}"><i class="ft-em">${f.emoji}</i><b>${f.name}</b>${tag}</span>`;
  }).join('');
  const t = document.createElement('div');
  t.id = 'feedTray'; t.className = 'feed-tray';
  t.innerHTML = `<div class="ft-head"><span>🍽️ 喂 ${petEmoji(auth.role)}${esc(myName())}：<b class="ft-tip">按住拖到 TA 嘴边</b>，或轻点喂自己</span><button class="ft-x" data-x="1">✕</button></div><div class="ft-items">${items}</div><div class="ft-legend">❤ 最爱 · ○ 还行 · ✗ 不喜欢</div>`;
  stage.appendChild(t); feedTrayEl = t;
  stage.classList.add('tray-open');
  const x = t.querySelector('.ft-x'); if (x) x.addEventListener('click', closeFeedTray);
  t.querySelectorAll('.ft-item').forEach((it) => it.addEventListener('pointerdown', (ev) => startFeedDrag(it, ev)));
  feedTrayTimer = setTimeout(closeFeedTray, 9000);
}
function closeFeedTray() {
  clearTimeout(feedTrayTimer); feedTrayTimer = null;
  if (feedTrayEl) { const st = $('#petStage'); if (st) st.classList.remove('tray-open'); feedTrayEl.remove(); feedTrayEl = null; }
}
function startFeedDrag(it, ev) {
  const foodId = it.dataset.food;
  try { it.setPointerCapture(ev.pointerId); } catch (e) {}
  const g = document.createElement('div'); g.className = 'fd-ghost'; g.textContent = it.dataset.emoji;
  document.body.appendChild(g);
  const startX = ev.clientX, startY = ev.clientY; let moved = false;
  const move = (e) => { moved = true; g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; };
  const end = (e) => {
    it.removeEventListener('pointermove', move); it.removeEventListener('pointerup', end); it.removeEventListener('pointercancel', end);
    if (g.parentNode) g.parentNode.removeChild(g);
    const isTap = !moved || Math.hypot(e.clientX - startX, e.clientY - startY) < 12;
    if (isTap) { closeFeedTray(); doFeed(auth.role, foodId); return; }   // 轻点 = 喂自己
    const hit = feedTargetAt(e.clientX, e.clientY);
    const role = (hit && hit.role) ? hit.role : auth.role;               // 拖到别人身上就喂别人
    closeFeedTray(); doFeed(role, foodId);
  };
  it.addEventListener('pointermove', move); it.addEventListener('pointerup', end); it.addEventListener('pointercancel', end);
  g.style.left = startX + 'px'; g.style.top = startY + 'px';
}
function feedTargetAt(x, y) {
  if (P3Dmode === '3d' && P3Dmod) { try { const h = P3Dmod.pickAt(x, y); if (h && h.role) return h; } catch (e) {} }
  const el = document.elementFromPoint(x, y);
  const pet = el && el.closest ? el.closest('.stage-pet[data-role]') : null;
  return pet ? { role: pet.dataset.role } : null;
}
/* 3D 洗澡泡泡覆盖层 */
function p3dBubbles(on) {
  const host = $('#petStagePets'); if (!host) return;
  let l = document.getElementById('p3dBubLayer');
  if (!on) { if (l) l.remove(); return; }
  if (l) l.remove();
  l = document.createElement('div'); l.id = 'p3dBubLayer'; l.className = 'bub-layer';
  for (let i = 0; i < 22; i++) { const b = document.createElement('span'); b.className = 'bub'; b.style.left = (4 + Math.random() * 92) + '%'; b.style.setProperty('--d', String(Math.round(Math.random() * 4))); l.appendChild(b); }
  host.appendChild(l);
}
async function doFeed(role, foodId) {
  const food = foodOf(foodId); const st = care(role); const e = effCare(role);
  const like = tasteOf(role, food);
  if (like <= 0) {
    // 😤 挑食：嫌弃 → 扭头 + 生气，心情下降
    st.happy = clamp(e.happy - 5, 0, 100); st.clean = clamp(e.clean - 1, 0, 100); st.ts = Date.now(); saveLocalState();
    const lines = role === 'rabbit'
      ? ['我吃素的！拿走拿走~', '闻了闻…嫌弃.jpg', '才不要！哼 😤']
      : ['我不是兔子！这个不吃', '苦的辣的我才不要！', '嫌弃…拿走拿走'];
    if (P3Dmode === '3d' && P3Dmod) { P3Dmod.act(role, 'reject'); say3D(role, randomOf(lines)); emoji3D(role, '😖'); }
    else {
      const pet = stagePetDom(role);
      if (pet) { floatEmoji('😖', pet); bub(pet, randomOf(lines)); const fig = pet.querySelector('.sp-fig'); if (fig) { fig.classList.remove('anim-wiggle'); void fig.offsetWidth; fig.classList.add('anim-wiggle'); setTimeout(() => fig.classList.remove('anim-wiggle'), 1400); } pet.classList.add('aura'); setTimeout(() => pet.classList.remove('aura'), 750); }
    }
    sfx('boop'); renderPetStats(); await push(true); return;
  }
  st.hunger = 100; st.happy = clamp(e.happy + (like === 2 ? 12 : 8), 0, 100); st.clean = clamp(e.clean - 4, 0, 100); st.ts = Date.now(); st.fed = todayStr(); saveLocalState();
  if (P3Dmode === '3d' && P3Dmod) {
    P3Dmod.act(role, 'eat');
    say3D(role, like === 2 ? `${food.emoji} 是我最爱！吧唧吧唧` : `${food.emoji} 好吃~ 吧唧吧唧`, 2200);
    emoji3D(role, like === 2 ? '🤤' : '😋');
    setTimeout(() => { if (P3Dmode === '3d' && P3Dmod && !sleepState[role]) P3Dmod.act(role, 'happy'); }, 950);
  } else {
    const pet = stagePetDom(role); const fig = pet && pet.querySelector('.sp-fig');
    if (fig) { fig.classList.remove('anim-eat'); void fig.offsetWidth; fig.classList.add('anim-eat'); setTimeout(() => fig.classList.remove('anim-eat'), 2500); }
    floatEmoji(food.emoji, pet); bub(pet, `${food.emoji} 太好吃啦~ 吧唧吧唧`); sfx('munch');
  }
  sfx('munch'); renderPetStats(); await push(true);
}
async function doBathe(role) {
  const st = care(role); const e = effCare(role);
  st.clean = 100; st.happy = clamp(e.happy + 5, 0, 100); st.ts = Date.now(); st.bathe = todayStr(); saveLocalState();
  const stage = $('#petStage');
  if (P3Dmode === '3d' && P3Dmod) {
    if (stage) stage.classList.add('bathing');
    sfx('splash'); p3dBubbles(true); P3Dmod.act(role, 'happy'); say3D(role, '🫧 泡泡浴~ 好舒服');
    setTimeout(() => { if (stage) stage.classList.remove('bathing'); p3dBubbles(false); if (P3Dmod && P3Dmode === '3d') { P3Dmod.act(role, 'happy'); } floatEmoji('✨'); say3D(role, '洗得香喷喷✨'); }, 3000);
  } else {
    const pet = stagePetDom(role);
    if (stage && pet) {
      stage.classList.add('bathing'); pet.classList.add('bathing'); spawnBubbles(pet); sfx('splash'); bub(pet, '🫧 泡泡浴~ 好舒服');
      setTimeout(() => { stage.classList.remove('bathing'); pet.classList.remove('bathing'); clearBubbles(pet); floatEmoji('✨', pet); bub(pet, '洗得香喷喷~'); }, 2800);
    }
  }
  renderPetStats(); await push(true);
}
async function doSleep(role) {
  const st = care(role); const e = effCare(role);
  st.energy = 100; st.happy = clamp(e.happy + 3, 0, 100); st.ts = Date.now(); st.slept = todayStr(); saveLocalState();
  const stage = $('#petStage');
  if (P3Dmode === '3d' && P3Dmod) {
    if (stage) stage.classList.add('sleeping');
    p3dSetSleep(role, true);   // 闭眼 + 缓慢呼吸
    setTimeout(() => {
      if (!sleepState[role]) return;                       // 已被点醒就不重复播报
      if (stage) stage.classList.remove('sleeping');
      p3dSetSleep(role, false);
      if (P3Dmod && P3Dmode === '3d') P3Dmod.act(role, 'wake');
      say3D(role, '睡醒啦，精神满满！'); floatEmoji('☀️');
    }, 4200);
  } else {
    const pet = stagePetDom(role);
    if (stage) { stage.classList.add('sleeping'); sfx('sleepy'); bub(pet, 'Zzz… 睡饱饱啦~'); }
    setTimeout(() => { if (stage) stage.classList.remove('sleeping'); floatEmoji('☀️', pet); bub(pet, '睡醒啦，精神满满！'); }, 4200);
  }
  renderPetStats(); await push(true);
}
let recog = null, petTalking = false;
function talkPet(role) {
  if (petTalking) return;
  const synth = window.speechSynthesis;
  const speak = (t) => { if (synth) { try { const u = new SpeechSynthesisUtterance(t); u.rate = 1.3; u.pitch = 1.7; u.volume = 0.92; synth.cancel(); synth.speak(u); } catch (e) {} } };
  /* 2D/3D 通用“宠物说话气泡”：3D 下嘴巴同步张合 */
  const show = (txt, dur) => {
    if (P3Dmode === '3d' && P3Dmod) { const ms = dur || Math.min(2600, 700 + (txt || '').length * 220); P3Dmod.act(role, 'talk', { ms }); say3D(role, txt, ms); }
    else { const pet = stagePetDom(role); if (pet) bub(pet, txt); }
  };
  const fallback = () => { const l = PET_LINES[Math.floor(Math.random() * PET_LINES.length)]; show('🔊 ' + l); speak(l); };
  sfx('pop'); show('🎤 来呀，跟我说句话~', 1500);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    try {
      if (recog) { try { recog.abort(); } catch (e) {} }
      recog = new SR(); recog.lang = 'zh-CN'; recog.interimResults = false; recog.maxAlternatives = 1; petTalking = true;
      recog.onstart = () => { show('听你说…', 1400); };
      recog.onresult = (ev) => { petTalking = false; const t = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || ''; if (t) { show('🗣️ ' + t.slice(0, 14)); speak(t); } else { show('没听清，再说一遍?'); } };
      recog.onerror = () => { petTalking = false; fallback(); };
      recog.onend = () => { petTalking = false; };
      recog.start();
    } catch (e) { petTalking = false; fallback(); }
  } else fallback();
}
function runDock(act) {
  const role = auth.role;
  if (act === 'feed') openFeed();
  else if (act === 'bathe') doBathe(role);
  else if (act === 'sleep') doSleep(role);
  else if (act === 'talk') talkPet(role);
  else if (act === 'help') toast('👆 摸它的头/耳朵/肚子/爪子有不同反应；喂食·洗澡·睡觉·说话都在下面哦');
}
function toggleSheet(open) {
  const s = $('#homeSheet'); if (!s) return;
  s.classList.toggle('open', open == null ? !s.classList.contains('open') : open);
}

/* ================= 渲染 ================= */
function renderAll() { if (!auth || !state) return; renderTopbar(); renderBanner(); renderHome(); renderCheckin(); renderInteract(); renderMood(); renderRoom(); renderGameStatus(); }

function renderTopbar() { $('#harmonyVal').textContent = harmony(); $('#roomTag').textContent = otherPet() ? `和 ${petEmoji(otherRole())}${otherName()} 一起` : '等 TA 搬进来~'; renderDaysPill(); }

function petSceneEl(role, side) {
  const pet = state.pets[role]; if (!pet) return '';
  const out = OUTFITS[pet.outfit] && OUTFITS[pet.outfit].img ? outfitAnchorImg(pet.outfit, 'scene-outfit') : '';
  return `<div class="scene-pet ${side}" data-role="${role}">
    <div class="sp-name">${petEmoji(role)} ${esc(pet.name)} <i>Lv.${expToLevel(pet.exp)}</i></div>
    <div class="sp-fig"><img class="sp-img" src="${PET_IMG[role]}" alt="">${out}</div>
    <div class="sp-shadow"></div>
    <div class="sp-bubble"></div>
  </div>`;
}
/* 家具贴纸 HTML（shared：小屋可编辑 / 主页小家只读） */
function decorItemsHtml(interactive) {
  return (state.roomDecor || []).map((d) => {
    const f = furnitureFor(d.itemId);
    const im = f.img ? `<img src="${f.img}" alt="">` : `<span>${f.emoji}</span>`;
    const del = interactive ? `<button class="decor-del" data-id="${d.id}">✕</button>` : '';
    const x = (typeof d.x === 'number' && isFinite(d.x)) ? d.x : 50;
    const y = (typeof d.y === 'number' && isFinite(d.y)) ? d.y : 50;
    const w = (f.s && f.s[0]) || 24;
    return `<div class="decor-item ${interactive ? '' : 'ro'}" data-id="${d.id}" style="left:${x}%;top:${y}%;width:${w}%">${im}${del}</div>`;
  }).join('');
}
function renderHome() {
  const atWork = sceneMode === 'work';
  document.body.classList.toggle('at-work', atWork);   // 全局氛围切换（CSS 冷/暖色调）
  const bg = atWork ? SCENE_IMG.work : wallImg((state.wallpaper && state.wallpaper.v) || 'cream');
  const bgEl = $('#stageBg'); if (bgEl) bgEl.src = bg;
  renderStagePets(atWork);      // 汤姆猫式大宠物 + 抚摸分区
  renderPetStats();             // 饱食/干净/开心/精力
  renderDock();                 // 喂食/洗澡/睡觉/说话/提示
  if (atWork) renderWorkPanel(); else renderHomePanel();
  const me = myPet();
  const lp = levelProgress(me && me.exp);
  $('#expRow').innerHTML = `<span>Lv.${lp.lvl}</span><div class="exp-bar"><b style="width:${lp.pct}%"></b></div><span>${lp.cur}/${lp.need}</span>`;
  const per = personality(me, auth.role);
  $('#personalityBox').innerHTML = `性格：<b>${per.emoji} ${per.name}</b> · ${per.desc}`;
  renderStory();
}
/* 在家小面板：今日干饭 + 快捷跳转（和上班工作面板完全区分开） */
function renderHomePanel() {
  const d = todayStr();
  const meals = MEALS.filter((m) => mealDone(d, auth.role, m.key)).length;
  const otRole = otherPet() ? otherRole() : null;
  const otMeals = otRole ? MEALS.filter((m) => mealDone(d, otRole, m.key)).length : -1;
  $('#studyTask').innerHTML = `<div class="work-panel home-panel">
    <div class="work-row"><span class="task-t">🍚 今日干饭</span><span class="task-d">我 ${meals}/${MEALS.length} 顿${otMeals >= 0 ? ' · ' + petEmoji(otRole) + esc(otherName()) + ' ' + otMeals + '/' + MEALS.length + ' 顿' : ''}</span><button class="btn-mini green" id="btnGoCheckin" style="flex:none">去打卡</button></div>
    <div class="work-row"><span class="task-t">🎮 找 TA 玩</span><span class="task-d">互动页有 6 种小玩法</span><button class="btn-mini" id="btnGoInteract" style="flex:none">去互动</button></div>
  </div>`;
  const a = $('#btnGoCheckin'); if (a) a.addEventListener('click', () => document.querySelector('.tabbar button[data-tab="checkin"]').click());
  const b2 = $('#btnGoInteract'); if (b2) b2.addEventListener('click', () => document.querySelector('.tabbar button[data-tab="interact"]').click());
}

/* ---------- 工作面板（上班/下班打卡 + 番茄钟 + 待办 + 周报） ---------- */
function renderWorkPanel() {
  const day = todayStr(), me = auth.role, ot = otherPet();
  state.commute = state.commute || {}; state.focus = state.focus || {}; state.todos = state.todos || [];
  const c = (state.commute[day] || {});
  const inTs = c[me];
  let commuteHtml;
  if (inTs) commuteHtml = `<span class="task-ok">✅ ${fmtTime(inTs)} 已上班 · 下班打卡见</span>`;
  else commuteHtml = `<span class="task-t">💼 开工啦</span><button class="btn-mini green" id="btnCheckIn" style="flex:none">上班打卡</button>`;
  // 番茄钟
  const fs = (state.focus[day] || {}), myFocus = (fs[me] || 0), otFocus = (fs[ot || ''] || 0);
  const focusHtml = `<div class="work-row"><span class="task-t">🍅 今日专注</span><span class="task-d">我 ${Math.round(myFocus/60)}分 · ${ot ? petEmoji(otherRole()) + esc(otherName()) + ' ' + Math.round(otFocus/60) + '分' : 'TA 还没来'}</span><button class="btn-mini" id="btnFocus" style="flex:none">开始专注</button></div>`;
  // 待办
  const pending = state.todos.filter((t) => !t.done).length;
  const todoHtml = `<div class="work-row"><span class="task-t">📝 共享待办</span><span class="task-d">还有 ${pending} 件</span><button class="btn-mini" id="btnTodo" style="flex:none">管理</button></div>`;
  // 周报
  const weekHtml = `<div class="work-row"><span class="task-t">📊 本周专注</span><span class="task-d">${weekFocus()}</span></div>`;
  $('#studyTask').innerHTML = `<div class="work-panel">${focusHtml}${todoHtml}${commuteHtml}${weekHtml}</div>`;
  const bf = $('#btnFocus'); if (bf) bf.addEventListener('click', openFocus);
  const bt = $('#btnTodo'); if (bt) bt.addEventListener('click', openTodos);
  const bi = $('#btnCheckIn'); if (bi) bi.addEventListener('click', () => doCommute(day));
}
function weekFocus() {
  state.focus = state.focus || {};
  let sec = 0; const now = new Date();
  for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(now.getDate() - i); const p = (n) => ('' + n).padStart(2, '0'); const ds = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; sec += (((state.focus[ds] || {}).rabbit || 0) + ((state.focus[ds] || {}).dog || 0)); }
  return `两人共专注 <b>${Math.round(sec / 60)}</b> 分钟`;
}
async function doCommute(day) {
  state.commute = state.commute || {}; state.commute[day] = state.commute[day] || {};
  state.commute[day][auth.role] = Date.now();
  myPet().exp += 10;
  toast(`💼 上班打卡成功 +10 经验`);
  confetti(10); renderHome(); await push(true);
}
/* 番茄钟 */
let focusTimer = null;
function openFocus() {
  const len = FOCUS_LENGTHS.map((m) => `<button class="focus-len" data-min="${m}">${m} 分钟</button>`).join('');
  showModal(`<h2>🍅 专注番茄钟</h2><p style="text-align:center;font-size:12.5px;color:var(--text-light);margin-bottom:10px">一起专注，宠物戴上眼镜认真上班</p><div class="focus-lens">${len}</div>`);
  $$('.focus-len').forEach((b) => b.addEventListener('click', () => { closeModal(); startFocus(parseInt(b.dataset.min)); }));
}
function startFocus(min) {
  const end = Date.now() + min * 60000;
  showModal(`<div class="focus-modal"><div class="fc-emoji">🍅</div><div class="fc-title">专注中…</div><div class="fc-note">宠物在认真上班，看手机前先歇一下</div><div class="fc-timer" id="fcTimer">${min}:00</div><div class="fc-stage"><img class="focused-pet" src="${PET_IMG[auth.role]}">${outfitAnchorImg(myPet().outfit, 'scene-outfit')}<button class="btn-mini" id="btnFocusStop" style="position:relative;z-index:5">先停一下</button></div></div>`);
  const stop = $('#btnFocusStop'); if (stop) stop.addEventListener('click', () => { clearInterval(focusTimer); focusTimer = null; closeModal(); toast('⏸️ 专注暂停了'); });
  if (focusTimer) clearInterval(focusTimer);
  focusTimer = setInterval(() => {
    const left = end - Date.now();
    const el = $('#fcTimer');
    if (left <= 0) {
      clearInterval(focusTimer); focusTimer = null;
      const sec = min * 60, day = todayStr();
      state.focus = state.focus || {}; state.focus[day] = state.focus[day] || {};
      state.focus[day][auth.role] = (state.focus[day][auth.role] || 0) + sec;
      myPet().exp += 15;
      closeModal(); confetti(20); toast(`🍅 专注 ${min} 分钟完成！+15 经验`);
      if (state.focus[day][otherRole()]) setTimeout(() => { hearts(9); toast('💞 你俩都专注了一波，默契 +1！'); }, 700);
      renderAll(); push(true);
    } else {
      const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
      if (el) el.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
  }, 1000);
}
/* 共享待办 */
function openTodos() {
  state.todos = state.todos || [];
  const rows = state.todos.map((t) => `<div class="todo-row ${t.done ? 'done' : ''}" data-tid="${t.id}"><button class="todo-toggle">${t.done ? '✅' : '⬜'}</button><span class="todo-text">${esc(t.text)}</span><button class="todo-del" data-tid="${t.id}">✕</button></div>`).join('');
  showModal(`<h2>📝 共享工作待办</h2><p style="text-align:center;font-size:12.5px;color:var(--text-light);margin-bottom:10px">两人都能加、都能勾，消失的收进做得快的口袋</p><div class="todo-add"><input id="todoInput" maxlength="40" placeholder="比如：周五前交方案"><button class="btn-mini green" id="btnTodoAdd" style="flex:none">添加</button></div><div class="todo-list">${rows || '<div class="todo-empty">还没有待办，加一件吧 ✍️</div>'}</div>`);
  $('#btnTodoAdd').addEventListener('click', addTodo);
  $('#todoInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
  $$('.todo-toggle').forEach((b) => b.addEventListener('click', () => toggleTodo(b.parentElement.dataset.tid)));
  $$('.todo-del').forEach((b) => b.addEventListener('click', () => delTodo(b.dataset.tid)));
}
async function addTodo() {
  const inp = $('#todoInput'); const text = (inp.value || '').trim(); if (!text) { toast('写点内容哦'); return; }
  state.todos = state.todos || [];
  state.todos.push({ id: uid(), text, done: false, by: auth.role, ts: Date.now() });
  closeModal(); renderWorkPanel(); renderAll(); await push(true);
}
async function toggleTodo(id) {
  const t = (state.todos || []).find((x) => x.id === id); if (!t) return;
  t.done = !t.done;
  if (t.done && !((state.studyDone || {})[todayStr()])) { myPet().exp += 8; toast('🗂️ 待办 +1，经验 +8'); }
  renderWorkPanel(); renderAll(); if ($('#todoInput')) openTodos(); await push(true);
}
async function delTodo(id) {
  state.todos = (state.todos || []).filter((x) => x.id !== id);
  renderWorkPanel(); renderAll(); if ($('#todoInput')) openTodos(); else closeModal(); await push(true);
}

// 互动宠物自动小动作（每几秒触发一次）
let interactTimer = null, lastInteract = 0;
function maybeInteract() {
  const now = Date.now(); if (now - lastInteract < 5600) return; lastInteract = now;
  const rolesAlive = ROLES.filter((r) => state.pets && state.pets[r]);
  if (rolesAlive.length === 0) return;
  const act = Math.floor(Math.random() * 3);
  if (act === 0 && rolesAlive.length >= 2) {
    // 双人默契脉冲
    hearts(7);
    const hl = $('#stageFloat'); if (hl) { const p = document.createElement('span'); p.className = 'float-emoji'; p.textContent = '💞 默契 +'; p.style.left = '45%'; p.style.top = '40%'; hl.appendChild(p); setTimeout(() => p.remove(), 1400); }
  } else if (act === 1) {
    // 宠物说话
    const role = rolesAlive[Math.floor(Math.random() * rolesAlive.length)];
    const el = document.querySelector(`.stage-pet[data-role="${role}"] .sp-bubble`);
    const line = PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
    if (el) { el.textContent = line; el.classList.add('show'); setTimeout(() => { el.classList.remove('show'); el.textContent = ''; }, 3400); }
  } else {
    // 蹦跶一下
    const role = rolesAlive[Math.floor(Math.random() * rolesAlive.length)];
    const el = document.querySelector(`.stage-pet[data-role="${role}"] .sp-fig`);
    if (el) { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); setTimeout(() => el.classList.remove('bounce'), 900); }
  }
}

async function doStudy(t) {
  if (((state.studyDone || {})[todayStr()])) return;
  state.studyDone = state.studyDone || {};
  state.studyDone[todayStr()] = true;
  myPet().exp += t.exp;
  toast(`💼 ${t.name}完成！经验 +${t.exp}`);
  confetti(16);
  renderAll();
  await push(true);
}

function renderCheckin() {
  const streak = checkinStreak(auth.role);
  $('#streakLine').innerHTML = streak > 0 ? `🔥 连续打卡 <b>${streak}</b> 天，继续保持！` : '今天从按时吃饭开始吧~';
  const h = new Date().getHours();
  $('#mealList').innerHTML = MEALS.map((m) => {
    const done = mealDone(todayStr(), auth.role, m.key);
    const inWindow = h >= m.start && h < m.end, past = h >= m.end;
    let ctl;
    if (done) ctl = `<div class="done-chip">✓ 吃过啦</div>`;
    else if (inWindow) ctl = `<button class="btn-check" data-meal="${m.key}">打卡 +${m.exp}</button>`;
    else if (past) ctl = `<div class="miss-chip">这餐过时间啦<br>明天再来</div>`;
    else ctl = `<div class="miss-chip">还没到时间<br>${m.tip} 有效</div>`;
    return `<div class="meal-card"><div class="meal-emoji">${m.emoji}</div><div class="meal-info"><div class="t">${m.label}</div><div class="d">${m.tip} · ${m.exp} 经验</div></div><div class="meal-state">${ctl}</div></div>`;
  }).join('');
  $$('#mealList [data-meal]').forEach((b) => b.addEventListener('click', () => doCheckin(b.dataset.meal)));
  const ot = otherPet();
  let both = `<div style="display:flex;justify-content:space-around;font-size:13px;padding:4px 0"><div>我（${petEmoji(auth.role)}）</div><div>${ot ? 'TA（' + petEmoji(otherRole()) + esc(otherName()) + '）' : 'TA 还没来'}</div></div>`;
  both += `<div style="display:flex;justify-content:space-around;margin-top:10px">` + MEALS.map((m) => {
    const mine = mealDone(todayStr(), auth.role, m.key) ? '🟢' : '⚪';
    const theirs = ot && mealDone(todayStr(), otherRole(), m.key) ? '🟢' : '⚪';
    return `<div style="text-align:center;font-size:12px">${m.emoji}<div style="font-size:17px;margin-top:2px">${mine} ${theirs}</div><div style="color:var(--text-light);margin-top:2px">${m.label}</div></div>`;
  }).join('') + `</div>`;
  $('#bothCheckins').innerHTML = both;
}

function renderInteract() {
  renderModeBanner();
  renderGameGrid();
  // 生日卡
  const bdays = birthdayPetToday();
  const bdBox = $('#birthdayAct');
  if (bdays.length) {
    const role = bdays[0];
    bdBox.classList.remove('hidden');
    bdBox.innerHTML = `<div class="big">🎂</div><div class="t">今天是${petLabel(role)}的生日！</div><div class="d">吹蜡烛、写祝福，陪它过生日吧</div><button class="btn-mini green" id="btnBday">去庆祝</button>`;
    $('#btnBday').addEventListener('click', openBirthday);
  } else {
    const near = ROLES.map((r) => [r, daysToBirthday(r)]).filter(([, d]) => d > 0 && d <= 7).sort((a, b) => a[1] - b[1])[0];
    if (near) { bdBox.classList.remove('hidden'); bdBox.innerHTML = `<div class="big">💌</div><div class="t">还有 ${near[1]} 天是${petLabel(near[0])}的生日</div><div class="d">可以提前准备一句祝福哦</div>`; }
    else bdBox.classList.add('hidden');
  }
  const opened = ((state.boxLast || {})[auth.role]) === todayStr();
  const todayBox = (state.boxToday || {})[auth.role];
  $('#boxDesc').innerHTML = opened ? (todayBox ? `今天开出了：${todayBox.emoji} ${esc(todayBox.name)}` : '今天已经开过啦') : '每天一次小惊喜';
  $('#btnBox').disabled = opened;
  const hugToday = (state.hugs || []).filter((x) => x.from === auth.role && new Date(x.ts).toDateString() === new Date().toDateString()).length;
  $('#hugDesc').textContent = hugToday >= 5 ? '今天抱够多啦，明天再抱~' : '摸摸头，一切都会好的';
  $('#btnHug').disabled = hugToday >= 5;
  const unread = unreadWhispers(), sent = (state.whispers || []).filter((w) => w.from === auth.role).slice(-3).reverse();
  $('#whisperSub').textContent = unread.length ? `${unread.length} 条未读` : '';
  // 用宠物名字而非"对方" / "TA"
  const myPetName = myName(), otherPetName = otherName();
  let wh = '';
  for (const w of unread) {
    const fromName = w.from === auth.role ? myPetName : otherPetName;
    const mood = WHISPER_MOODS.find((m) => m.key === w.mood) || WHISPER_MOODS[0];
    wh += `<div class="whisper-item" data-wid="${w.id}" style="cursor:pointer"><div class="mood" style="background:${mood.color}">${mood.emoji}</div><div class="info"><div class="t">${petEmoji(w.from)} ${esc(fromName)} 给你写了留言</div><div class="d">${fmtTime(w.ts)} · 点开看，看完即焚</div></div><div style="font-size:16px">👉</div></div>`;
  }
  for (const w of sent) {
    const mood = WHISPER_MOODS.find((m) => m.key === w.mood) || WHISPER_MOODS[0];
    const otherReadBy = w.read ? `${otherPetName} 已读，已化作烟花 🎆` : `送达中，${otherPetName} 还没打开`;
    wh += `<div class="whisper-item" style="opacity:.75"><div class="mood" style="background:#F4EEF2">${mood.emoji}</div><div class="info"><div class="t">你（${petEmoji(auth.role)}${esc(myPetName)}）寄出的悄悄话（${w.mood}）</div><div class="d">${otherReadBy}</div></div></div>`;
  }
  $('#whisperList').innerHTML = wh || `<div class="whisper-empty">还没有悄悄话，写一句吧 ✍️</div>`;
  $$('#whisperList [data-wid]').forEach((el) => el.addEventListener('click', () => openWhisper(el.dataset.wid)));
  // 动态 whisper 标题：用宠物名字
  const tEl = $('#whisperTitle'); if (tEl) tEl.textContent = `${petLabel(otherRole())}的留言信箱`;
  const badge = $('#interactBadge'), n = unread.length + (unreadHugs().length > 0 ? 1 : 0);
  if (n > 0) { badge.textContent = n > 9 ? '9+' : n; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
}

/* ====== 模式感知：banner + 游戏网格 ====== */
function currentMode() { return (state.mode && state.mode.v) || 'together'; }
function renderModeBanner() {
  const el = $('#modeBanner'); if (!el) return;
  const mode = MODE_INFO[currentMode()];
  el.className = 'mode-banner mode-' + mode.key;
  el.innerHTML = `
    <div class="mode-emoji">${mode.emoji}</div>
    <div class="mode-info">
      <div class="mode-title">${mode.label} <span class="mode-chip">${mode.chip}</span></div>
      <div class="mode-tag">${mode.tagline}</div>
    </div>
    <button class="mode-switch" id="btnSwitchMode" title="切换模式">🔁</button>
  `;
  const sw = $('#btnSwitchMode'); if (sw) sw.addEventListener('click', toggleMode);
}
function renderGameGrid() {
  const el = $('#gameGrid'); const title = $('#gameTitle'); const sub = $('#gameSub'); if (!el) return;
  const mode = currentMode();
  const games = mode === 'together' ? TOGETHER_GAMES : APART_GAMES;
  if (title) title.textContent = mode === 'together' ? '实时默契大比拼' : '异步陪伴心愿';
  if (sub) sub.textContent = mode === 'together' ? '同地 · 两人同时玩' : '异地 · 不同时也能一起';
  const gameOpen = {
    dice: openDice, syncmood: openSyncMood, quiz: openHarmonyQuiz, guess: openGuess,
    soul: openSoul, wish: openWish, draw: openDraw, moon: openMoon,
    movie: openMovieWheel, music: openMusic
  };
  el.innerHTML = games.map((g) => `<button class="game-tile" data-game="${g.id}"><div class="g-emoji">${g.emoji}</div><div class="g-name">${g.name}</div><div class="g-desc">${g.desc}</div></button>`).join('');
  $$('#gameGrid .game-tile').forEach((b) => b.addEventListener('click', () => { const fn = gameOpen[b.dataset.game]; if (fn) fn(); else toast('还在准备中…'); }));
}
async function toggleMode() {
  const cur = currentMode();
  const next = cur === MODE_TOGETHER ? MODE_APART : MODE_TOGETHER;
  const nextInfo = MODE_INFO[next];
  const ok = confirm(`切到「${nextInfo.label}」模式？\n\n${nextInfo.tagline}\n${next === 'together' ? '🧩 实时游戏：摇骰子、同步表情、默契问答' : '🌙 异步陪伴：心愿清单、晚安仪式、你画我猜'}\n\n（双方都能改，看哪个合适就切哪个）`);
  if (!ok) return;
  state.mode = { v: next, ts: Date.now() };
  applyModeTheme();
  await push(true); renderInteract(); toast(`已切到「${nextInfo.label}」模式 ${nextInfo.emoji}`);
}
function applyModeTheme() {
  const m = MODE_INFO[currentMode()];
  document.documentElement.style.setProperty('--mode-color', m.color);
  document.documentElement.style.setProperty('--mode-bg', m.key === 'together' ? '#FFF7EE' : '#F4F1FB');
}

/* ====== 在一起天数 / 入口文案 / 季节 ====== */
function daysTogether() { return Math.max(1, Math.floor((Date.now() - (state.since || Date.now())) / 86400000) + 1); }
function renderDaysPill() { const el = $('#daysPill'); if (el) el.textContent = `💗 ${daysTogether()}天`; }
function currentSeasonId() { return (state.season && state.season.v) || 'spring'; }
function applySeason() {
  const s = SEASONS.find((x) => x.id === currentSeasonId()) || SEASONS[0];
  const root = document.documentElement.style;
  root.setProperty('--bg', s.bg);
  root.setProperty('--pink', s.accent);
  document.querySelector('meta[name="theme-color"]') && (document.querySelector('meta[name="theme-color"]').content = s.bg);
}
function renderGateQuote() { nextGateQuote(); }
function nextGateQuote() {
  // 同一天内每次进来也可以轮换：用 分钟级随机
  const el = $('#gateQuote'); if (!el) return;
  const i = Math.floor(Math.random() * QUOTES.length);
  const item = QUOTES[i];
  let text = item.q;
  if (item.t === '专属' && auth) {
    const meName = (state && state.pets && state.pets[auth.role] && state.pets[auth.role].name) || '';
    const oRole = ROLES.find((r) => r !== auth.role);
    const oName = (state && state.pets && state.pets[oRole] && state.pets[oRole].name) || 'TA';
    text = text.replace(/\{me\}/g, meName || '我').replace(/\{other\}/g, oName);
  }
  el.innerHTML = `<span class="gq-tag">${item.t}</span>「${esc(text)}」`;
}

/* ====== 设置面板 ===== */
function openSettings() {
  const me = myPet() || { name: '' };
  const mode = MODE_INFO[currentMode()];
  const season = SEASONS.find((x) => x.id === currentSeasonId()) || SEASONS[0];
  const sinceD = new Date(state.since || Date.now());
  const sinceStr = `${sinceD.getFullYear()}-${('' + (sinceD.getMonth() + 1)).padStart(2, '0')}-${('' + sinceD.getDate()).padStart(2, '0')}`;
  const seasonBtns = SEASONS.map((s) => `<button class="season-btn ${s.id === season.id ? 'sel' : ''}" data-season="${s.id}" style="${s.id === season.id ? 'background:' + s.accent + ';color:#fff' : ''}">${s.emoji} ${s.name}</button>`).join('');
  const modeBtns = Object.values(MODE_INFO).map((m) => `<button class="season-btn ${m.key === mode.key ? 'sel' : ''}" data-mode="${m.key}" style="${m.key === mode.key ? 'background:' + m.color + ';color:#fff' : ''}">${m.emoji} ${m.name}（${m.label}）</button>`).join('');
  showModal(`<h2>⚙️ 小窝设置</h2>
    <div class="field"><label>我的宠物（${petEmoji(auth.role)} ${petLabel(auth.role)}）的名字</label><input id="setName" maxlength="8" value="${esc(me.name)}" placeholder="比如：奶糖"></div>
    <div class="field"><label>模式（两人共享，随时切换）</label><div class="season-row">${modeBtns}</div></div>
    <div class="field"><label>季节皮肤</label><div class="season-row">${seasonBtns}</div></div>
    <div class="field"><label>在一起的日子（纪念日，用来算天数）</label><input id="setSince" type="date" value="${sinceStr}"></div>
    <div style="height:14px"></div>
    <button class="btn-main" id="btnSaveSettings">💾 保存</button>
    <div style="height:10px"></div>
    <div class="settings-info">房间码：<b>${esc(auth.roomKey)}</b><br>密文用你们的暗号加密，换设备也能找回（同房间码+同暗号）</div>
    <div style="height:10px"></div>
    <button class="btn-ghost" id="btnExitRoom" style="color:#E06666">🚪 退出这个房间（只清本机）</button>`);
  $$('#modal .season-btn[data-mode]').forEach((b) => b.addEventListener('click', () => { $$('#modal .season-btn[data-mode]').forEach((x) => { x.classList.remove('sel'); x.style.background = ''; x.style.color = ''; }); b.classList.add('sel'); b.style.background = MODE_INFO[b.dataset.mode].color; b.style.color = '#fff'; }));
  $$('#modal .season-btn[data-season]').forEach((b) => b.addEventListener('click', () => { $$('#modal .season-btn[data-season]').forEach((x) => { x.classList.remove('sel'); x.style.background = ''; x.style.color = ''; }); b.classList.add('sel'); b.style.background = (SEASONS.find((s) => s.id === b.dataset.season) || {}).accent; b.style.color = '#fff'; }));
  $('#btnSaveSettings').addEventListener('click', async () => {
    const name = $('#setName').value.trim();
    if (name && name !== me.name) { myPet().name = name; toast(`✨ 已改名为「${name}」`); }
    const selMode = document.querySelector('#modal .season-btn[data-mode].sel');
    if (selMode && selMode.dataset.mode !== currentMode()) state.mode = { v: selMode.dataset.mode, ts: Date.now() };
    const selSeason = document.querySelector('#modal .season-btn[data-season].sel');
    if (selSeason) state.season = { v: selSeason.dataset.season, ts: Date.now() };
    const since = $('#setSince').value;
    if (since) { const d = dateToStr(since); if (!isNaN(d)) state.since = d.getTime(); }
    applySeason(); applyModeTheme();
    await push(true); closeModal(); renderAll(); toast('💾 设置已保存');
  });
  $('#btnExitRoom').addEventListener('click', () => {
    const ok = confirm('退出房间只清除这台设备上的记录，云端数据还在（同房间码+暗号可再进入）。确定退出？');
    if (!ok) return;
    localStorage.removeItem(LS_AUTH); localStorage.removeItem(LS_STATE);
    location.reload();
  });
}

function renderGameStatus() {
  const el = $('#gameStatus'); if (!el) return;
  const g = state.game;
  if (!g) { el.innerHTML = ''; return; }
  const labels = { quiz: '🧩 默契问答', guess: '💬 猜猜看', dice: '🎲 摇骰子', syncmood: '🎯 同步表情', soul: '💭 灵魂问问', wish: '📌 心愿清单', draw: '🎨 你画我猜', moon: '🌙 晚安仪式', movie: '🎡 电影大转盘', music: '🎧 云共听' };
  let line = `${labels[g.type] || ''} 进行中…`;
  if (g.type === 'quiz') {
    const a = g.answers || {};
    line += ` 我：${a[auth.role] != null ? '已答✓' : '未答'} · TA：${a[otherRole()] != null ? '已答✓' : '未答'}`;
  } else if (g.type === 'guess') {
    line += ` ${g.stage === 'setup' ? 'TA 正在出题' : 'TA 正在猜'}`;
  } else if (g.type === 'draw') {
    line += ` ${g.stage === 'paint' ? '等待 TA 画画' : (g.guess && g.guess[auth.role] ? '我已猜✓' : 'TA 已画好')}`;
  } else if (g.type === 'moon') {
    line += ` 我：${g.by && g.by[auth.role] ? '已道晚安✓' : '未道'} · TA：${g.by && g.by[otherRole()] ? '已道✓' : '未道'}`;
  } else if (g.type === 'movie') {
    line += g.locked ? ` 今晚就看《${g.locked.movie}》` : ' 还没锁定今晚的电影';
  } else if (g.type === 'music') {
    line += g.current ? ` 正在听《${g.current.song}》` : ' 还没开始';
  }
  el.innerHTML = `<span class="gs">${line}</span> <button class="btn-mini" id="btnResumeGame">继续</button>`;
  const b = $('#btnResumeGame'); if (b) b.addEventListener('click', () => { resumeGame(g); });
}
function resumeGame(g) {
  const t = g.type;
  if (t === 'quiz') openHarmonyQuiz();
  else if (t === 'guess') openGuess();
  else if (t === 'draw') openDraw();
  else if (t === 'moon') openMoon();
  else if (t === 'soul') openSoul();
  else if (t === 'wish') openWish();
  else if (t === 'dice') openDice();
  else if (t === 'syncmood') openSyncMood();
  else if (t === 'movie') openMovieWheel();
  else if (t === 'music') openMusic();
}

function renderMood() {
  renderQA();
  renderMoodCalendar();
}
function renderQA() {
  const box = $('#qaContext'), qEl = $('#qaQuestion'), act = $('#qaActions'), rev = $('#qaReveal');
  const qid = dailyIndex('soul', SOUL_QUESTIONS.length);
  const question = SOUL_QUESTIONS[qid];
  const todayQ = (state.qa && state.qa.date === todayStr()) ? state.qa : null;
  const myAns = todayQ && todayQ.answers && todayQ.answers[auth.role];
  const otherAns = todayQ && todayQ.answers && todayQ.answers[otherRole()];
  box.innerHTML = `<div class="qa-day">今天的话题</div>`;
  qEl.innerHTML = `<span class="qa-mark">Q${qid + 1}</span> ${esc(question)}`;
  if (!myAns) {
    act.innerHTML = `<textarea class="whisper-input" id="qaInput" maxlength="120" placeholder="写下你的回答（只有 TA 能看到）…"></textarea>
      <div style="height:12px"></div><button class="btn-main" id="btnSendQA">🔒 加密回答</button>`;
    const send = $('#btnSendQA'); if (send) send.addEventListener('click', async () => {
      const text = $('#qaInput').value.trim(); if (!text) { toast('写点什么再答吧~'); return; }
      const enc = await encryptText(text);
      state.qa = { date: todayStr(), qid, answers: Object.assign({}, (state.qa && state.qa.answers) || {}, { [auth.role]: { enc } }) };
      await push(true); renderMood(); toast('💌 已回答，TA 写下后你们就能互看');
    });
  } else {
    act.innerHTML = `<div class="qa-my"><b>我的回答：</b><span class="qa-dec" data-role="${auth.role}">（加密中…）</span></div>`;
    const myEl = document.querySelector('.qa-dec[data-role="' + auth.role + '"]');
    decryptText(myAns.enc).then((t) => { if (myEl) myEl.textContent = t; });
  }
  if (otherAns) {
    rev.innerHTML = `<div class="qa-reveal-box"><div class="qa-head">${petEmoji(otherRole())} ${esc(otherName())} 的回答</div><div class="qa-dec" data-role="${otherRole()}">（加密中…）</div></div>`;
    const el = document.querySelector('.qa-reveal-box .qa-dec');
    decryptText(otherAns.enc).then((t) => { if (el) el.textContent = t; });
  } else {
    rev.innerHTML = `<div class="qa-wait">${otherPet() ? `等 ${petEmoji(otherRole())}${esc(otherName())} 写下 TA 的回答…` : '等 TA 加入小窝'}</div>`;
  }
}
// 心情日历
let moodOffset = 0;
function renderMoodCalendar() {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth() + moodOffset;
  const first = new Date(y, m, 1), startDay = first.getDay(); // 0=周日
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const label = `${y} 年 ${m + 1} 月`;
  $('#moodMonthLabel').textContent = label;
  let html = ['日', '一', '二', '三', '四', '五', '六'].map((d) => `<div class="mood-wd">${d}</div>`).join('');
  for (let i = 0; i < startDay; i++) html += `<div class="mood-cell"></div>`;
  const today = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${('' + (m + 1)).padStart(2, '0')}-${('' + d).padStart(2, '0')}`;
    const moods = (state.moods || {})[ds] || {};
    const mR = moods.rabbit, mD = moods.dog;
    const isToday = ds === today;
    html += `<div class="mood-cell ${isToday ? 'today' : ''} ${ds > today ? 'future' : ''}"
      data-ds="${ds}" ${isToday ? 'style="cursor:pointer"' : ''} title="${isToday ? '点我记录今天的心情' : ''}">
      ${isToday ? `<span class="mood-num">${d}</span>` : `<span class="mood-num dim">${d}</span>`}
      <div class="mood-dots">
        <span class="md ${mR ? 'on' : ''}" style="${mR ? 'background:' + (DAY_MOOD_MAP[mR.emoji] ? DAY_MOOD_MAP[mR.emoji].color : '#ddd') : ''}">${mR ? mR.emoji : ''}</span>
        <span class="md ${mD ? 'on' : ''}" style="${mD ? 'background:' + (DAY_MOOD_MAP[mD.emoji] ? DAY_MOOD_MAP[mD.emoji].color : '#ddd') : ''}">${mD ? mD.emoji : ''}</span>
      </div></div>`;
  }
  $('#moodGrid').innerHTML = html;
  $$('#moodGrid .mood-cell.today').forEach((c) => c.addEventListener('click', () => openMoodPicker()));
  const todayMoods = (state.moods || {})[today] || {};
  const hasR = todayMoods.rabbit, hasD = todayMoods.dog;
  const mE = (v) => { const e = (v && typeof v === 'object') ? v.emoji : v; const hit = e && DAY_MOOD_MAP[e]; return hit ? hit.emoji : (e || '—'); };
  $('#moodTodayInfo').innerHTML = `今天：我 ${mE(hasR)} · TA ${mE(hasD)}`;
  const prev = $('#moodPrev'), next = $('#moodNext');
  prev.onclick = () => { moodOffset--; renderMoodCalendar(); };
  next.onclick = () => { moodOffset++; renderMoodCalendar(); };
}
let myMoodSel = null;
function openMoodPicker() {
  const today = todayStr();
  myMoodSel = ((state.moods || {})[today] || {}).rabbit ? ((state.moods || {})[today].rabbit.emoji) : null;
  const btns = DAY_MOODS.map((mo) => `<button class="mood-btn ${mo.emoji === myMoodSel ? 'sel' : ''}" data-mood="${mo.emoji}" style="font-size:20px">${mo.emoji}</button>`).join('');
  showModal(`<h2>😶🌫️ 今天的心情</h2>
    <p style="text-align:center;font-size:12.5px;color:var(--text-light);margin-bottom:10px">选一个代表今天的小情绪</p>
    <div class="mood-pick2">${btns}</div>
    <div style="height:14px"></div><button class="btn-main" id="btnSaveMood">保存</button>`);
  $$('.mood-btn').forEach((b) => b.addEventListener('click', () => { myMoodSel = b.dataset.mood; $$('.mood-btn').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); }));
  $('#btnSaveMood').addEventListener('click', async () => {
    if (!myMoodSel) { toast('选一个吧~'); return; }
    const today = todayStr();
    state.moods = state.moods || {};
    state.moods[today] = state.moods[today] || {};
    state.moods[today].rabbit = { emoji: myMoodSel };
    await push(true); closeModal(); renderMood(); toast('😊 已记录今天的心情');
  });
}

function renderRoom() {
  // 装修小屋：壁纸 + 同画风家具贴纸（可拖动/删除）
  const decor = (state.roomDecor || []);
  const wp = (state.wallpaper && state.wallpaper.v) || 'cream';
  $('#decorSub').textContent = `${decor.length} 件`;
  let stageHtml = `<img class="decor-bg" src="${wallImg(wp)}" alt="">`;
  const items = decor.map((d) => {
    const f = furnitureFor(d.itemId);
    const im = f.img ? `<img src="${f.img}" alt="">` : `<span>${f.emoji}</span>`;
    const x = (typeof d.x === 'number' && isFinite(d.x)) ? d.x : 50;
    const y = (typeof d.y === 'number' && isFinite(d.y)) ? d.y : 50;
    const w = (f.s && f.s[0]) || 24;
    return `<div class="decor-item" data-id="${d.id}" style="left:${x}%;top:${y}%;width:${w}%" data-by="${d.by}">${im}<button class="decor-del" data-id="${d.id}">✕</button></div>`;
  }).join('');
  stageHtml += items + `<button class="decor-add" id="btnDecorateInline">🧸 摆件</button><button class="decor-add wall" id="btnWallInline">🖼️ 壁纸</button>`;
  $('#decorStage').innerHTML = stageHtml;
  $$('#btnDecorateInline').forEach((b) => b.addEventListener('click', openDecorate));
  const bw = $('#btnWallInline'); if (bw) bw.addEventListener('click', openWallpaper);
  // 拖动/点击删除
  bindDecorDrag(); bindDecorDelete();
  // 装扮
  const me = myPet();
  $('#dressStage').innerHTML = petStageHTML(auth.role, me, true, false);
  const grid = Object.keys(OUTFITS).map((key) => {
    const o = OUTFITS[key], owned = ((me.ownedOutfits || []).includes(key)) || outfitUnlocked(key), wearing = me.outfit === key;
    let lock; if (key === 'none') lock = ''; else if (owned) lock = wearing ? '穿着中 ✓' : '已拥有'; else lock = '🔒 ' + outfitCondText(key) + ' / 盲盒';
    return `<button class="dress-item ${owned ? 'owned' : ''} ${wearing ? 'wearing' : ''}" data-outfit="${key}" ${!owned ? 'disabled' : ''}><div class="emoji">${o.img ? `<img src="${o.img}">` : o.emoji}</div><div class="n">${o.name}</div><div class="lock">${lock}</div></button>`;
  }).join('');
  $('#dressGrid').innerHTML = grid;
  $$('#dressGrid [data-outfit]').forEach((b) => b.addEventListener('click', () => setOutfit(b.dataset.outfit)));
  const furs = FURNITURES.map((f) => { const has = (me.ownedFurniture || []).includes(f.id); return `<div class="furn-chip ${has ? '' : 'empty'}">${has ? (f.img ? `<img src="${f.img}">` : f.emoji) : '🔒'} ${f.name}</div>`; }).join('');
  $('#furnWall').innerHTML = furs;
  $('#furnSub').textContent = `${(me.ownedFurniture || []).length}/${FURNITURES.length} 件`;
  // 成就
  const stats = { checkinStreak: checkinStreak(auth.role), checkinTotal: checkinTotal(auth.role), level: expToLevel(me.exp), bond: harmony(), hugCount: (state.hugs || []).length, noteCount: (state.whispers || []).filter((w) => w.from === auth.role).length, boxItems: me.boxItems || [], ownedFurniture: me.ownedFurniture || [] };
  const achDefs = [['a_checkin7', '🍚', '按时吃饭', stats.checkinStreak >= 7], ['a_checkin30', '🥗', '三餐守护', stats.checkinTotal >= 30], ['a_level5', '🌟', '小小成长', stats.level >= 5], ['a_bond10', '💞', '心有灵犀', stats.bond >= 10], ['a_hug10', '🤗', '温暖抱抱', stats.hugCount >= 10], ['a_note7', '✍️', '每日一句', stats.noteCount >= 7], ['a_box10', '🎁', '开盒达人', stats.boxItems.length >= 10], ['a_fur5', '🏠', '温馨小屋', stats.ownedFurniture.length >= 5]];
  $('#achRow').innerHTML = achDefs.map(([id, e, n, on]) => `<div class="ach-chip ${on ? 'on' : ''}" title="${n}"><div class="e">${e}</div><div class="n">${n}</div></div>`).join('');
}
function petStageHTML(role, pet, isMe, small) {
  const dots = MEALS.map((m) => `<i class="${mealDone(todayStr(), role, m.key) ? 'on' : ''}"></i>`).join('');
  const out = OUTFITS[pet.outfit] && OUTFITS[pet.outfit].img ? outfitAnchorImg(pet.outfit, 'outfit-img') : '';
  return `<div class="pet-unit ${isMe ? 'me' : ''}"><div class="pet-wrap ${small ? 'small' : ''}"><div class="pet-float"><img class="pet-img" src="${PET_IMG[role]}" alt="${petLabel(role)}">${out}</div><div class="pet-shadow"></div></div><div class="pet-name">${petEmoji(role)} ${esc(pet.name)} <span class="lvl">Lv.${expToLevel(pet.exp)}</span></div><div class="meals-dots">${dots}</div></div>`;
}
/* ---------- 全屏家园（单独撑满画面） ---------- */
function renderFullRoom() {
  const wp = wallImg((state.wallpaper && state.wallpaper.v) || 'cream');
  const furn = decorItemsHtml(false);
  const me = myPet(), ot = otherPet();
  const pets = `<div class="fr-pets">${me ? petSceneEl(auth.role, 'left') : ''}${ot ? petSceneEl(otherRole(), 'right') : ''}</div>`;
  $('#fullRoomBody').innerHTML = `<div class="fr-room"><img class="fr-bg" src="${wp}" alt="">${furn}</div>${pets}<div class="fr-tip">小屋装修，就是这里哦 · 下方可添摆件/换壁纸</div>`;
}
function openFullRoom() { renderFullRoom(); $('#fullRoom').classList.remove('hidden'); }
function closeFullRoom() { $('#fullRoom').classList.add('hidden'); }

function renderBanner() {
  const b = $('#birthdayBanner'); const bdays = birthdayPetToday();
  if (bdays.length) { b.classList.remove('hidden'); b.innerHTML = `<span class="cake">🎂</span><span>今天是${petLabel(bdays[0])}的生日！点进来庆祝 →</span><span class="go">去庆祝</span>`; b.onclick = openBirthday; } else b.classList.add('hidden');
}

/* ================= 行为 ================= */
async function doCheckin(mealKey) {
  const m = MEALS.find((x) => x.key === mealKey); if (!m) return;
  const h = new Date().getHours(); if (!(h >= m.start && h < m.end)) { toast('现在不在打卡时间哦'); return; }
  if (mealDone(todayStr(), auth.role, mealKey)) { toast('这餐已经打过啦'); return; }
  const day = todayStr(); state.checkins[day] = state.checkins[day] || {}; state.checkins[day][auth.role] = state.checkins[day][auth.role] || []; state.checkins[day][auth.role].push(mealKey);
  myPet().exp += m.exp; renderAll(); toast(`${m.emoji} ${m.label}打卡成功 +${m.exp} 经验`);
  if (mealDone(day, otherRole(), mealKey)) setTimeout(() => { hearts(8); toast('💞 你们俩这餐都吃了，默契 +1！'); }, 500);
  await push(true);
}
async function openBox() {
  if (((state.boxLast || {})[auth.role]) === todayStr()) return;
  const prize = BLINDBOX[Math.floor(Math.random() * BLINDBOX.length)];
  state.boxLast = state.boxLast || {}; state.boxLast[auth.role] = todayStr(); state.boxToday = state.boxToday || {}; state.boxToday[auth.role] = { id: prize.id, name: prize.name, emoji: prize.emoji };
  const me = myPet(); me.exp += prize.exp;
  if (prize.type === 'outfit' && !me.ownedOutfits.includes(prize.target)) me.ownedOutfits.push(prize.target);
  if (prize.type === 'furniture' && !me.ownedFurniture.includes(prize.target)) me.ownedFurniture.push(prize.target);
  me.boxItems = me.boxItems || []; me.boxItems.push(prize.id);
  showModal(`<div class="box-stage"><div class="gift shaking">🎁</div><div style="font-size:12px;color:var(--text-light);margin-top:6px">摇晃中…</div></div>`);
  setTimeout(() => { showModal(`<div class="box-stage"><div class="prize-emoji">${prize.emoji}</div><div class="prize-name">开出了「${esc(prize.name)}」！</div><div class="prize-sub">${prize.type === 'outfit' ? '新装扮已加入衣柜 🎀' : prize.type === 'furniture' ? '新家具搬进了小屋 🏠' : '经验到手 🍬'} · 经验 +${prize.exp}</div><button class="btn-main" style="margin-top:16px" onclick="closeModal()">开心收下</button></div>`); confetti(14); renderAll(); }, 1300);
  await push(true);
}
let hugLock = false;
async function sendHug() {
  if (hugLock) return; hugLock = true; setTimeout(() => { hugLock = false; }, 1200);
  state.hugs = state.hugs || []; state.hugs.push({ from: auth.role, ts: Date.now() });
  const hugToday = state.hugs.filter((x) => x.from === auth.role && new Date(x.ts).toDateString() === new Date().toDateString()).length;
  if (hugToday <= 5) myPet().exp += 2;
  hearts(12); toast(`🤗 已把抱抱送给 ${otherName()}：${COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)]}`, 3000);
  renderAll(); await push(true);
}
let moodSel = '心里话';
async function openWriteWhisper() {
  const moods = WHISPER_MOODS.map((m) => `<button class="mood-btn ${m.key === moodSel ? 'sel' : ''}" data-mood="${m.key}" style="${m.key === moodSel ? 'background:' + m.color + ';color:#5B4A4F' : ''}">${m.emoji} ${m.key}</button>`).join('');
  showModal(`<h2>✍️ 写给 ${esc(otherName())} 的悄悄话</h2><div class="mood-pick">${moods}</div><textarea class="whisper-input" id="whisperInput" maxlength="300" placeholder="说不出口的话，放在这里…&#10;TA 打开后看完即焚，你们都不会再看到它"></textarea><div style="height:14px"></div><button class="btn-main" id="btnSendWhisper">🔒 加密寄出</button><div class="gate-tip">内容用你们的暗号加密后才上传<br>除了 TA 谁也看不到，看完自动烧掉</div>`);
  $$('.mood-btn').forEach((b) => b.addEventListener('click', () => { moodSel = b.dataset.mood; $$('.mood-btn').forEach((x) => { x.classList.remove('sel'); x.style.background = ''; x.style.color = ''; }); const m = WHISPER_MOODS.find((mm) => mm.key === moodSel); b.classList.add('sel'); b.style.background = m.color; b.style.color = '#5B4A4F'; }));
  $('#btnSendWhisper').addEventListener('click', async () => {
    const text = $('#whisperInput').value.trim(); if (!text) { toast('写点什么再寄吧~'); return; }
    const btn = $('#btnSendWhisper'); btn.disabled = true; btn.textContent = '加密中…';
    const enc = await encryptText(text); state.whispers = state.whispers || []; state.whispers.push({ id: uid(), from: auth.role, to: otherRole(), mood: moodSel, enc, ts: Date.now(), read: false });
    await push(true); closeModal(); toast('📮 已寄出！TA 打开后就会消失'); renderAll();
  });
}
async function openWhisper(id) {
  const w = (state.whispers || []).find((x) => x.id === id); if (!w || w.to !== auth.role || w.read) return;
  const text = await decryptText(w.enc); const mood = WHISPER_MOODS.find((m) => m.key === w.mood) || WHISPER_MOODS[0];
  showModal(`<h2>${mood.emoji} 来自 ${esc(otherName())} 的悄悄话</h2><div class="whisper-body">${text ? esc(text) : '（解不开…检查一下暗号是否一致）'}</div><div class="burn-bar"><b id="burnBar" style="width:100%"></b></div><div class="burn-tip">🔥 看完即焚 · 5 秒后这封信将永远消失</div>`);
  let left = 5; const timer = setInterval(() => { left--; const bar = $('#burnBar'); if (bar) bar.style.width = (left / 5 * 100) + '%'; if (left <= 0) { clearInterval(timer); w.read = true; w.readAt = Date.now(); w.enc = null; push(true).then(() => { closeModal(); toast('🎆 悄悄话已化作烟花消失'); renderAll(); }); } }, 1000);
}
async function setOutfit(key) { if (!outfitUnlocked(key) && key !== 'none') { toast('还没解锁哦，看看获取条件~'); return; } myPet().outfit = key; renderAll(); toast(`✨ 换上了${OUTFITS[key].name}`); await push(true); }
function openBirthday() {
  const bdays = birthdayPetToday(); if (!bdays.length) return;
  const role = bdays[0]; const meDone = ((state.candle || {})[todayStr()] || {})[auth.role]; const wishes = (state.wishes || []).slice().reverse();
  const wishList = wishes.map((wv) => `<div class="wish-item"><div class="who">${petEmoji(wv.from)} ${esc(wv.from === auth.role ? myName() : otherName())} · ${fmtTime(wv.ts)}</div>🕯️ <span class="wish-text" data-wid="${wv.id}">解密中…</span></div>`).join('');
  showModal(`<h2>🎂 ${petLabel(role)} 的生日</h2><div class="cake-stage"><span class="cake-emoji">🎂</span><div class="flames" id="flames"><span class="flame">🕯️</span><span class="flame">🕯️</span><span class="flame">🕯️</span><span class="flame">🕯️</span><span class="flame">🕯️</span></div><div style="font-size:12.5px;color:var(--text-light);margin-bottom:10px">${meDone ? '今天已经吹灭蜡烛啦 · 已 +50 经验' : '连点蜡烛 5 次，帮它吹灭！'}</div><button class="btn-mini" id="btnBlow" ${meDone ? 'disabled' : ''}>💨 吹一口气</button></div><div style="height:14px"></div><button class="btn-mini green" id="btnWish" style="width:100%;padding:11px">💌 写一句生日祝福（只有今天能写）</button><div style="height:12px"></div>${wishList || '<div class="whisper-empty">还没有祝福，写下第一句吧</div>'}`);
  wishes.forEach(async (wv) => { const el = document.querySelector('.wish-text[data-wid="' + wv.id + '"]'); if (el) el.textContent = await decryptText(wv.enc); });
  let blows = 0; const btn = $('#btnBlow');
  if (btn && !meDone) btn.addEventListener('click', async () => { blows++; const flames = $$('#flames .flame'); if (flames[blows - 1]) flames[blows - 1].classList.add('out'); if (blows >= 5) { btn.disabled = true; btn.textContent = '🎉 吹灭啦！'; confetti(30); hearts(10); myPet().exp += 50; state.candle = state.candle || {}; state.candle[todayStr()] = state.candle[todayStr()] || {}; state.candle[todayStr()][auth.role] = true; toast('🎂 生日快乐！经验 +50'); await push(true); renderAll(); } else toast(`💨 呼——还剩 ${5 - blows} 根`); });
  $('#btnWish').addEventListener('click', async () => {
    showModal(`<h2>💌 生日祝福</h2><textarea class="whisper-input" id="wishInput" maxlength="100" placeholder="对${petLabel(role)}（和 TA）说一句祝福…"></textarea><div style="height:14px"></div><button class="btn-main" id="btnSendWish">寄出祝福</button>`);
    $('#btnSendWish').addEventListener('click', async () => { const text = $('#wishInput').value.trim(); if (!text) { toast('写一句再寄吧~'); return; } const enc = await encryptText(text); state.wishes = state.wishes || []; state.wishes.push({ id: uid(), from: auth.role, enc, ts: Date.now() }); await push(true); closeModal(); toast('💌 祝福已挂上许愿墙'); renderAll(); });
  });
}

/* ================= 游戏：默契问答 ================= */
async function openHarmonyQuiz() {
  const qid = (state.game && state.game.type === 'quiz' && state.game.qid) || dailyIndex('harmony', HARMONY_QUESTIONS.length);
  let g = (state.game && state.game.type === 'quiz') ? state.game : null;
  if (!g) { g = { type: 'quiz', qid, seq: (state.game ? state.game.seq : 0) + 1, answers: {} }; state.game = g; }
  const q = HARMONY_QUESTIONS[g.qid % HARMONY_QUESTIONS.length];
  const myAns = g.answers[auth.role], otherAns = g.answers[otherRole()];
  const optsBtns = q.opts.map((o, i) => `<button class="quiz-opt ${myAns === i ? 'sel' : ''}" data-opt="${i}" ${myAns != null ? 'disabled' : ''}>${'ABCD'[i]}. ${esc(o)}</button>`).join('');
  let info = `<div class="qa-day">第 ${g.qid + 1} 题 · 两人同答，看是不是心有灵犀</div>`;
  if (myAns == null) info += `<div class="quiz-q">${esc(q.q)}</div><div class="quiz-opts">${optsBtns}</div>`;
  else {
    info += `<div class="quiz-q">${esc(q.q)}</div><div class="quiz-myans">我选：${esc(q.opts[myAns])}</div>`;
    if (otherAns != null) info += `<div class="quiz-reveal"><div class="qr-row"><span>${petEmoji(otherRole())} ${esc(otherName())}</span><b>${otherAns === myAns ? '💞 不谋而合！' : '🤔 不一样哦'}</b></div><div class="ta">TA 选：${esc(q.opts[otherAns])}</div></div>`;
    else info += `<div class="qa-wait">等 ${petEmoji(otherRole())}${esc(otherName())} 选了就能互相看答案</div>`;
  }
  info += `<div style="height:14px"></div><button class="btn-main" id="btnNextQuiz">下一题</button>`;
  showModal(`<h2>🧩 默契问答</h2>${info}`);
  $$('.quiz-opt').forEach((b) => b.addEventListener('click', async () => { g.answers[auth.role] = +b.dataset.opt; g.seq += 1; state.game = g; await push(true); renderMood(); renderGameStatus(); openHarmonyQuiz(); if (g.answers[otherRole()] === g.answers[auth.role]) setTimeout(() => { hearts(8); toast('💞 默契满分，你们想到一块啦'); }, 500); }));
  const next = $('#btnNextQuiz'); if (next) next.addEventListener('click', async () => { const ng = { type: 'quiz', qid: g.qid + 1, seq: g.seq + 1, answers: {} }; state.game = ng; await push(true); renderGameStatus(); openHarmonyQuiz(); });
}

/* ================= 游戏：猜猜看 ================= */
async function openGuess() {
  let g = (state.game && state.game.type === 'guess') ? state.game : null;
  const myRole = auth.role, other = otherRole();
  let html = `<h2>💬 我来描述你来猜</h2>`;
  if (!g) {
    // 发起：出题人
    g = { type: 'guess', seq: (state.game ? state.game.seq : 0) + 1, stage: 'setup', setter: myRole, guesser: other, word: '', hint: '', guesses: [], solved: false, solvedBy: null };
    state.game = g;
    html += `<div class="quiz-q">你来出题！想一个词，再给 TA 一条提示</div>
      <div class="field"><label>词语（只有你知道，TA 要猜这个）</label><input id="guessWord" maxlength="12" placeholder="比如：火锅"></div>
      <div class="field"><label>给你的提示</label><input id="guessHint" maxlength="20" placeholder="比如：冬天很多人爱吃"></div>
      <button class="btn-main" id="btnStartGuess">📤 出好题，让 TA 猜</button>
      <div class="gate-tip">出题后，对方在「互动 → 默契大比拼 → 继续」里进入猜测</div>`;
  } else if (g.stage === 'setup') {
    if (g.setter === myRole) {
      html += `<div class="quiz-q">你出的是：<b>${esc(g.word)}</b></div><div class="qa-day">提示：${esc(g.hint)}</div><div class="qa-wait">等 ${petEmoji(other)}${esc(otherName())} 来猜…</div>`;
    } else {
      html += `<div class="qa-day">${petEmoji(other)}${esc(otherName())} 出了一道题</div><div class="quiz-hint">提示：<b>${esc(g.hint)}</b></div>
        <div class="field"><label>你的猜测（${esc(g.hint) ? '靠提示' : ''}）</label><input id="guessInput" maxlength="12" placeholder="猜猜是什么"></div>
        <button class="btn-main" id="btnSubmitGuess">📮 交答案</button>
        <div class="gate-tip">猜中了对方会告诉你；也可以翻答案</div>`;
    }
  } else if (g.stage === 'playing') {
    const guesses = g.guesses || [];
    const last = guesses.slice(-4).reverse();
    html += `<div class="qa-day">提示：${esc(g.hint)}</div>`;
    if (g.guesser === myRole) {
      html += `<div class="field"><label>再猜一次</label><input id="guessInput" maxlength="12" placeholder="猜猜是什么"></div><button class="btn-main" id="btnSubmitGuess">📮 交答案</button><div style="height:8px"></div><button class="btn-ghost" id="btnReveal2">🙈 太笨了，直接看答案</button>`;
    } else {
      html += `<div class="quiz-q">你的词是：<b>${esc(g.word)}</b></div>`;
      if (last.length) html += `<div class="qa-wait">TA 的猜测：</div>` + last.map((gu) => `<div class="guess-chip">${petEmoji(other)} ${esc(gu.by === myRole ? myName() : otherName())}：${esc(gu.text)}${gu.correct ? ' ✅' : ''}</div>`).join('');
      if (g.guesses && g.guesses.length) html += `<div style="height:10px"></div><button class="btn-mini green" id="btnMarkRight" style="width:100%">✅ 对！TA 猜对了</button>`;
    }
  }
  showModal(html);
  const send = $('#btnStartGuess'); if (send) send.addEventListener('click', async () => { const word = $('#guessWord').value.trim(), hint = $('#guessHint').value.trim(); if (!word) { toast('先想个词吧'); return; } g.word = word; g.hint = hint || '提示：和吃有关'; g.stage = 'playing'; g.seq += 1; state.game = g; await push(true); renderGameStatus(); openGuess(); });
  const submit = $('#btnSubmitGuess'); if (submit) submit.addEventListener('click', async () => { const text = $('#guessInput').value.trim(); if (!text) { toast('写个答案吧'); return; } g.guesses = g.guesses || []; g.guesses.push({ by: myRole, text, ts: Date.now(), correct: false }); g.seq += 1; state.game = g; await push(true); renderGameStatus(); openGuess(); toast('📮 已交给对方确认'); });
  const rev2 = $('#btnReveal2'); if (rev2) rev2.addEventListener('click', async () => { g.revealed = true; g.solved = true; g.solvedBy = 'reveal'; g.seq += 1; state.game = g; await push(true); renderGameStatus(); toast(`答案是：${g.word}`); showModal(`<h2>💬 答案揭晓</h2><div class="quiz-q">答案是：<b>${esc(g.word)}</b></div><div class="qa-day">提示：${esc(g.hint)}</div><button class="btn-main" onclick="closeModal()">知道啦</button>`); });
  const mark = $('#btnMarkRight'); if (mark) mark.addEventListener('click', async () => { g.guesses = g.guesses || []; const last = g.guesses[g.guesses.length - 1]; if (last) last.correct = true; g.solved = true; g.solvedBy = 'correct'; g.seq += 1; state.game = g; myPet().exp += 20; await push(true); renderGameStatus(); closeModal(); confetti(16); toast('🎉 猜对啦！默契 +，经验 +20'); });
}

/* ================= 游戏：谁猜看（你来描述我来猜） ================= */
async function openDraw() {
  let g = (state.game && state.game.type === 'draw') ? state.game : null;
  const myRole = auth.role, other = otherRole();
  let html = `<h2>🎨 你画我猜</h2><div class="qa-day">选个词画下来，等 TA 来猜，看猜不猜得中~</div>`;
  if (!g) {
    const idx = Math.floor(Math.random() * GUESS_PAINT_WORDS.length);
    g = { type: 'draw', seq: (state.game ? state.game.seq : 0) + 1, stage: 'paint', word: GUESS_PAINT_WORDS[idx], painter: myRole, guesser: other, guess: {} };
    state.game = g;
    html += `<div class="quiz-q">你画的是：<b>${esc(g.word)}</b></div>
      <div class="qa-day">去 Canvas 里把它画出来（比如一个太阳、一栋房子）</div>
      <div class="draw-stage" id="drawStage"><canvas id="drawCanvas" width="300" height="220"></canvas></div>
      <div class="draw-tools"><button class="btn-mini" id="btnDrawClear">清空</button><button class="btn-mini blue" id="btnDrawDone">✅ 画好了，让 TA 猜</button></div>
      <div class="gate-tip">画笔颜色随机 · 画完 TA 上线就能看</div>`;
  } else if (g.stage === 'paint') {
    if (g.painter === myRole) {
      html += `<div class="draw-stage" id="drawStage"><canvas id="drawCanvas" width="300" height="220"></canvas></div><div class="draw-tools"><button class="btn-mini" id="btnDrawClear">清空</button><button class="btn-mini blue" id="btnDrawDone">✅ 更新画作</button></div>`;
    } else {
      html += `<div class="q-wait">${petEmoji(other)}${esc(otherName())} 正在画画…</div><div class="qa-day">画好了你就能来猜</div>`;
    }
  } else if (g.stage === 'guess') {
    if (g.guesser === myRole) {
      if (g.image) html += `<div class="draw-show"><img src="${g.image}" alt="画作"></div>`;
      if (g.guess && g.guess[myRole]) {
        html += `<div class="qa-day">你猜的是：${esc(g.guess[myRole])}</div>`;
        if (g.solved) html += `<div class="quiz-q">${g.solvedBy === myRole ? '🎉 猜对啦！' : ''}答案：<b>${esc(g.word)}</b></div>`;
        else html += `<div class="qa-wait">等 TA 告诉你对不对…</div>`;
      } else {
        html += `<div class="field"><label>猜猜 TA 画的是什么</label><input id="drawGuess" maxlength="12" placeholder="比如：太阳"></div><button class="btn-main" id="btnSubmitDraw">📮 交答案</button>`;
      }
    } else {
      html += `<div class="q-wait">你的词是：<b>${esc(g.word)}</b></div>`;
      if (g.image) html += `<div class="draw-show"><img src="${g.image}" alt="画作"></div>`;
      if (g.guess && g.guess[other]) html += `<div class="qa-day">TA 猜是：${esc(g.guess[other])}</div><button class="btn-mini green" id="btnDrawRight" style="width:100%">✅ 对！猜中了</button><button class="btn-ghost" id="btnDrawWrong">🙈 不对</button>`;
      else html += `<div class="qa-wait">等 ${petEmoji(other)}${esc(otherName())} 来猜…</div>`;
    }
  }
  html += `<div style="height:12px"></div><button class="btn-ghost" id="btnDrawNext">换一个词 →</button>`;
  showModal(html);
  drawBind(g, myRole);
}
let drawStroke = '';
function drawBind(g, myRole) {
  const cv = $('#drawCanvas'); const other = otherRole();
  if (cv) {
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.strokeStyle = drawStroke || ['#E8645A', '#4A8DE8', '#63B76A', '#B75AD8'][Math.floor(Math.random() * 4)]; ctx.lineWidth = 3; ctx.lineCap = 'round';
    let drawing = false, lastX = 0, lastY = 0;
    cv.addEventListener('pointerdown', (e) => { drawing = true; const r = cv.getBoundingClientRect(); lastX = (e.clientX - r.left) * (cv.width / r.width); lastY = (e.clientY - r.top) * (cv.height / r.height); });
    cv.addEventListener('pointermove', (e) => { if (!drawing) return; const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * (cv.width / r.width), y = (e.clientY - r.top) * (cv.height / r.height); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); lastX = x; lastY = y; });
    cv.addEventListener('pointerup', () => { drawing = false; });
  }
  const clear = $('#btnDrawClear'); if (clear) clear.addEventListener('click', () => { const c = $('#drawCanvas'); if (c) { const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); } });
  const done = $('#btnDrawDone'); if (done) done.addEventListener('click', async () => { const c = $('#drawCanvas'); if (!c) return; g.image = c.toDataURL('image/png'); g.stage = 'guess'; g.seq += 1; state.game = g; await push(true); renderGameStatus(); openDraw(); toast('🎨 画好了，等 TA 来猜~'); });
  const submit = $('#btnSubmitDraw'); if (submit) submit.addEventListener('click', async () => { const t = $('#drawGuess').value.trim(); if (!t) { toast('写个猜测吧'); return; } g.guess = g.guess || {}; g.guess[myRole] = t; g.seq += 1; state.game = g; await push(true); renderGameStatus(); openDraw(); });
  const right = $('#btnDrawRight'); if (right) right.addEventListener('click', async () => { g.solved = true; g.solvedBy = 'painter'; g.seq += 1; state.game = g; myPet().exp += 20; await push(true); renderGameStatus(); closeModal(); confetti(16); toast('🎉 猜中啦！默契 +，经验 +20'); });
  const wrong = $('#btnDrawWrong'); if (wrong) wrong.addEventListener('click', async () => { g.solved = true; g.solvedBy = 'painter'; g.seq += 1; state.game = g; await push(true); renderGameStatus(); closeModal(); toast(`答案是：${g.word}`); });
  const next = $('#btnDrawNext'); if (next) next.addEventListener('click', async () => { const idx = Math.floor(Math.random() * GUESS_PAINT_WORDS.length); g = { type: 'draw', seq: g.seq + 1, stage: 'paint', word: GUESS_PAINT_WORDS[idx], painter: g.guesser, guesser: g.painter, guess: {} }; drawStroke = ''; state.game = g; await push(true); renderGameStatus(); openDraw(); });
}

/* ================= 游戏：每日灵魂一问 ================= */
async function openSoul() {
  const qid = (state.game && state.game.type === 'soul' && state.game.qid) || dailyIndex('soul', SOUL_QUESTIONS.length);
  let g = (state.game && state.game.type === 'soul') ? state.game : null;
  if (!g) { g = { type: 'soul', qid, seq: (state.game ? state.game.seq : 0) + 1, answers: {} }; state.game = g; openSoul(); return; }
  const q = SOUL_QUESTIONS[g.qid % SOUL_QUESTIONS.length];
  const myAns = g.answers[auth.role], otherAns = g.answers[otherRole()];
  let info = `<div class="qa-day">第 ${(g.qid % SOUL_QUESTIONS.length) + 1} 问 · 每天一问</div><div class="quiz-q">${esc(q)}</div>`;
  if (myAns == null) {
    info += `<textarea class="whisper-input" id="soulInput" maxlength="140" placeholder="写下你的回答（只有 TA 能看）…"></textarea><div style="height:12px"></div><button class="btn-main" id="btnSendSoul">🔒 加密回答</button>`;
  } else {
    info += `<div class="qa-my"><b>我的回答：</b><span class="qa-dec" data-role="${auth.role}">（加密中…）</span></div>`;
    const el = document.querySelector('.qa-dec[data-role="' + auth.role + '"]'); if (el) decryptText(myAns.enc).then((t) => { if (el) el.textContent = t; });
  }
  if (otherAns != null) {
    info += `<div class="qa-reveal-box"><div class="qa-head">${petEmoji(otherRole())} ${esc(otherName())} 的回答</div><div class="qa-dec" data-role="${otherRole()}">（加密中…）</div></div>`;
    const el = document.querySelector('.qa-reveal .qa-dec'); if (el) decryptText(otherAns.enc).then((t) => { if (el) el.textContent = t; });
  } else {
    info += `<div class="qa-wait">${otherPet() ? `等 ${petEmoji(otherRole())}${esc(otherName())} 写下…` : '等 TA 加入小窝'}</div>`;
  }
  showModal(`<h2>💭 每日灵魂一问</h2>${info}`);
  const send = $('#btnSendSoul'); if (send) send.addEventListener('click', async () => {
    const text = $('#soulInput').value.trim(); if (!text) { toast('写点什么再答吧~'); return; }
    const enc = await encryptText(text); g.answers = g.answers || {}; g.answers[auth.role] = { enc }; g.seq += 1; state.game = g;
    await push(true); renderGameStatus(); closeModal(); toast('💌 已回答，TA 写下后就能互看');
  });
}

/* ================= 心愿清单 ================= */
let wishFilter = '';
async function openWish() {
  let g = (state.game && state.game.type === 'wish') ? state.game : null;
  if (!g) { g = { type: 'wish', seq: (state.game ? state.game.seq : 0) + 1 }; state.game = g; }
  const list = (state.wishlist || []).slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.ts - a.ts));
  const rows = list.map((w) => `<div class="wish-row ${w.done ? 'done' : ''}" data-wid="${w.id}">
    <div class="wish-check ${w.done ? 'on' : ''}" data-wid="${w.id}">${w.done ? '✓' : ''}</div>
    <div class="wish-text">${esc(w.text)}</div>
    ${w.done ? `<div class="wish-by">${petEmoji(w.doneBy)} ${esc(w.doneBy === auth.role ? myName() : otherName())} 完成</div>` : ''}
  </div>`).join('');
  const quick = WISH_PRESETS.map((p) => `<button class="wish-chip" data-wish="${esc(p)}">${p}</button>`).join('');
  showModal(`<h2>📌 心愿清单</h2>
    <div class="qa-day">一起写想做的事，完成一项勾一项~</div>
    <div class="wish-input-row"><input id="wishInput" maxlength="40" placeholder="写下想一起做的事…"><button class="btn-mini" id="btnAddWish">＋</button></div>
    <div class="wish-quick">${quick}</div>
    <div style="height:10px"></div>${rows || '<div class="whisper-empty">还没心愿，写下第一个吧 ✨</div>'}`);
  $('#btnAddWish').addEventListener('click', async () => { const t = $('#wishInput').value.trim(); if (!t) { toast('写个心愿吧'); return; } state.wishlist = state.wishlist || []; state.wishlist.push({ id: uid(), text: t, ts: Date.now(), done: false, doneBy: null }); g.seq += 1; state.game = g; await push(true); renderGameStatus(); openWish(); toast('✨ 心愿已挂上'); });
  $$('#modal .wish-chip').forEach((b) => b.addEventListener('click', () => { $('#wishInput').value = b.dataset.wish; }));
  $$('#modal .wish-check').forEach((c) => c.addEventListener('click', async () => { const w = (state.wishlist || []).find((x) => x.id === c.dataset.wid); if (!w) return; w.done = !w.done; w.doneBy = w.done ? auth.role : null; g.seq += 1; state.game = g; if (w.done && !w._rewarded) { w._rewarded = true; myPet().exp += 10; } await push(true); renderGameStatus(); openWish(); if (w.done) { confetti(10); toast('✅ 完成一个心愿！经验 +10'); } }));
}

/* ================= 晚安仪式 ================= */
async function openMoon() {
  let g = (state.game && state.game.type === 'moon') ? state.game : null;
  if (!g) { g = { type: 'moon', seq: (state.game ? state.game.seq : 0) + 1, by: {}, date: todayStr() }; state.game = g; }
  const me = g.by[auth.role], other = g.by[otherRole()];
  const done = !!(me && other);
  let info = `<div class="qa-day">每天晚上，互道一声晚安，就能解锁今晚的月色</div>`;
  if (done) {
    info += `<div class="moon-reveal"><div class="moon-fig">🌕</div><div class="qa-day">今晚月色真美，因为有你。</div><div class="qa-day">${petEmoji(auth.role)} 和 ${petEmoji(otherRole())} 都道过晚安了 💞</div></div>`;
  } else {
    info += `<div class="moon-status">我：${me ? '已道晚安 ✓' : '未道'} · TA：${other ? '已道✓' : '未道'}</div>`;
    if (!me) info += `<button class="btn-main" id="btnSayMoon">🌙 对 TA 说晚安</button>`;
    info += `<div class="qa-wait">${other ? 'TA 也道了晚安，就能一起看月色~' : '等 TA 上线过来道晚安…'}</div>`;
  }
  showModal(`<h2>🌙 晚安仪式</h2>${info}`);
  const say = $('#btnSayMoon'); if (say) say.addEventListener('click', async () => { g.by[auth.role] = true; g.seq += 1; state.game = g; await push(true); renderGameStatus(); openMoon(); if (g.by[otherRole()]) { confetti(12); hearts(10); toast('🌕 你们互道晚安了！'); } });
}

/* ================= 摇骰子决定晚饭 ================= */
async function openDice() {
  let g = (state.game && state.game.type === 'dice') ? state.game : null;
  const myRole = auth.role, other = otherRole();
  if (!g) { g = { type: 'dice', seq: (state.game ? state.game.seq : 0) + 1, rolls: {} }; state.game = g; }
  const meRoll = g.rolls[myRole], otherRoll = g.rolls[other];
  const foods = ['火锅 🍲', '烧烤 🍢', '寿司 🍣', '炒饭 🍛', '披萨 🍕', '麻辣烫 🍜', '沙拉 🥗', '汉堡 🍔'];
  let cmp = '';
  if (meRoll != null && otherRoll != null) {
    const diff = Math.abs(meRoll - otherRoll);
    cmp = diff <= 1 ? `💞 数字只差 ${diff}，心有灵犀啊！` : diff <= 3 ? `😊 差 ${diff}，勉强算默契` : `🤔 差 ${diff}，今天各吃各的？`;
  }
  let html = `<h2>🎲 今天吃什么</h2><div class="qa-day">两人都摇，数字越近越默契（1~6）</div>
    <div class="dice-row"><div class="dice-pair"><div class="dice-face" id="diceMe">${meRoll != null ? meRoll : '?'}</div><div class="dice-name">我</div></div>
    <div class="dice-pair"><div class="dice-face" id="diceOther">${otherRoll != null ? otherRoll : '?'}</div><div class="dice-name">${petEmoji(other)} ${esc(otherName())}</div></div></div>
    ${cmp ? `<div class="qa-day" style="margin-top:8px">${cmp}</div>` : ''}
    <div class="qa-day" style="margin-top:6px">推荐：${foods[Math.floor(Math.random() * foods.length)]}</div>`;
  if (meRoll == null) html += `<div style="height:12px"></div><button class="btn-main" id="btnRollDice">🎲 摇一下</button>`;
  showModal(`<h2>🎲 摇骰子</h2>${html}`);
  const roll = $('#btnRollDice'); if (roll) roll.addEventListener('click', async () => { g.rolls[myRole] = 1 + Math.floor(Math.random() * 6); g.seq += 1; state.game = g; await push(true); renderGameStatus(); if (g.rolls[other] != null) setTimeout(openDice, 900); else openDice(); toast(`🎲 你摇到了 ${g.rolls[myRole]}`); });
}

/* ================= 同步表情 ================= */
async function openSyncMood() {
  let g = (state.game && state.game.type === 'syncmood') ? state.game : null;
  const myRole = auth.role, other = otherRole();
  if (!g) { g = { type: 'syncmood', seq: (state.game ? state.game.seq : 0) + 1, picks: {} }; state.game = g; }
  const moods = ['🤗', '🥰', '😆', '😢', '😤', '🤩', '😌', '😴'];
  let result = '';
  if (g.picks && g.picks[other] != null) {
    result = g.picks[myRole] != null
      ? (g.picks[myRole] === g.picks[other] ? '💞 同一秒选了同一个表情，默契满分！' : '😊 你俩选了不同的表情')
      : '';
  }
  let html = `<h2>🎯 同步表情</h2><div class="qa-day">两人同时（同一秒）选出同一个表情，就算默契命中~</div>
    <div class="sync-moods">${moods.map((m) => `<button class="sync-mood ${g.picks && g.picks[myRole] === m ? 'sel' : ''}" data-mood="${m}" ${g.picks && g.picks[myRole] != null ? 'disabled' : ''}>${m}</button>`).join('')}</div>
    ${g.picks && g.picks[myRole] != null ? `<div class="qa-day">我选：${g.picks[myRole]}</div>` : ''}
    ${g.picks && g.picks[other] != null ? `<div class="qa-day">TA 选：${g.picks[other]}</div>` : ''}
    ${result ? `<div class="qa-day" style="margin-top:8px;font-weight:500">${result}</div>` : ''}
    ${g.picks && g.picks[myRole] != null ? `<button class="btn-main" id="btnSyncAgain">再玩一次</button>` : ''}`;
  showModal(`<h2>🎯 同步表情</h2>${html}`);
  $$('.sync-mood').forEach((b) => b.addEventListener('click', async () => { g.picks = g.picks || {}; g.picks[myRole] = b.dataset.mood; g.seq += 1; state.game = g; await push(true); renderGameStatus(); openSyncMood(); const t = setTimeout(() => { if (g.picks && g.picks[other] === g.picks[myRole]) { confetti(10); hearts(8); toast('🎯 默契命中！'); } clearTimeout(t); }, 1000); }));
  const again = $('#btnSyncAgain'); if (again) again.addEventListener('click', async () => { g = { type: 'syncmood', seq: g.seq + 1, picks: {} }; state.game = g; await push(true); renderGameStatus(); openSyncMood(); });
}

/* ================= 电影大转盘（同地） ================= */
function drawWheel(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6;
  const n = MOVIE_TYPES.length, arc = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const t = MOVIE_TYPES[i];
    const a0 = -Math.PI / 2 + i * arc - arc / 2, a1 = a0 + arc;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
    ctx.fillStyle = t.color; ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.stroke();
    // 文字沿扇形中线向外
    const mid = (a0 + a1) / 2;
    ctx.save(); ctx.translate(cx + Math.cos(mid) * R * 0.66, cy + Math.sin(mid) * R * 0.66);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = '#5B4A4F'; ctx.font = '600 13px -apple-system, PingFang SC, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.name, 0, 0);
    ctx.restore();
  }
  // 中心圆
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#FFD9E4'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#F4567F'; ctx.font = '700 16px -apple-system, PingFang SC, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎬', cx, cy + 1);
}
let wheelSpinning = false;
async function openMovieWheel() {
  let g = (state.game && state.game.type === 'movie') ? state.game : null;
  if (!g) { g = { type: 'movie', seq: (state.game ? state.game.seq : 0) + 1, spin: null, locked: null }; state.game = g; }
  const myRole = auth.role, other = otherRole();
  // 选择的类型：默认上次选过或喜剧，未锁定/未转出前可随时切
  const selType = g.selType || 'comedy';
  let html = `<h2>🎡 电影大转盘</h2><div class="qa-day">先选好今晚的类型，再从这部类型的片单里抽一部</div>`;
  if (g.locked) {
    const t = MOVIE_TYPES.find((x) => x.id === g.locked.typeId) || MOVIE_TYPES[0];
    html += `<div class="movie-locked">
      <div class="ml-emoji">${t.emoji}</div>
      <div class="ml-title">今晚就看</div>
      <div class="ml-movie">《${esc(g.locked.movie)}》</div>
      <div class="ml-sub">${t.name} · 由 ${petEmoji(g.locked.by)}${esc(g.locked.by === myRole ? myName() : otherName())} 锁定 · ${fmtTime(g.locked.ts)}</div>
    </div>
    <div style="height:12px"></div>
    <button class="btn-main" id="btnMovieWatched">✅ 看完了！+10 经验</button>
    <div style="height:8px"></div><button class="btn-ghost" id="btnMovieRespin">🎨 换类型再抽（改了主意）</button>`;
  } else if (g.spin) {
    const t = MOVIE_TYPES.find((x) => x.id === g.spin.typeId) || MOVIE_TYPES[0];
    const idx = g.spin.movieIdx != null ? g.spin.movieIdx : Math.floor(Math.random() * t.movies.length);
    const movie = t.movies[idx] || t.movies[0];
    const spins = (g.spinBy || []).map((r) => petEmoji(r) + (r === myRole ? myName() : otherName())).join(' · ');
    html += `<div class="movie-spin-result">
      <div class="ml-emoji">${t.emoji}</div>
      <div class="ml-movie">《${esc(movie)}》</div>
      <div class="ml-sub">${t.name}片单推荐${spins ? ' · ' + esc(spins) + ' 转过' : ''}</div>
    </div>
    <div style="height:12px"></div>
    <button class="btn-main" id="btnMovieLock">💯 就它了！锁定今晚</button>
    <div style="height:8px"></div>
    <button class="btn-mini" id="btnMovieNext">🔀 这部不看，同类型换一部</button>
    <div style="height:8px"></div>
    <button class="btn-ghost" id="btnMovieRespin2">🎨 换类型再抽</button>`;
  } else {
    // 类型自选：8 种类型 chips 高亮当前选中
    html += `<div class="mv-types">
      ${MOVIE_TYPES.map((t) => `<button class="mv-type ${t.id === selType ? 'on' : ''}" data-type="${t.id}" title="${esc(t.movies.join('、'))}">${t.emoji}${t.name}</button>`).join('')}
    </div>`;
    const sel = MOVIE_TYPES.find((t) => t.id === selType) || MOVIE_TYPES[0];
    html += `<div class="qa-day mv-seltip">已选「<b>${sel.emoji}${sel.name}</b>」· 片单共 ${sel.movies.length} 部</div>`;
    html += `<div class="movie-typed-list" id="mvList">` + sel.movies.map((m) => `<span class="guess-chip">🎬 ${esc(m)}</span>`).join('') + `</div><div style="height:14px"></div>`;
    html += `<button class="btn-main" id="btnMovieSpin">🎲 从「${sel.name}」抽一部！</button>`;
  }
  showModal(html);
  // 类型 chips：点击切换选中类型（只更新状态 + 高亮 + 重渲染列表）
  $$('#modal .mv-type').forEach((b) => b.addEventListener('click', () => {
    g.selType = b.dataset.type; push(true);
    $$('#modal .mv-type').forEach((x) => x.classList.toggle('on', x === b));
    const t = MOVIE_TYPES.find((x) => x.id === b.dataset.type) || MOVIE_TYPES[0];
    const tip = $('#modal .mv-seltip'); if (tip) tip.innerHTML = `已选「<b>${t.emoji}${t.name}</b>」· 片单共 ${t.movies.length} 部`;
    const list = document.getElementById('mvList'); if (list) list.innerHTML = t.movies.map((m) => `<span class="guess-chip">🎬 ${esc(m)}</span>`).join('');
    const sb = $('#modal #btnMovieSpin'); if (sb) sb.textContent = `🎲 从「${t.name}」抽一部！`;
  }));
  const spinBtn = $('#btnMovieSpin');
  if (spinBtn) spinBtn.addEventListener('click', () => {
    const t = MOVIE_TYPES.find((x) => x.id === (g.selType || 'comedy')) || MOVIE_TYPES[0];
    const movieIdx = Math.floor(Math.random() * t.movies.length);
    g.spin = { typeId: t.id, movieIdx, ts: Date.now() };
    g.spinBy = [myRole]; g.seq += 1; state.game = g;
    push(true); renderGameStatus(); confetti(10);
    toast(`🎬 抽到「${t.name}」→《${t.movies[movieIdx]}》`);
    openMovieWheel();
  });
  const nextBtn = $('#btnMovieNext'); if (nextBtn) nextBtn.addEventListener('click', async () => {
    const t = MOVIE_TYPES.find((x) => x.id === g.spin.typeId) || MOVIE_TYPES[0];
    g.spin.movieIdx = (g.spin.movieIdx + 1) % t.movies.length; g.spin.ts = Date.now();
    g.seq += 1; state.game = g; await push(true); renderGameStatus(); openMovieWheel();
  });
  const lockBtn = $('#btnMovieLock'); if (lockBtn) lockBtn.addEventListener('click', async () => {
    const t = MOVIE_TYPES.find((x) => x.id === g.spin.typeId) || MOVIE_TYPES[0];
    g.locked = { typeId: t.id, movie: t.movies[g.spin.movieIdx] || t.movies[0], by: myRole, ts: Date.now() };
    g.seq += 1; state.game = g; await push(true); renderGameStatus(); closeModal();
    confetti(16); hearts(10); toast(`🎬 今晚就看《${g.locked.movie}》！`);
  });
  const watched = $('#btnMovieWatched'); if (watched) watched.addEventListener('click', async () => {
    myPet().exp += 10; g.locked = null; g.spin = null; g.seq += 1; state.game = g;
    await push(true); renderGameStatus(); closeModal(); confetti(12); toast('🍿 看完啦！经验 +10');
  });
  const respin = $('#btnMovieRespin') || $('#btnMovieRespin2'); if (respin) respin.addEventListener('click', async () => {
    g.spin = null; g.locked = null; g.seq += 1; state.game = g;
    await push(true); renderGameStatus(); openMovieWheel();
  });
}

/* ================= 云共听（同地 · 同一首歌） ================= */
function musicFmt(sec) { sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${('' + s).padStart(2, '0')}`; }
async function openMusic() {
  let g = (state.game && state.game.type === 'music') ? state.game : null;
  const myRole = auth.role, other = otherRole();
  if (!g) { g = { type: 'music', seq: (state.game ? state.game.seq : 0) + 1, current: null, history: [] }; state.game = g; }
  const cur = g.current;
  let html = `<h2>🎧 云共听</h2>
    <div class="qa-day">各自打开自己的音乐 App 播同一首歌，这里帮你们记着「我们正在一起听」</div>`;
  if (cur) {
    const starterName = cur.by === myRole ? myName() : otherName();
    const iAmIn = cur.listening && cur.listening[myRole];
    const otherIn = cur.listening && cur.listening[other];
    const elapsed = musicFmt((Date.now() - cur.startTs) / 1000);
    html += `<div class="music-now">
      <div class="mn-disc">💿</div>
      <div class="mn-song">《${esc(cur.song)}》</div>
      <div class="mn-sub">${petEmoji(cur.by)}${esc(starterName)} 发起 · 已经一起听了 <b id="musicTimer">${elapsed}</b></div>
      <div class="mn-avatars">
        <span class="mn-av ${iAmIn ? 'on' : ''}">${petEmoji(myRole)}${esc(myName())}${iAmIn ? ' 🎧' : ''}</span>
        <span class="mn-av ${otherIn ? 'on' : ''}">${petEmoji(other)}${esc(otherName())}${otherIn ? ' 🎧' : ''}</span>
      </div>
    </div><div style="height:12px"></div>`;
    if (!iAmIn) html += `<button class="btn-main" id="btnMusicJoin">🎧 我也开听，加入共听</button><div style="height:8px"></div>`;
    else html += `<div class="qa-day" style="font-weight:500">🎧 正在共听中… 听完点下面</div><div style="height:8px"></div>`;
    html += `<button class="btn-mini green" id="btnMusicDone">✅ 听完了 +8 经验</button><div style="height:8px"></div><button class="btn-ghost" id="btnMusicCancel">换一首歌</button>`;
    const recent = (g.history || []).slice(-5).reverse();
    if (recent.length) html += `<div style="height:10px"></div><div class="qa-day">最近一起听过：</div>` + recent.map((h) => `<div class="guess-chip">🎵 ${esc(h.song)} · ${musicFmt((h.endTs - h.startTs) / 1000)}</div>`).join('');
  } else {
    const mine = (g.mySongs && g.mySongs[myRole]) || [];
    const quick = ['喜欢的歌', '晴天', '突然好想你', '起风了', '夜空中最亮的星', '孤勇者'];
    html += `<div class="field"><label>想一起听的歌（歌手 + 歌名更好找）</label><input id="musicSong" maxlength="30" placeholder="比如：周杰伦 晴天"></div>
      <div class="wish-quick">${quick.map((q) => `<button class="wish-chip" data-song="${esc(q)}">${q}</button>`).join('')}</div>
      ${mine.length ? `<div style="height:10px"></div><div class="qa-day">我最近点的：</div>` + mine.slice(-4).reverse().map((s) => `<button class="guess-chip" data-mine="${esc(s)}">🎵 ${esc(s)}</button>`).join('') : ''}
      <div style="height:12px"></div>
      <button class="btn-main" id="btnMusicStart">💿 就听这首，开听！</button>`;
  }
  showModal(html);
  $$('#modal .wish-chip[data-song]').forEach((b) => b.addEventListener('click', () => { $('#musicSong').value = b.dataset.song; }));
  $$('#modal [data-mine]').forEach((b) => b.addEventListener('click', () => { $('#musicSong').value = b.dataset.mine; }));
  const start = $('#btnMusicStart'); if (start) start.addEventListener('click', async () => {
    const song = $('#musicSong').value.trim(); if (!song) { toast('写个歌名吧'); return; }
    g.mySongs = g.mySongs || {}; g.mySongs[myRole] = [...(g.mySongs[myRole] || []).slice(-9), song];
    g.current = { song, by: myRole, startTs: Date.now(), listening: { [myRole]: true } };
    g.seq += 1; state.game = g; await push(true); renderGameStatus(); openMusic();
    toast(`💿 开始听《${song}》啦，${otherName()} 加入就是一起听~`);
  });
  const join = $('#btnMusicJoin'); if (join) join.addEventListener('click', async () => {
    g.current.listening = g.current.listening || {}; g.current.listening[myRole] = true;
    g.seq += 1; state.game = g; await push(true); renderGameStatus(); openMusic();
    hearts(8); toast('🎧 已加入共听，按下播放键吧~');
  });
  const done = $('#btnMusicDone'); if (done) done.addEventListener('click', async () => {
    if (g.current) { g.history = [...(g.history || []).slice(-19), { song: g.current.song, startTs: g.current.startTs, endTs: Date.now() }]; }
    g.current = null; g.seq += 1; state.game = g; myPet().exp += 8;
    await push(true); renderGameStatus(); openMusic(); confetti(10); toast('🎵 一起听歌完成！经验 +8');
  });
  const cancel = $('#btnMusicCancel'); if (cancel) cancel.addEventListener('click', async () => { g.current = null; g.seq += 1; state.game = g; await push(true); renderGameStatus(); openMusic(); });
  // 计时器
  if (cur) {
    const timerEl = $('#musicTimer');
    clearInterval(openMusic._t);
    openMusic._t = setInterval(() => { const el = $('#musicTimer'); if (!el) { clearInterval(openMusic._t); return; } el.textContent = musicFmt((Date.now() - cur.startTs) / 1000); }, 1000);
  }
}

/* ================= 装修小屋 ================= */
let placingItem = null;
function openDecorate() {
  const owned = (myPet().ownedFurniture || []);
  // 可用：已拥有 + 未拥有但也给预览（未拥有的拖放要消耗？简单起见：已拥有可选，未拥有显示需收集）
  const list = FURNITURES.map((f) => {
    const has = owned.includes(f.id);
    return `<button class="decor-pick ${has ? '' : 'locked'}" data-item="${f.id}" ${has ? '' : 'disabled'}><img src="${f.img}"><div class="n">${f.name}</div>${has ? '' : '<div class="lock">🔒 收集解锁</div>'}</button>`;
  }).join('');
  showModal(`<h2>🧸 添一件摆件</h2>
    <p style="text-align:center;font-size:12.5px;color:var(--text-light);margin-bottom:10px">选一件，然后点小屋里的位置摆下</p>
    <div class="decor-picks">${list}</div>`);
  $$('.decor-pick[data-item]').forEach((b) => b.addEventListener('click', () => { placingItem = b.dataset.item; closeModal(); toast('点小屋里的位置摆下去~'); enablePlacing(); }));
}
function openWallpaper() {
  const cur = (state.wallpaper && state.wallpaper.v) || 'cream';
  const list = WALLPAPERS.map((w) => `<button class="wall-pick ${cur === w.id ? 'sel' : ''}" data-wall="${w.id}"><img src="${w.img}"><div class="n">${w.name}</div></button>`).join('');
  showModal(`<h2>🖼️ 换壁纸</h2><p style="text-align:center;font-size:12.5px;color:var(--text-light);margin-bottom:10px">换个背景，小屋和大门口的小家会一起变</p><div class="wall-picks">${list}</div>`);
  $$('.wall-pick').forEach((b) => b.addEventListener('click', async () => { state.wallpaper = { v: b.dataset.wall, ts: Date.now() }; await push(true); closeModal(); renderAll(); toast('🖼️ 壁纸换好啦，小屋和小家都更新了'); }));
}
function enablePlacing() {
  const stage = $('#decorStage');
  stage.classList.add('placing');
  const handler = async (e) => {
    const rect = stage.getBoundingClientRect();
    const x = Math.max(4, Math.min(94, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    state.roomDecor = state.roomDecor || [];
    state.roomDecor.push({ id: uid(), itemId: placingItem, x: Math.round(x), y: Math.round(y), by: auth.role });
    placingItem = null; stage.classList.remove('placing');
    stage.removeEventListener('click', handler);
    await push(true); renderRoom(); toast('🛋️ 摆好啦，TA 也会看到');
  };
  stage.addEventListener('click', handler);
}
/* 家具拖拽（pointer 事件，支持触屏/鼠标） */
function bindDecorDrag() {
  let startX = 0, startY = 0, fx = 0, fy = 0, dragging = null, moved = false;
  const stage = $('#decorStage');
  const move = (e) => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    // 用非指针鼠标事件坐标，兼容 pointer capture 重定向
    const cx = (e.clientX != null ? e.clientX : pageX(e)), cy = (e.clientY != null ? e.clientY : pageY(e));
    const dx = ((cx - startX) / rect.width) * 100;
    const dy = ((cy - startY) / rect.height) * 100;
    if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) moved = true;
    const nx = Math.max(4, Math.min(94, fx + dx)), ny = Math.max(8, Math.min(90, fy + dy));
    dragging.style.left = nx + '%'; dragging.style.top = ny + '%';
  };
  const up = async (e) => {
    if (!dragging) return;
    const el = dragging; dragging = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    if (moved) {
      const id = el.dataset.id; const d = (state.roomDecor || []).find((x) => x.id === id);
      if (d) { d.x = Math.round(parseFloat(el.style.left)); d.y = Math.round(parseFloat(el.style.top)); await push(true); }
    }
  };
  $$('#decorStage .decor-item').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('decor-del')) return;
      dragging = el; moved = false; e.preventDefault();
      const rect = stage.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      fx = parseFloat(el.style.left) || 0; fy = parseFloat(el.style.top) || 0;
      // 把移动/抬起监听挂到 document：不论 pointer capture 把事件重定向给谁，都能收到
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
      try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (err) {}
    });
  });
}
function pageX(e) { return (e.touches && e.touches[0] && e.touches[0].clientX) != null ? e.touches[0].clientX : 0; }
function pageY(e) { return (e.touches && e.touches[0] && e.touches[0].clientY) != null ? e.touches[0].clientY : 0; }
/* 家具删除：点 ✕ */
function bindDecorDelete() {
  $$('#decorStage .decor-del').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = btn.dataset.id;
    state.roomDecor = (state.roomDecor || []).filter((x) => x.id !== id);
    await push(true); renderRoom(); toast('🗑️ 已收起这件摆件');
  }));
}

/* ================= 配对流程 ================= */
let gateRole = 'rabbit';
function showGateScreen(id) { ['gateHome', 'gateCreate', 'gateJoin', 'gateInvite'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id)); }
function inviteTextStr(code, secret) { const link = location.origin + location.pathname + '#r=' + code; return `我建好了我们俩的小窝 double 🐰🐶\n① 打开这个链接：${link}\n② 选「加入小窝」，房间码会自动填好\n③ 输入我们的暗号：${secret}\n进来之后给我也养一只宠物嘛~`; }
async function doCreate() {
  const name = $('#createName').value.trim() || (gateRole === 'rabbit' ? '奶糖' : '布丁');
  const secret = $('#createSecret').value.trim() || String(Math.floor(1000 + Math.random() * 9000));
  const btn = $('#btnDoCreate'); btn.disabled = true; btn.textContent = '创建中…';
  try {
    auth = { roomKey: randCode(16), secret, role: gateRole };
    state = defaultState(gateRole, name); state.probe = await makeProbe();
    await writeRemote(state); saveAuth(); saveLocalState();
    const grouped = auth.roomKey.match(/.{4}/g).join('-');
    $('#inviteCode').textContent = grouped; $('#inviteSecret').textContent = secret; $('#inviteText').textContent = inviteTextStr(grouped, secret);
    $('#invitePetImg').src = PET_IMG[gateRole]; $('#invitePetName').textContent = `${petEmoji(gateRole)} ${name}`;
    showGateScreen('gateInvite');
  } catch (e) { toast('创建失败，网络不太好，再试一次'); btn.disabled = false; btn.textContent = '建好啦，去邀请 TA'; }
}
async function doJoin() {
  const code = $('#joinCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const secret = $('#joinSecret').value.trim();
  if (code.length < 10) { toast('房间码不太对，检查一下~'); return; }
  if (!secret) { toast('要输入暗号哦'); return; }
  const btn = $('#btnDoJoin'); btn.disabled = true; btn.textContent = '找小窝中…';
  try {
    auth = { roomKey: code, secret, role: null };
    const remote = await pullRemote();
    if (!remote || !remote.probe) { toast('没找到这个小窝，检查房间码'); btn.disabled = false; btn.textContent = '进入我们的小窝'; auth = null; return; }
    const probe = await decryptText(remote.probe); if (probe !== 'cloudpet-ok') { toast('暗号不对哦'); btn.disabled = false; btn.textContent = '进入我们的小窝'; auth = null; return; }
    state = remote;
    const taken = ROLES.filter((r) => state.pets && state.pets[r]); const free = ROLES.find((r) => !taken.includes(r));
    if (!free) { toast('这个小窝已经住满啦'); btn.disabled = false; btn.textContent = '进入我们的小窝'; auth = null; return; }
    auth.role = free;
    $('#joinNameField').classList.remove('hidden'); $('#joinNameField').querySelector('label').textContent = `给${petLabel(free)}起个名字（TA 养${petLabel(taken[0])}）`;
    $('#joinSecret').disabled = true; $('#joinCode').disabled = true;
    const oldBtn = $('#btnDoJoin'); const newBtn = oldBtn.cloneNode(false); newBtn.textContent = '入住！'; newBtn.disabled = false; oldBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', async () => {
      const name = $('#joinName').value.trim() || (free === 'rabbit' ? '奶糖' : '布丁');
      newBtn.disabled = true; newBtn.textContent = '入住中…';
      try { state.pets[free] = defaultPet(name); state = mergeStates(state, null); await writeRemote(state); saveAuth(); saveLocalState(); enterApp(); }
      catch (e) { toast('入住失败，再试一次'); newBtn.disabled = false; newBtn.textContent = '入住！'; }
    });
  } catch (e) { toast('网络不太好，再试一次'); btn.disabled = false; btn.textContent = '进入我们的小窝'; }
}
function enterApp() {
  $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden');
  if (storyIdx < 0) setStory(); applySeason(); applyModeTheme();
  try { renderAll(); }
  catch (e) {
    console.error('renderAll err', e);
    window.__bootErr && window.__bootErr('界面渲染出错：' + (e && e.message || e) + '\n点下方按钮强制刷新一次');
    return;
  }
  window.__bootDone && window.__bootDone();
  pull(true); toast(`🏠 欢迎回来，${myName()}！`); startInteractLoop();
}

/* ================= 启动 ================= */
function startInteractLoop() { if (interactTimer) clearInterval(interactTimer); interactTimer = setInterval(() => { if (auth && $('#gate').classList.contains('hidden')) maybeInteract(); }, 7000); }
function onEl(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
function bindEvents() {
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => {
    $$('.tabbar button').forEach((x) => x.classList.remove('active')); b.classList.add('active'); $$('.tab').forEach((t) => t.classList.remove('active')); $('#tab-' + b.dataset.tab).classList.add('active');
    toggleSheet(false);
    if (b.dataset.tab === 'interact') { state.hugSeen = state.hugSeen || {}; const last = (state.hugs || []).filter((h) => h.from !== auth.role).slice(-1)[0]; if (last && (!state.hugSeen[auth.role] || state.hugSeen[auth.role] < last.ts)) { state.hugSeen[auth.role] = last.ts; push(false); } renderInteract(); }
    if (b.dataset.tab === 'mood') renderMood();
    if (b.dataset.tab === 'room') renderRoom();
  }));
  onEl('btnSync', 'click', () => pull(false));
  onEl('btnBox', 'click', openBox);
  onEl('btnHug', 'click', sendHug);
  onEl('btnWriteWhisper', 'click', openWriteWhisper);
  onEl('btnSceneToggle', 'click', toggleScene);
  onEl('btnDecorate', 'click', openDecorate);
  onEl('btnFullRoom', 'click', openFullRoom);
  onEl('btnCloseRoom', 'click', closeFullRoom);
  onEl('btnSettings', 'click', openSettings);
  // 汤姆猫式互动：摸宠物分区 / 底部功能 / 面板抽屉
  const petsHost = $('#petStagePets');
  if (petsHost) petsHost.addEventListener('click', (e) => {
    const zone = e.target.closest('.pet-zone'); const pet = e.target.closest('.stage-pet');
    if (zone) reactPart(zone.dataset.role, zone.dataset.part);
    else if (pet) { const key = (PET_ZONES[pet.dataset.role] || []); reactPart(pet.dataset.role, key.length ? key[Math.floor(Math.random() * key.length)].part : 'body'); }
  });
  const dock = $('#petDock');
  if (dock) dock.addEventListener('click', (e) => { const b = e.target.closest('.dock-btn'); if (b) runDock(b.dataset.act); });
  onEl('btnSheet', 'click', () => toggleSheet());
  onEl('sheetMask', 'click', () => toggleSheet(false));
  // gate
  onEl('btnCreate', 'click', () => showGateScreen('gateCreate'));
  onEl('btnJoin', 'click', () => showGateScreen('gateJoin'));
  onEl('btnBack1', 'click', () => showGateScreen('gateHome'));
  onEl('btnBack2', 'click', () => showGateScreen('gateHome'));
  $$('.role-card').forEach((c) => c.addEventListener('click', () => { $$('.role-card').forEach((x) => x.classList.remove('sel')); c.classList.add('sel'); gateRole = c.dataset.role; }));
  onEl('btnDoCreate', 'click', doCreate);
  onEl('btnDoJoin', 'click', doJoin);
  onEl('btnCopyInvite', 'click', async () => { const text = $('#inviteText').textContent; try { await navigator.clipboard.writeText(text); toast('已复制！发给 TA 吧 📋'); } catch (e) { if (navigator.share) { try { await navigator.share({ text }); } catch (e2) {} } else toast('长按上面的文字手动复制哦'); } });
  onEl('btnEnterRoom', 'click', enterApp);
}
function init() {
  auth = loadAuth();
  if (auth && auth.roomKey && auth.role) {
    try {
      state = loadLocalState();
      if (!state) { state = ensureStateShape(defaultState(auth.role, '')); saveLocalState(); } // 本地数据丢失时重建，云端会再拉回
      enterApp();
    } catch (e) {
      console.error('boot err', e);
      try { $('#gate').classList.remove('hidden'); nextGateQuote(); setInterval(nextGateQuote, 6000); } catch (e2) {}
      window.__bootErr && window.__bootErr('启动出错了：' + (e && e.message || e) + '\n点下方按钮强制刷新一次');
    }
  } else {
    $('#gate').classList.remove('hidden'); nextGateQuote(); setInterval(nextGateQuote, 6000);
    window.__bootDone && window.__bootDone();
  }
  const m = location.hash.match(/#r=([A-Z0-9-]+)/i);
  if (m && !auth) { try { showGateScreen('gateJoin'); $('#joinCode').value = m[1].toUpperCase(); } catch (e) {} }
  const tabHash = location.hash.match(/tab=([a-z]+)/i);
  if (tabHash) { const t = tabHash[1]; const btn = document.querySelector('.tabbar button[data-tab="' + t + '"]'); if (btn) btn.click(); }
  const scHash = location.hash.match(/scene=(home|work)/i);
  if (scHash && sceneMode !== scHash[1]) { try { sceneMode = scHash[1]; const b = $('#btnSceneToggle'); if (b) b.textContent = sceneMode === 'home' ? '💼 去上班' : '🏠 下班回家'; renderHome(); } catch (e) {} }
  try { bindEvents(); } catch (e) { console.error('bind err', e); }
  setInterval(() => pull(true), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && auth) pull(true); });
}
try { init(); } catch (e) { console.error(e); try { window.__bootErr('页面初始化出错：' + (e && e.message || e) + '\n点下方按钮强制刷新一次'); } catch (e2) {} }
