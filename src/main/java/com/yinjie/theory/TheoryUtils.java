package com.yinjie.theory;

import com.yinjie.dto.FretboardDtos.ScaleNote;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 乐理拼写与命名的公共逻辑：音阶音名拼写、和弦音角色名、转位名。
 */
public final class TheoryUtils {

    private static final Map<String, String> ROLE_NAMES = Map.ofEntries(
            Map.entry("1", "根音"),
            Map.entry("b2", "小二音"),
            Map.entry("2", "大二音"),
            Map.entry("b3", "小三音"),
            Map.entry("3", "大三音"),
            Map.entry("4", "纯四音"),
            Map.entry("#4", "增四音"),
            Map.entry("5", "纯五音"),
            Map.entry("b5", "减五音"),
            Map.entry("#5", "增五音"),
            Map.entry("6", "大六音"),
            Map.entry("b6", "小六音"),
            Map.entry("7", "大七音"),
            Map.entry("b7", "小七音"),
            Map.entry("bb7", "减七音"),
            Map.entry("9", "大九音"),
            Map.entry("b9", "小九音"),
            Map.entry("#9", "增九音"),
            Map.entry("11", "纯十一音"),
            Map.entry("#11", "增十一音"),
            Map.entry("13", "大十三音")
    );

    private TheoryUtils() {
    }

    /**
     * 按音阶公式拼写音阶内的音名（保证字母距离正确，F 大调得到 Bb、F# 大调得到 E#）。
     */
    public static List<ScaleNote> scaleNotes(ScaleType scale, String rootName) {
        Notes.Spelled root = Notes.parse(rootName);
        List<ScaleNote> notes = new ArrayList<>();
        for (int i = 0; i < scale.intervals().size(); i++) {
            int interval = scale.intervals().get(i);
            String degreeLabel = scale.formula().get(i);
            int degree = ScaleType.degreeNumber(degreeLabel);
            int letter = Math.floorMod(root.letterIndex() + degree - 1, 7);
            int pitchClass = Math.floorMod(root.pitchClass() + interval, 12);
            notes.add(new ScaleNote(
                    Notes.spell(pitchClass, letter),
                    pitchClass,
                    degree,
                    degreeLabel,
                    Notes.intervalName(interval)
            ));
        }
        return notes;
    }

    /** 根据根音拼写与请求偏好，决定升降号使用策略：sharp / flat / mixed。 */
    public static String accidentalPreference(String rootName, String requested) {
        if ("sharp".equalsIgnoreCase(requested)) {
            return "sharp";
        }
        if ("flat".equalsIgnoreCase(requested)) {
            return "flat";
        }
        if (rootName != null) {
            if (rootName.contains("b")) {
                return "flat";
            }
            if (rootName.contains("#")) {
                return "sharp";
            }
        }
        return "mixed";
    }

    public static String roleName(String degreeLabel) {
        return ROLE_NAMES.getOrDefault(degreeLabel, degreeLabel + "音");
    }

    public static String inversionName(String degreeLabel) {
        return switch (degreeLabel) {
            case "1" -> "原位";
            case "3", "b3" -> "第一转位（三音在低音）";
            case "5", "b5", "#5" -> "第二转位（五音在低音）";
            case "7", "b7", "bb7" -> "第三转位（七音在低音）";
            case "9", "b9", "#9" -> "转位（九音在低音）";
            case "6" -> "转位（六音在低音）";
            case "2" -> "转位（二音在低音）";
            case "4", "#4" -> "转位（四音在低音）";
            default -> "转位";
        };
    }
}
