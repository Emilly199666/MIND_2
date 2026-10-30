/* ============================================================
   MIND · 脑海  —  数据层 (localStorage 持久化)
   ============================================================ */
(function () {
  const KEY = 'mind_brain_data_v1';
  const META_KEY = 'mind_brain_meta_v1';   // 记录 localStorage 最近保存时间，用于与后端比新旧

  /* ---------- 配色库：20 个色系（款式），每系 6~8 款 ----------
     灵感取自 2026 流行趋势（WGSN 转型青 / 潘通 Cloud Dancer /
     莫兰迪 / 马卡龙 / 多巴胺 / 克莱因蓝 / 香芋紫 / 焦糖棕 / 大地色 / 宝石色 …）
     每组 4 色：[主色, 辅色, 点缀色, 浅背景色] */
  const THEME_FAMILIES = [
    { id: 'ocean', name: '海洋蓝', themes: [
      { id: 'mist',        name: '雾蓝',     c: ['#5B8DEF', '#86A9F2', '#BBD0F7', '#EDF3FD'] },
      { id: 'ocean_deep',  name: '深海蓝',   c: ['#2E6BD6', '#4F8AE8', '#9CC0F5', '#E7F0FD'] },
      { id: 'ocean_ice',   name: '冰川蓝',   c: ['#7FB4E8', '#A6CCF0', '#CFE3F7', '#EEF6FD'] },
      { id: 'ocean_navy',  name: '靛蓝',     c: ['#3B5BA9', '#5E7AC8', '#A6BCE6', '#EAEEF8'] },
      { id: 'ocean_capri', name: '卡布里蓝', c: ['#1FA3E0', '#56BCEC', '#A6E0F5', '#E6F6FD'] },
      { id: 'ocean_teal',  name: '转型青',   c: ['#1FA39A', '#56C2BB', '#A6E2DD', '#E4F5F2'] },
      { id: 'ocean_peri',  name: '长春花',   c: ['#6B73D6', '#8E95E6', '#C0C4F2', '#ECEEFB'] },
      { id: 'ocean_sky',   name: '天空蓝',   c: ['#5BA7E0', '#8DC3ED', '#C2E0F6', '#EDF5FC'] },
    ] },
    { id: 'morandi', name: '莫兰迪', themes: [
      { id: 'morandi_haze',  name: '烟蓝', c: ['#7C93A8', '#9DAEBE', '#C7D2DC', '#EEF1F4'] },
      { id: 'morandi_mauve', name: '烟紫', c: ['#9A8FA3', '#B7AEC0', '#D8D1DE', '#F1EEF3'] },
      { id: 'morandi_sage',  name: '灰绿', c: ['#8FA391', '#AFC0B0', '#D2DDD2', '#EEF2EE'] },
      { id: 'morandi_rose',  name: '豆沙', c: ['#B08A8E', '#C8A9AC', '#E3CBCB', '#F4ECEC'] },
      { id: 'morandi_sand',  name: '灰杏', c: ['#B6A88E', '#CDBFA3', '#E5DAC6', '#F4EFE6'] },
      { id: 'morandi_clay',  name: '灰陶', c: ['#A98B82', '#C4A89E', '#E0CCC4', '#F2E9E5'] },
      { id: 'morandi_olive', name: '灰橄榄', c: ['#9A9A7A', '#B7B79B', '#D8D8C2', '#F1F1EA'] },
      { id: 'morandi_stone', name: '雾石灰', c: ['#9AA0A6', '#B7BCC1', '#D9DCDF', '#F0F2F3'] },
    ] },
    { id: 'macaron', name: '马卡龙', themes: [
      { id: 'macaron_pink',   name: '草莓粉', c: ['#F7A8C4', '#FBC6D8', '#FBE0EA', '#FEF4F8'] },
      { id: 'macaron_blue',   name: '婴儿蓝', c: ['#A6C8F0', '#C2DAF6', '#E0EDFB', '#F3F8FE'] },
      { id: 'macaron_mint',   name: '薄荷糖', c: ['#A6E0C4', '#C2EBD6', '#E0F6EC', '#F2FBF6'] },
      { id: 'macaron_lemon',  name: '奶油黄', c: ['#F4D98A', '#F8E4AC', '#FCF1D2', '#FDFAF0'] },
      { id: 'macaron_purple', name: '香芋紫', c: ['#C2A8E8', '#D6C2F0', '#EBDEF8', '#F6F0FD'] },
      { id: 'macaron_peach',  name: '蜜桃',   c: ['#F5B79A', '#F9CEB8', '#FCE3D6', '#FEF2EC'] },
      { id: 'macaron_green',  name: '抹茶',   c: ['#B8D98A', '#D0E6AC', '#E8F2D2', '#F6FBEC'] },
      { id: 'macaron_lilac',  name: '丁香',   c: ['#C8B0E0', '#DBC4EE', '#EEDCF6', '#F8F1FD'] },
    ] },
    { id: 'dopamine', name: '多巴胺', themes: [
      { id: 'dopamine_coral',  name: '珊瑚红', c: ['#FF6B6B', '#FF9494', '#FFB3B3', '#FFE9E9'] },
      { id: 'dopamine_sun',    name: '柠檬黄', c: ['#FFD23F', '#FFE07A', '#FFEFB0', '#FFF8E0'] },
      { id: 'dopamine_orange', name: '活力橙', c: ['#FF8C42', '#FFA566', '#FFC599', '#FFEFE2'] },
      { id: 'dopamine_pink',   name: '玫粉',   c: ['#FF5DA2', '#FF86BC', '#FFAFD3', '#FFE5F0'] },
      { id: 'dopamine_blue',   name: '电光蓝', c: ['#3DA5FF', '#6FBEFF', '#A6D6FF', '#E9F4FF'] },
      { id: 'dopamine_green',  name: '青柠',   c: ['#6BD968', '#93E090', '#BBEFB8', '#ECFBEA'] },
      { id: 'dopamine_purple', name: '亮紫',   c: ['#9B5DE5', '#B582EC', '#D2B0F2', '#F2E9FB'] },
    ] },
    { id: 'cream', name: '奶油风', themes: [
      { id: 'cream_vanilla', name: '香草', c: ['#E9D9B8', '#F2E6CC', '#FAF2E0', '#FDF9F0'] },
      { id: 'cream_latte',   name: '拿铁', c: ['#D8C3A5', '#E6D6BD', '#F2E8D8', '#FBF6EE'] },
      { id: 'cream_milk',    name: '奶白', c: ['#EDE4D3', '#F4ECE0', '#FBF6EE', '#FDFBF6'] },
      { id: 'cream_butter',  name: '奶油黄', c: ['#F3E1A0', '#F8ECC0', '#FCF5DC', '#FDFBEE'] },
      { id: 'cream_sand',    name: '暖沙', c: ['#E3D2B5', '#EEE1C8', '#F7EFDE', '#FCF8F0'] },
      { id: 'cream_peach',   name: '杏奶', c: ['#F0D8C2', '#F6E4D2', '#FBF0E4', '#FDF7F1'] },
      { id: 'cream_rose',    name: '玫瑰奶', c: ['#EBD0CE', '#F2DEDC', '#F9ECEA', '#FDF6F5'] },
    ] },
    { id: 'taro', name: '芋泥紫', themes: [
      { id: 'taro_1',      name: '香芋',   c: ['#B79CE0', '#CDB8EC', '#E4D6F4', '#F4EEFB'] },
      { id: 'taro_lilac',  name: '淡丁香', c: ['#C9B3E6', '#DBCCF0', '#EEDDF7', '#F8F2FD'] },
      { id: 'taro_plum',   name: '梅紫',   c: ['#9B7BC4', '#B59AD4', '#D6C2EA', '#F1E9F8'] },
      { id: 'taro_violet', name: '紫罗兰', c: ['#8A6FD0', '#AC92E2', '#CBBBEF', '#EEE8F9'] },
      { id: 'taro_grape',  name: '葡萄',   c: ['#A77BC8', '#C09AD9', '#DDC0EC', '#F3E9F9'] },
      { id: 'taro_orchid', name: '兰紫',   c: ['#B58FD6', '#CDAEE4', '#E6D2F1', '#F5EEFB'] },
      { id: 'taro_peri',   name: '雾蓝紫', c: ['#9FA0E0', '#B9BAEC', '#D7D8F4', '#F0F0FB'] },
    ] },
    { id: 'klein', name: '克莱因蓝', themes: [
      { id: 'klein_1',        name: '克莱因', c: ['#2A4BDA', '#4F6EE6', '#97A9F2', '#E7EBFD'] },
      { id: 'klein_royal',    name: '宝蓝',   c: ['#2E5BD8', '#5A82E6', '#A0B6F0', '#E9EEFC'] },
      { id: 'klein_cobalt',   name: '钴蓝',   c: ['#1F4FD0', '#4B77E0', '#94AEF2', '#E7EEFD'] },
      { id: 'klein_indigo',   name: '靛青',   c: ['#34459C', '#5A6BC0', '#A0AEE0', '#EAEDF8'] },
      { id: 'klein_azure',    name: '蔚蓝',   c: ['#2C6FE0', '#5A92EC', '#A0C0F4', '#EAF2FD'] },
      { id: 'klein_electric', name: '电光',   c: ['#1E6FE8', '#57A0F2', '#A8D2FB', '#E9F4FE'] },
      { id: 'klein_midnight', name: '午夜',   c: ['#1F2E6E', '#3E4E96', '#8A98C8', '#E8EBF4'] },
    ] },
    { id: 'caramel', name: '焦糖棕', themes: [
      { id: 'caramel_1',      name: '焦糖',   c: ['#C98A4E', '#DCA878', '#ECCCA6', '#F8EFE2'] },
      { id: 'caramel_cocoa',  name: '可可',   c: ['#9C6B43', '#B88A62', '#D6B794', '#F2E9DE'] },
      { id: 'caramel_hazel',  name: '榛果',   c: ['#B5895A', '#CDA87E', '#E4CDA6', '#F6EEE2'] },
      { id: 'caramel_coffee', name: '咖啡',   c: ['#7A5238', '#9A7150', '#C2A081', '#EEE6DC'] },
      { id: 'caramel_amber',  name: '琥珀',   c: ['#D89A3C', '#E6B566', '#F2D29A', '#FBF1E0'] },
      { id: 'caramel_chest',  name: '栗棕',   c: ['#8C5A3C', '#A87C58', '#CBA587', '#F0E7DD'] },
      { id: 'caramel_toast',  name: '吐司',   c: ['#C9A26E', '#DCBB8E', '#ECD8BC', '#F8F1E6'] },
    ] },
    { id: 'forest', name: '森系', themes: [
      { id: 'forest_pine',   name: '松绿',   c: ['#3E8E6E', '#6BAA8E', '#A6CCB6', '#E6F2EC'] },
      { id: 'forest_moss',   name: '苔藓',   c: ['#6E8A4E', '#93AC74', '#BFCFAC', '#EEF3E6'] },
      { id: 'forest_olive',  name: '橄榄',   c: ['#7E8A4A', '#A1AC74', '#C9D2AC', '#F0F3E8'] },
      { id: 'forest_fern',   name: '蕨绿',   c: ['#4E9A6A', '#79B88E', '#AEDABC', '#E9F5EE'] },
      { id: 'forest_tea',    name: '茶绿',   c: ['#5E9A7E', '#84B69C', '#B6DCC8', '#EBF6F0'] },
      { id: 'forest_leaf',   name: '叶绿',   c: ['#4FA86A', '#7BC08E', '#AFD9BC', '#EAF6EE'] },
      { id: 'forest_sage',   name: '鼠尾草', c: ['#8AA38C', '#A9BDAA', '#CFDBCF', '#EEF4EE'] },
      { id: 'forest_matcha', name: '抹茶',   c: ['#7BA85E', '#9DC080', '#C7DCAE', '#EFF7E8'] },
    ] },
    { id: 'monet', name: '莫奈', themes: [
      { id: 'monet_water',    name: '睡莲蓝', c: ['#6FA8C8', '#97C2D8', '#C7DEEA', '#EEF5FA'] },
      { id: 'monet_lily',     name: '莲粉',   c: ['#D6A6C0', '#E4C0D2', '#F2DAE6', '#FAF0F5'] },
      { id: 'monet_mist',     name: '晨雾',   c: ['#9CC0C0', '#BBD6D6', '#DCEAEA', '#F1F7F7'] },
      { id: 'monet_dawn',     name: '破晓',   c: ['#C8B0A0', '#DAC4B6', '#ECDAD0', '#F8F1EC'] },
      { id: 'monet_garden',   name: '花园绿', c: ['#88B090', '#A9C8AF', '#CFE3D2', '#F0F7F2'] },
      { id: 'monet_sky',      name: '天青',   c: ['#84B4D4', '#A7CCE4', '#CFE6F2', '#EFF6FB'] },
      { id: 'monet_lavender', name: '薰衣草', c: ['#A8A8D0', '#C2C2E0', '#DCDCF0', '#F2F2FA'] },
    ] },
    { id: 'sakura', name: '樱花粉', themes: [
      { id: 'sakura_1',        name: '樱花粉', c: ['#F2AEC4', '#F7C8D8', '#FBE0E9', '#FDF2F6'] },
      { id: 'sakura_rose',     name: '玫瑰',   c: ['#E58AA8', '#EEAEC2', '#F6D2DE', '#FBEEF3'] },
      { id: 'sakura_blush',    name: '蜜桃粉', c: ['#F4B6C0', '#F8CCD2', '#FBE2E7', '#FDF3F5'] },
      { id: 'sakura_coral',    name: '珊瑚粉', c: ['#F08CA0', '#F5ADBB', '#FAD0D8', '#FCEEF1'] },
      { id: 'sakura_magenta',  name: '梅红',   c: ['#D96A93', '#E590AC', '#F2BAD0', '#F9E7EF'] },
      { id: 'sakura_peach',    name: '桃粉',   c: ['#F2B0A6', '#F7CBC2', '#FBE2DC', '#FDF4F1'] },
      { id: 'sakura_bubble',   name: '泡泡粉', c: ['#F6A8C8', '#FAC6DC', '#FCDDEB', '#FEF2F8'] },
    ] },
    { id: 'sunset', name: '日落橘', themes: [
      { id: 'sunset_1',         name: '日落',   c: ['#F08A4E', '#F5A872', '#FAD0AE', '#FDEDE2'] },
      { id: 'sunset_coral',     name: '珊瑚橘', c: ['#FF7A59', '#FF9A80', '#FFC2AE', '#FFEDE6'] },
      { id: 'sunset_tangerine', name: '橘黄',   c: ['#F59A3C', '#F8B566', '#FCD49A', '#FDF1E0'] },
      { id: 'sunset_ember',     name: '余烬',   c: ['#E2643C', '#EE8A66', '#F7BCA1', '#FCEDE6'] },
      { id: 'sunset_apricot',   name: '杏橙',   c: ['#F2A05C', '#F7BC82', '#FBD6AE', '#FCF2E6'] },
      { id: 'sunset_flame',     name: '火橙',   c: ['#FF6B3D', '#FF8C66', '#FFB499', '#FFE9E0'] },
      { id: 'sunset_peach',     name: '蜜桃橘', c: ['#F49A7A', '#F8B79E', '#FCD6C6', '#FDF1EC'] },
    ] },
    { id: 'mint', name: '薄荷绿', themes: [
      { id: 'mint_1',     name: '薄荷',   c: ['#6FC2A6', '#97D6C0', '#C2E9DB', '#ECF8F3'] },
      { id: 'mint_aqua',  name: '水蓝绿', c: ['#5FBBC0', '#8AD0D4', '#C0E6E8', '#EAF6F7'] },
      { id: 'mint_sea',   name: '海绿',   c: ['#4FB89E', '#7DCBB6', '#B2E0D2', '#E9F6F1'] },
      { id: 'mint_jade',  name: '玉绿',   c: ['#7BC2A2', '#A0D6BE', '#C9E9DA', '#EEF7F2'] },
      { id: 'mint_ice',   name: '冰薄荷', c: ['#A6DCC8', '#C2E6D6', '#E0F2EA', '#F2FBF6'] },
      { id: 'mint_spring',name: '春绿',   c: ['#8FD0A0', '#AFDCBE', '#D2EEDA', '#F1F9F4'] },
      { id: 'mint_teal',  name: '青薄荷', c: ['#5CC0B0', '#8AD2C6', '#BCE6DC', '#EAF7F3'] },
    ] },
    { id: 'retro', name: '复古', themes: [
      { id: 'retro_mustard', name: '芥末黄', c: ['#C9A23C', '#D9BE66', '#ECDBA0', '#F8F1DE'] },
      { id: 'retro_rust',    name: '铁锈红', c: ['#B5563C', '#C97C60', '#E0AB95', '#F4E7E0'] },
      { id: 'retro_teal',    name: '复古青', c: ['#3E8E8A', '#6BAAA6', '#A6CCC8', '#E6F4F2'] },
      { id: 'retro_plum',    name: '复古紫', c: ['#7E5B8A', '#9B7BA4', '#C6AED0', '#EFE7F3'] },
      { id: 'retro_olive',   name: '复古橄榄', c: ['#8A8A4E', '#A9A974', '#D0D0AC', '#F1F1E8'] },
      { id: 'retro_brick',   name: '砖红',   c: ['#A8543C', '#C27A60', '#DDAA95', '#F4E8E2'] },
      { id: 'retro_denim',   name: '牛仔蓝', c: ['#5A7CA8', '#82A0C0', '#B6CCDE', '#ECF2F8'] },
    ] },
    { id: 'grey', name: '高级灰', themes: [
      { id: 'grey_slate',   name: '石板',   c: ['#6E7A8A', '#93A0AE', '#C2CAD4', '#EDEFF2'] },
      { id: 'grey_silver',  name: '银灰',   c: ['#8A9098', '#AAB0B6', '#D4D7DB', '#F1F2F4'] },
      { id: 'grey_graphite',name: '石墨',   c: ['#5A606A', '#828893', '#B6BCC4', '#ECEEF1'] },
      { id: 'grey_mist',    name: '雾灰',   c: ['#9AA0A8', '#B7BCC2', '#D9DCDF', '#F1F2F4'] },
      { id: 'grey_pearl',   name: '珍珠灰', c: ['#A8ABB0', '#C5C7CB', '#E0E2E4', '#F5F6F7'] },
      { id: 'grey_steel',   name: '钢灰',   c: ['#7A838E', '#9DA6B0', '#C7CDD5', '#EEF1F4'] },
      { id: 'grey_cool',    name: '冷灰',   c: ['#828E9C', '#A3AEBB', '#CCD4DD', '#EFF2F6'] },
    ] },
    { id: 'berry', name: '莓果', themes: [
      { id: 'berry_1',        name: '莓果',   c: ['#B14A6A', '#C97A92', '#E2B2C0', '#F6E7EC'] },
      { id: 'berry_cranberry',name: '蔓越莓', c: ['#C23A4E', '#D56E7E', '#EBA6B0', '#F8E7EA'] },
      { id: 'berry_grape',    name: '葡萄紫', c: ['#8A4E9E', '#A878BC', '#CFB0DD', '#F1E7F5'] },
      { id: 'berry_plum',     name: '黑梅',   c: ['#7E3E6E', '#9C6A8E', '#C2A0BC', '#EFE4ED'] },
      { id: 'berry_raspberry',name: '树莓',   c: ['#D14A7A', '#E07AA0', '#F0AAC4', '#F9E5EE'] },
      { id: 'berry_wine',     name: '酒红',   c: ['#9E3A4C', '#BD6A78', '#DCA6AE', '#F4E7EA'] },
      { id: 'berry_cherry',   name: '樱桃',   c: ['#C23A5C', '#D66E84', '#EBACB8', '#F8E8EC'] },
    ] },
    { id: 'earth', name: '大地色', themes: [
      { id: 'earth_terra', name: '赤陶', c: ['#C46A4A', '#D68C70', '#EAB79F', '#F6E6DC'] },
      { id: 'earth_clay',  name: '陶土', c: ['#B5684A', '#C98C70', '#E0B29E', '#F3E6DD'] },
      { id: 'earth_sand',  name: '沙土', c: ['#C2A06A', '#D6BB8E', '#E9D8BC', '#F5EEE1'] },
      { id: 'earth_ochre', name: '赭石', c: ['#C29A4E', '#D6B878', '#EBD6A6', '#F8F1E2'] },
      { id: 'earth_bark',  name: '树皮', c: ['#8A6A4A', '#A88C6E', '#CBB49A', '#F0E9DE'] },
      { id: 'earth_stone', name: '石灰', c: ['#9A948A', '#B6B0A6', '#D7D3CC', '#F2F0EC'] },
      { id: 'earth_umber', name: '赭棕', c: ['#8C6A4E', '#A88C70', '#CBB298', '#F0E9DE'] },
    ] },
    { id: 'cyber', name: '赛博', themes: [
      { id: 'cyber_neon',    name: '霓虹蓝', c: ['#00D4FF', '#5AE3FF', '#A6F0FF', '#E6FBFF'] },
      { id: 'cyber_magenta', name: '霓虹粉', c: ['#FF2D9B', '#FF6BBB', '#FFA6D3', '#FFE9F4'] },
      { id: 'cyber_violet',  name: '霓虹紫', c: ['#9B5CFF', '#B98AFF', '#D7B6FF', '#F2EAFF'] },
      { id: 'cyber_green',   name: '电绿',   c: ['#2DFF9E', '#74FFBE', '#AFFFD9', '#E9FFEF'] },
      { id: 'cyber_acid',    name: '荧光绿', c: ['#C6FF2D', '#D9FF74', '#ECFFB6', '#F7FFE9'] },
      { id: 'cyber_cyan',    name: '青蓝',   c: ['#00E0D0', '#66EDE2', '#A6F4EE', '#E9FCFB'] },
      { id: 'cyber_pink',    name: '赛博粉', c: ['#FF3DAA', '#FF7BC3', '#FFB0DC', '#FFEAF5'] },
    ] },
    { id: 'jewel', name: '墨绿宝石', themes: [
      { id: 'jewel_emerald',  name: '祖母绿', c: ['#1E8A5E', '#4EAA7E', '#9AD0B6', '#E6F4EE'] },
      { id: 'jewel_sapphire', name: '宝蓝',   c: ['#1E5AA8', '#4E80C8', '#9AB8E6', '#E9F0FA'] },
      { id: 'jewel_amethyst', name: '紫晶',   c: ['#6E3E9E', '#8E6EBE', '#C0A2DE', '#EFE7F8'] },
      { id: 'jewel_ruby',     name: '宝石红', c: ['#A8284C', '#C85A78', '#E0A0B0', '#F6E7EC'] },
      { id: 'jewel_topaz',    name: '黄玉',   c: ['#C29A2E', '#D8B85E', '#EBD69E', '#F8F1DE'] },
      { id: 'jewel_garnet',   name: '石榴',   c: ['#8E2E4E', '#B05A74', '#D2A0AE', '#F2E7EC'] },
      { id: 'jewel_teal',     name: '宝石青', c: ['#1E8A8A', '#4EAAAA', '#9AD0D0', '#E6F4F4'] },
    ] },
    { id: 'oat', name: '燕麦米', themes: [
      { id: 'oat_1',      name: '燕麦', c: ['#D8C4A0', '#E6D6BC', '#F2E8D6', '#FAF5EC'] },
      { id: 'oat_beige',  name: '米色', c: ['#E0D2BC', '#ECE2D2', '#F6EFE2', '#FBF8F2'] },
      { id: 'oat_linen',  name: '亚麻', c: ['#DCCFB8', '#E9DECC', '#F4EDE0', '#FBF7F0'] },
      { id: 'oat_sand',   name: '暖米', c: ['#E2D0B2', '#EEE0CB', '#F7EFDF', '#FCF8F1'] },
      { id: 'oat_cream',  name: '奶米', c: ['#EDE4D2', '#F4EEDF', '#FAF5EA', '#FDFBF6'] },
      { id: 'oat_wheat',  name: '麦色', c: ['#D6BE90', '#E4D2AE', '#F1E4CC', '#FAF4E8'] },
      { id: 'oat_almond', name: '杏仁', c: ['#DCC6A4', '#E9D8BC', '#F4EAD6', '#FBF6EC'] },
    ] },
  ];

  const PALETTE = ['#FF2442','#00AEEC','#07C160','#FB7299','#FF8200','#9B8BC4','#2BC58C','#FFC300','#3B5998','#E1251B','#FF6600','#25F4EE','#C20C0C','#4EDA8C','#FF6B6B','#0084FF'];

  /* ---------- 默认数据 ---------- */
  function defaultData() {
    return {
      profile: { name: '我', avatar: '', signature: '记录每一步成长', career: { dirs: [], jobs: [] } },
      themeId: 'mist',
      fontPct: 50,   // 默认 50%，即当代电脑常用大小（实际缩放 = fontPct/50）
      themeScope: 'all',     // 主题应用范围：all / chrome / content
      mode: 'light',         // 日夜模式：light / dark
      sidebarCollapsed: false, // 左侧导航栏是否收起
      learning: {
        subjects: [
          { id: uid(), name: '数学', color: PALETTE[0] },
          { id: uid(), name: '英语', color: PALETTE[1] },
          { id: uid(), name: '编程', color: PALETTE[2] },
        ],
        daySubjects: {},   // 'YYYY-MM-DD': { subjectId: minutes }
        projects: [],      // 学习项目
      },
      skills: {
        items: [],         // 技能养成记录（项目）
        daySkills: {},     // 'YYYY-MM-DD': { skillId: minutes }
      },
      habits: { items: [] },   // {id,name,color,records:{'YYYY-MM-DD':true}}
      reviews: {},         // 周复盘：{ 'YYYY-MM-DD'(当周周一): { content, mood, updatedAt } }
      /* 周复盘：各指标的标准值（目标）。0 或空 = 不设目标、不判定 */
      reviewGoals: {
        learnAvgPerDay: 0,   // 平均每天学习小时
        learnWeek: 0,        // 每周学习总小时
        learnDays: 0,        // 每周学习打卡天数
        skillAvgPerDay: 0,   // 平均每天技能小时
        skillWeek: 0,        // 每周技能总小时
        skillDays: 0,        // 每周技能练习天数
        habitTotal: 0,       // 每周习惯完成总次数
        perHabit: {},        // { habitId: 每周天数 }
      },
      /* 周复盘快照：{ 'YYYY-MM-DD'(周一): { generatedAt, goals, days, metrics, items, verdict } }
         生成后固定保存，历史每周都可回看，不随源数据改动而变化 */
      reviewSnapshots: {},
      network: [],         // 人脉
      projects: [],        // 项目流程
      reminders: [],       // 已触发提醒记录（去重用）：[{key, projectId, date, title, firedAt}]
      reminder: { on: true, defaultLead: 1 }, // 提醒总开关 + 默认提前天数
      ideas: [],           // 想法（临时灵感 / 小事）：[{id,title,color,memo,createdAt,reminders:[...]}]
      sound: { id: 'chime', volume: 90, customUrl: '' }, // 提醒声音：预设id / 音量 / 自定义音频dataURL
      webhook: { url: '' }, // 可选第三方推送（企业微信机器人等 Webhook）
      customThemes: [],    // 用户自定义主题 [{id,name,c:[c1,c2,c3,c4]}]
      sync: { enabled: false, appId: '', appKey: '', serverUrl: '', objectId: '' }, // 云端同步（LeanCloud，个人自用）
    };
  }

  /* ---------- 持久化：localStorage(快缓存) + 本地服务器落盘(权威副本) ----------
     设计目标：永不再静默丢数据。
     · localStorage 作为即时缓存；本地服务器(data/mind_data.json)作为权威、耐久副本。
     · 本地服务器不可用时自动回退到纯 localStorage（不报错崩溃）。
     · 若 localStorage 也写不进去，则弹出醒目红色横幅警告，而不是悄悄只存内存。   */
  let mem = null;                 // localStorage 不可用时的临时内存（仅兜底展示）
  let backendOk = null;           // null=探测中, true/false
  let storageOk = true;           // localStorage 是否可写
  let lastSaved = null;           // 最近一次成功落盘时间戳
  let saveTimer = null;           // 落盘防抖定时器
  let warnedNoBackend = false;    // 是否已提示过"未连接服务器"

  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { storageOk = false; }
    return null;
  }

  /* 后端探测：仅当页面由本地服务器（server.js）提供时才存在 /api/ping */
  function probeBackend() {
    if (typeof fetch !== 'function') { backendOk = false; return Promise.resolve(false); }
    return fetch('/api/ping', { cache: 'no-store' })
      .then(r => { backendOk = r.ok; return r.ok; })
      .catch(() => { backendOk = false; return false; });
  }
  function fetchState() {
    return fetch('/api/state', { cache: 'no-store' })
      .then(r => { if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => (j && j.ok && j.data) ? { data: j.data, savedAt: j.savedAt || 0 } : null)
      .catch(() => null);
  }
  function pushState() {
    if (backendOk !== true) return Promise.resolve(false);
    const snapshot = JSON.stringify({ data: state, savedAt: Date.now() });
    return fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: snapshot })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { if (j && j.ok) { lastSaved = j.savedAt || Date.now(); updateStatusUI(); return true; } throw new Error((j && j.message) || 'unknown'); })
      .catch(e => { console.warn('[MIND] 后端落盘失败:', e.message); updateStatusUI(true); return false; });
  }
  function schedulePush() {
    if (backendOk !== true) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; pushState(); }, 400);
  }

  /* 启动：先同步用 localStorage 让 UI 立刻有数据；再异步以本地服务器副本为准 */
  const localState = loadLocal();
  const hadLocal = !!localState;
  const state = hadLocal ? localState : defaultData();

  if (!state.profile) Object.assign(state, defaultData());
  // 兼容老数据：补上 profile.career 字段（用户可编辑的就业方向/岗位）
  if (!state.profile.career) state.profile.career = { dirs: [], jobs: [] };
  // 新增字段归一化（兼容旧数据）
  normalize();

  /* 启动序列：探测后端 → 以"较新的一方"为准，避免任一副本的改动被旧副本覆盖 */
  function boot() {
    probeBackend().then(ok => {
      if (!ok) { updateStatusUI(); return; }   // 无后端：维持 localStorage
      return fetchState().then(remote => {
        if (!remote) {
          // 后端尚无数据：若本地有真实数据，立即推到磁盘完成迁移
          if (hadLocal) pushState();
          return;
        }
        // 后端有数据：比较双方保存时间，取较新者，避免短暂离线期间的本地改动被旧后端覆盖
        let localSavedAt = 0;
        try { localSavedAt = parseInt(localStorage.getItem(META_KEY) || '0', 10) || 0; } catch (e) {}
        const remoteSavedAt = remote.savedAt || 0;
        if (hadLocal && localSavedAt && localSavedAt > remoteSavedAt) {
          // 本地更新 → 用本地覆盖后端
          pushState();
          return;
        }
        // 后端更新或无法判断 → 以后端为准（权威副本），保留本地云端同步配置
        const keepSync = state.sync;
        Object.keys(state).forEach(k => delete state[k]);
        Object.assign(state, remote.data);
        state.sync = keepSync;
        normalize();
        document.dispatchEvent(new Event('store-loaded'));
        updateStatusUI();
      });
    });
  }

  /* 保存状态横幅：后端不可用时温和提示；localStorage 也失败时红色紧急横幅 */
  function ensureBanner() {
    let b = document.getElementById('mind-save-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'mind-save-banner';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:10px 16px;font-size:13px;line-height:1.4;color:#fff;background:#c9821f;box-shadow:0 -2px 10px rgba(0,0,0,.25);display:none;';
      (document.body || document.documentElement).appendChild(b);
    }
    return b;
  }
  function updateStatusUI(forceWarn) {
    const b = ensureBanner();
    if (backendOk === true) { b.style.display = 'none'; return; }   // 已落盘，安全
    if (storageOk && !forceWarn) {
      if (warnedNoBackend) return;
      warnedNoBackend = true;
      b.textContent = '⚠️ 未连接本地服务器：数据仅存于当前浏览器（换端口/清缓存会丢）。建议用 node server.js 打开以永久保存到本地文件。';
      b.style.background = '#c9821f';
      b.style.display = 'block';
      setTimeout(() => { b.style.display = 'none'; }, 9000);
      return;
    }
    b.textContent = '⚠️ 数据无法保存到任何位置！请改用 node server.js 打开本应用，避免丢失。';
    b.style.background = '#e1251b';
    b.style.display = 'block';
  }

  function save() {
    // 1) localStorage 即时缓存（不再静默回退内存）
    try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(META_KEY, String(Date.now())); storageOk = true; }
    catch (e) { storageOk = false; }
    // 2) 本地服务器权威副本（防抖批量写入）
    schedulePush();
    updateStatusUI();
  }

  /* ---------- 数据归一化 & 云端同步（LeanCloud） ---------- */
  function normalize() {
    if (!state.sync || typeof state.sync !== 'object') state.sync = { enabled: false, appId: '', appKey: '', serverUrl: '', objectId: '' };
    if (!Array.isArray(state.ideas)) state.ideas = [];
    if (!state.reviews || typeof state.reviews !== 'object') state.reviews = {};
    if (!state.reviewSnapshots || typeof state.reviewSnapshots !== 'object') state.reviewSnapshots = {};
    if (!state.reviewGoals || typeof state.reviewGoals !== 'object') state.reviewGoals = defaultData().reviewGoals;
    {
      const g = state.reviewGoals;
      ['learnAvgPerDay', 'learnWeek', 'learnDays', 'skillAvgPerDay', 'skillWeek', 'skillDays', 'habitTotal']
        .forEach(k => { if (typeof g[k] !== 'number') g[k] = 0; });
      if (!g.perHabit || typeof g.perHabit !== 'object') g.perHabit = {};
    }
    if (!state.sound || typeof state.sound !== 'object') state.sound = { id: 'chime', volume: 90, customUrl: '' };
    if (!state.webhook || typeof state.webhook !== 'object') state.webhook = { url: '' };
    if (typeof state.themeScope !== 'string') state.themeScope = 'all';
    if (typeof state.sidebarCollapsed !== 'boolean') state.sidebarCollapsed = false;
    if (state.mode !== 'light' && state.mode !== 'dark') state.mode = 'light';
    if (state.skills && Array.isArray(state.skills.items)) state.skills.items.forEach(s => {
      if (typeof s.mastery !== 'number') s.mastery = 0;
      if (!Array.isArray(s.masteryHistory)) s.masteryHistory = [];
    });
    (state.projects || []).forEach(p => (p.skills || []).forEach(sk => { if (!Array.isArray(sk.history)) sk.history = []; }));
  }

  let avInited = false;
  function lcInit() {
    const s = state.sync;
    if (!s || !s.enabled || !s.appId || !s.appKey) return false;
    if (typeof AV === 'undefined' || !AV || !AV.init) return false;
    try { if (s.serverUrl && AV.setServerURLs) AV.setServerURLs(s.serverUrl); } catch (e) {}
    if (!avInited) { try { AV.init({ appId: s.appId, appKey: s.appKey }); avInited = true; } catch (e) { console.warn('AV init failed', e); return false; } }
    return true;
  }
  function pushCloud() {
    const s = state.sync;
    if (!s || !s.enabled) return;
    if (!lcInit()) return;
    try {
      let obj;
      if (s.objectId) {
        obj = AV.Object.createWithoutData('MindState', s.objectId);
      } else {
        obj = new AV.Object('MindState');
        const acl = new AV.ACL(); acl.setPublicReadAccess(true); acl.setPublicWriteAccess(true); obj.setACL(acl);
      }
      obj.set('payload', JSON.stringify(state));
      obj.save().then(res => {
        const id = (res && res.id) || obj.id;
        if (id && id !== s.objectId) { s.objectId = id; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
      }).catch(e => console.warn('cloud push failed', e));
    } catch (e) { console.warn('cloud push error', e); }
  }
  function pullCloud(cb) {
    const s = state.sync;
    if (!s || !s.enabled || !s.objectId) { if (cb) cb(false); return; }
    if (!lcInit()) { if (cb) cb(false); return; }
    try {
      const q = new AV.Query('MindState');
      q.get(s.objectId).then(o => {
        const raw = o && o.get && o.get('payload');
        if (raw) {
          const data = JSON.parse(raw);
          const keepSync = state.sync;
          Object.keys(state).forEach(k => delete state[k]);
          Object.assign(state, data);
          state.sync = keepSync;
          normalize();
          document.dispatchEvent(new Event('store-synced'));
          if (cb) cb(true);
        } else if (cb) cb(false);
      }).catch(e => { console.warn('cloud pull failed', e); if (cb) cb(false); });
    } catch (e) { console.warn('cloud pull error', e); if (cb) cb(false); }
  }
  /* ---------- 工具 ---------- */
  function uid() { return 'id_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
  /* 根据背景色亮度自动选黑/白文字，保证配色可读养眼 */
  function pickText(hex) {
    try {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return L > 0.6 ? '#1f2430' : '#ffffff';
    } catch (e) { return '#ffffff'; }
  }
  function todayStr() { return fmtDate(new Date()); }
  function fmtDate(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

  /* ---------- 公共 API ---------- */
  const Store = {
    THEME_FAMILIES, THEMES: THEME_FAMILIES, PALETTE,
    get: () => state,
    save,
    uid, todayStr, fmtDate, parseDate, pickText,
    /* 全部可选主题（内置扁平化 + 自定义），每项带 family / familyName */
    getThemes() {
      const builtin = [];
      THEME_FAMILIES.forEach(f => f.themes.forEach(t => builtin.push(Object.assign({}, t, { family: f.id, familyName: f.name }))));
      return builtin.concat(state.customThemes || []);
    },
    getFamilies() { return THEME_FAMILIES; },
    addCustomTheme(theme) { (state.customThemes = state.customThemes || []).push(theme); save(); },
    removeCustomTheme(id) { state.customThemes = (state.customThemes || []).filter(t => t.id !== id); save(); },
    /* 应用主题与字号 */
    applyTheme() {
      const t = this.getThemes().find(x => x.id === state.themeId) || THEME_FAMILIES[0].themes[0];
      const root = document.documentElement.style;
      root.setProperty('--c1', t.c[0]);
      root.setProperty('--c2', t.c[1]);
      root.setProperty('--c3', t.c[3]); // 最浅色作为浅背景 / 顶栏侧栏底色
      root.setProperty('--c4', t.c[2]); // 点缀色
      root.setProperty('--on-c1', pickText(t.c[0])); // 主色之上的文字色
      root.setProperty('--on-c2', pickText(t.c[1])); // 辅色之上的文字色
      root.setProperty('--font-scale', String((state.fontPct || 50) / 50));
      // 日夜模式：在 body 上挂 class，由 CSS 变量切换整体明暗
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('mode-dark', state.mode === 'dark');
      }
    },
    /* 通用增删改辅助 */
    addItem(arr, obj) { arr.push(obj); save(); return obj; },
    removeItem(arr, id) { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); save(); },
    /* 数据备份 / 恢复 / 清空（原地修改 state，保持引用有效） */
    exportData() { return JSON.parse(JSON.stringify(state)); },
    importData(obj) {
      if (!obj || typeof obj !== 'object') throw new Error('文件格式不正确');
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, defaultData(), obj);
      state.customThemes = Array.isArray(obj.customThemes) ? obj.customThemes : [];
      if (!state.themeId) state.themeId = 'mist';
      mem = null; save();
    },
    resetData() {
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, defaultData());
      mem = null; save();
    },
    /* 云端同步控制（LeanCloud，个人自用） */
    reinitSync() { avInited = false; return lcInit(); },
    syncNow() { return new Promise(res => { pullCloud(r => res(!!r)); }); },
    pushNow() { pushCloud(); },
    getSync() { return state.sync; },

    /* ---------- 本地持久化状态 / 迁移 / 备份 ---------- */
    /* 返回当前保存状态：后端是否可用、localStorage 是否可写、最近落盘时间 */
    getStatus() { return { backend: backendOk === true, storage: storageOk, lastSaved }; },
    /* 立即把当前（浏览器里的）数据写入本地磁盘文件（迁移用） */
    migrateToDisk() {
      return probeBackend().then(ok => { if (!ok) return false; return pushState().then(r => r); });
    },
    /* 立即强制落盘一次（不等防抖） */
    saveNow() { return pushState(); },
    /* 列出本地磁盘上的可用备份 */
    getBackups() {
      if (backendOk !== true) return Promise.resolve({ ok: false, message: '未连接本地服务器' });
      return fetch('/api/backups', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false }));
    },
    /* 回滚到某一份历史备份（name 形如 mind_data-20261030xxxxxx.json） */
    restoreBackup(name) {
      if (backendOk !== true) return Promise.resolve({ ok: false, message: '未连接本地服务器' });
      return fetch('/api/restore/' + encodeURIComponent(name), { method: 'POST' })
        .then(r => r.json()).then(j => {
          if (j && j.ok) { /* 重新拉取并刷新内存 */ return fetchState().then(remote => { if (remote) { const ks = state.sync; Object.keys(state).forEach(k => delete state[k]); Object.assign(state, remote.data); state.sync = ks; normalize(); document.dispatchEvent(new Event('store-loaded')); } return j; }); }
          return j;
        }).catch(() => ({ ok: false }));
    },

    /* 自动把未掌握技能加入技能养成记录 */
    ensureSkillRecord(skillName) {
      const s = state.skills.items;
      let found = s.find(x => x.name === skillName);
      if (!found) {
        found = { id: uid(), name: skillName, color: PALETTE[s.length % PALETTE.length],
                  records: {}, notes: '', dailyDetail: {} };
        s.push(found); save();
      }
      return found;
    },
  };

  // 启动：探测本地服务器并做数据迁移/对齐（异步，不阻塞首屏渲染）
  boot();

  window.Store = Store;
})();
