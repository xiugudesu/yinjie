package com.yinjie.theory;

import java.util.List;

/**
 * 内置音阶 / 调式目录。所有音阶都相对根音定义，级数标签用于拼写音名。
 */
public final class ScaleCatalog {

    private static final List<ScaleType> SCALES = List.of(
            // ---- 基础音阶 ----
            new ScaleType("major", "自然大调（Ionian）", "Ionian / Major", "基础音阶",
                    List.of(0, 2, 4, 5, 7, 9, 11),
                    List.of("1", "2", "3", "4", "5", "6", "7")),
            new ScaleType("natural-minor", "自然小调（Aeolian）", "Aeolian / Natural Minor", "基础音阶",
                    List.of(0, 2, 3, 5, 7, 8, 10),
                    List.of("1", "2", "b3", "4", "5", "b6", "b7")),
            new ScaleType("harmonic-minor", "和声小调", "Harmonic Minor", "基础音阶",
                    List.of(0, 2, 3, 5, 7, 8, 11),
                    List.of("1", "2", "b3", "4", "5", "b6", "7")),
            new ScaleType("melodic-minor", "旋律小调（上行）", "Melodic Minor Ascending", "基础音阶",
                    List.of(0, 2, 3, 5, 7, 9, 11),
                    List.of("1", "2", "b3", "4", "5", "6", "7")),
            new ScaleType("harmonic-major", "和声大调", "Harmonic Major", "基础音阶",
                    List.of(0, 2, 4, 5, 7, 8, 11),
                    List.of("1", "2", "3", "4", "5", "b6", "7")),

            // ---- 教会调式 ----
            new ScaleType("ionian", "伊奥尼亚调式（Ionian）", "Ionian", "教会调式",
                    List.of(0, 2, 4, 5, 7, 9, 11),
                    List.of("1", "2", "3", "4", "5", "6", "7")),
            new ScaleType("dorian", "多利亚调式（Dorian）", "Dorian", "教会调式",
                    List.of(0, 2, 3, 5, 7, 9, 10),
                    List.of("1", "2", "b3", "4", "5", "6", "b7")),
            new ScaleType("phrygian", "弗里吉亚调式（Phrygian）", "Phrygian", "教会调式",
                    List.of(0, 1, 3, 5, 7, 8, 10),
                    List.of("1", "b2", "b3", "4", "5", "b6", "b7")),
            new ScaleType("lydian", "利底亚调式（Lydian）", "Lydian", "教会调式",
                    List.of(0, 2, 4, 6, 7, 9, 11),
                    List.of("1", "2", "3", "#4", "5", "6", "7")),
            new ScaleType("mixolydian", "混合利底亚调式（Mixolydian）", "Mixolydian", "教会调式",
                    List.of(0, 2, 4, 5, 7, 9, 10),
                    List.of("1", "2", "3", "4", "5", "6", "b7")),
            new ScaleType("aeolian", "爱奥尼亚调式（Aeolian）", "Aeolian", "教会调式",
                    List.of(0, 2, 3, 5, 7, 8, 10),
                    List.of("1", "2", "b3", "4", "5", "b6", "b7")),
            new ScaleType("locrian", "洛克里亚调式（Locrian）", "Locrian", "教会调式",
                    List.of(0, 1, 3, 5, 6, 8, 10),
                    List.of("1", "b2", "b3", "4", "b5", "b6", "b7")),

            // ---- 五声与布鲁斯 ----
            new ScaleType("major-pentatonic", "大调五声音阶", "Major Pentatonic", "五声与布鲁斯",
                    List.of(0, 2, 4, 7, 9),
                    List.of("1", "2", "3", "5", "6")),
            new ScaleType("minor-pentatonic", "小调五声音阶", "Minor Pentatonic", "五声与布鲁斯",
                    List.of(0, 3, 5, 7, 10),
                    List.of("1", "b3", "4", "5", "b7")),
            new ScaleType("blues", "小调布鲁斯音阶", "Blues Scale", "五声与布鲁斯",
                    List.of(0, 3, 5, 6, 7, 10),
                    List.of("1", "b3", "4", "#4", "5", "b7")),
            new ScaleType("major-blues", "大调布鲁斯音阶", "Major Blues", "五声与布鲁斯",
                    List.of(0, 2, 3, 4, 7, 9),
                    List.of("1", "2", "b3", "3", "5", "6")),

            // ---- 对称 / 特殊音阶 ----
            new ScaleType("whole-tone", "全音阶", "Whole Tone", "特殊音阶",
                    List.of(0, 2, 4, 6, 8, 10),
                    List.of("1", "2", "3", "#4", "#5", "#6"))
    );

    private ScaleCatalog() {
    }

    public static List<ScaleType> all() {
        return SCALES;
    }

    public static ScaleType byId(String id) {
        return SCALES.stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
    }

    public static ScaleType require(String id) {
        ScaleType scale = byId(id);
        if (scale == null) {
            throw new IllegalArgumentException("未知的音阶类型: " + id);
        }
        return scale;
    }

    /** 默认音阶（自然大调）。 */
    public static ScaleType defaultScale() {
        return SCALES.get(0);
    }
}
