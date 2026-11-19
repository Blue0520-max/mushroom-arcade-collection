# 素材与制作记录

## 精灵与字体

马里奥、栗宝宝、绿龟、库克、金币、龟壳与砖块主要来自所给素材中 `resources/graphics/` 下的 `mario_bros.png`、`smb_enemies_sheet.png`、`item_objects.png` 和 `tile_set.png`。新版裁取小马里奥、蹲姿、攀藤与滑旗动作、火焰形态、食人花、火焰花与火球动画，并为积分星和无敌星制作可辨认的蓝色与虹彩配色。部分道具来自提供的爱给网图片，西文字体使用随包的 `Fixedsys500c.ttf`。

## 音乐与音效

| 游戏场景 | 用户素材库中的文件 |
| --- | --- |
| 草甸、云顶 | `resources/music/main_theme.ogg`，带有 Main Theme & Overworld 与 Koji Kondo 标签。地上关卡时间紧迫时切换至 `main_theme_sped_up.ogg`。 |
| 地下、密室 | `DM_20261118190011_025.mp3` 中约 2.712 至 15.309 秒的地下主题循环，保留原录音的 11025 Hz 立体声。 |
| 城堡、库克 | `DM_20261118190011_036.mp3` 中约 0.050 至 8.037 秒的一轮城堡主题。与所给 TAS 视频约 4:13 开始的 8-4 旋律做过比对。 |
| 无敌星 | `resources/music/invincible.ogg`，带 Starman 标签。无敌时间结束后恢复当前场景曲。 |
| 触旗、过关、时间提示、死亡 | `resources/music/` 中的 `flagpole.wav`、`stage_clear.wav`、`world_clear.wav`、`out_of_time.wav`、`death.wav`。 |
| 动作 | 跳跃、顶砖、踩踏、火球、出管、金币等音效，以及余时折分时的短音（`count_down.ogg`）来自 `resources/sound/`。 |

游戏使用素材库录音。TAS 视频用于对照画面和辨认乐句。角色、名称和原作音画属于各自权利人，随包文件未附这些第三方素材的公开再发布授权。

## 场景插画

五张环境图由内置 ImageGen 生成，导出为 WebP，位于 `assets/art/`。封面上的马里奥、金币和问号砖使用游戏的透明精灵，中文标题和按钮由网页单独排版。

### 封面

`assets/art/cover.webp`

> Use case: illustration-story. Asset type: continuous extra-wide panorama, an original 16-bit fantasy overworld map for a retro platform arcade website. Bright, joyful, premium handcrafted SNES pixel art with chunky clearly visible square pixels, dark teal pixel outlines, clean readable clusters and inviting details. An isometric landscape seen from a hillside: cobalt-blue and turquoise sky with big sculpted cream clouds above a vivid emerald kingdom, sloping gold-ochre cliffs with emerald grassy tops, a winding blue river and two tiny waterfalls and timber bridges, red and cream mushroom houses, rounded green striped mountains, forests and tiny orange flowers, with a distant ivory fairytale castle with crimson pennants on the far RIGHT horizon. Composition: very wide 2.8:1 edge-to-edge landscape header, left half calm shadowed teal hills with space in upper left for interface typography, right half sunlit and richly illustrated. Right-middle around 70% is open sky above a grassy ledge, reserved for a separately drawn game sprite. Emphasize crisp pixel geometry, a well composed game world, warm sunlight, uplifting and saturated. Blank artwork only, with no characters, text, logos, signs, borders, or UI.

### 青葱草甸

`assets/art/meadow.webp`

> Use case: illustration-story. Asset type: game website artwork. A side-view parallax background plate for a lush 16-bit Mario-inspired platform adventure, panoramic landscape 16:9 or wider. Crisp carefully placed square pixel clusters, clean rich cohesive SNES environmental pixel art. Sunlit rolling mint/teal rounded striped hills; a red-spotted giant mushroom and little daisies on the lower right; a green pipe nestled in grass on the left edge, softly colored forest silhouettes, tiny red-roofed castle in the far distance. Turquoise blue sky with ivory puffy pixel clouds occupies upper half. Atmospheric layering, vivid forest greens at bottom, restrained warm golden accents. Compose as a game world postcard and scrollable background behind gameplay. No main character or enemies, no floating collectibles, NO text, no graphic border, no lettering, no UI. Entire image is one landscape.

### 辉光晶洞

`assets/art/cavern.webp`

> Use case: illustration-story. Asset type: game website artwork. A magnificent wide side-view 16-bit arcade platform game parallax background plate for a gemstone cavern, panorama 16:9 or wider. Deep indigo and violet silhouette rock arch going around the top and far sides, bioluminescent cyan and lavender faceted crystal clusters on ledges at lower left and right, a small glowing blue lake and waterfall in the middle distance, layers of dark turquoise rock and purple stalactites. Readable bright shapes, rich purple tones, a few pink gem points, clean crisp square pixel clusters, handcrafted premium SNES environment art, striking and magical, beautifully composed as a level-select postcard. Fixed side-on camera with a lot of clear central midground for gameplay. No characters, no enemies, no collectibles, no text, no border, no UI.

### 云顶风车

`assets/art/sky.webp`

> Use case: illustration-story. Asset type: game website artwork. A beautiful wide 16-bit side-on parallax game background for a floating windmill archipelago among glowing sunset clouds. Panorama 16:9 or wider. Warm peach apricot sky fading into soft lilac, cream-gold cloudbanks, patches of light cyan on shaded clouds, two floating rocky grass islands, a charming full dark-wood windmill with four cream sails on right island and a tiny distant windmill, thin trailing vegetation beneath cliffs; airy view with vivid warm sunset silhouette. Handmade SNES-style crisp and legible pixel clusters, subtle detailed dithering, premium classic platform game world-select postcard art, composition has open midground. No Mario or characters, no coins, no UI, no text, no border.

### 熔岩城堡

`assets/art/castle.webp`

> Use case: illustration-story. Asset type: game website artwork. A dramatic wide side-view parallax game background plate for the final lava castle of a Super Mario-style adventure. Panorama 16:9 or wider. Monumental nearly black purple basalt keep on the right half with glowing orange windows, towers and banners, brick arches and a broken bridge stretching from the left. An orange-red lava river winding through volcanic foothills, fiery peach horizon, ember pixels, layered aubergine mountains. Bold warm crimson, obsidian and molten gold. Hand-placed 16-bit SNES environmental pixel art, big clean pixel clusters, clear silhouettes and atmospheric layers, beautiful level-select postcard still. Open central midground for gameplay, no characters, no enemies, no text, UI or border.
