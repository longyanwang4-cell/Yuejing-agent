// 史书典故：分幕文本 + 镜头 + 街景 + 练习。六篇各有一套街景与人物。
// 引文全部出自公有领域古籍（史记 / 左传 / 汉书 / 晋书 / 晏子春秋 / 战国策），现代解读一律用自己的话写。

// 每篇的街景：旗号、主色、地标、天气。
// landmarks 决定这条街上摆什么，没列出来的就不建 —— 六篇共用同一套街道骨架，换的是陈设与人物。
const TOWN = {
  zhao: {
    flag: '赵', accent: 0xb8873a, ground: 0xffffff, roof: 0x2e2a40,
    landmarks: ['gate'], stalls: true, trees: true, well: true,
    key: 0xffc48a, fill: 0x7c96dc, hemi: 0xa294c8,
  },
  song: {
    flag: '宋', accent: 0xa8803a, ground: 0xfff4e2, roof: 0x35303a,
    landmarks: ['hall', 'jade'], stalls: true, trees: true, well: false,
    key: 0xffd0a0, fill: 0x8a9cd0, hemi: 0xb0a2c8,
  },
  han: {
    flag: '汉', accent: 0x8a94b0, ground: 0xf2f6ff, roof: 0x3a4054,
    landmarks: ['yurt', 'sheep'], stalls: false, trees: false, well: false,
    snow: true, key: 0xcfe0ff, fill: 0x7c96dc, hemi: 0x9aa8c8,
  },
  jin: {
    flag: '晋', accent: 0x7a8a5a, ground: 0xf0ead8, roof: 0x2e3438,
    landmarks: ['gate', 'court'], stalls: true, trees: true, well: true,
    key: 0xffc48a, fill: 0x86a0d0, hemi: 0xa8a8b8,
  },
  chu: {
    flag: '楚', accent: 0x9a4a34, ground: 0xfff0e0, roof: 0x3a2a30,
    landmarks: ['gate', 'smallDoor'], stalls: true, trees: true, well: true,
    key: 0xffc48a, fill: 0x7c96dc, hemi: 0xa294c8,
  },
  qin: {
    flag: '秦', accent: 0x8a3a2a, ground: 0xe8dcc8, roof: 0x2a2430,
    landmarks: ['throne', 'brazier'], stalls: false, trees: false, well: false,
    key: 0xffb070, fill: 0x6a7cc0, hemi: 0x9a8ab0,
  },
};

// 五幕的相机位是通用的：wide（全场）/ lianpo（近人）/ street（街面）/ gate（门口）/ wide2（收回书）
export const STORIES = {
  conflict_being_right_is_trap: {
    id: 'conflict_being_right_is_trap',
    title: '将相和',
    subtitle: '两个人的功劳，与一场没打起来的架',
    source: '《史记·廉颇蔺相如列传》',
    era: '战国 · 赵',
    concept: '「先国家之急而后私仇」',
    origin: '《史记·廉颇蔺相如列传》',
    section: '卷八十一',
    ready: true,
    town: TOWN.zhao,
    cast: [
      { key: 'lianpo', kind: 'guard', opts: { h: 0.52, robe: 0x463a56, cape: true }, pos: [-0.5, 1.1] },
      { key: 'car', kind: 'carriage', pos: [0.56, 0.9], scale: 1.15 },
      { key: 'lin', kind: 'person', opts: { h: 0.34, robe: 0x4a4468 }, parent: 'car', pos: [0, 0.05], y: 0.12 },
      { key: 'linStand', kind: 'person', opts: { h: 0.48, robe: 0x4a4468 }, pos: [0.05, -0.62], vis: false },
      { key: 'lianpoWalk', kind: 'guard', opts: { h: 0.5, robe: 0x463a56 }, pos: [0, 0], vis: false },
    ],
    beats: {
      bg: { lianpo: { p: [-0.5, 1.1], r: 0.15 }, car: { p: [0.56, 0.9], r: 0, vis: true }, linStand: { vis: false }, lianpoWalk: { vis: false } },
      clash: { lianpo: { p: [-0.16, 0.66], r: 0.05 }, car: { p: [0.56, 0.9], r: 0, vis: true }, linStand: { vis: false }, lianpoWalk: { vis: false } },
      choice: { lianpo: { p: [0.28, 0.5], r: -0.85 }, car: { p: [-2.02, 0.28], r: Math.PI / 2, vis: true }, linStand: { vis: false }, lianpoWalk: { vis: false } },
      result: { lianpo: { vis: false }, car: { vis: false }, linStand: { vis: true, p: [0.08, -0.62], r: 0.1 }, lianpoWalk: { vis: true, p: [0.12, -0.18], r: 0, lean: 0.22 } },
      mirror: { lianpo: { vis: false }, car: { vis: false }, linStand: { vis: true, p: [-0.28, -0.36], r: -0.5 }, lianpoWalk: { vis: true, p: [0.36, -0.3], r: 0.55 } },
    },
    steps: [
      {
        key: 'bg', label: '背景', essence: '两人之功', title: '一个靠嘴，一个靠刀', shot: 'wide',
        page: ['赵国朝堂上，两个人各有各的功劳。', '蔺相如两次出使：一次带着和氏璧去秦国，原物带回；一次在渑池之会上，护住了赵王的体面。', '廉颇带兵在外，攻下的城、打过的仗，是一刀一枪换来的。'],
        quote: { text: '我为赵将，有攻城野战之大功', by: '廉颇' },
        caption: '两个人的功劳都是真的。',
      },
      {
        key: 'clash', label: '冲突', essence: '一句狠话', title: '他放话：见面一定要羞辱他', shot: 'lianpo',
        page: ['蔺相如被拜为上卿，位次排到了廉颇之上。', '廉颇不服：凭什么一个动嘴的，压在我这个打仗的头上。', '这话不是私下说的，是公开说的。'],
        quote: { text: '我见相如，必辱之。', by: '廉颇' },
        caption: '他要的不是把事情说清，是要赢。',
      },
      {
        key: 'choice', label: '抉择', essence: '一次避让', title: '他称病不上朝，路上把车拐进小巷', shot: 'street',
        page: ['蔺相如开始称病，不上朝。', '有一回在街上远远望见廉颇的车马，他让车夫调转车头，拐进旁边的巷子。', '门客看不下去：我们跟您，是敬您有骨气。这么躲，太窝囊了，我们想走。'],
        quote: { text: '相如引车避匿。', by: '史记' },
        caption: '躲，不是怕。是算过账。',
      },
      {
        key: 'result', label: '结果', essence: '两虎不斗', title: '两虎相斗，不能并存', shot: 'gate',
        page: ['蔺相如说：秦王那么威风，我敢在朝堂上呵斥他，我难道怕廉将军？', '我想的是——强秦不敢打赵国，就因为赵国有我们两个人。', '两虎相斗，不能并存。我这么做，是把国家的急事放在前，私人的仇怨放在后。'],
        quote: { text: '先国家之急而后私仇也。', by: '蔺相如' },
        caption: '廉颇听说了，脱下上衣、背着荆条，到门前请罪。两人成了刎颈之交。',
      },
      {
        key: 'mirror', label: '照见自己', essence: '先国后私', title: '你们俩都对，可作业还是得交', shot: 'wide2',
        page: ['廉颇占理：功劳是打出来的。', '蔺相如也占理：功劳是谈出来的。', '可一旦开始争「谁更对」，真正该做的事就没人做了。', '你要的不是赢下这一场辩论，是这份作业交得上去。'],
        quote: null,
        caption: '注意：蔺相如从没说过廉颇错。不争对错，不等于认输。',
      },
    ],
    practice: {
      place: '宿舍 · 晚上八点',
      setup: '小组作业交上去被打了回来。组里有人在群里说：这一版是你负责的，你说怎么办。',
      turns: [
        {
          who: '组员',
          line: '这一版是你拼的，现在被打回来了，你说怎么办？',
          choices: [
            { text: '先别急着分谁的锅。今晚八点我们把分工记录翻出来，对一遍再改。', kind: 'good', reply: '……行，那就八点。' },
            { text: '我拼的？初稿是你写的，你怎么不说？', kind: 'bad', reply: '你看，一说就吵。' },
            { text: '……好吧，都是我的问题，我重做。', kind: 'weak', reply: '那你就重做吧。（群里安静了）' },
          ],
        },
        {
          who: '组员',
          line: '八点我没空。你现在就说，到底谁的活没做完。',
          choices: [
            { text: '那现在说也行：三段内容谁写的，我们一条一条过。不猜。', kind: 'good', reply: '……那就过一遍。' },
            { text: '你没空就是你没空，别拿话堵我。', kind: 'bad', reply: '我堵你？' },
            { text: '算了算了，都我改，别吵了。', kind: 'weak', reply: '早这样不就行了。' },
          ],
        },
      ],
      done: '你没有赢下这场对话，但你把「谁更对」换成了「哪一段没做完」。',
    },
  },

  boundary_task_separation: {
    id: 'boundary_task_separation',
    title: '子罕辞玉',
    subtitle: '把「宝」换个说法，拒绝就不伤人',
    source: '《左传·襄公十五年》',
    era: '春秋 · 宋',
    concept: '「我以不贪为宝」',
    origin: '《左传·襄公十五年》',
    section: '襄公十五年',
    ready: true,
    town: TOWN.song,
    cast: [
      { key: 'zihan', kind: 'person', opts: { h: 0.52, robe: 0x3f4a52, sash: 0x8a6a3a }, pos: [-0.3, -0.44] },
      { key: 'giver', kind: 'person', opts: { h: 0.48, robe: 0x5a4a44 }, pos: [0.5, 0.9], r: Math.PI },
    ],
    beats: {
      bg: { giver: { p: [0.5, 0.9], r: Math.PI }, zihan: { p: [-0.3, -0.44], r: 0 } },
      clash: { giver: { p: [0.2, 0.34], r: Math.PI }, zihan: { p: [-0.26, -0.4], r: 0.12 } },
      choice: { giver: { p: [0.06, 0.2], r: Math.PI }, zihan: { p: [-0.16, -0.26], r: 0.24 } },
      result: { giver: { p: [0.56, 0.82], r: Math.PI * 0.82 }, zihan: { p: [-0.3, -0.44], r: -0.2 } },
      mirror: { giver: { p: [0.9, 0.6], r: Math.PI * 0.7 }, zihan: { p: [-0.42, -0.5], r: -0.35 } },
    },
    steps: [
      {
        key: 'bg', label: '背景', essence: '一块玉', title: '有人把一块玉送到他手上', shot: 'wide',
        page: ['宋国有人得了一块上好的玉。', '他没有自己留着，要把它献给执政的子罕。', '献玉的人觉得：这块玉能换一份庇护。'],
        quote: { text: '宋人或得玉，献诸子罕。', by: '左传' },
        caption: '他送的不是玉，是一次交换。',
      },
      {
        key: 'clash', label: '冲突', essence: '不接', title: '子罕没有接', shot: 'lianpo',
        page: ['子罕不接受。', '献玉的人说：这玉拿给玉匠看过，是难得的宝物。', '他以为对方嫌礼太薄。'],
        quote: { text: '以示玉人，玉人以为宝也，故敢献之。', by: '献玉者' },
        caption: '对方越认真，这一让就越难。',
      },
      {
        key: 'choice', label: '抉择', essence: '换个宝', title: '他把「宝」换了两个字', shot: 'street',
        page: ['子罕说：我把不贪当作宝，你把玉当作宝。', '如果把玉给我，我们两个人都丢了宝。', '不如各人守着自己的宝。'],
        quote: { text: '我以不贪为宝，尔以玉为宝。', by: '子罕' },
        caption: '他没有说玉不好，他说自己另有一件宝。',
      },
      {
        key: 'result', label: '结果', essence: '人没走', title: '献玉的人没有被赶走', shot: 'gate',
        page: ['子罕没有把献玉的人轰出去。', '他让那人把玉带回去，安排他住在自己的封邑里。', '拒绝的是这件事，不是这个人。'],
        quote: null,
        caption: '拒得干净，也没把人推远。',
      },
      {
        key: 'mirror', label: '照见自己', essence: '拒事不拒人', title: '你要拒的是事，不是人', shot: 'wide2',
        page: ['你开不了口，多半不是因为怕对方，', '是怕一开口，关系就没了。', '子罕的做法是：把边界说清，同时把路留着。'],
        quote: null,
        caption: '不贪，不等于不近人情。',
      },
    ],
    practice: {
      place: '宿舍 · 熄灯前',
      setup: '室友又来找你借充电器，这已经是这个月第四次，你今晚要用。',
      turns: [
        {
          who: '室友',
          line: '充电器借我用一晚上呗，我手机快没电了。',
          choices: [
            { text: '我今晚要用，这个不借。你的型号跟我不一样，我帮你查查楼下哪家店还开着。', kind: 'good', reply: '……那算了，我自己想办法。' },
            { text: '你这人怎么老借别人的东西？', kind: 'bad', reply: '不借就不借，说这么难听干嘛。' },
            { text: '……行吧，你拿去。（今晚你自己没法用）', kind: 'weak', reply: '谢啦！明天还你。' },
          ],
        },
        {
          who: '室友',
          line: '就一晚上，你今晚又不一定用，至于吗？',
          choices: [
            { text: '我得用，这是我的东西，用不用都不用给理由。你要急，超市八点关门。', kind: 'good', reply: '……行，我去买。' },
            { text: '你上次也说明天还，结果用了三天。', kind: 'bad', reply: '你翻旧账是吧？' },
            { text: '好好好，你拿去，别说了。', kind: 'weak', reply: '这才对嘛。' },
          ],
        },
      ],
      done: '你说的是「今晚我要用」，不是「你这人不行」。事情拒了，人还在。',
    },
  },

  boundary_courage_disliked: {
    id: 'boundary_courage_disliked',
    title: '苏武持节',
    subtitle: '被所有人劝着低头时，他还认得出自己',
    source: '《汉书·李广苏建传》',
    era: '西汉 · 匈奴',
    concept: '「屈节辱命，虽生何归」',
    origin: '《汉书·李广苏建传》',
    section: '卷五十四',
    ready: true,
    town: TOWN.han,
    cast: [
      { key: 'suwu', kind: 'person', opts: { h: 0.52, robe: 0x4a4058, cape: true, staff: true }, pos: [-0.34, -0.1] },
      { key: 'xiongnu', kind: 'guard', opts: { h: 0.5, robe: 0x6a4a34 }, pos: [0.42, -0.28], r: -1.3 },
    ],
    beats: {
      // 匈奴人始终朝着苏武 —— 背对镜头站在羊群里，看着只是个棕色木桶
      bg: { suwu: { p: [-0.34, -0.1], r: 0.1 }, xiongnu: { p: [0.42, -0.28], r: -1.3 } },
      clash: { suwu: { p: [-0.24, -0.02], r: 0.22 }, xiongnu: { p: [0.26, 0.02], r: -1.65 } },
      choice: { suwu: { p: [-0.62, 0.5], r: 0.5 }, xiongnu: { p: [0.42, 0.44], r: -1.5 } },
      result: { suwu: { p: [-0.1, -0.62], r: 0.05 }, xiongnu: { p: [0.72, 0.86], r: -2.6 } },
      mirror: { suwu: { p: [-0.3, -0.34], r: -0.3 }, xiongnu: { vis: false } },
    },
    steps: [
      {
        key: 'bg', label: '背景', essence: '一支节', title: '一支节，十九年', shot: 'wide',
        page: ['苏武出使匈奴，被扣下了。', '单于要他投降，许他高官厚禄。', '他手里那根汉节，已经磨得掉了毛。'],
        quote: { text: '杖汉节牧羊', by: '汉书' },
        caption: '所有人都在劝他低头。',
      },
      {
        key: 'clash', label: '冲突', essence: '熬他', title: '他们把他扔进地窖', shot: 'lianpo',
        page: ['先是断了他的粮。', '再把他迁到北海边上，让他放羊。', '告诉他：公羊生了小羊，就放你回去。'],
        quote: { text: '羝乳乃得归。', by: '匈奴' },
        caption: '这不是劝降，是熬。',
      },
      {
        key: 'choice', label: '抉择', essence: '节不落地', title: '他每天把节举起来', shot: 'street',
        page: ['没有粮食，他掘野鼠、吃草籽。', '但节一直没有放下。', '不是给别人看的，是给自己看的。'],
        quote: { text: '杖汉节牧羊，卧起操持，节旄尽落。', by: '汉书' },
        caption: '他守的不是一口气，是身份。',
      },
      {
        key: 'result', label: '结果', essence: '十九年', title: '十九年后，他回来了', shot: 'gate',
        page: ['来的时候一百多人，回去的只剩九个。', '节上的毛掉光了，他还举着。', '汉昭帝给了他一个位置：典属国。'],
        quote: null,
        caption: '他没有赢过谁，只是没变成另一个人。',
      },
      {
        key: 'mirror', label: '照见自己', essence: '认得出自己', title: '你怕的是被讨厌，不是被为难', shot: 'wide2',
        page: ['答应的时候，你以为是在维持关系。', '可一次一次答应，你在这段关系里就没有位置了。', '苏武守的那条线，不是跟别人较劲，是让自己还认得出自己。'],
        quote: null,
        caption: '被讨厌是一时的，变成另一个人是长久的。',
      },
    ],
    practice: {
      place: '教室 · 班会',
      setup: '班里要选一个人做汇报，没人举手，所有人的目光都落到你身上。你其实准备了另一个方向。',
      turns: [
        {
          who: '班长',
          line: '就你吧，你讲得最好，大家都这么觉得。',
          choices: [
            { text: '我这次不接。我准备的是另一个方向，需要的话我可以讲我那块。', kind: 'good', reply: '……那谁上？' },
            { text: '凭什么又是我？你们一个个都躲。', kind: 'bad', reply: '谁躲了？还不是看你讲得好。' },
            { text: '……行吧，我上。（你自己的方向就废了）', kind: 'weak', reply: '就知道你靠谱！' },
          ],
        },
        {
          who: '班长',
          line: '你要是不上，这课就没人讲了，大家都会怪你。',
          choices: [
            { text: '怪我我也不能上。我现在把能讲的讲清楚，剩下的得有人认领。', kind: 'good', reply: '……那我把名单发群里。' },
            { text: '你们就欺负老实人。', kind: 'bad', reply: '你这话什么意思？' },
            { text: '算了算了，我上，别吵了。', kind: 'weak', reply: '好，那就你。' },
          ],
        },
      ],
      done: '你没有被「大家都这么觉得」推着走，也没有把话说成指责。',
    },
  },

  boundary_not_others_expectation: {
    id: 'boundary_not_others_expectation',
    title: '不为五斗米折腰',
    subtitle: '八十天县令，换回一个自己',
    source: '《晋书·陶潜传》',
    era: '东晋 · 义熙',
    concept: '「不为五斗米折腰」',
    origin: '《晋书·陶潜传》',
    section: '卷九十四',
    ready: true,
    town: TOWN.jin,
    cast: [
      { key: 'tao', kind: 'person', opts: { h: 0.52, robe: 0x4a5a48, sash: 0x8a6a3a }, pos: [-0.34, -0.2] },
      { key: 'duyou', kind: 'guard', opts: { h: 0.5, robe: 0x5a4a3a, cape: true }, pos: [0.4, 0.84], r: Math.PI },
      { key: 'clerk', kind: 'person', opts: { h: 0.44, robe: 0x4a4452 }, pos: [0.02, 0.34], r: Math.PI * 0.9 },
    ],
    beats: {
      bg: { tao: { p: [-0.34, -0.2], r: 0.1 }, duyou: { p: [0.4, 0.84], r: Math.PI }, clerk: { p: [0.06, 0.42], r: Math.PI * 0.9 } },
      clash: { tao: { p: [-0.3, -0.14], r: 0.2 }, duyou: { p: [0.3, 0.6], r: Math.PI }, clerk: { p: [0.0, 0.3], r: Math.PI } },
      choice: { tao: { p: [-0.44, 0.24], r: 0.7 }, duyou: { p: [0.34, 0.72], r: Math.PI }, clerk: { p: [0.16, 0.44], r: Math.PI * 0.8 } },
      result: { tao: { p: [-0.6, 0.78], r: Math.PI * 0.55 }, duyou: { p: [0.44, 0.84], r: Math.PI }, clerk: { p: [0.2, 0.5], r: Math.PI } },
      mirror: { tao: { p: [-0.5, 0.5], r: Math.PI * 0.5 }, duyou: { vis: false }, clerk: { vis: false } },
    },
    steps: [
      {
        key: 'bg', label: '背景', essence: '八十天', title: '他刚当上彭泽令', shot: 'wide',
        page: ['陶渊明做了彭泽县令。', '上面派来的督邮到了县里。', '按规矩，他得整好衣冠、束带去见。'],
        quote: { text: '郡遣督邮至县。', by: '晋书' },
        caption: '一个县的父母官，也要低头。',
      },
      {
        key: 'clash', label: '冲突', essence: '束带', title: '他不想束带', shot: 'lianpo',
        page: ['属吏提醒他：应当束带见之。', '束带是一套礼数，也是一次表态。', '他当了几十天县令，为的是养家。'],
        quote: { text: '应束带见之。', by: '属吏' },
        caption: '不是大事，是一条线。',
      },
      {
        key: 'choice', label: '抉择', essence: '解印', title: '他把印解了下来', shot: 'street',
        page: ['他说：我不能为了五斗米，向乡里小人折腰。', '当天解下印绶，写下辞官的理由。', '上任到离任，八十多天。'],
        quote: { text: '吾不能为五斗米折腰，拳拳事乡里小人邪！', by: '陶渊明' },
        caption: '他拒的不是俸禄，是必须变成另一个人。',
      },
      {
        key: 'result', label: '结果', essence: '归去', title: '他回家种地去了', shot: 'gate',
        page: ['回去的路上写了《归去来兮辞》。', '后来日子并不宽裕，酒常常喝不上。', '但他再没回去当过官。'],
        quote: { text: '归去来兮，田园将芜胡不归。', by: '归去来兮辞' },
        caption: '代价是真代价，不是姿态。',
      },
      {
        key: 'mirror', label: '照见自己', essence: '先问一句', title: '答应之前，先问一句', shot: 'wide2',
        page: ['你答应的时候，常常不是想要，是怕对方失望。', '陶渊明算的不是得失，是「我还能不能是我」。', '这条线在哪，得你自己划。'],
        quote: null,
        caption: '折腰一次会变成习惯，第二次就不疼了。',
      },
    ],
    practice: {
      // 窗外是亮着灯的夜景，写「下午」会穿帮；傍晚正好——城市的灯刚亮
      place: '办公室 · 周五傍晚',
      setup: '导师让你周末去参加一个跟你课题无关的会，说「对你有好处」，其实只是凑人数。',
      turns: [
        {
          who: '导师',
          line: '周六那个会你来一下，坐个场，对你有好处。',
          choices: [
            { text: '周六我得赶实验数据。会的内容我看了，跟我的题不搭，这次我不去。', kind: 'good', reply: '……那你把数据做好。' },
            { text: '每次都叫我，怎么不叫别人？', kind: 'bad', reply: '你这是什么态度？' },
            { text: '……好的，我去。（你自己的事又往后拖）', kind: 'weak', reply: '嗯，就这样。' },
          ],
        },
        {
          who: '导师',
          line: '就半天，你连半天都抽不出来？别人都能来。',
          choices: [
            { text: '不是抽不出来，是这半天用在我这儿更值。数据周六出，我周一给您看结果。', kind: 'good', reply: '……行，周一我要看到。' },
            { text: '别人是别人，我是我。', kind: 'bad', reply: '你这话我记下了。' },
            { text: '那……我去吧。', kind: 'weak', reply: '这就对了。' },
          ],
        },
      ],
      done: '你给的是理由和替代方案，不是态度。「不去」这件事本身不需要道歉。',
    },
  },

  conflict_power_struggle: {
    id: 'conflict_power_struggle',
    title: '晏子使楚',
    subtitle: '对方给你挖的坑，可以递回去',
    source: '《晏子春秋·内篇杂下》',
    era: '春秋 · 楚',
    concept: '「使狗国者从狗门入」',
    origin: '《晏子春秋·内篇杂下》',
    section: '内篇杂下第九',
    ready: true,
    town: TOWN.chu,
    cast: [
      { key: 'yanzi', kind: 'person', opts: { h: 0.4, robe: 0x4a4468, sash: 0x8a2b22 }, pos: [-0.16, 0.66], r: Math.PI },
      { key: 'host', kind: 'guard', opts: { h: 0.5, robe: 0x5a4048 }, pos: [0.44, -0.7], r: 0.2 },
    ],
    beats: {
      bg: { yanzi: { p: [-0.16, 0.66], r: Math.PI }, host: { p: [0.44, -0.7], r: 0.2 } },
      clash: { yanzi: { p: [-0.16, 0.44], r: Math.PI }, host: { p: [0.3, -0.56], r: 0.1 } },
      choice: { yanzi: { p: [-0.1, 0.3], r: Math.PI * 0.86 }, host: { p: [0.24, -0.62], r: 0.05 } },
      result: { yanzi: { p: [-0.16, 0.16], r: Math.PI }, host: { p: [0.4, -0.72], r: -0.1 } },
      mirror: { yanzi: { p: [-0.3, 0.5], r: Math.PI * 0.8 }, host: { vis: false } },
    },
    steps: [
      {
        key: 'bg', label: '背景', essence: '一道小门', title: '楚人给他开了个小门', shot: 'wide',
        page: ['晏子出使楚国。', '楚人知道齐国派来的是个矮个子。', '就在大门旁边开了一道小门，请他进去。'],
        quote: { text: '楚人为小门于大门之侧而延晏子。', by: '晏子春秋' },
        caption: '还没进门，试探就开始了。',
      },
      {
        key: 'clash', label: '冲突', essence: '两个坏答案', title: '进，是认了；不进，是失礼', shot: 'lianpo',
        page: ['从小门进去，等于认下这层羞辱。', '当场发火，又落个使臣无礼。', '两边都不划算。'],
        quote: null,
        caption: '刁难的厉害之处，是让你只能在两个坏答案里挑。',
      },
      {
        key: 'choice', label: '抉择', essence: '递回去', title: '他把选择推回给对方', shot: 'street',
        page: ['晏子说：出使狗国的人，才从狗门进。', '我今天出使的是楚国，不该走这道门。', '请回去问清楚：楚国到底是什么国。'],
        quote: { text: '使狗国者从狗门入。今臣使楚，不当从此门入。', by: '晏子' },
        caption: '他没有骂人，他把门的问题变成了国的问题。',
      },
      {
        key: 'result', label: '结果', essence: '门开了', title: '门开了', shot: 'gate',
        page: ['迎宾的人只好领他从大门进去。', '见了楚王，楚王又问：齐国没人了吗？', '晏子答：齐国人多得很，只是出使要看对象。'],
        quote: { text: '齐之临淄三百闾。', by: '晏子春秋' },
        caption: '他没有退，也没有跟着对方的节奏走。',
      },
      {
        key: 'mirror', label: '照见自己', essence: '不接那一棒', title: '不接那一棒', shot: 'wide2',
        page: ['对方抛过来的不是问题，是一个框。', '你一接，就站进了他画的框里。', '晏子做的是：把框递回去。'],
        quote: null,
        caption: '不跟着怒，不等于没有脾气。',
      },
    ],
    practice: {
      place: '会议室 · 汇报中途',
      setup: '汇报会上，一个跟你不太熟的同事突然打断你。',
      turns: [
        {
          who: '同事',
          line: '这个方案你确定想过吗？我觉得挺业余的。',
          choices: [
            { text: '具体哪一段业余？你说出来，我们现在就改。', kind: 'good', reply: '……我是说整体思路。' },
            { text: '你行你上啊。', kind: 'bad', reply: '我就是提个意见。' },
            { text: '……可能确实不太成熟，我再想想。', kind: 'weak', reply: '嗯，那你再改改。' },
          ],
        },
        {
          who: '同事',
          line: '整体就没抓住重点，我说不上来，但感觉不对。',
          choices: [
            { text: '那我们先停在这。等你能说出具体哪一页，我们再回来改。', kind: 'good', reply: '……行吧。' },
            { text: '说不上来就别乱评价。', kind: 'bad', reply: '你这人怎么说话呢。' },
            { text: '那我整个推翻重做吧。', kind: 'weak', reply: '对，重做比较好。' },
          ],
        },
      ],
      done: '你没有接「业余」这个词，也没有把对方顶回去。你把话头拉回了具体的事。',
    },
  },

  conflict_anger_is_a_tool: {
    id: 'conflict_anger_is_a_tool',
    title: '唐雎不辱使命',
    subtitle: '他要的是你怕，你不怕，他的怒就没用了',
    source: '《战国策·魏策四》',
    era: '战国 · 秦',
    concept: '「此庸夫之怒，非士之怒」',
    origin: '《战国策·魏策四》',
    section: '魏策四',
    ready: true,
    town: TOWN.qin,
    cast: [
      { key: 'tangju', kind: 'person', opts: { h: 0.46, robe: 0x4a4468, sash: 0x8a2b22, sword: true }, pos: [0.06, 0.78], r: Math.PI },
      { key: 'king', kind: 'person', opts: { h: 0.54, robe: 0x6a3a2e, cape: true }, pos: [-0.4, -0.66], r: 0.1 },
    ],
    beats: {
      bg: { tangju: { p: [0.06, 0.78], r: Math.PI }, king: { p: [-0.4, -0.66], r: 0.1 } },
      clash: { tangju: { p: [0.02, 0.5], r: Math.PI }, king: { p: [-0.24, -0.42], r: 0.16 } },
      choice: { tangju: { p: [0.0, 0.34], r: Math.PI }, king: { p: [-0.1, -0.2], r: 0.28, lean: -0.2 } },
      result: { tangju: { p: [-0.02, 0.24], r: Math.PI }, king: { p: [-0.16, -0.3], r: 0.2, lean: 0.24 } },
      mirror: { tangju: { p: [-0.24, 0.4], r: Math.PI * 0.85 }, king: { p: [0.3, -0.6], r: -0.2 } },
    },
    steps: [
      {
        key: 'bg', label: '背景', essence: '五十里地', title: '秦王要一块地，说要用五百里换', shot: 'wide',
        page: ['秦王派人对安陵君说：我用五百里地，换你五十里。', '安陵君没答应。', '秦王不高兴，安陵君就派唐雎出使秦国。'],
        quote: { text: '以五百里之地易安陵。', by: '战国策' },
        caption: '这笔「买卖」，从一开始就不是买卖。',
      },
      {
        key: 'clash', label: '冲突', essence: '天子之怒', title: '秦王把火先点起来', shot: 'lianpo',
        page: ['秦王对唐雎说：你听说过天子发怒吗？', '唐雎答：没听说过。', '秦王说：天子一发怒，伏尸百万，流血千里。'],
        quote: { text: '天子之怒，伏尸百万，流血千里。', by: '秦王' },
        caption: '他不是在讲道理，是在让你怕。',
      },
      {
        key: 'choice', label: '抉择', essence: '两种怒', title: '他把「怒」拆成了两种', shot: 'street',
        page: ['唐雎问：大王听说过布衣之怒吗？', '秦王说：不过是摘了帽子、光着脚、拿头撞地罢了。', '唐雎说：那是庸夫之怒，不是士之怒。'],
        quote: { text: '此庸夫之怒也，非士之怒也。', by: '唐雎' },
        caption: '他不否认怒，他重新定义了怒。',
      },
      {
        key: 'result', label: '结果', essence: '挺剑而起', title: '秦王变了脸色', shot: 'gate',
        page: ['唐雎说：如果士一定要发怒，倒在地上的就是两个人，血流五步，天下人都穿白。', '今天就是这样。', '他挺剑而起。秦王长跪而谢。'],
        quote: { text: '若士必怒，伏尸二人，流血五步，天下缟素，今日是也。', by: '唐雎' },
        caption: '安陵最后保住了。靠的不是嗓门大。',
      },
      {
        key: 'mirror', label: '照见自己', essence: '不跟着怒', title: '对方越吼，你越要慢', shot: 'wide2',
        page: ['发火的人，往往是在借怒气拿走你的判断。', '你一急，就只剩两个反应：顶回去，或者认下来。', '唐雎做的第三件事：把「怒」拆开，看看它到底是什么。'],
        quote: null,
        caption: '不被吓住，也不跟着怒 —— 这两件事可以同时做到。',
      },
    ],
    practice: {
      place: '宿舍 · 深夜',
      setup: '你和室友因为卫生问题起了争执，他声音越来越大。',
      turns: [
        {
          who: '室友',
          line: '这屋子就我一个人住是吗？我天天打扫你看见了吗！',
          choices: [
            { text: '你打扫了，我看见了。我们现在说的是垃圾谁倒——这个可以排个班。', kind: 'good', reply: '……排就排。' },
            { text: '你打扫？你那是打扫？', kind: 'bad', reply: '行，那我以后不扫了。' },
            { text: '……对不起，是我的错，你别生气。', kind: 'weak', reply: '你每次都这样，下次还是这样。' },
          ],
        },
        {
          who: '室友',
          line: '排班？你上次也这么说，坚持了三天。',
          choices: [
            { text: '上次没坚持是我没做好。这次写下来贴在门上，谁没倒谁自己划掉。', kind: 'good', reply: '……行，写。' },
            { text: '你少翻旧账，你就没忘倒过？', kind: 'bad', reply: '那没法聊了。' },
            { text: '那你说怎么办就怎么办吧。', kind: 'weak', reply: '我说？我说你也不听。' },
          ],
        },
      ],
      done: '你没有被他的音量带走，也没有为了止住争吵把责任全揽下来。',
    },
  },
};

// 尚未精做的篇目：给题面，不做 3D
export const PENDING_STORIES = {};
