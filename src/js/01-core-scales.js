/* 幻歌鸟调色盘 · Gengoetori Palette
 * © 2026 TouhouGakurin / 幻歌鸟与风声之乐 · MIT License
 * https://github.com/TouhouGakurin/gengoetori-palette
 */
/* 60 个音阶：来源（src）× 调式色彩（第三级/七级）× 音乐语言中的性质（traits）
   ────────────────────────────────────────────────────────────
   每条音阶不是一列音级，而是一段有出处的音乐语汇：
     src    来自哪个体裁/地域/理论传统（见 ORIGINS）
     rot    在那个传统内部的旋法序号（只有成套的七声体系才有）
     traits 它在实际写作里扮演的角色：色彩、常用级数、标志性音程
     about  一句话讲清它是什么、在什么场合出现
     pcs    最后才是音级本身 —— 音级是结果，不是定义
   ──────────────────────────────────────────────────────────── */

const ORIGINS = [
  {id:"church",   cn:"教会调式",       en:"Church modes",       short:"教会", order:1,
   note:"中世纪的七声调式体系；二十世纪以后被爵士、民谣与影视配乐重新采用。"},
  {id:"melodic",  cn:"旋律小调体系",   en:"Melodic minor",      short:"旋律小调", order:2,
   note:"小调上行升高六、七级形成的七声体系，爵士理论把它拆成七条旋法。"},
  {id:"harmonic", cn:"和声小调体系",   en:"Harmonic minor",     short:"和声小调", order:3,
   note:"小三度与增二度并存的七声体系，小调功能和声的母体。"},
  {id:"harmMajor",cn:"和声大调体系",   en:"Harmonic major",     short:"和声大调", order:4,
   note:"大调第六级降半音得到的七声体系，大小调互相渗透后的产物。"},
  {id:"neap",     cn:"那不勒斯与降二调式", en:"Neapolitan family", short:"降二", order:5,
   note:"以降二级起头的调式群：那不勒斯六和弦、西班牙半音语汇都从这里取材料。"},
  {id:"jazz",     cn:"爵士与布鲁斯",   en:"Jazz & blues",       short:"爵士", order:6,
   note:"布鲁斯音阶与 bebop 八声音阶，二十世纪中叶爵士的即兴语汇。"},
  {id:"folk",     cn:"民族与地域",     en:"Folk & regional",     short:"民族", order:7,
   note:"各民族的五声与七声语汇：中国五声、日本都节、东欧吉普赛与中东圣咏。"},
  {id:"symm",     cn:"对称音阶",       en:"Symmetrical / limited transposition", short:"对称", order:8,
   note:"移位若干次后自我重合的结构：全音、增、减、半音与梅西安有限移位调式。"}
];

const ORIGIN_ORDER = ORIGINS.map(o => o.id);

const MODES = [
  /* ── 教会调式：大调音阶的七个旋法 ───────────────────────── */
  {id:"ion", src:"church", rot:1, cn:"伊奥尼亚 · 自然大调", n:"Ionian",
   traits:["大小调功能的基准","主音是大三和弦"],
   about:"西方大小调体系的中心音阶，主音上是大三和弦，七个音级都没有变化音。",
   pcs:[0,2,4,5,7,9,11]},

  {id:"dor", src:"church", rot:2, cn:"多利亚", n:"Dorian",
   traits:["民谣与吟唱常用","Ⅱ 级和声"],
   about:"降三级、还原六级的自然小调，凯尔特音乐与爵士 Ⅱ 级和弦的共同底色。",
   pcs:[0,2,3,5,7,9,10]},

  {id:"phr", src:"church", rot:3, cn:"弗里几亚", n:"Phrygian",
   traits:["降二级的压迫感","西班牙与中东风味"],
   about:"以小二度起头的七声，弗拉门戈与中东音乐的核心语汇。",
   pcs:[0,1,3,5,7,8,10]},

  {id:"lyd", src:"church", rot:4, cn:"利底亚", n:"Lydian",
   traits:["升四级","影视配乐常用"],
   about:"唯一带升四级的自然七声，悬浮感强，电影配乐常用来写开阔与辽远。",
   pcs:[0,2,4,6,7,9,11]},

  {id:"mix", src:"church", rot:5, cn:"混合利底亚", n:"Mixolydian",
   traits:["降七级的属色彩","摇滚与放克常用"],
   about:"大调音阶降七级，属七和弦的母音阶，也是摇滚与放克即兴的常用音阶。",
   pcs:[0,2,4,5,7,9,10]},

  {id:"aeo", src:"church", rot:6, cn:"伊奥利亚 · 自然小调", n:"Aeolian",
   traits:["自然小调","流行与摇滚的底色"],
   about:"降三级与降六级的自然小调，现代流行、摇滚与影视配乐最常用的小调。",
   pcs:[0,2,3,5,7,8,10]},

  {id:"loc", src:"church", rot:7, cn:"洛克里亚", n:"Locrian",
   traits:["减五度的不稳定","ⅶø7 的母音阶"],
   about:"唯一没有纯五度的七声，主音三和弦是半减五度，几乎只作不稳定的经过。",
   pcs:[0,1,3,5,6,8,10]},

  /* ── 旋律小调体系 ────────────────────────────────────── */
  {id:"mm", src:"melodic", rot:1, cn:"旋律小调", n:"Melodic Minor",
   traits:["爵士小调的母体","上行升六、七级"],
   about:"小调上行时升高六、七级以避免增二度；爵士理论把它当作七条旋法的母体。",
   pcs:[0,2,3,5,7,9,11]},

  {id:"dor2", src:"melodic", rot:2, cn:"多利亚降二", n:"Dorian b2",
   traits:["降二级的小调","属七升五的替代"],
   about:"多利亚再降二级，常用来在属功能上做半音变化。",
   pcs:[0,1,3,5,7,9,10]},

  {id:"lyd5", src:"melodic", rot:3, cn:"利底亚增五", n:"Lydian Augmented",
   traits:["增五度的明亮","Ⅲ 级变化音阶"],
   about:"旋律小调第三旋法，大三和弦加升五度，色彩明亮而不稳定。",
   pcs:[0,2,4,6,8,9,11]},

  {id:"ld", src:"melodic", rot:4, cn:"利底亚属", n:"Lydian Dominant",
   traits:["升四级的属音阶","属七升十一"],
   about:"属七和弦配升十一度，爵士里最常见的属音阶之一。",
   pcs:[0,2,4,6,7,9,10]},

  {id:"mixb6", src:"melodic", rot:5, cn:"混合利底亚降六", n:"Mixolydian b6",
   traits:["降六级的属音阶","Ⅴ 级柔和解决"],
   about:"属音阶降六级，解决到主和弦时有不带导音的柔顺感。",
   pcs:[0,2,4,5,7,8,10]},

  {id:"loc2", src:"melodic", rot:6, cn:"洛克里亚还原二", n:"Locrian ♮2",
   traits:["半减五度还原二","ⅵ 级常用"],
   about:"半减五度和弦的母音阶，还原二级让它比洛克里亚实用得多。",
   pcs:[0,2,3,5,6,8,10]},

  {id:"sloc", src:"melodic", rot:7, cn:"超级洛克里亚 · 变化", n:"Super Locrian",
   traits:["七个变化音","变化属和弦的母体"],
   about:"除主音外全部降低，常被当作变化属和弦的母音阶。",
   pcs:[0,1,3,4,6,8,10]},

  /* ── 和声小调体系 ────────────────────────────────────── */
  {id:"hm", src:"harmonic", rot:1, cn:"和声小调", n:"Harmonic Minor",
   traits:["小三度与增二度","小调功能和声的母体"],
   about:"升高七级让属和弦有导音，代价是六级与七级之间的增二度。",
   pcs:[0,2,3,5,7,8,11]},

  {id:"loc6", src:"harmonic", rot:2, cn:"洛克里亚还原六", n:"Locrian ♮6",
   traits:["半减五度还原六","Ⅱ 级和声"],
   about:"和声小调第二旋法，Ⅱ 级半减五度七和弦的母音阶。",
   pcs:[0,1,3,5,6,9,10]},

  {id:"ion5", src:"harmonic", rot:3, cn:"伊奥尼亚增五", n:"Ionian #5",
   traits:["增五度","Ⅲ 级色彩"],
   about:"和声小调第三旋法，主音是大三和弦加增五度。",
   pcs:[0,2,4,5,8,9,11]},

  {id:"dor4", src:"harmonic", rot:4, cn:"多利亚增四", n:"Dorian #4",
   traits:["升四级的小调","吉普赛与东欧"],
   about:"多利亚再升四级，罗马尼亚与吉普赛音乐里的常见音阶。",
   pcs:[0,2,3,6,7,9,10]},

  {id:"phr3", src:"harmonic", rot:5, cn:"弗里几亚还原三 · 属和弦", n:"Phrygian ♮3",
   traits:["大三度配降二降六","西班牙与中东"],
   about:"属功能上的弗里几亚，也叫西班牙音阶、双和声大调音阶。",
   pcs:[0,1,4,5,7,8,10]},

  {id:"lyd2", src:"harmonic", rot:6, cn:"利底亚增二", n:"Lydian #2",
   traits:["增二度","Ⅵ 级异域色彩"],
   about:"从主音到第二级就是增二度，异域色彩最浓的一条旋法。",
   pcs:[0,3,4,6,7,9,11]},

  {id:"uloc", src:"harmonic", rot:7, cn:"超级洛克里亚降七", n:"Ultralocrian",
   traits:["双减七度的极限不稳定","只能当经过"],
   about:"和声小调第七旋法，减七度加降五度，几乎没有独立的用法。",
   pcs:[0,1,3,4,6,8,9]},

  /* ── 和声大调体系 ────────────────────────────────────── */
  {id:"hma", src:"harmMajor", rot:1, cn:"和声大调", n:"Harmonic Major",
   traits:["降六级的大调","大三和弦配小六度"],
   about:"大调降六级得到的七声，主和弦是大三，下属方向却带小六度。",
   pcs:[0,2,4,5,7,8,11]},

  {id:"dor5", src:"harmMajor", rot:2, cn:"多利亚降五", n:"Dorian b5",
   traits:["降五度","Ⅱ 级"],
   about:"和声大调第二旋法，小七和弦缺纯五度。",
   pcs:[0,2,3,5,6,9,10]},

  {id:"phr4", src:"harmMajor", rot:3, cn:"弗里几亚降四", n:"Phrygian b4",
   traits:["降四度","Ⅲ 级"],
   about:"和声大调第三旋法，四级降半音，三全音的位置与常见调式不同。",
   pcs:[0,1,3,4,7,8,10]},

  {id:"lydb3", src:"harmMajor", rot:4, cn:"利底亚降三", n:"Lydian b3",
   traits:["升四降三","Ⅳ 级"],
   about:"和声大调第四旋法，同时带升四级与降三级。",
   pcs:[0,2,3,6,7,9,11]},

  {id:"mixb2", src:"harmMajor", rot:5, cn:"那不勒斯混合利底亚", n:"Mixolydian b2",
   traits:["降二级的属音阶","那不勒斯色彩"],
   about:"和声大调第五旋法，属功能上带降二级，听感接近那不勒斯和弦。",
   pcs:[0,1,4,5,7,9,10]},

  {id:"lyda2", src:"harmMajor", rot:6, cn:"利底亚增五增二", n:"Lydian Augmented #2",
   traits:["增五加增二","Ⅵ 级复合色彩"],
   about:"和声大调第六旋法，两个增音程叠在同一个调式里。",
   pcs:[0,3,4,6,8,9,11]},

  {id:"locb7", src:"harmMajor", rot:7, cn:"洛克里亚降七", n:"Locrian bb7",
   traits:["双减七度","ⅶ 级"],
   about:"和声大调第七旋法，导音与主音之间同时有降五度和双减七度。",
   pcs:[0,1,3,5,6,8,9]},

  /* ── 那不勒斯与降二调式 ──────────────────────────────── */
  {id:"ionb2", src:"neap", rot:null, cn:"伊奥尼亚降二", n:"Ionian b2",
   traits:["降二级","西班牙与犹太礼拜音乐"],
   about:"大调音阶降二级，二级与主音形成小二度，西班牙与礼拜音乐常用。",
   pcs:[0,1,4,5,7,9,11]},

  {id:"napoM", src:"neap", rot:null, cn:"那不勒斯大调", n:"Neapolitan Major",
   traits:["降二降三","理论调式"],
   about:"以那不勒斯六和弦为核心的降二降三大调，理论书与现代配乐里常见。",
   pcs:[0,1,3,5,7,9,11]},

  {id:"napoN", src:"neap", rot:null, cn:"拿波里小调", n:"Neapolitan Minor",
   traits:["降二降三的小调","那不勒斯六和弦的母体"],
   about:"和声小调再降二级，那不勒斯六和弦就取自它的降二级。",
   pcs:[0,1,3,5,7,8,11]},

  /* ── 对称音阶：移位后自我重合 ────────────────────────── */
  {id:"wt0", src:"symm", rot:null, cn:"全音阶", n:"Whole Tone",
   traits:["六个音等距","没有半音"],
   about:"全部音程都是全音，只有两种移位，听感悬浮、没有调性中心。",
   pcs:[0,2,4,6,8,10]},

  {id:"wt1", src:"symm", rot:null, cn:"全音阶 · 移高半音", n:"Whole Tone (+1)",
   traits:["六个音等距","与 wt0 无共同音"],
   about:"全音阶的另一次移位，与上一条没有一个共同音。",
   pcs:[1,3,5,7,9,11]},

  {id:"aug1", src:"symm", rot:null, cn:"增音阶 · 甲式", n:"Augmented (C–D♯)",
   traits:["两个增三和弦交叠","三度与半音交替"],
   about:"两个相距半音的增三和弦叠成六声，音程按三度与半音交替。",
   pcs:[0,3,4,7,8,11]},

  {id:"aug2", src:"symm", rot:null, cn:"增音阶 · 乙式", n:"Augmented (C–D♭)",
   traits:["两个增三和弦交叠","半音与三度交替"],
   about:"增音阶的另一种起点，音程顺序与甲式相反。",
   pcs:[0,1,4,5,8,9]},

  {id:"dimWH", src:"symm", rot:null, cn:"减音阶 · 全半", n:"Diminished (W–H)",
   traits:["全音半音交替","含两个减七和弦"],
   about:"全音与半音交替的八声，包含两个减七和弦，常用于属功能。",
   pcs:[0,2,3,5,6,8,9,11]},

  {id:"dimHW", src:"symm", rot:null, cn:"减音阶 · 半全", n:"Diminished (H–W)",
   traits:["半音全音交替","减七和弦的母体"],
   about:"半音与全音交替的八声，减七和弦的母音阶。",
   pcs:[0,1,3,4,6,7,9,10]},

  /* ── 民族与地域：中国五声（旋宫）────────────────────── */
  {id:"penG", src:"folk", rot:null, pentRot:0, cn:"五声 · 宫调式", n:"Pentatonic — Gong",
   traits:["中国五声","宫调式：以第一音为主"],
   about:"宫音为主音的五声，没有半音也没有三全音，色彩最接近大调。",
   pcs:[0,2,4,7,9], degNames:["宫","商","角","徵","羽"]},

  {id:"penS", src:"folk", rot:null, pentRot:1, cn:"五声 · 商调式", n:"Pentatonic — Shang",
   traits:["中国五声","商调式：以第二音为主"],
   about:"以商为主音，五声的第二次序；调式音是宫、商、清角、徵、闰这一组，听上去比宫调式更「硬」。",
   pcs:[0,2,5,7,10], degNames:["商","角","徵","羽","宫"]},

  {id:"penJ", src:"folk", rot:null, pentRot:2, cn:"五声 · 角调式", n:"Pentatonic — Jue",
   traits:["中国五声","角调式：以第三音为主"],
   about:"以角为主音，五声里唯一带小三度与大六度的旋法。",
   pcs:[0,3,5,8,10], degNames:["角","徵","羽","宫","商"]},

  {id:"penZ", src:"folk", rot:null, pentRot:3, cn:"五声 · 徵调式", n:"Pentatonic — Zhi",
   traits:["中国五声","徵调式：骨架同宫调式"],
   about:"以徵为主音，音集与宫调式相同，只是重心移到了第四个音。",
   pcs:[0,2,5,7,9], degNames:["徵","羽","宫","商","角"]},

  {id:"penY", src:"folk", rot:null, pentRot:4, cn:"五声 · 羽调式", n:"Pentatonic — Yu",
   traits:["中国五声","羽调式：最接近自然小调"],
   about:"以羽为主音，五声里最接近自然小调的一条。",
   pcs:[0,3,5,7,10], degNames:["羽","宫","商","角","徵"]},

  /* ── 民族与地域：日本 ────────────────────────────────── */
  {id:"in", src:"folk", rot:null, cn:"都节音阶（日本）", n:"Miyako-bushi",
   traits:["日本都市音阶","含两个半音"],
   about:"日本近世的都节音阶，含两个半音，是筝曲与民谣的基础。",
   pcs:[0,1,5,7,8]},

  {id:"hira", src:"folk", rot:null, cn:"平调子音阶（日本）", n:"Hirajoshi",
   traits:["日本民谣","半音与纯四度并存"],
   about:"平调子，日本民谣与筝曲常用的五声，含一个小二度与一个大三度。",
   pcs:[0,2,3,7,8]},

  {id:"iwato", src:"folk", rot:null, cn:"岩户音阶（日本）", n:"Iwato",
   traits:["日本神乐","三全音加半音"],
   about:"岩户，神乐与雅乐里的五声，含三全音与半音，色彩最涩。",
   pcs:[0,1,5,6,10]},

  /* ── 民族与地域：东欧与中东 ──────────────────────────── */
  {id:"hung", src:"folk", rot:null, cn:"匈牙利小调", n:"Hungarian Minor",
   traits:["两个增二度","吉普赛与东欧"],
   about:"和声小调再升四级，两个增二度让它成为吉普赛音乐的代表。",
   pcs:[0,2,3,6,7,8,11]},

  {id:"hungM", src:"folk", rot:null, cn:"匈牙利大调", n:"Hungarian Major",
   traits:["升四降六的大调","东欧"],
   about:"大调音阶升四级、降六级，与匈牙利小调成对出现的东欧色彩。",
   pcs:[0,2,4,6,7,8,11]},

  {id:"byz", src:"folk", rot:null, cn:"拜占庭 · 双和声大调", n:"Byzantine",
   traits:["两个增二度","中东与东正教圣咏"],
   about:"降二级、降六级的大调，两个增二度，中东与东正教圣咏常用。",
   pcs:[0,1,4,5,7,8,11]},

  /* ── 爵士与布鲁斯 ────────────────────────────────────── */
  {id:"blues", src:"jazz", rot:null, cn:"布鲁斯音阶（六声）", n:"Blues",
   traits:["小调五声加降五","布鲁斯与摇滚即兴"],
   about:"小调五声加降五度的蓝音，布鲁斯与摇滚即兴的核心材料。",
   pcs:[0,3,5,6,7,10]},

  {id:"mblues", src:"jazz", rot:null, cn:"大调布鲁斯（六声）", n:"Major Blues",
   traits:["大调五声加降三","乡村与早期爵士"],
   about:"大调五声加降三级的蓝音，乡村、福音与早期爵士常用。",
   pcs:[0,2,3,4,7,9]},

  {id:"bop7", src:"jazz", rot:null, cn:"Bebop 属音阶", n:"Bebop Dominant",
   traits:["属音阶加还原七","bebop 句法"],
   about:"混合利底亚加还原七级作经过音，让八分音符落在正拍上。",
   pcs:[0,2,4,5,7,9,10,11]},

  {id:"bopM", src:"jazz", rot:null, cn:"Bebop 大调", n:"Bebop Major",
   traits:["大调音阶加降六","bebop 大调句"],
   about:"大调音阶加降六级经过音，bebop 大调旋律的标准形态。",
   pcs:[0,2,4,5,7,8,9,11]},

  {id:"bopm", src:"jazz", rot:null, cn:"Bebop 小调", n:"Bebop Dorian",
   traits:["多利亚加还原三","bebop 小调句"],
   about:"多利亚加还原三级经过音，小调 bebop 的常用音阶。",
   pcs:[0,2,3,4,5,7,9,10]},

  {id:"bopd", src:"jazz", rot:null, cn:"Bebop 属升四", n:"Bebop Dominant ♯4",
   traits:["混合利底亚加升四","属七上的半音经过"],
   about:"混合利底亚再加升四级，四级与升四级并存的八声经过音阶。",
   pcs:[0,2,4,5,6,7,9,10]},

  /* ── 梅西安有限移位调式 ──────────────────────────────── */
  {id:"mes3", src:"symm", rot:null, cn:"梅西安 3 号（九声）", n:"Messiaen 3",
   traits:["有限移位"],
   about:"梅西安第三调式，九声，移位三次后与自身重合。",
   pcs:[0,2,3,4,6,7,8,10,11]},

  {id:"mes4", src:"symm", rot:null, cn:"梅西安 4 号（八声）", n:"Messiaen 4",
   traits:["有限移位"],
   about:"梅西安第四调式，八声，移位五次后与自身重合。",
   pcs:[0,1,2,5,6,7,8,11]},

  {id:"mes5", src:"symm", rot:null, cn:"梅西安 5 号（六声）", n:"Messiaen 5",
   traits:["有限移位"],
   about:"梅西安第五调式，六声，由三组「半音加三度」叠成。",
   pcs:[0,1,2,6,7,8]},

  {id:"mes6", src:"symm", rot:null, cn:"梅西安 6 号（九声）", n:"Messiaen 6",
   traits:["有限移位"],
   about:"梅西安第六调式，九声，由「小二度加大二度」反复构成。",
   pcs:[0,2,3,4,6,7,9,10,11]},

  {id:"mes7", src:"symm", rot:null, cn:"梅西安 7 号（十声）", n:"Messiaen 7",
   traits:["有限移位"],
   about:"梅西安第七调式，十声，移位一次后与自身重合。",
   pcs:[0,1,2,3,5,6,7,8,9,10]},

  {id:"chrom", src:"symm", rot:null, cn:"半音阶（十二声）", n:"Chromatic",
   traits:["没有调性中心","最小的音程单位"],
   about:"十二个半音全用上，没有调性中心，是音高材料的全集。",
   pcs:[0,1,2,3,4,5,6,7,8,9,10,11]}
];

const IONIAN = [0,2,4,5,7,9,11];

const TONICS = [
  {pc:0,li:0,acc:0},{pc:1,li:0,acc:1},{pc:2,li:1,acc:0},{pc:3,li:2,acc:-1},
  {pc:4,li:2,acc:0},{pc:5,li:3,acc:0},{pc:6,li:3,acc:1},{pc:7,li:4,acc:0},
  {pc:8,li:5,acc:-1},{pc:9,li:5,acc:0},{pc:10,li:6,acc:-1},{pc:11,li:6,acc:0}
];

/* ── 派生：来源查表 ──────────────────────────────────────── */
const ORIGIN_OF = {};
ORIGINS.forEach(o => { ORIGIN_OF[o.id] = o; });
MODES.forEach(m => {
  m.origin = ORIGIN_OF[m.src] || ORIGINS[0];
  m.originOrder = m.origin.order;
});

function originLabel(m){ return (m.origin && m.origin.cn) || m.src; }
function originShort(m){ return (m.origin && m.origin.short) || m.src; }

/* ── 派生：调式色彩（看第三级与第七级，只看音程关系）─────── */
function scaleColor(m){
  const s = m.pcs, has = p => s.indexOf(p) >= 0;
  // 五声没有三度音，按旋宫定性（宫、商、徵为大，角、羽为小），和调号色彩保持同一套口径
  if(m.pentRot != null) return (m.pentRot === 2 || m.pentRot === 4) ? "minor" : "major";
  const maj3 = has(4), min3 = has(3), b7 = has(10), p5 = has(7);
  if(maj3 && min3) return "mixed";       // 大三度小三度并存
  if(maj3) return p5 ? (b7 ? "dom" : "major") : "aug";   // 属色彩 / 大调色彩 / 没有纯五度的增三色彩
  if(min3) return "minor";               // 小调色彩
  return "none";                         // 没有三度
}
const COLOR_CN  = {major:"大调色彩", minor:"小调色彩", dom:"属色彩", aug:"增三色彩",
                   mixed:"大小三度并存", none:"没有三度"};
const COLOR_KEY = {major:"M", minor:"m", dom:"D", aug:"A", mixed:"X", none:"x"};

MODES.forEach(m => {
  m.colorKey = COLOR_KEY[scaleColor(m)];
  m.colorCn  = COLOR_CN[scaleColor(m)];
});

/* ── 派生：音乐的「性格标签」────────────────────────────── */
// 会把音级里的特征自动翻成中文标签，与人工写的 traits 一起显示
function autoTraits(m){
  const out = [], s = m.pcs, n = s.length;
  const gaps = s.map((p, i) => ((s[(i + 1) % n] - p) + 12) % 12);
  // 音数已经由详情头的「N 声音阶」徽标说明，这里只补听感/结构上的特征
  if(gaps.some(g => g === 3) && n === 7) out.push("含增二度");
  if(!gaps.some(g => g === 1) && n > 3) out.push("没有半音");
  if(gaps.every(g => g === gaps[0])) out.push("等距");
  const sym = [1,2,3,4,5,6].some(t => s.every(p => s.indexOf((p + t) % 12) >= 0));
  if(sym) out.push("对称");
  return out;
}
/* 风格与色彩感受：这两层是「听感」，不是音级。
   风格 style = 这条音阶在现实里最常出现的乐种/地域（凯尔特、哥特、爵士、中国、中东……），
   色彩感受 mood = 听到它时的第一印象（明亮、幽静、苦涩、诡谲……）。
   原来的「凯尔特 / 异域 / 悬 / 哥特 / 哥特古典」照原样保留在 style 里，其余按同一套词汇补齐。 */
const STYLE_MOOD = {
  ion:   ["古典",   "明亮"],
  dor:   ["凯尔特", "温暖"],
  phr:   ["异域",   "阴郁"],
  lyd:   ["悬",     "空灵"],
  mix:   ["蓝调",   "晴朗"],
  aeo:   ["民谣",   "忧郁"],
  loc:   ["哥特",   "阴暗"],

  mm:    ["爵士",   "忧郁"],
  dor2:  ["爵士",   "苦涩"],
  lyd5:  ["悬",     "神秘"],
  ld:    ["悬",     "辉煌"],
  mixb6: ["爵士",   "漂浮"],
  loc2:  ["爵士",   "阴暗"],
  sloc:  ["爵士",   "诡谲"],

  hm:    ["哥特古典", "悲怆"],
  loc6:  ["吉普赛",  "苦涩"],
  ion5:  ["悬",     "怪异"],
  dor4:  ["哥特",   "冷峻"],
  phr3:  ["异域",   "灼热"],
  lyd2:  ["异域",   "华丽"],
  uloc:  ["哥特",   "险峻"],

  hma:   ["古典",   "庄严"],
  dor5:  ["中东",   "神秘"],
  phr4:  ["中东",   "怪异"],
  lydb3: ["电影配乐", "华丽"],
  mixb2: ["中东",   "妖异"],
  lyda2: ["电影配乐", "离奇"],
  locb7: ["电影配乐", "阴森"],

  ionb2: ["古典",   "苦涩"],
  napoM: ["古典",   "柔软"],
  napoN: ["古典",   "古老"],

  wt0:   ["二十世纪", "漂浮"],
  wt1:   ["二十世纪", "漂浮"],
  aug1:  ["二十世纪", "迷离"],
  aug2:  ["二十世纪", "迷离"],
  dimWH: ["二十世纪", "诡谲"],
  dimHW: ["二十世纪", "诡谲"],

  penG:  ["中国",   "平和"],
  penS:  ["中国",   "质朴"],
  penJ:  ["中国",   "哀婉"],
  penZ:  ["中国",   "明亮"],
  penY:  ["中国",   "柔婉"],
  in:    ["日本",   "明朗"],
  hira:  ["日本",   "幽静"],
  iwato: ["日本",   "险峻"],
  hung:  ["吉普赛",  "悲怆"],
  hungM: ["吉普赛",  "华丽"],
  byz:   ["中东",   "庄严"],

  blues: ["布鲁斯",  "苦涩"],
  mblues:["布鲁斯",  "明快"],
  bop7:  ["爵士",   "摇摆"],
  bopM:  ["爵士",   "明快"],
  bopm:  ["爵士",   "摇曳"],
  bopd:  ["爵士",   "华丽"],

  mes3:  ["二十世纪", "闪烁"],
  mes4:  ["二十世纪", "庄严"],
  mes5:  ["二十世纪", "明亮"],
  mes6:  ["二十世纪", "流动"],
  mes7:  ["二十世纪", "摇曳"],
  chrom: ["二十世纪", "中性"]
};

MODES.forEach(m => {
  const sm = STYLE_MOOD[m.id] || ["", ""];
  m.style = sm[0];
  m.mood = sm[1];
  const seen = {};
  m.tags = (m.traits || []).concat(autoTraits(m)).filter(t => {
    if(seen[t]) return false;
    seen[t] = 1; return true;
  });
});

/* 亮度 = 相对同主音大调的变化音数（升为 +，降为 −）。
   七声：第 i 个音与大调第 i 级的差，逐级相加 —— 和界面上标的 #4 / b7 同口径。
   非七声：按最近的 Ionian 级数取偏差；正好卡在正中间的（b2/b3/b5/b6/b7）按降号算，
   这样五声·宫 = 0、五声·角 = −3、Bebop 属 = −1，分别与自然大调、伊奥利亚、混合利底亚同分。 */
function brightScore(m){
  const n = m.pcs.length;
  if(n === 7) return m.pcs.reduce((s, p, i) => s + (p - IONIAN[i]), 0);
  let s = 0;
  for(const p of m.pcs){
    if(p === 0 || IONIAN.indexOf(p) >= 0) continue;
    const up = IONIAN.find(v => v > p);
    const dn = IONIAN.slice().reverse().find(v => v < p);
    const dUp = up === undefined ? 99 : up - p;
    const dDn = dn === undefined ? 99 : p - dn;
    if(dUp === 1 && dDn === 1) s -= 1;       // 正中：按降
    else if(dUp === 1) s += 1;               // 升
    else if(dDn === 1) s -= 1;               // 降
  }
  return s;
}
function brightRankAll(modes){
  modes.forEach(m => { m.bright = brightScore(m); });
  const order = modes.slice().sort((a, b) =>
    b.bright - a.bright
    || String(a.id).localeCompare(String(b.id)));
  order.forEach((m, i) => { m.rankN = i + 1; });
  return order;
}

// ── 中国五声：旋宫 + 偏音 ─────────────────────────────────────────
// 音高集合永远是「宫 商 角 徵 羽」这五个（相对宫的半音），旋宫只换主音；
// 偏音则是往上加第四个、第七个音（清角/变徵 二选一，闰/变宫 二选一）。
const PENTA_NAMES = ["宫","商","角","徵","羽"];
const PENTA_IDS   = ["penG","penS","penJ","penZ","penY"];
const PENTA_BASE  = [0,2,4,7,9];
const PENTA_BIAN  = { 5:"清角", 6:"变徵", 10:"闰", 11:"变宫" };

function pentaMode(base, opts){
  const o = opts || {};
  const rot = (((o.rot !== undefined ? o.rot : (base && base.pentRot) || 0) % 5) + 5) % 5;
  const tonic = PENTA_BASE[rot];
  const abs = PENTA_BASE.slice();
  if(o.b4) abs.push(o.b4);
  if(o.b7) abs.push(o.b7);
  const rows = abs.map(p => ({
    p,
    name: PENTA_NAMES[PENTA_BASE.indexOf(p)] || PENTA_BIAN[p] || "?",
    rel: ((p - tonic) % 12 + 12) % 12
  })).sort((a, b) => a.rel - b.rel);
  const extra = [];
  if(o.b4) extra.push(PENTA_BIAN[o.b4]);
  if(o.b7) extra.push(PENTA_BIAN[o.b7]);
  const out = Object.assign({}, base, {
    pcs: rows.map(r => r.rel),
    degNames: rows.map(r => r.name),
    cn: `五声 · ${PENTA_NAMES[rot]}调式` + (extra.length ? " · 加" + extra.join("") : ""),
    // 两侧都加时两个偏音都要写出来（旧写法 .map(...)[0] 只取到第一个）
    n: `Pentatonic — ${["Gong","Shang","Jue","Zhi","Yu"][rot]}`
      + (extra.length ? " + " + (o.b4 && o.b7 ? "BianZhi-BianGong" : (o.b4 ? "BianZhi" : "BianGong")) : "")
  });
  // 旋宫换了主音，色彩与自动标签要跟着重算
  out.colorKey = COLOR_KEY[scaleColor(out)];
  out.colorCn  = COLOR_CN[scaleColor(out)];
  out.tags = (out.traits || []).concat(autoTraits(out)).filter((t, i, a) => a.indexOf(t) === i);
  return out;
}

// 每个调式的音数（5 声、6 声、7 声、8 声、9 声、10 声）
function scaleSize(mode){ return mode.pcs.length; }

function isHeptatonic(mode){ return mode.pcs.length === 7; }

// 级数标签：七声用罗马数字（相对大调），其余用「阿拉伯数字」；五声另给宫商角徵羽
function degLabel(mode, i){
  if(mode.degNames && mode.degNames[i]) return mode.degNames[i];
  if(mode.pcs.length === 7){
    const d = mode.pcs[i] - IONIAN[i];
    return accStr(d) + ROMAN[i];
  }
  return String(i + 1);
}

// 七声才有「相对大调的亮度」这套说法；其余返回 null
function brightness(mode){
  if(mode.pcs.length !== 7) return {delta:null, marks:[]};
  let d = 0; const marks = [];
  for(let i=0;i<7;i++){
    const diff = mode.pcs[i] - IONIAN[i];
    if(diff !== 0){
      d += diff;
      marks.push(accStr(diff) + (i+1));
    }
  }
  return {delta:d, marks};
}

const BRIGHT_ORDER = brightRankAll(MODES);
